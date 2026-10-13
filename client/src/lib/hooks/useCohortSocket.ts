"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GroupMessage } from "@/lib/api/types";
import { API_BASE_URL } from "@/lib/api/routes";

interface UseCohortSocketOptions {
  groupId: string;
  userId?: string;
  username?: string;
  onNewMessage?: (message: GroupMessage) => void;
  onMessagePinned?: (messageId: string, isPinned: boolean) => void;
  onMessageDeleted?: (messageId: string) => void;
  onPresenceUpdate?: (activeCount: number) => void;
  onQuizAssigned?: (quiz: any) => void;
}

/**
 * Robust WebSocket URL resolver:
 * - Detects explicit NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_BACKEND_URL
 * - Automatically falls back to backend port 5000 in local development
 * - Uses window.location.host with wss: in production deployments
 */
function resolveCohortWsUrl(groupId: string, userId?: string, username?: string): string {
  if (typeof window === "undefined" || !groupId) return "";

  const explicitWs = process.env.NEXT_PUBLIC_WS_URL;
  if (explicitWs) {
    const params = new URLSearchParams({
      groupId,
      userId: userId || "",
      username: username || "Cadet",
    });
    return `${explicitWs.replace(/\/$/, "")}/ws/cohorts?${params.toString()}`;
  }

  const backendEnv = process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE_URL || "";
  let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  let host = window.location.host;

  if (backendEnv && /^https?:\/\//.test(backendEnv)) {
    protocol = backendEnv.startsWith("https") ? "wss:" : "ws:";
    host = backendEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");
  } else if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    // Next.js dev server is on port 3000, NestJS WebSocket server is on port 5000
    host = `${window.location.hostname}:5000`;
  }

  const params = new URLSearchParams({
    groupId,
    userId: userId || "",
    username: username || "Cadet",
  });

  return `${protocol}//${host}/ws/cohorts?${params.toString()}`;
}

export function useCohortSocket({
  groupId,
  userId,
  username,
  onNewMessage,
  onMessagePinned,
  onMessageDeleted,
  onPresenceUpdate,
  onQuizAssigned,
}: UseCohortSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeCadetsCount, setActiveCadetsCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutMapRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isUnmountedRef = useRef(false);

  // Stable callback refs so effect doesn't re-trigger unnecessarily
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;
  const onMessagePinnedRef = useRef(onMessagePinned);
  onMessagePinnedRef.current = onMessagePinned;
  const onMessageDeletedRef = useRef(onMessageDeleted);
  onMessageDeletedRef.current = onMessageDeleted;
  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  onPresenceUpdateRef.current = onPresenceUpdate;
  const onQuizAssignedRef = useRef(onQuizAssigned);
  onQuizAssignedRef.current = onQuizAssigned;

  const connect = useCallback(() => {
    if (!groupId || typeof window === "undefined" || isUnmountedRef.current) return;

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const wsUrl = resolveCohortWsUrl(groupId, userId, username);
      if (!wsUrl) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);

        // Send a keep-alive ping every 25 seconds
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "PING" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || !data.type) return;

          switch (data.type) {
            case "CONNECTED":
              setIsConnected(true);
              if (typeof data.activeCount === "number") {
                setActiveCadetsCount(data.activeCount);
                onPresenceUpdateRef.current?.(data.activeCount);
              }
              break;

            case "PRESENCE_UPDATE":
              if (typeof data.activeCount === "number") {
                setActiveCadetsCount(data.activeCount);
                onPresenceUpdateRef.current?.(data.activeCount);
              }
              break;

            case "NEW_MESSAGE":
              if (data.message) {
                onNewMessageRef.current?.(data.message);
              }
              break;

            case "MESSAGE_PINNED":
              if (data.messageId) {
                onMessagePinnedRef.current?.(data.messageId, Boolean(data.isPinned));
              }
              break;

            case "MESSAGE_DELETED":
              if (data.messageId) {
                onMessageDeletedRef.current?.(data.messageId);
              }
              break;

            case "USER_TYPING":
              if (data.username && data.userId !== userId) {
                const typingName = data.username;
                setTypingUsers((prev) => Array.from(new Set([...prev, typingName])));

                const existingTimeout = typingTimeoutMapRef.current.get(typingName);
                if (existingTimeout) clearTimeout(existingTimeout);

                const timeout = setTimeout(() => {
                  setTypingUsers((prev) => prev.filter((u) => u !== typingName));
                  typingTimeoutMapRef.current.delete(typingName);
                }, 3000);
                typingTimeoutMapRef.current.set(typingName, timeout);
              }
              break;

            case "QUIZ_ASSIGNED":
              if (data.quiz) {
                onQuizAssignedRef.current?.(data.quiz);
              }
              break;

            default:
              break;
          }
        } catch (e) {
          // ignore malformed frame
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Only reconnect if not unmounted
        if (!isUnmountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 4000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch (err) {
      setIsConnected(false);
      if (!isUnmountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    }
  }, [groupId, userId, username]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      typingTimeoutMapRef.current.forEach((t) => clearTimeout(t));
      typingTimeoutMapRef.current.clear();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendTyping = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "TYPING",
          groupId,
          userId,
          username,
        })
      );
    }
  }, [groupId, userId, username]);

  return {
    isConnected,
    activeCadetsCount,
    typingUsers,
    sendTyping,
  };
}
