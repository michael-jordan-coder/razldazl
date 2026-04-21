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

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createWSServer, type WSHandlers, type WSServer } from '@product/bridge/server';
import { runTurn, type ToolExecutor } from '@product/ai';
import { editFile, findJSXElements } from '@product/ast-engine';
import {
  aiRunTurnArgsSchema,
  astEditApplyArgsSchema,
  fileWriteArgsSchema,
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

        const executor = createToolExecutor(projectRoot, emit);

        const turn = await runTurn({
          client: anthropic,
          message: args.message,
          selectedSource: args.context.selectedSource,
          fileContents,
          onPart: emit,
          executor,
        });

        return {
          toolCallCount: turn.toolCalls.length,
          finalText: turn.finalText,
          iterations: turn.iterations,
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
      // Raw write — used by undo/redo to restore a snapshot verbatim. Does not
      // emit file-edit chat parts (the client is driving undo and already
      // knows what it wrote). Sandboxed to the project root.
      write: async (rawArgs) => {
        const args = fileWriteArgsSchema.parse(rawArgs);
        const written: string[] = [];
        for (const { path, contents } of args.edits) {
          const abs = resolveInsideRoot(projectRoot, path);
          if (!abs) throw new Error(`Refusing to write ${path}: outside project root`);
          await writeFile(abs, contents, 'utf8');
          written.push(relative(projectRoot, abs));
        }
        return { written };
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
            before: result.before,
            after: result.after,
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

function createToolExecutor(
  projectRoot: string,
  emit: (p: ChatPart) => void,
): ToolExecutor {
  return {
    async listFiles({ directory }) {
      const base = directory
        ? resolveInsideRoot(projectRoot, directory)
        : projectRoot;
      if (!base) throw new Error(`Refusing to list ${directory}: outside project root`);
      return listReactFiles(projectRoot, base);
    },
    async readFile({ path }) {
      const abs = resolveInsideRoot(projectRoot, path);
      if (!abs) throw new Error(`Refusing to read ${path}: outside project root`);
      return readFile(abs, 'utf8');
    },
    async findJSXElement({ path, tag, textContains, classContains }) {
      const abs = resolveInsideRoot(projectRoot, path);
      if (!abs) throw new Error(`Refusing to read ${path}: outside project root`);
      const contents = await readFile(abs, 'utf8');
      const query: { tag?: string; textContains?: string; classContains?: string } = {};
      if (tag !== undefined) query.tag = tag;
      if (textContains !== undefined) query.textContains = textContains;
      if (classContains !== undefined) query.classContains = classContains;
      return findJSXElements(contents, abs, query);
    },
    async applyEdit(op) {
      const fileName = op.args.source.fileName;
      const abs = resolveInsideRoot(projectRoot, fileName);
      if (!abs) throw new Error(`Refusing to edit ${fileName}: outside project root`);
      const result = await editFile(abs, [op]);
      emit({
        kind: 'file-edit',
        id: `${abs}-${Date.now()}`,
        path: relative(projectRoot, abs),
        beforeHash: sha256(result.before),
        afterHash: sha256(result.after),
        diff: renderDiff(result.before, result.after),
        before: result.before,
        after: result.after,
      });
    },
  };
}

async function listReactFiles(projectRoot: string, base: string): Promise<string[]> {
  const out: string[] = [];
  const SKIP = new Set(['node_modules', 'dist', '.turbo', '.git', '.vite', 'coverage']);
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
      } else if (/\.(tsx|jsx)$/.test(e.name)) {
        out.push(relative(projectRoot, abs));
      }
    }
  }
  await walk(base);
  out.sort();
  return out;
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
