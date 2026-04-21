// Multi-turn loop: the AI can interleave read-only tools (listFiles, readFile,
// findJSXElement) with edit tools (setJSXProp, updateJSXText). Edits apply
// inline so a subsequent readFile sees the fresh contents.

import Anthropic from '@anthropic-ai/sdk';
import type { ChatPart, JSXSource, ToolCall } from '@product/protocol';
import { SYSTEM_PROMPT, toolSchemas } from './tools.js';
import { MODEL } from './model.js';

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export interface ToolExecutor {
  listFiles(args: { directory?: string }): Promise<string[]>;
  readFile(args: { path: string }): Promise<string>;
  findJSXElement(args: {
    path: string;
    tag?: string;
    textContains?: string;
    classContains?: string;
  }): Promise<unknown[]>;
  applyEdit(op: ToolCall): Promise<void>;
}

export interface RunTurnOptions {
  client: Anthropic;
  message: string;
  selectedSource: JSXSource | null;
  fileContents: string | null;
  onPart: (part: ChatPart) => void;
  executor: ToolExecutor;
  maxIterations?: number;
}

export interface RunTurnResult {
  toolCalls: ToolCall[];
  finalText: string;
  iterations: number;
  stopReason: string | null;
}

const DEFAULT_MAX_ITERATIONS = 12;

export async function runTurn({
  client,
  message,
  selectedSource,
  fileContents,
  onPart,
  executor,
  maxIterations = DEFAULT_MAX_ITERATIONS,
}: RunTurnOptions): Promise<RunTurnResult> {
  const contextBlocks: string[] = [];
  if (selectedSource) {
    contextBlocks.push(
      `Selected element: ${selectedSource.fileName}:${selectedSource.lineNumber}:${selectedSource.columnNumber}`,
    );
  }
  if (fileContents) {
    contextBlocks.push(
      `Current contents of the selected file:\n\n\`\`\`tsx\n${fileContents}\n\`\`\``,
    );
  }
  contextBlocks.push(`User request: ${message}`);

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: contextBlocks.join('\n\n') },
  ];

  const collectedEdits: ToolCall[] = [];
  let finalText = '';
  let stopReason: string | null = null;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: toolSchemas.map((tool, i) =>
        i === toolSchemas.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' } } : tool,
      ) as Anthropic.Messages.Tool[],
      messages,
    });

    stopReason = response.stop_reason;

    const toolUses: Array<{ id: string; name: string; input: unknown }> = [];
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        finalText += block.text;
        onPart({ kind: 'text', id: `t-${iterations}-${finalText.length}`, text: block.text });
      } else if (block.type === 'tool_use') {
        toolUses.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    if (toolUses.length === 0) break;

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const result = await runTool(use, executor, collectedEdits, onPart);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: result.ok ? result.content : result.error,
        ...(result.ok ? {} : { is_error: true as const }),
      });
    }

    messages.push({ role: 'user', content: toolResults });

    if (stopReason === 'end_turn') break;
  }

  return {
    toolCalls: collectedEdits,
    finalText,
    iterations,
    stopReason,
  };
}

type StepResult = { ok: true; content: string } | { ok: false; error: string };

async function runTool(
  use: { id: string; name: string; input: unknown },
  executor: ToolExecutor,
  collectedEdits: ToolCall[],
  onPart: (p: ChatPart) => void,
): Promise<StepResult> {
  onPart({
    kind: 'tool-call',
    id: use.id,
    tool: use.name,
    args: use.input,
    state: 'running',
  });

  try {
    if (use.name === 'listFiles') {
      const args = (use.input ?? {}) as { directory?: string };
      const files = await executor.listFiles(args);
      onPart({
        kind: 'tool-call',
        id: use.id,
        tool: use.name,
        args: use.input,
        state: 'success',
      });
      return { ok: true, content: JSON.stringify(files) };
    }

    if (use.name === 'readFile') {
      const args = use.input as { path: string };
      if (typeof args?.path !== 'string') {
        return { ok: false, error: 'readFile: missing "path" (string)' };
      }
      const contents = await executor.readFile(args);
      onPart({
        kind: 'tool-call',
        id: use.id,
        tool: use.name,
        args: use.input,
        state: 'success',
      });
      return { ok: true, content: contents };
    }

    if (use.name === 'findJSXElement') {
      const args = use.input as {
        path: string;
        tag?: string;
        textContains?: string;
        classContains?: string;
      };
      if (typeof args?.path !== 'string') {
        return { ok: false, error: 'findJSXElement: missing "path" (string)' };
      }
      const matches = await executor.findJSXElement(args);
      onPart({
        kind: 'tool-call',
        id: use.id,
        tool: use.name,
        args: use.input,
        state: 'success',
      });
      return { ok: true, content: JSON.stringify(matches) };
    }

    if (EDIT_TOOL_NAMES.has(use.name)) {
      const op = parseEditCall(use.name, use.input);
      if (!op) {
        return { ok: false, error: `${use.name}: invalid arguments` };
      }
      collectedEdits.push(op);
      await executor.applyEdit(op);
      onPart({
        kind: 'tool-call',
        id: use.id,
        tool: use.name,
        args: use.input,
        state: 'success',
      });
      return { ok: true, content: 'applied' };
    }

    return { ok: false, error: `Unknown tool: ${use.name}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onPart({
      kind: 'tool-call',
      id: use.id,
      tool: use.name,
      args: use.input,
      state: 'error',
      error: message,
    });
    return { ok: false, error: message };
  }
}

const EDIT_TOOL_NAMES = new Set([
  'setJSXProp',
  'updateJSXText',
  'addElement',
  'wrapElement',
  'deleteElement',
  'moveElement',
]);

function parseEditCall(name: string, input: unknown): ToolCall | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  if (name === 'setJSXProp') {
    const source = obj.source;
    if (!isJSXSource(source)) return null;
    const prop = obj.prop;
    const value = obj.value;
    if (typeof prop !== 'string' || typeof value !== 'string') return null;
    return { tool: 'setJSXProp', args: { source, prop, value } };
  }
  if (name === 'updateJSXText') {
    const source = obj.source;
    if (!isJSXSource(source)) return null;
    const text = obj.text;
    if (typeof text !== 'string') return null;
    return { tool: 'updateJSXText', args: { source, text } };
  }
  if (name === 'addElement') {
    const parent = obj.parent;
    if (!isJSXSource(parent)) return null;
    const position = obj.position;
    if (position !== 'start' && position !== 'end') return null;
    const element = parseElementDescriptor(obj.element);
    if (!element) return null;
    return { tool: 'addElement', args: { parent, position, element } };
  }
  if (name === 'wrapElement') {
    const target = obj.target;
    if (!isJSXSource(target)) return null;
    const wrapper = parseElementDescriptor(obj.wrapper, /* allowText */ false);
    if (!wrapper) return null;
    return {
      tool: 'wrapElement',
      args: { target, wrapper: { tag: wrapper.tag, ...(wrapper.props ? { props: wrapper.props } : {}) } },
    };
  }
  if (name === 'deleteElement') {
    const target = obj.target;
    if (!isJSXSource(target)) return null;
    return { tool: 'deleteElement', args: { target } };
  }
  if (name === 'moveElement') {
    const target = obj.target;
    const newParent = obj.newParent;
    if (!isJSXSource(target) || !isJSXSource(newParent)) return null;
    const position = obj.position;
    if (position !== 'start' && position !== 'end') return null;
    return { tool: 'moveElement', args: { target, newParent, position } };
  }
  return null;
}

function parseElementDescriptor(
  v: unknown,
  allowText = true,
): { tag: string; props?: Record<string, string>; text?: string } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.tag !== 'string' || o.tag.length === 0) return null;

  const out: { tag: string; props?: Record<string, string>; text?: string } = { tag: o.tag };

  if (o.props !== undefined) {
    if (!o.props || typeof o.props !== 'object' || Array.isArray(o.props)) return null;
    const props: Record<string, string> = {};
    for (const [k, val] of Object.entries(o.props as Record<string, unknown>)) {
      if (typeof val !== 'string') return null;
      props[k] = val;
    }
    out.props = props;
  }

  if (allowText && o.text !== undefined) {
    if (typeof o.text !== 'string') return null;
    out.text = o.text;
  }

  return out;
}

function isJSXSource(v: unknown): v is JSXSource {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.fileName === 'string' &&
    typeof o.lineNumber === 'number' &&
    typeof o.columnNumber === 'number'
  );
}
