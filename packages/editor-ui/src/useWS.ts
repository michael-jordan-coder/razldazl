import { useCallback, useEffect, useRef, useState } from 'react';
import { createWSClient, type WSClient } from '@product/bridge';
import type { ChatPart } from '@product/protocol';
import { SERVER_WS_URL } from './config.js';

export interface UseWS {
  ready: boolean;
  client: WSClient | null;
  chatParts: ChatPart[];
  clearChat(): void;
  /** Append a part locally (e.g. user echo, undo toast) — not sent to server. */
  appendPart(part: ChatPart): void;
  /** Subscribe to server-emitted chat parts only. */
  subscribeToChat(handler: (part: ChatPart) => void): () => void;
}

// The client owns its own lifecycle inside useEffect so StrictMode's
// double-mount gets a fresh socket on each run — no reuse of a closed WS.
export function useWS(): UseWS {
  const [ready, setReady] = useState(false);
  const [chatParts, setChatParts] = useState<ChatPart[]>([]);
  const clientRef = useRef<WSClient | null>(null);
  const chatHandlersRef = useRef<Set<(p: ChatPart) => void>>(new Set());

  useEffect(() => {
    let disposed = false;
    const client = createWSClient({ url: SERVER_WS_URL });
    clientRef.current = client;

    client.ready
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch(() => {
        if (!disposed) setReady(false);
      });

    const off = client.on('chat', (data) => {
      const part = data as ChatPart;
      setChatParts((prev) => [...prev, part]);
      for (const h of chatHandlersRef.current) h(part);
    });

    return () => {
      disposed = true;
      off();
      client.close();
      if (clientRef.current === client) clientRef.current = null;
      setReady(false);
    };
  }, []);

  const appendPart = useCallback((part: ChatPart) => {
    setChatParts((prev) => [...prev, part]);
  }, []);

  const subscribeToChat = useCallback((handler: (p: ChatPart) => void) => {
    chatHandlersRef.current.add(handler);
    return () => {
      chatHandlersRef.current.delete(handler);
    };
  }, []);

  return {
    ready,
    get client() {
      return clientRef.current;
    },
    chatParts,
    clearChat: () => setChatParts([]),
    appendPart,
    subscribeToChat,
  };
}
