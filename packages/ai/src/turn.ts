// Single-turn loop: user message + selected-element context → Claude emits
// tool calls and optional text. Streams parts to the caller as they arrive.
//
// We use prompt caching on the system prompt + tool schemas, which stay
// stable across turns. This is the highest-leverage caching target: tools
// alone are several kB of JSON Schema, and they don't change per-request.

import Anthropic from '@anthropic-ai/sdk';
import type { ChatPart, JSXSource, ToolCall } from '@product/protocol';
import { SYSTEM_PROMPT, toolSchemas } from './tools.js';
import { MODEL } from './model.js';

export interface RunTurnOptions {
  client: Anthropic;
  message: string;
  selectedSource: JSXSource | null;
  fileContents: string | null;
  onPart: (part: ChatPart) => void;
}

export interface RunTurnResult {
  toolCalls: ToolCall[];
  finalText: string;
  stopReason: string | null;
}

export async function runTurn({
  client,
  message,
  selectedSource,
  fileContents,
  onPart,
}: RunTurnOptions): Promise<RunTurnResult> {
  const contextBlocks: string[] = [];
  if (selectedSource) {
    contextBlocks.push(
      `Selected element: ${selectedSource.fileName}:${selectedSource.lineNumber}:${selectedSource.columnNumber}`,
    );
  }
  if (fileContents) {
    contextBlocks.push(`Current contents of the selected file:\n\n\`\`\`tsx\n${fileContents}\n\`\`\``);
  }
  contextBlocks.push(`User request: ${message}`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: toolSchemas.map((t, i) =>
      // Cache the last tool definition; Anthropic caches everything up to and
      // including the cached breakpoint.
      i === toolSchemas.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t,
    ) as Anthropic.Messages.Tool[],
    messages: [
      {
        role: 'user',
        content: contextBlocks.join('\n\n'),
      },
    ],
  });

  const toolCalls: ToolCall[] = [];
  let finalText = '';

  for (const block of response.content) {
    if (block.type === 'text') {
      finalText += block.text;
      onPart({ kind: 'text', id: block.type + '-' + finalText.length, text: block.text });
    } else if (block.type === 'tool_use') {
      const parsed = parseToolCall(block.name, block.input);
      if (parsed) {
        toolCalls.push(parsed);
        onPart({
          kind: 'tool-call',
          id: block.id,
          tool: block.name,
          args: block.input,
          state: 'running',
        });
      } else {
        onPart({
          kind: 'tool-call',
          id: block.id,
          tool: block.name,
          args: block.input,
          state: 'error',
          error: `Unknown or malformed tool call: ${block.name}`,
        });
      }
    }
  }

  return {
    toolCalls,
    finalText,
    stopReason: response.stop_reason,
  };
}

function parseToolCall(name: string, input: unknown): ToolCall | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const source = obj.source;
  if (!isJSXSource(source)) return null;

  if (name === 'setJSXProp') {
    const prop = obj.prop;
    const value = obj.value;
    if (typeof prop !== 'string' || typeof value !== 'string') return null;
    return { tool: 'setJSXProp', args: { source, prop, value } };
  }
  if (name === 'updateJSXText') {
    const text = obj.text;
    if (typeof text !== 'string') return null;
    return { tool: 'updateJSXText', args: { source, text } };
  }
  return null;
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
