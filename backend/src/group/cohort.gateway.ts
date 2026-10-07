import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer, WebSocket } from 'ws';
import * as url from 'url';

interface CohortWebSocket extends WebSocket {
  groupId?: string;
  userId?: string;
  username?: string;
  isAlive?: boolean;
}

@Injectable()
export class CohortWsGateway
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CohortWsGateway.name);
  private wss: WebSocketServer | null = null;
  private rooms = new Map<string, Set<CohortWebSocket>>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onApplicationBootstrap() {
    try {
      const server = this.httpAdapterHost.httpAdapter.getHttpServer();
      if (!server) {
        this.logger.warn('HTTP server not available for Cohort WebSocket upgrade');
        return;
      }

      this.wss = new WebSocketServer({ noServer: true });

      server.on('upgrade', (request: any, socket: any, head: any) => {
        try {
          const parsed = url.parse(request.url || '', true);
          const pathname = parsed.pathname || '';

          if (pathname === '/ws/cohorts' || pathname.startsWith('/ws/cohorts/')) {
            this.wss?.handleUpgrade(request, socket, head, (ws) => {
              this.wss?.emit('connection', ws, request);
            });
          }
        } catch (err) {
          this.logger.error('Error handling WebSocket upgrade:', err);
          socket.destroy();
        }
      });

      this.wss.on('connection', (ws: CohortWebSocket, request: any) => {
        const parsed = url.parse(request.url || '', true);
        const query = parsed.query || {};
        const groupId = (query.groupId as string) || '';
        const userId = (query.userId as string) || '';
        const username = (query.username as string) || 'Cadet';

        ws.groupId = groupId;
        ws.userId = userId;
        ws.username = username;
        ws.isAlive = true;

        if (groupId) {
          this.addToRoom(groupId, ws);
        }

        this.logger.log(
          `[WS] Cadet connected: ${username} (${userId}) to cohort ${groupId}. Active in room: ${this.getRoomActiveCount(groupId)}`,
        );

        // Acknowledge connection
        this.safeSend(ws, {
          type: 'CONNECTED',
          groupId,
          activeCount: this.getRoomActiveCount(groupId),
          timestamp: new Date().toISOString(),
        });

        this.broadcastPresence(groupId);

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (data: any) => {
          try {
            const parsedData = JSON.parse(data.toString());
            this.handleClientMessage(ws, parsedData);
          } catch (e) {
            // invalid json, ignore
          }
        });

        ws.on('close', () => {
          if (ws.groupId) {
            this.removeFromRoom(ws.groupId, ws);
            this.broadcastPresence(ws.groupId);
          }
        });

        ws.on('error', (err) => {
          this.logger.warn(`[WS Error] ${err.message}`);
        });
      });

      // Keepalive heartbeat every 30 seconds
      this.heartbeatInterval = setInterval(() => {
        if (!this.wss) return;
        this.wss.clients.forEach((client: any) => {
          const ws = client as CohortWebSocket;
          if (ws.isAlive === false) {
            if (ws.groupId) this.removeFromRoom(ws.groupId, ws);
            return ws.terminate();
          }
          ws.isAlive = false;
          ws.ping();
        });
      }, 30000);

      this.logger.log('Cohort WebSocket Gateway initialized on path: /ws/cohorts');
    } catch (err: any) {
      this.logger.error('Failed to initialize Cohort WebSocket Gateway', err);
    }
  }

  onApplicationShutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }

  private handleClientMessage(ws: CohortWebSocket, payload: any) {
    if (!payload || !payload.type) return;

    switch (payload.type) {
      case 'JOIN_COHORT': {
        const targetGroup = payload.groupId || ws.groupId;
        if (targetGroup) {
          if (ws.groupId && ws.groupId !== targetGroup) {
            this.removeFromRoom(ws.groupId, ws);
          }
          ws.groupId = targetGroup;
          if (payload.userId) ws.userId = payload.userId;
          if (payload.username) ws.username = payload.username;
          this.addToRoom(targetGroup, ws);
          this.broadcastPresence(targetGroup);
        }
        break;
      }

      case 'TYPING': {
        if (ws.groupId) {
          this.broadcastToRoom(
            ws.groupId,
            {
              type: 'USER_TYPING',
              groupId: ws.groupId,
              userId: ws.userId,
              username: ws.username,
            },
            ws, // omit sender
          );
        }
        break;
      }

      case 'PING': {
        this.safeSend(ws, { type: 'PONG', timestamp: Date.now() });
        break;
      }

      default:
        break;
    }
  }

  // ==================== ROOM HELPERS ====================
  private addToRoom(groupId: string, ws: CohortWebSocket) {
    if (!this.rooms.has(groupId)) {
      this.rooms.set(groupId, new Set<CohortWebSocket>());
    }
    this.rooms.get(groupId)!.add(ws);
  }

  private removeFromRoom(groupId: string, ws: CohortWebSocket) {
    const room = this.rooms.get(groupId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(groupId);
      }
    }
  }

  getRoomActiveCount(groupId: string): number {
    return this.rooms.get(groupId)?.size || 0;
  }

  private broadcastPresence(groupId: string) {
    const activeCount = this.getRoomActiveCount(groupId);
    this.broadcastToRoom(groupId, {
      type: 'PRESENCE_UPDATE',
      groupId,
      activeCount,
    });
  }

  private safeSend(ws: CohortWebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (err) {
        this.logger.warn('Failed to send WebSocket message');
      }
    }
  }

  private broadcastToRoom(groupId: string, payload: any, exceptClient?: CohortWebSocket) {
    const room = this.rooms.get(groupId);
    if (!room || room.size === 0) return;

    const messageString = JSON.stringify(payload);
    room.forEach((client) => {
      if (client !== exceptClient && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
        } catch (e) {
          // ignore send error
        }
      }
    });
  }

  // ==================== PUBLIC BROADCAST API ====================
  broadcastNewMessage(groupId: string, message: any) {
    this.logger.log(`[WS Broadcast] New message in cohort ${groupId}`);
    this.broadcastToRoom(groupId, {
      type: 'NEW_MESSAGE',
      groupId,
      message,
    });
  }

  broadcastPinMessage(groupId: string, messageId: string, isPinned: boolean) {
    this.logger.log(`[WS Broadcast] Message ${messageId} pinned status in cohort ${groupId}: ${isPinned}`);
    this.broadcastToRoom(groupId, {
      type: 'MESSAGE_PINNED',
      groupId,
      messageId,
      isPinned,
    });
  }

  broadcastDeleteMessage(groupId: string, messageId: string) {
    this.logger.log(`[WS Broadcast] Message ${messageId} deleted in cohort ${groupId}`);
    this.broadcastToRoom(groupId, {
      type: 'MESSAGE_DELETED',
      groupId,
      messageId,
    });
  }

  broadcastQuizAssigned(groupId: string, quiz: any) {
    this.logger.log(`[WS Broadcast] Quiz assigned in cohort ${groupId}`);
    this.broadcastToRoom(groupId, {
      type: 'QUIZ_ASSIGNED',
      groupId,
      quiz,
    });
  }
}
