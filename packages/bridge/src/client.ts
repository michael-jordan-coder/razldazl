// Typed WS client. `call(api, method, args)` returns a Promise resolving to
// the server's callback result (or rejecting with its error). `on(topic, fn)`
// subscribes to event broadcasts. Works in browser (native WebSocket) and
// Node (if caller injects a WebSocket implementation).

import { wsEnvelopeSchema, type WSEnvelope } from '@product/protocol';

export interface WSClient {
  call<T = unknown>(api: string, method: string, args: unknown): Promise<T>;
  on(topic: string, handler: (data: unknown) => void): () => void;
  close(): void;
  ready: Promise<void>;
}

export interface CreateWSClientOptions {
  url: string;
  WebSocket?: typeof WebSocket;
}

let nextId = 0;

export function createWSClient({ url, WebSocket: WS = WebSocket }: CreateWSClientOptions): WSClient {
  const ws = new WS(url);
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Map<string, Set<(data: unknown) => void>>();

  const ready = new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', () => reject(new Error('WS connection error')), { once: true });
  });

  ws.addEventListener('message', (ev: MessageEvent) => {
    let parsed: WSEnvelope;
    try {
      parsed = wsEnvelopeSchema.parse(JSON.parse(String(ev.data)));
    } catch {
      return;
    }
    if (parsed.type === 'callback') {
      const p = pending.get(parsed.id);
      if (!p) return;
      pending.delete(parsed.id);
      if (parsed.ok) p.resolve(parsed.result);
      else p.reject(new Error(parsed.error));
    } else if (parsed.type === 'event') {
      const set = listeners.get(parsed.topic);
      if (set) for (const fn of set) fn(parsed.data);
    }
  });

  return {
    ready,
    call<T = unknown>(api: string, method: string, args: unknown): Promise<T> {
      const id = `c${++nextId}`;
      const envelope: WSEnvelope = { type: 'call', id, api, method, args };
      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: (v) => resolve(v as T),
          reject,
        });
        ws.send(JSON.stringify(envelope));
      });
    },
    on(topic, handler) {
      let set = listeners.get(topic);
      if (!set) {
        set = new Set();
        listeners.set(topic, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },
    close() {
      ws.close();
    },
  };
}
