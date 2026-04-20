import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { createWSServer } from '../server.js';
import { createWSClient } from '../client.js';

describe('WS bridge', () => {
  it('routes a call to a handler and returns its result', async () => {
    const server = await createWSServer({
      port: 0 as number === 0 ? await freePort() : 0,
      handlers: {
        math: {
          add: async (args) => {
            const a = (args as { a: number }).a;
            const b = (args as { b: number }).b;
            return a + b;
          },
        },
      },
    });

    const client = createWSClient({
      url: `ws://localhost:${server.port}`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    await client.ready;
    const result = await client.call<number>('math', 'add', { a: 2, b: 3 });
    expect(result).toBe(5);

    client.close();
    await server.close();
  });

  it('rejects when an unknown method is called', async () => {
    const server = await createWSServer({
      port: await freePort(),
      handlers: {},
    });
    const client = createWSClient({
      url: `ws://localhost:${server.port}`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    await client.ready;
    await expect(client.call('nope', 'nada', null)).rejects.toThrow(/Unknown method/);
    client.close();
    await server.close();
  });

  it('broadcasts events from a handler back to the client', async () => {
    const server = await createWSServer({
      port: await freePort(),
      handlers: {
        pubsub: {
          emit: async (_args, ctx) => {
            ctx.send('ticker', { n: 1 });
            ctx.send('ticker', { n: 2 });
            return 'done';
          },
        },
      },
    });
    const client = createWSClient({
      url: `ws://localhost:${server.port}`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    await client.ready;

    const received: unknown[] = [];
    client.on('ticker', (d) => received.push(d));
    await client.call('pubsub', 'emit', null);
    // Events are dispatched before callback in server order; give microtask a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(received).toEqual([{ n: 1 }, { n: 2 }]);

    client.close();
    await server.close();
  });
});

async function freePort(): Promise<number> {
  const { createServer } = await import('node:net');
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, () => {
      const addr = s.address();
      if (!addr || typeof addr === 'string') return reject(new Error('no address'));
      const port = addr.port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}
