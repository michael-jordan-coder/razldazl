import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createWSClient } from '@product/bridge/client';
import { startServer, type RunningServer } from '../server.js';
import type Anthropic from '@anthropic-ai/sdk';

// A stub that implements only what runTurn uses from the SDK. We fabricate a
// response containing one setJSXProp tool_use block so the server's routing
// can be exercised without hitting the network.
// Two-turn stub: first turn emits a tool_use (setJSXProp); second turn
// (after the tool result comes back) emits plain text and stops.
function stubAnthropic(): Anthropic {
  let calls = 0;
  return {
    messages: {
      create: async () => {
        calls++;
        if (calls === 1) {
          return {
            id: 'msg_stub_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-4-7',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_stub',
                name: 'setJSXProp',
                input: {
                  source: { fileName: 'App.tsx', lineNumber: 2, columnNumber: 5 },
                  prop: 'className',
                  value: 'touched',
                },
              },
            ],
            stop_reason: 'tool_use',
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          };
        }
        return {
          id: 'msg_stub_2',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: 'Updated the class name.' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 20, output_tokens: 5 },
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('startServer — end-to-end routing (stubbed LLM)', () => {
  let root: string;
  let server: RunningServer;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'product-server-'));
    await writeFile(
      join(root, 'App.tsx'),
      `export const App = () => (\n    <div className="old">hi</div>\n);\n`,
      'utf8',
    );
    server = await startServer({
      port: 0,
      projectRoot: root,
      anthropic: stubAnthropic(),
    });
  });

  afterAll(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  it('runs a turn, applies the edit, and emits a file-edit chat part', async () => {
    const client = createWSClient({
      url: `ws://localhost:${server.port}`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    await client.ready;

    const parts: unknown[] = [];
    client.on('chat', (p) => parts.push(p));

    const result = await client.call<{ toolCallCount: number }>('ai', 'runTurn', {
      message: 'make it touched',
      context: {
        selectedSource: { fileName: 'App.tsx', lineNumber: 2, columnNumber: 5 },
      },
    });
    expect(result.toolCallCount).toBe(1);

    // Wait a microtask so events land before we inspect.
    await new Promise((r) => setTimeout(r, 10));

    const edit = parts.find(
      (p): p is { kind: 'file-edit'; path: string; diff: string } =>
        typeof p === 'object' && p !== null && (p as { kind: string }).kind === 'file-edit',
    );
    expect(edit).toBeDefined();
    expect(edit!.path).toBe('App.tsx');

    const written = await readFile(join(root, 'App.tsx'), 'utf8');
    expect(written).toContain('className="touched"');
    expect(written).not.toContain('className="old"');

    client.close();
  });
});
