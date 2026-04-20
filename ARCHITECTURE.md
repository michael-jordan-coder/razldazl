# Architecture

## System layout

```
┌────────────────────────────────────────────────────────────┐
│ Browser                                                    │
│                                                            │
│ ┌──────────────────────┐       ┌──────────────────────┐   │
│ │ editor-ui  :5174     │──────▶│ preview iframe       │   │
│ │                      │ post  │ ┌──────────────────┐ │   │
│ │ - iframe host        │◀──────│ │ demo-app :5173   │ │   │
│ │ - selection overlay  │ msg   │ │                  │ │   │
│ │ - props panel        │       │ │ jsx-runtime →    │ │   │
│ │ - chat + diff view   │       │ │ __propsToSource  │ │   │
│ └──────────┬───────────┘       │ │                  │ │   │
│            │                   │ │ preview-agent    │ │   │
│            │ WebSocket         │ └──────────────────┘ │   │
└────────────┼───────────────────└──────────────────────┘   │
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ server :4000                                               │
│                                                            │
│ ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│ │ WS router    │──▶│ ai turn loop │──▶│ ast-engine     │  │
│ │ (bridge)     │   │ (Claude)     │   │ (babel+recast) │  │
│ └──────────────┘   └──────────────┘   └────────┬───────┘  │
│                                                │          │
│                                                ▼          │
│                                         writes file on    │
│                                         disk in demo-app  │
└────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                                        Vite HMR → preview
                                        re-renders →
                                        __propsToSource
                                        refreshed with new
                                        props objects
```

## The loop (step by step)

1. **Click in preview.** `preview-agent` receives click, reads `node.__reactFiber$*`, walks `fiber.return` up until it finds a `memoizedProps` that's a key in `window.__propsToSource`. Returns `{ fileName, lineNumber, columnNumber }`.
2. **Relay to editor.** `preview-agent` `postMessage`s the source triple + element rect to `editor-ui`.
3. **Editor highlights.** `editor-ui` paints the selection overlay, opens the props panel for that source triple, fetches the file contents from the server.
4. **User prompts.** "Make this text-xl and rename to Subscribe." Editor sends `{ api: "ai", method: "runTurn", args: { message, context: { selectedSource } } }` over WS.
5. **AI turn.** `server` calls `ai.runTurn`, which calls Claude Opus 4.7 with prompt-cached system message + tool schemas. Claude emits `tool_use` blocks for `setJSXProp({ file, line, col, prop: "className", value: "... text-xl" })` and `updateJSXText({ file, line, col, text: "Subscribe" })`.
6. **AST edit.** `server` dispatches each tool call to `ast-engine.editFile(path, ops)`. Engine parses with `@babel/parser` (preserving comments + ranges), locates the node by line+col, applies the edit via `recast`, writes the file.
7. **HMR.** Vite detects the file change, pushes HMR payload to demo-app. React re-renders. `jsxDEVKeepSource` repopulates `__propsToSource` with fresh props objects (keyed by the new props identity).
8. **Re-lock selection.** `preview-agent` observes the re-render, re-queries its last selection's source triple against the new `__propsToSource`, finds the new DOM node, emits updated rect to `editor-ui`. Editor's overlay tracks the element through the edit.
9. **Chat UI.** Throughout, `ai` streams parts (`text`, `tool-call`, `file-edit`, `app-validation`) back to the editor over the WS resource-sync channel.

## Wire protocol (from `@product/protocol`)

**Envelope**:
```ts
type WSEnvelope =
  | { type: 'call'; id: string; api: string; method: string; args: unknown }
  | { type: 'callback'; id: string; ok: true; result: unknown }
  | { type: 'callback'; id: string; ok: false; error: string }
  | { type: 'event'; topic: string; data: unknown };
```

**Source triple** (the load-bearing type):
```ts
type JSXSource = {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
};
```

**Tool calls** (what `ai` emits, what `ast-engine` consumes):
```ts
type ToolCall =
  | { tool: 'setJSXProp'; args: { source: JSXSource; prop: string; value: string } }
  | { tool: 'updateJSXText'; args: { source: JSXSource; text: string } };
```

## Critical correctness invariant

Every AST edit in `@product/ast-engine` **must** leave the `{lineNumber, columnNumber}` of every non-edited JSX element unchanged. Violating this silently breaks the `__propsToSource` WeakMap on the next HMR re-render (the new element renders, writes its source to the WeakMap keyed on new props, but the editor's stored source triple no longer matches any render's output).

This is enforced by property-based tests. See `packages/ast-engine/__tests__/preserve-coords.test.ts`.

## Deferred

| Item | Why deferred |
|---|---|
| Multi-file edits | Invariant of single-file edit is the foundation. Cross-file coordination is a separate design problem (transactional semantics, order-dependent validation). |
| CRDT / multi-user | Single-user semantics must be correct first. |
| Publishing / containers | Orthogonal to the edit loop. |
| History / rollback | Git is a reasonable fallback while the core is stabilizing. |
| Auth | Local-only until multi-user. |
