// @product/protocol — the single source of truth for every wire type.
//
// All trust boundaries (WebSocket messages, postMessage, AI tool calls) parse
// against schemas defined here. If a value doesn't match, it's a bug, not a
// runtime fallback — fail loudly.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// JSXSource — the load-bearing coordinate triple.
// ---------------------------------------------------------------------------

export const jsxSourceSchema = z.object({
  fileName: z.string().min(1),
  lineNumber: z.number().int().positive(),
  columnNumber: z.number().int().nonnegative(),
});
export type JSXSource = z.infer<typeof jsxSourceSchema>;

// ---------------------------------------------------------------------------
// Tool calls — what the AI emits, what ast-engine consumes.
// ---------------------------------------------------------------------------

export const setJSXPropSchema = z.object({
  tool: z.literal('setJSXProp'),
  args: z.object({
    source: jsxSourceSchema,
    prop: z.string().min(1),
    value: z.string(),
  }),
});

export const updateJSXTextSchema = z.object({
  tool: z.literal('updateJSXText'),
  args: z.object({
    source: jsxSourceSchema,
    text: z.string(),
  }),
});

// Structural edits — add, wrap, delete, move a JSX element. All four resolve
// their targets against the AST at the start of a batch, so mixing structural
// and attribute ops in one batch is safe.
//
// `tag` is the element's name (e.g. "div", "Button"). `props` are stringified
// attribute values only for now — no expression attrs, no boolean shorthand.
// `text` becomes the element's single JSXText child; omit for a self-closing
// element. Nested children are not expressible in a descriptor — chain ops to
// build a subtree.

export const jsxElementDescriptorSchema = z.object({
  tag: z.string().min(1),
  props: z.record(z.string(), z.string()).optional(),
  text: z.string().optional(),
});
export type JSXElementDescriptor = z.infer<typeof jsxElementDescriptorSchema>;

export const jsxPositionSchema = z.union([z.literal('start'), z.literal('end')]);
export type JSXPosition = z.infer<typeof jsxPositionSchema>;

export const addElementSchema = z.object({
  tool: z.literal('addElement'),
  args: z.object({
    parent: jsxSourceSchema,
    position: jsxPositionSchema,
    element: jsxElementDescriptorSchema,
  }),
});

export const wrapElementSchema = z.object({
  tool: z.literal('wrapElement'),
  args: z.object({
    target: jsxSourceSchema,
    // Wrapper can't carry text — its child is the target element.
    wrapper: jsxElementDescriptorSchema.omit({ text: true }),
  }),
});

export const deleteElementSchema = z.object({
  tool: z.literal('deleteElement'),
  args: z.object({
    target: jsxSourceSchema,
  }),
});

export const moveElementSchema = z.object({
  tool: z.literal('moveElement'),
  args: z.object({
    target: jsxSourceSchema,
    newParent: jsxSourceSchema,
    position: jsxPositionSchema,
  }),
});

export const toolCallSchema = z.discriminatedUnion('tool', [
  setJSXPropSchema,
  updateJSXTextSchema,
  addElementSchema,
  wrapElementSchema,
  deleteElementSchema,
  moveElementSchema,
]);
export type ToolCall = z.infer<typeof toolCallSchema>;

// ---------------------------------------------------------------------------
// WebSocket envelope — transport for all editor ↔ server traffic.
// Shape mirrors Dazl's observed `{type, from, to, data, callbackId}` pattern,
// simplified to what we need for the first slice.
// ---------------------------------------------------------------------------

export const wsCallSchema = z.object({
  type: z.literal('call'),
  id: z.string(),
  api: z.string(),
  method: z.string(),
  args: z.unknown(),
});

export const wsCallbackSchema = z.union([
  z.object({
    type: z.literal('callback'),
    id: z.string(),
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal('callback'),
    id: z.string(),
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export const wsEventSchema = z.object({
  type: z.literal('event'),
  topic: z.string(),
  data: z.unknown(),
});

export const wsEnvelopeSchema = z.union([wsCallSchema, wsCallbackSchema, wsEventSchema]);
export type WSEnvelope = z.infer<typeof wsEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Chat parts — streamed from server → editor during an AI turn.
// Modeled after Dazl's observed `parts[]`: text, tool-call, file-edit,
// app-validation, read-file.
// ---------------------------------------------------------------------------

export const chatPartSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    kind: z.literal('tool-call'),
    id: z.string(),
    tool: z.string(),
    args: z.unknown(),
    state: z.enum(['running', 'success', 'error']),
    error: z.string().optional(),
  }),
  z.object({
    kind: z.literal('file-edit'),
    id: z.string(),
    path: z.string(),
    beforeHash: z.string(),
    afterHash: z.string(),
    diff: z.string(),
    // Full contents before/after the edit, carried so the client can revert
    // without a round-trip. Only present for forward edits, not for reverts.
    before: z.string().optional(),
    after: z.string().optional(),
  }),
  z.object({
    kind: z.literal('app-validation'),
    id: z.string(),
    ok: z.boolean(),
    errors: z.array(z.string()),
  }),
]);
export type ChatPart = z.infer<typeof chatPartSchema>;

// ---------------------------------------------------------------------------
// Preview ↔ Editor postMessage protocol.
// ---------------------------------------------------------------------------

export const previewToEditorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ready'),
  }),
  z.object({
    kind: z.literal('selected'),
    source: jsxSourceSchema,
    rect: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
    tag: z.string(),
    text: z.string().nullable(),
    className: z.string().nullable(),
  }),
  z.object({
    kind: z.literal('cleared'),
  }),
  z.object({
    kind: z.literal('rerendered'),
  }),
]);
export type PreviewToEditor = z.infer<typeof previewToEditorSchema>;

export const editorToPreviewSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('relock'),
    source: jsxSourceSchema,
  }),
  z.object({
    kind: z.literal('clear'),
  }),
  z.object({
    kind: z.literal('mode'),
    mode: z.enum(['edit', 'preview']),
  }),
]);
export type EditorToPreview = z.infer<typeof editorToPreviewSchema>;

// ---------------------------------------------------------------------------
// AI turn API — called over WS from editor-ui.
// ---------------------------------------------------------------------------

export const aiRunTurnArgsSchema = z.object({
  message: z.string().min(1),
  context: z.object({
    selectedSource: jsxSourceSchema.nullable(),
  }),
});
export type AIRunTurnArgs = z.infer<typeof aiRunTurnArgsSchema>;

// ---------------------------------------------------------------------------
// File API — editor-ui → server.
// ---------------------------------------------------------------------------

export const readFileArgsSchema = z.object({
  path: z.string().min(1),
});
export const readFileResultSchema = z.object({
  path: z.string(),
  contents: z.string(),
});

// ---------------------------------------------------------------------------
// Direct AST-edit API — editor-ui → server. Used by the Design panel to apply
// a concrete edit without going through the AI turn loop.
// ---------------------------------------------------------------------------

export const astEditApplyArgsSchema = z.object({
  ops: z.array(toolCallSchema).min(1),
});
export type AstEditApplyArgs = z.infer<typeof astEditApplyArgsSchema>;

// ---------------------------------------------------------------------------
// Raw file write — editor-ui → server. Used by undo/redo to restore a
// previous snapshot verbatim, bypassing the AST engine.
// ---------------------------------------------------------------------------

export const fileWriteArgsSchema = z.object({
  edits: z
    .array(
      z.object({
        path: z.string().min(1),
        contents: z.string(),
      }),
    )
    .min(1),
});
export type FileWriteArgs = z.infer<typeof fileWriteArgsSchema>;
