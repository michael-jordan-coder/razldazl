# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A dev-time AI visual editor for React — the DOM click → React fiber walk → `__propsToSource` → source coordinates → AST edit → Vite HMR → preview re-renders with selection re-locked pipeline, built production-grade.

**Scope: design engineers.** JSX / Tailwind / visual composition. Not for backend, API routes, or database work — the AST engine only understands JSX. Peers in positioning: Dazl, Tempo Labs, v0, Bolt, Figma Sites/Make. Evaluate new features through this lens: *"does this help a design engineer iterate faster on a visual surface?"*

A `.claude/agents/product-worker.md` subagent at the workspace root carries the full context and auto-runs for code changes here. Read it for the non-negotiable invariants and gotchas.

## Commands

From this directory (`product/`):

```bash
pnpm install                          # bootstrap workspace
cp .env.example .env                  # then paste ANTHROPIC_API_KEY
pnpm dev                              # boots 3 processes in parallel

pnpm build                            # turbo: tsc -b across packages + vite build for apps
pnpm typecheck                        # tsc -b --noEmit across packages
pnpm lint                             # ESLint flat config
pnpm test                             # vitest across packages, excluding e2e

pnpm --filter @product/ast-engine test          # the correctness core alone
pnpm --filter @product/ast-engine test preserve # run a single test by name
pnpm e2e                              # Playwright (requires: npx playwright install chromium once)
pnpm format                           # prettier
```

`pnpm dev` boots:
- `http://localhost:5173` — demo-app (edit target)
- `http://localhost:5174` — editor-ui (open this)
- `ws://localhost:4000` — server (AST + AI)

If ports are stuck: `lsof -ti :5173 -i :5174 -i :4000 | xargs -r kill -9`.

Environment variables live in `.env` at this directory root. Loaded by `packages/server/src/cli.ts` via Node 22's `process.loadEnvFile`. `ANTHROPIC_API_KEY` is required for the AI chat path; direct panel controls work without it.

## Architecture

Nine packages in `packages/`. Dependency order flows downward:

```
jsx-runtime  ← leaf. The load-bearing primitive (port of @dazl/dev, MIT).
protocol     ← leaf. Zod schemas for every wire type.
bridge       ← WS client+server, postMessage. Browser-safe root entry; Node server at `@product/bridge/server`.
preview-agent← injected into the preview iframe. Fiber walk, selection overlay, HMR relock.
ast-engine   ← Babel + recast. setJSXProp, updateJSXText, findJSXElements. Coord-preserving.
ai           ← Claude turn loop. Tool schemas. Design-engineering system prompt.
server       ← Node HTTP+WS. Routes intent → ai or ast-engine. Sandboxed file I/O.
editor-ui    ← React+Vite editor. Top toolbar, Sidebar (chat), PreviewPane, DesignPanel.
demo-app     ← Vite+React+Tailwind sample app being edited.
```

`ARCHITECTURE.md` has the full system diagram and message flow through the edit loop.

### The edit loop

1. User clicks a node → `preview-agent` walks `fiber.return` up until `memoizedProps` is a key in `window.__propsToSource`.
2. postMessage → `editor-ui` paints selection overlay, opens Design panel.
3. User edits a control → WS call `astEdit.apply` (direct) or `ai.runTurn` (natural language).
4. `server` → `ast-engine.editFile` parses with `@babel/parser`, locates node by 1-indexed line/col, edits via `recast`, writes file.
5. Vite HMR → demo-app re-renders → `jsxDEVKeepSource` refreshes `__propsToSource`.
6. `preview-agent` re-locks selection on the same source triple.

### Non-negotiable invariants

- **Source-coord preservation.** For attribute/text edits (`setJSXProp`, `updateJSXText`) every non-edited element's `{lineNumber, columnNumber}` must stay identical. For structural edits (`addElement`, `wrapElement`, `deleteElement`, `moveElement`) the rule is relaxed: elements strictly *before* the mutation point preserve their coords; elements after may shift, since HMR regenerates `__source` and the preview-agent re-locks from the refreshed map. Both forms are property-tested in `packages/ast-engine/src/__tests__/preserve-coords.test.ts` — if you touch the engine, these must pass.
- **Zod at every trust boundary.** WS messages, postMessage, AI tool calls all parse through schemas in `packages/protocol/src/index.ts`. No `any` at boundaries.
- **Protocol-first.** All wire types live in `@product/protocol`. No duplicated definitions.
- **1-indexed columns.** React's JSX dev transform emits `column + 1` in `__source`. `ast-engine/src/edit.ts` does `source.columnNumber - 1` to match Babel's 0-indexed loc. Preserve this convention anywhere that matches coords.
- **Sandboxed file I/O.** `resolveInsideRoot` in `packages/server/src/server.ts` strips Vite's `?t=…` query and rejects anything escaping `projectRoot`.
- **Undo requires `runAction` wrapping.** Any new edit path must go through `useUndo.runAction(fn)` or it won't be reversible. `file-edit` chat parts must include `before` + `after` full contents.

### UI3 design tokens

`packages/editor-ui/src/index.css` defines CSS custom properties for the Figma UI3 visual language:

- `--ui-bg` `#1e1e1e` (panels), `--ui-bg-input` `#2c2c2c` (inputs), `--ui-border` `rgba(255,255,255,0.08)`
- `--ui-text` / `--ui-text-secondary` / `--ui-text-tertiary`
- `--ui-accent` `#0d99ff` (Figma blue)
- Radius 5px medium / 2px small. Row height 24px. Section header 40px. Body text 11px Inter medium; strong 550.

Use these, not raw Tailwind colors. Compose via existing primitives in `packages/editor-ui/src/design/primitives/` (`Popover`, `Select`, `SegmentedControl`, `LabeledField`).

### Role-based Design panel

`DesignPanel` dispatches to section components via `ROLE_SECTIONS[role]` + `SECTION_RENDER[id]` (see `packages/editor-ui/src/design/role.ts`). Roles: `text` / `button` / `input` / `image` / `container` / `fallback`. Adding a new section = one file in `design/sections.tsx` + entries in the three maps in `DesignPanel.tsx`.

## Gotchas worth knowing

- **No `@vitejs/plugin-react`.** The demo-app uses esbuild's built-in JSX (`jsxDev: true`, `jsxImportSource: '@product/jsx-runtime'`). The React plugin prepends ~19 lines of Fast Refresh preamble before Babel parses, shifting `__source` lineNumbers and breaking DOM→file mapping. Trade-off: no Fast Refresh (full reload on edit).
- **StrictMode double-mount in `useWS`.** WS client is created inside `useEffect`, not `useMemo`. Otherwise the first effect's cleanup closes the socket before the second effect uses it.
- **Vite `?t=` query strings** appear on `fileName` in `__source`. Always strip via `split('?')[0]` or `resolveInsideRoot`.
- **Pattern caching.** `className-utils.ts` exposes RegExp patterns as module-scope constants (`TEXT_SIZE_PATTERN` etc.) with back-compat function shims. Prefer the constants in new code.
- **Radix Select** under Tailwind v4 needs `position="popper"` for the portal to size correctly.

## Workflow

1. **Read `SESSIONS.md`** for recent context. Prepend a new entry at the top after every meaningful session. Format is fixed (Goal / Shipped / Deferred / Tests / Gotchas).
2. **Build + test before declaring done.** All tests green, zero TS errors, all 9 packages build.
3. **Research context lives in `../info/`.** `dazl-architecture.md`, `dazl-critical-unknowns.md`, `dazl-next-todos.md`. Preserve evidence tags (OBSERVED / INFERRED / DOCUMENTED / OPEN) when editing those.
4. **Prefer editing existing files** over creating new ones. Don't add docs/READMEs unless asked.

## Explicitly deferred

Do not rabbit-hole into these without a direct ask:
- Validation loop (AI sees typecheck/build errors, self-corrects) — highest-leverage next move
- Editor-UI controls for structural edits (insert / wrap / delete buttons in the Design panel — engine + AI tools already landed)
- State variants (hover / focus / disabled tabs in the design panel)
- Fast Refresh restoration via source-map remap
- Multi-file edits + transactional semantics
- Component/token introspection (read `tailwind.config`, Radix metadata, theme files)
- CRDT / multi-user, publishing, git integration, auth, asset management
