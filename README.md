# product/

Production-quality foundations for an AI-assisted visual editor for React — a Dazl-like product built on the reverse-engineering in the parent workspace.

## Who this is for

**Design engineers.** People who live in JSX, Tailwind utility classes, and visual component structure. The tool reads DOM → fiber → source coordinates and writes back to `.tsx` files on disk, giving direct-manipulation control over layout, typography, color, spacing, and component composition.

**Not for:** backend/full-stack work. The AST engine only understands JSX; it has no concept of API routes, database schemas, or server code. Reach for Cursor or a full-stack agent for that.

**Closest peers in positioning:** Dazl, Tempo Labs, v0, Bolt, Figma Sites/Make — visual editors. Not Cursor, Aider, or codegen agents.

## Run

```bash
pnpm install
cp .env.example .env       # then paste your ANTHROPIC_API_KEY
pnpm dev
```

Boots three processes in parallel:

- `http://localhost:5173` — **demo-app** (the app being edited, Vite HMR)
- `http://localhost:5174` — **editor-ui** (the editor itself; loads demo-app in an iframe)
- `ws://localhost:4000` — **server** (WS bus + AST engine + AI turn loop)

Open `http://localhost:5174` in a browser and click a node in the embedded preview.

## Packages

| Package | Role |
|---|---|
| `@product/jsx-runtime` | Dev-time JSX wrapper. Populates `window.__propsToSource` (port of `@dazl/dev`). The single load-bearing primitive. |
| `@product/protocol` | Zod schemas for every WS message, tool call, and source triple. Single source of truth for wire types. |
| `@product/bridge` | Transport: WS client/server, postMessage helpers, resource-sync primitive. |
| `@product/preview-agent` | Injected into the preview iframe. DOM-node → source lookup via React fiber walk + `__propsToSource`. |
| `@product/editor-ui` | React app: iframe host, selection overlay, props panel, AI chat, diff view. |
| `@product/ast-engine` | Babel + recast source-coord-preserving edit primitives. Property-tested. |
| `@product/ai` | Claude turn loop with tool use. |
| `@product/server` | Node HTTP+WS server. Routes intent → ai or ast-engine, mediates file I/O. |
| `@product/demo-app` | Sample React + Vite + Tailwind app used as the edit target. |

## Testing

```bash
pnpm test                    # unit + integration (all packages except e2e)
pnpm --filter @product/ast-engine test   # the correctness core
pnpm e2e                     # Playwright end-to-end — requires browsers:
                             #   npx playwright install chromium   (once)
```

## Correctness core

Every AST edit **must** preserve `{line, column}` of every non-edited JSX element in the file. If that invariant breaks, the `__propsToSource` WeakMap goes stale on HMR, click-to-source regresses silently, and the whole product breaks.

This is enforced by property-based tests in `packages/ast-engine`:

```bash
pnpm --filter @product/ast-engine test
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system diagram and message flow through the full editor loop.

## History

See [SESSIONS.md](./SESSIONS.md) for a session-by-session changelog (goal, what shipped, what was deferred, test count, gotchas). Add an entry at the top every working session.

## Not yet

First-slice deferrals (explicit): multi-file edits, CRDT/multi-user, publishing, auth, history, full tool catalog beyond `setJSXProp` + `updateJSXText`.
