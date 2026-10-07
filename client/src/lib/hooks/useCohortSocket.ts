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
}

export function useCohortSocket({
  groupId,
  userId,
  username,
  onNewMessage,
  onMessagePinned,
  onMessageDeleted,
  onPresenceUpdate,
}: UseCohortSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeCadetsCount, setActiveCadetsCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutMapRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Stable callback refs so effect doesn't re-trigger
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;
  const onMessagePinnedRef = useRef(onMessagePinned);
  onMessagePinnedRef.current = onMessagePinned;
  const onMessageDeletedRef = useRef(onMessageDeleted);
  onMessageDeletedRef.current = onMessageDeleted;
  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  onPresenceUpdateRef.current = onPresenceUpdate;

  const connect = useCallback(() => {
    if (!groupId || typeof window === "undefined") return;

    try {
      // Determine WebSocket base url from API_BASE_URL or window.location
      const base = API_BASE_URL || window.location.origin;
      const wsProtocol = base.startsWith("https") ? "wss:" : "ws:";
      const host = base.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const params = new URLSearchParams({
        groupId,
        userId: userId || "",
        username: username || "Cadet",
      });

      const wsUrl = `${wsProtocol}//${host}/ws/cohorts?${params.toString()}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || !data.type) return;

          switch (data.type) {
            case "CONNECTED":
              setIsConnected(true);
              if (typeof data.activeCount === "number") {
                setActiveCadetsCount(Math.max(1, data.activeCount));
                onPresenceUpdateRef.current?.(data.activeCount);
              }
              break;

            case "PRESENCE_UPDATE":
              if (typeof data.activeCount === "number") {
                setActiveCadetsCount(Math.max(1, data.activeCount));
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

                // Clear existing timeout for this user
                const existingTimeout = typingTimeoutMapRef.current.get(typingName);
                if (existingTimeout) clearTimeout(existingTimeout);

                const timeout = setTimeout(() => {
                  setTypingUsers((prev) => prev.filter((u) => u !== typingName));
                  typingTimeoutMapRef.current.delete(typingName);
                }, 3000);
                typingTimeoutMapRef.current.set(typingName, timeout);
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
        // Attempt reconnect with backoff
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch (err) {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 4000);
    }
  }, [groupId, userId, username]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      typingTimeoutMapRef.current.forEach((t) => clearTimeout(t));
      typingTimeoutMapRef.current.clear();
      if (wsRef.current) {
        wsRef.current.close();
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
