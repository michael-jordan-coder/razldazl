import { useEffect, useRef, useState } from 'react';
import { createWSClient, type WSClient } from '@product/bridge';
import type { ChatPart } from '@product/protocol';
import { SERVER_WS_URL } from './config.js';

export interface UseWS {
  ready: boolean;
  client: WSClient | null;
  chatParts: ChatPart[];
  clearChat(): void;
}

// The client owns its own lifecycle inside useEffect so StrictMode's
// double-mount gets a fresh socket on each run — no reuse of a closed WS.
export function useWS(): UseWS {
  const [ready, setReady] = useState(false);
  const [chatParts, setChatParts] = useState<ChatPart[]>([]);
  const clientRef = useRef<WSClient | null>(null);

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
      setChatParts((prev) => [...prev, data as ChatPart]);
    });

    return () => {
      disposed = true;
      off();
      client.close();
      if (clientRef.current === client) clientRef.current = null;
      setReady(false);
    };
  }, []);

  return {
    ready,
    get client() {
      return clientRef.current;
    },
    chatParts,
    clearChat: () => setChatParts([]),
  };
}
