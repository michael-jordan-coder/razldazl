// The server wires AI turns to AST edits.
//
// Flow per message:
//   editor-ui → call ai.runTurn({ message, context: { selectedSource } })
//     → server loads file contents for selectedSource.fileName (if any)
//     → server runs ai.runTurn, streaming each chat part as a WS event
//     → server applies returned tool calls via ast-engine.editFile
//     → server emits a `file-edit` chat part per edited file
//   Vite (on the demo-app side) observes the file change and HMRs
//   preview-agent re-locks selection; editor-ui observes the new chat parts

import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute, relative } from 'node:path';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createWSServer, type WSHandlers, type WSServer } from '@product/bridge/server';
import { runTurn } from '@product/ai';
import { editFile } from '@product/ast-engine';
import {
  aiRunTurnArgsSchema,
  astEditApplyArgsSchema,
  readFileArgsSchema,
  type ChatPart,
  type ToolCall,
} from '@product/protocol';

export interface StartServerOptions {
  port: number;
  projectRoot: string;
  anthropicApiKey?: string;
  /** Override for tests. */
  anthropic?: Anthropic;
}

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

export async function startServer(opts: StartServerOptions): Promise<RunningServer> {
  const projectRoot = resolve(opts.projectRoot);
  const anthropic =
    opts.anthropic ??
    new Anthropic({
      apiKey: opts.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
    });

  const handlers: WSHandlers = {
    ai: {
      runTurn: async (rawArgs, { send }) => {
        const args = aiRunTurnArgsSchema.parse(rawArgs);

        let fileContents: string | null = null;
        if (args.context.selectedSource) {
          const absPath = resolveInsideRoot(projectRoot, args.context.selectedSource.fileName);
          if (absPath) {
            fileContents = await readFile(absPath, 'utf8').catch(() => null);
          }
        }

        const emit = (p: ChatPart) => send('chat', p);

        const turn = await runTurn({
          client: anthropic,
          message: args.message,
          selectedSource: args.context.selectedSource,
          fileContents,
          onPart: emit,
        });

        const byFile = groupOpsByFile(turn.toolCalls);

        for (const [fileName, ops] of byFile) {
          const abs = resolveInsideRoot(projectRoot, fileName);
          if (!abs) {
            emit({
              kind: 'tool-call',
              id: `reject-${fileName}`,
              tool: 'setJSXProp',
              args: {},
              state: 'error',
              error: `Refusing to edit ${fileName}: outside project root`,
            });
            continue;
          }
          try {
            const result = await editFile(abs, ops);
            emit({
              kind: 'file-edit',
              id: abs,
              path: relative(projectRoot, abs),
              beforeHash: sha256(result.before),
              afterHash: sha256(result.after),
              diff: renderDiff(result.before, result.after),
            });
          } catch (err) {
            emit({
              kind: 'tool-call',
              id: `error-${fileName}`,
              tool: 'setJSXProp',
              args: { fileName },
              state: 'error',
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return {
          toolCallCount: turn.toolCalls.length,
          finalText: turn.finalText,
        };
      },
    },
    files: {
      read: async (rawArgs) => {
        const args = readFileArgsSchema.parse(rawArgs);
        const abs = resolveInsideRoot(projectRoot, args.path);
        if (!abs) throw new Error(`Refusing to read ${args.path}: outside project root`);
        const contents = await readFile(abs, 'utf8');
        return { path: args.path, contents };
      },
    },
    astEdit: {
      // Direct edit path used by the Design panel. Skips the AI turn — the
      // client has already decided which ops to run. Emits `file-edit` chat
      // parts so the log still records what changed.
      apply: async (rawArgs, { send }) => {
        const args = astEditApplyArgsSchema.parse(rawArgs);
        const emit = (p: ChatPart) => send('chat', p);
        const byFile = groupOpsByFile(args.ops);
        let applied = 0;
        for (const [fileName, ops] of byFile) {
          const abs = resolveInsideRoot(projectRoot, fileName);
          if (!abs) {
            emit({
              kind: 'tool-call',
              id: `reject-${fileName}`,
              tool: ops[0]!.tool,
              args: { fileName },
              state: 'error',
              error: `Refusing to edit ${fileName}: outside project root`,
            });
            continue;
          }
          const result = await editFile(abs, ops);
          emit({
            kind: 'file-edit',
            id: abs,
            path: relative(projectRoot, abs),
            beforeHash: sha256(result.before),
            afterHash: sha256(result.after),
            diff: renderDiff(result.before, result.after),
          });
          applied += ops.length;
        }
        return { applied };
      },
    },
  };

  const ws: WSServer = await createWSServer({
    port: opts.port,
    handlers,
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error('[server] WS error:', err);
    },
  });

  return {
    port: ws.port,
    close: () => ws.close(),
  };
}

function groupOpsByFile(ops: ToolCall[]): Map<string, ToolCall[]> {
  const byFile = new Map<string, ToolCall[]>();
  for (const op of ops) {
    const fileName = op.args.source.fileName;
    const list = byFile.get(fileName) ?? [];
    list.push(op);
    byFile.set(fileName, list);
  }
  return byFile;
}

function resolveInsideRoot(root: string, requested: string): string | null {
  // Vite dev URLs include a cache-buster query like "?t=173...". Strip it.
  const clean = requested.split('?')[0]!.split('#')[0]!;
  const abs = isAbsolute(clean) ? clean : resolve(root, clean);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return abs;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 12);
}

// Minimal unified-diff-ish formatter; server ships a human-readable summary,
// and editor-ui can render a richer diff later.
function renderDiff(before: string, after: string): string {
  if (before === after) return '(no change)';
  const a = before.split('\n');
  const b = after.split('\n');
  const out: string[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      if (a[i] !== undefined) out.push(`-${a[i]}`);
      if (b[i] !== undefined) out.push(`+${b[i]}`);
    }
  }
  return out.slice(0, 200).join('\n');
}
