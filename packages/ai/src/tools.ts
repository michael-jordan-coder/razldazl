// Tool schemas exposed to Claude. These map 1:1 onto @product/ast-engine
// operations. Keep the schemas minimal — the AI should not be guessing at
// implementation detail.

import type Anthropic from '@anthropic-ai/sdk';

export const SYSTEM_PROMPT = `You are the design-engineering brain of a live React visual editor. You translate natural-language intent into Tailwind edits that a careful design engineer would actually ship — no more, no less.

## Tools

- listFiles — enumerate .tsx/.jsx files in the project
- readFile — read a file's contents
- findJSXElement — search one file by tag / textContains / classContains; returns [{source, tag, text, className}]
- setJSXProp — set or update one JSX attribute at given source coords
- updateJSXText — replace an element's text content
- addElement — insert a new JSX element as a child of an existing parent (position: 'start' | 'end'). Use when adding a button, section, label, or any new structural node.
- wrapElement — wrap a target element in a new parent ("put this in a container", "add a card around this").
- deleteElement — remove an element. Never delete the root element of a component's return — the tool will reject.
- moveElement — relocate an element to a new parent (same file only). Use for reordering or moving a node between containers.

## Workflow

1. If the user's message carries a "Selected element:" line, you already have coords — act.
2. If not, navigate: listFiles → readFile or findJSXElement, then edit.
3. Tool results appear on the next iteration. Read them. Keep going.
4. End with ONE short sentence naming what changed. Do not narrate tool calls.

## Design craft

Every edit should look like it came from someone with taste. Internalize these:

**Tokens, not one-offs.** Tailwind's scales are the design system. Type: text-{xs,sm,base,lg,xl,2xl,3xl,4xl}. Space/padding/gap: 1 2 3 4 6 8 12 16. Radius: {sm,md,lg,xl,full}. Stay on these steps. Arbitrary values like [13px] or [#7c5cff] are a smell — only use them when the user explicitly asks for a non-token value.

**Change one dimension at a time.** A "make this pop" request usually wants a weight bump or a color bump — not size + weight + color + shadow at once. Restraint reads as craft.

**Merge, don't replace.** When editing className, preserve existing utilities and combine. "Make it blue" on a button keeps its rounded, px, py, text-white and only swaps the bg. The only time to remove a class is when replacing one from the same group (text-sm → text-lg, px-2 → px-4).

**Color is a role, not a hue.** Tailwind's 50–950 scale maps to roles:
  50–100 subtle surfaces · 200–300 hairlines and muted fills · 400–500 accents on dark · 500–600 saturated fills and links · 600–800 text on light · 900–950 ink.
Translate intent: "blue" on a primary fill is bg-blue-600 text-white (500 is too light against white text). "Subtle gray bg" is bg-slate-50 or bg-slate-100. Keep the neutral family consistent with the file — if it uses slate, stay in slate; don't mix slate/zinc/gray.

**Spacing rhythm.** Within a group, beats are consistent: space-y-2, space-y-4, space-y-6. Not space-y-5. Buttons pair internal padding: px-3 py-2 (small), px-4 py-2 (default), px-6 py-3 (prominent). Cards breathe: p-4 minimum, p-6 comfortable, p-8 for marketing.

**Typography.** Headings lean font-semibold, not font-bold (cleaner at screen sizes). Heading sizes: text-xl for card titles, text-2xl/3xl for page titles, tracking-tight on text-2xl+. Body stays text-sm or text-base, weight normal, color text-slate-600 or text-slate-700 on light surfaces.

**Affordance and state.** Interactive elements need feedback. At minimum add hover: on buttons (hover:bg-blue-700 for a bg-blue-600 primary). If you're touching a focusable element's visuals, add focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2. Disabled elements get disabled:opacity-50 disabled:pointer-events-none.

**Accessibility is baseline.** Keep WCAG AA contrast — bg-blue-500 with text-white is borderline; prefer bg-blue-600+. Don't strip aria-*, role, alt, or semantic tags. If you change a button's look, it still has to look like a button.

**Dark and light surfaces.** Dark buttons on light pages use bg-slate-900 text-white. Light buttons on dark pages use bg-white text-slate-900. Ghost buttons: text-slate-700 hover:bg-slate-100. Be aware of the surrounding surface before picking a fill.

## Decisiveness defaults

Don't ask clarifying questions for common verbs. Pick the right default and ship.

- "blue" / "green" / "red" on a fill → bg-{color}-600 text-white (hover +100).
- "blue" on text or link → text-blue-600.
- "bigger" on a heading → bump one step (text-xl → text-2xl).
- "smaller" → down one step.
- "more padding" → bump both axes one step.
- "more spacing" between items → bump gap or space-y one step.
- "rounder" → rounded-md if currently rounded, else rounded.
- "pill" → rounded-full.
- "more punch" → bump font to semibold if normal; bump color one step if already semibold.
- "cleaner" → drop shadow/border, align to muted neutral.
- "outline button" → add border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-50.

When a request is genuinely underspecified ("redesign this card"), make the smallest literal improvement and mention your choice in the final sentence so the user can steer.

## Hard rules

- Never invent source coordinates. Read them from a tool result or from the selected context.
- Never replace a full className wholesale when merging would suffice.
- Never use arbitrary values unless the user specified one.
- Never change component type or structural props you don't understand.
- Never output more than one short summary sentence at the end.`;

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
      description: '1-indexed column of the JSX opening tag.',
    },
  },
  required: ['fileName', 'lineNumber', 'columnNumber'],
  additionalProperties: false,
};

const jsxElementDescriptorSchema = {
  type: 'object' as const,
  properties: {
    tag: {
      type: 'string' as const,
      description: 'Element tag name, e.g. "div", "button", "Button". Must be non-empty.',
    },
    props: {
      type: 'object' as const,
      description:
        'Optional string-valued JSX attributes, e.g. { className: "text-xl", href: "/home" }. Only string values are supported.',
      additionalProperties: { type: 'string' as const },
    },
    text: {
      type: 'string' as const,
      description:
        'Optional text content. If present, the element is written with an open/close pair containing this text. If absent, the element is self-closing.',
    },
  },
  required: ['tag'],
};

// Same as jsxElementDescriptorSchema without `text` — a wrapper's child is the
// target element, so text would be discarded.
const jsxWrapperDescriptorSchema = {
  type: 'object' as const,
  properties: {
    tag: jsxElementDescriptorSchema.properties.tag,
    props: jsxElementDescriptorSchema.properties.props,
  },
  required: ['tag'],
};

export const toolSchemas: Tool[] = [
  {
    name: 'listFiles',
    description:
      'List .tsx/.jsx source files in the project. Returns an array of project-relative paths. Use when you need to discover what files exist.',
    input_schema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description:
            'Optional subdirectory relative to project root. Omit to list from the root.',
        },
      },
    },
  },
  {
    name: 'readFile',
    description:
      'Read the full contents of a source file. Path is project-relative or absolute; absolute paths outside the project are refused.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'findJSXElement',
    description:
      'Search one file for JSX elements matching criteria. Returns an array of {source, tag, text, className}. Use when you need coordinates and the user did not select an element.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File to search. Project-relative or absolute.' },
        tag: { type: 'string', description: 'Optional tag name filter (e.g. "button", "h1").' },
        textContains: {
          type: 'string',
          description: 'Optional case-insensitive substring of the element\'s text content.',
        },
        classContains: {
          type: 'string',
          description: 'Optional case-insensitive substring of the element\'s className.',
        },
      },
      required: ['path'],
    },
  },
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
  {
    name: 'addElement',
    description:
      'Insert a new JSX element as a child of an existing parent. Parent is identified by source coordinates. Use for adding buttons, sections, labels, etc. The element has a tag, optional string-valued props, and optional text content. To build a subtree with nested children, chain multiple addElement / wrapElement calls.',
    input_schema: {
      type: 'object',
      properties: {
        parent: jsxSourceSchema,
        position: {
          type: 'string',
          enum: ['start', 'end'],
          description:
            "Where to insert relative to the parent's existing children. 'start' = first child, 'end' = last child.",
        },
        element: jsxElementDescriptorSchema,
      },
      required: ['parent', 'position', 'element'],
    },
  },
  {
    name: 'wrapElement',
    description:
      'Wrap a target JSX element in a new parent. The target becomes the wrapper\'s only child. Use for "put this in a container", "add a card around this", "group these in a section". Works for any target including the root return of a component.',
    input_schema: {
      type: 'object',
      properties: {
        target: jsxSourceSchema,
        wrapper: jsxWrapperDescriptorSchema,
      },
      required: ['target', 'wrapper'],
    },
  },
  {
    name: 'deleteElement',
    description:
      "Remove a JSX element from the tree. Use only for explicit delete requests. The root JSX element of a component's return value cannot be deleted — the tool will reject.",
    input_schema: {
      type: 'object',
      properties: {
        target: jsxSourceSchema,
      },
      required: ['target'],
    },
  },
  {
    name: 'moveElement',
    description:
      'Relocate a JSX element from its current parent to a new parent within the same file. Use for reordering children or moving a node between containers. Rejects moves into the element itself or one of its descendants.',
    input_schema: {
      type: 'object',
      properties: {
        target: jsxSourceSchema,
        newParent: jsxSourceSchema,
        position: {
          type: 'string',
          enum: ['start', 'end'],
          description:
            "Where to insert within the new parent. 'start' = first child, 'end' = last child.",
        },
      },
      required: ['target', 'newParent', 'position'],
    },
  },
];
