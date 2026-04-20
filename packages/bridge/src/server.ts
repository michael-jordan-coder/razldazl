// Minimal WS server that speaks the @product/protocol envelope.
//
// Handlers are registered as `api.method` → async function. Call messages get
// routed, their return value wrapped in a `callback` envelope, errors wrapped
// as `{ok: false, error}`. Event broadcasts are `send(topic, data)` on the
// connection object — useful for streaming chat parts back.

import { createServer, type Server as HTTPServer } from 'node:http';
import { WebSocketServer, type WebSocket as WSSocket } from 'ws';
import { wsEnvelopeSchema, type WSEnvelope } from '@product/protocol';

export type WSHandler = (args: unknown, ctx: { send: (topic: string, data: unknown) => void }) => Promise<unknown>;
export type WSHandlers = Record<string, Record<string, WSHandler>>;

export interface WSServer {
  port: number;
  close(): Promise<void>;
}

export interface CreateWSServerOptions {
  port: number;
  handlers: WSHandlers;
  onError?: (err: Error) => void;
}

export function createWSServer({
  port,
  handlers,
  onError,
}: CreateWSServerOptions): Promise<WSServer> {
  return new Promise((resolve, reject) => {
    const http: HTTPServer = createServer();
    const wss = new WebSocketServer({ server: http });

    wss.on('connection', (ws: WSSocket) => {
      const send = (topic: string, data: unknown) => {
        const envelope: WSEnvelope = { type: 'event', topic, data };
        ws.send(JSON.stringify(envelope));
      };

      ws.on('message', (raw) => {
        let parsed: WSEnvelope;
        try {
          parsed = wsEnvelopeSchema.parse(JSON.parse(raw.toString()));
        } catch (err) {
          onError?.(err as Error);
          return;
        }
        if (parsed.type !== 'call') return;
        const api = handlers[parsed.api];
        const method = api?.[parsed.method];
        if (!method) {
          const reply: WSEnvelope = {
            type: 'callback',
            id: parsed.id,
            ok: false,
            error: `Unknown method ${parsed.api}.${parsed.method}`,
          };
          ws.send(JSON.stringify(reply));
          return;
        }
        method(parsed.args, { send })
          .then((result) => {
            const reply: WSEnvelope = { type: 'callback', id: parsed.id, ok: true, result };
            ws.send(JSON.stringify(reply));
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            const reply: WSEnvelope = {
              type: 'callback',
              id: parsed.id,
              ok: false,
              error: message,
            };
            ws.send(JSON.stringify(reply));
            onError?.(err as Error);
          });
      });

      ws.on('error', (err) => onError?.(err));
    });

    http.on('error', reject);
    http.listen(port, () => {
      const addr = http.address();
      const actualPort =
        addr && typeof addr === 'object' && typeof addr.port === 'number' ? addr.port : port;
      resolve({
        port: actualPort,
        close: () =>
          new Promise<void>((res) => {
            wss.close(() => http.close(() => res()));
          }),
      });
    });
  });
}
