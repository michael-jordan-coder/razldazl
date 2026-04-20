// Tool schemas exposed to Claude. These map 1:1 onto @product/ast-engine
// operations. Keep the schemas minimal — the AI should not be guessing at
// implementation detail.

import type Anthropic from '@anthropic-ai/sdk';

export const SYSTEM_PROMPT = `You are the editing brain of a live React visual editor.

The user has selected an element in a running preview. You receive the element's source coordinates (fileName, lineNumber, columnNumber) and the user's natural-language request.

Use the provided tools to apply the smallest set of edits that satisfies the request. Edits take effect immediately — the user sees the preview update as you work.

Rules:
- Always pass the \`source\` you were given (or a coordinate discovered from context) verbatim to each tool.
- Prefer editing the exact selected element. Only edit other elements when the request unambiguously demands it.
- Tailwind utility classes are the default styling language. Merge with any existing className; do not drop existing classes unless asked.
- When a user says "make this X", default to changing className or inner text; avoid structural edits unless asked.
- After all edits, write one short sentence confirming what you changed. Do not narrate each tool call.`;

// Anthropic tool schema type
type Tool = Anthropic.Messages.Tool;

const jsxSourceSchema = {
  type: 'object' as const,
  properties: {
    fileName: { type: 'string' as const, description: 'Absolute path of the source file.' },
    lineNumber: {
      type: 'integer' as const,
      description: '1-indexed line of the JSX opening tag.',
    },
    columnNumber: {
      type: 'integer' as const,
      description: '0-indexed column of the JSX opening tag.',
    },
  },
  required: ['fileName', 'lineNumber', 'columnNumber'],
  additionalProperties: false,
};

export const toolSchemas: Tool[] = [
  {
    name: 'setJSXProp',
    description:
      'Set or update a JSX attribute on the element at the given source coordinates. For className, pass the full new value.',
    input_schema: {
      type: 'object',
      properties: {
        source: jsxSourceSchema,
        prop: {
          type: 'string',
          description: 'JSX attribute name (e.g. "className", "disabled", "href").',
        },
        value: {
          type: 'string',
          description: 'New string value. The editor wraps this in a JSX string literal.',
        },
      },
      required: ['source', 'prop', 'value'],
    },
  },
  {
    name: 'updateJSXText',
    description:
      'Replace the text content of the JSX element at the given source coordinates with new text. Any child elements inside the target are removed.',
    input_schema: {
      type: 'object',
      properties: {
        source: jsxSourceSchema,
        text: {
          type: 'string',
          description: 'New text content for the element.',
        },
      },
      required: ['source', 'text'],
    },
  },
];
