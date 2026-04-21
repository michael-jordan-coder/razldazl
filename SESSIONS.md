# Sessions

A terse log of what changed each working session. Add an entry at the **top** every time you do meaningful work. Keep entries scannable — code is the truth; this file is the narrative.

**Format per entry:**
```
## YYYY-MM-DD — short title
**Goal:** one line.
**Shipped:** bullet list of what landed (file-level).
**Deferred / known issues:** what we chose to skip, and why.
**Tests:** final count.
```

---

## 2026-04-21 — UI3 visual system (Figma-style panels)

**Goal:** Restyle both panels (Sidebar + DesignPanel) to Figma UI3's visual language — dense, dark, 11px body text, 24px input rows, 5px radius, Figma-blue (#0d99ff) accent, subtle borders.

**Shipped:**
- `editor-ui/src/index.css` — UI3 design tokens as CSS custom properties: `--ui-bg`, `--ui-bg-input`, `--ui-border`, `--ui-text`, `--ui-text-secondary`, `--ui-accent`, radius, font stack (Inter), body/heading font sizes. Tokens mapped from Figma UI3 library (file `mGoMHhP8FKt5tIzObcTk9M`).
- Redesigned `DesignPanel.tsx` — 260px wide, flat section stack with 40px headers, 11px body, generous but not wasteful padding (pl-4, pr-2). Sections separated by 1px border-b. Field labels are 64px-wide left column; control takes the rest.
- Redesigned `Sidebar.tsx` — 300px chat panel with matching header, compact connection-status row, chat parts as 5px-radius cards, Figma-blue send button, `⌘Z`/`⌘⇧Z`/`×` icon buttons in the header.
- `design/Scrubber.tsx` rewrite — UI3 numeric-input pattern (single 24px rect, letter-icon prefix slot, value right-aligned, whole rect is the drag surface; double-click to type; arrow/up/down to step).
- `design/ColorPicker.tsx` rewrite — 24px row with 14px swatch + class name + inline × clear button; popover grid uses inset box-shadow for selection and a thin border for contrast on white shades.
- `design/primitives/Popover.tsx` and `Select.tsx` rewrite — dark UI3 styling, 5px radius, subtle 0.5px inner border, Figma-style shadow (`0 8px 24px rgba(0,0,0,0.4)` + 0.5px hairline).
- `PreviewPane.tsx` selection overlay — swapped indigo for UI3 blue (`box-shadow: 0 0 0 1.5px var(--ui-accent)`, no fill), more readable against typical page backgrounds.

**Tokens captured from UI3:**
| Token | Value |
|---|---|
| Body text | 11px / 16lh / weight 450 (Inter Medium) |
| Strong body | 11px / 16lh / weight 550 (Inter Semi Bold) |
| Section heading | 13px / 22lh / weight 500 |
| Radius medium | 5px |
| Radius small | 2px |
| Input row height | 24px |
| Section header height | 40px |
| Panel padding | pl-16 pr-8 |
| Accent | `#0d99ff` |
| Panel bg (dark) | `#1e1e1e` |
| Input fill | `#2c2c2c` |
| Borders | `rgba(255,255,255,0.08)` |

**Deferred:**
- Segmented Design/Prototype tab at the top of the right panel (we only have Design for now).
- Section collapse/expand (UI3 sections are always open here).
- Proper Inter font import — using system Inter fallback. `Inter Variable` via a CDN or bundled would pixel-match.
- Icon glyphs for properties (we use letters X/Y/↔ for spacing; Figma uses SVG icons).

**Tests:** 35 passing. No logic changed; visual-only rewrite.

**Gotchas:**
- Tailwind v4 requires `rounded-[5px]` (arbitrary value) — the default scale doesn't include 5px. All panel radii use arbitrary values.
- CSS custom properties on `:root` live in `index.css`, referenced from inline styles where class-based approaches (e.g. Tailwind's text-[var()]) would be verbose.
- `focus-visible` gets the `:focus-visible { outline: 2px var(--ui-accent) }` global rule; Radix components respect this.

---

## 2026-04-21 — Session undo/redo

**Goal:** Every user action (panel control click or AI turn) becomes an atomic undoable unit. ⌘Z reverts, ⌘⇧Z redoes. No lossy hashes — full file snapshots.

**Shipped:**
- `@product/protocol`: extended `file-edit` chat part with optional `before`/`after` full-content strings; added `fileWriteArgsSchema` for the raw file-write endpoint.
- `@product/server`: `file-edit` parts now carry `before`/`after`. New `files.write` handler — raw sandboxed write used only by undo/redo. Does NOT emit chat parts (undo drives the UI client-side).
- `packages/editor-ui/src/useUndo.ts` — hook exposing `runAction(fn)`, `undo()`, `redo()`, `canUndo`, `canRedo`. `runAction` opens a batch, subscribes to `file-edit` parts during the batch, and pushes one `UndoEntry` on close. Snapshots collapse per-file (first `before`, last `after`) so multi-tool AI turns still undo in one step.
- `useWS` refactor: added `appendPart` (local-only chat messages, e.g. undo toasts) and `subscribeToChat` (internal subscription without duplicating state).
- `App.tsx`: wraps `onSend` and `onApplyEdit` in `undo.runAction`. Registers `⌘Z` / `⌘⇧Z` / `⌘Y` hotkeys.
- `Sidebar.tsx`: undo/redo buttons in the header with live counts (`↶ 3`, `↷ 1`).

**Deferred:**
- Persistent undo across page reloads (would need server-side store).
- Granular per-tool-call undo within an AI turn (current model treats the whole turn as one step — intentional).
- Undo preserves selection but doesn't restore the state variant tab (we don't have variant tabs yet).

**Tests:** 35 passing (no new tests; undo is integration behavior exercised through the UI).

**Gotchas:**
- `files.write` must not emit `file-edit` chat parts or we'd loop the undo back onto itself. Hence a separate handler from `astEdit.apply`.
- `UndoEntry.files` is collapsed: if a batch touches `App.tsx` twice, we keep the first `before` and last `after` so one revert is one write. Otherwise we'd queue N writes per undo and each HMR would fight the next.
- No-op edits (where `before === after`) are filtered out during collapse so the stack doesn't fill with empty entries when the AI responds with only text.

---

## 2026-04-21 — Deeper Design panel controls

**Goal:** Replace the chip groups in the Design panel with proper inputs — numeric scrubber for spacing, color-grid picker for bg/text/border, size/weight/radius pickers with rendered previews.

**Shipped:**
- `packages/editor-ui/src/design/tailwind-palette.ts` — 18 hues × 11 shades hex map (kept hardcoded per Daniel's preference), text-size scale with px/line-height, font-weight scale, radius scale, spacing scale.
- `packages/editor-ui/src/design/className-utils.ts` — `findClass`, `replaceGroup`, `spacingGroupPattern`, `colorGroupPattern`, `textSizePattern`, `fontWeightPattern`, `radiusPattern`, `spacingLabel`.
- `design/primitives/Popover.tsx` and `design/primitives/Select.tsx` — thin wrappers around Radix primitives with dark-theme Tailwind defaults. Code lives in our repo (shadcn-style), Radix handles a11y and focus/keyboard edge cases.
- `design/Scrubber.tsx` — Figma-style drag-on-label numeric input. Horizontal pointer drag, arrow keys, double-click to type. Commits one edit on release.
- `design/ColorPicker.tsx` — popover with the full Tailwind color grid. Swatches use inline hex so editor-ui's own Tailwind doesn't have to safelist 200+ classes; the *applied* class is a normal utility that the demo-app's Tailwind will purge/generate.
- `design/SizePicker.tsx`, `WeightPicker.tsx`, `RadiusPicker.tsx` — Radix select dropdowns where each item renders its actual visual (Aa at text-xl, "Aa" at font-semibold, a preview rect at rounded-lg).
- Rewrote `DesignPanel.tsx` around these primitives. New sections: Typography (size/weight/color), Fill (bg/border), Shape (radius), Spacing (px/py/gap scrubbers), Classes (freeform escape hatch).

**Deferred:**
- Hover/focus/disabled state tabs (needs pseudo-variant authoring support in ast-engine).
- Width/height scrubbers (needs awareness of full vs. auto vs. fraction).
- Flex/grid layout controls.
- Animated open/close for popovers (data-[state] transitions are declared but need tailwindcss-animate plugin to run).

**Dependencies added:** `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-tooltip` (tooltip scaffolded for future use).

**Tests:** 35 passing (no new unit tests — primitives are integration-tested via the panel itself at the moment).

**Gotchas:**
- ColorPicker swatches must use inline `style={{ background: hex }}` for the editor-ui's own rendering. Dynamic Tailwind classes in editor-ui source (`bg-${hue}-${shade}`) would NOT be picked up by Tailwind's source scanner. The applied utility string written to demo-app is always a literal, so demo-app's Tailwind generates it fine.
- Radix Select under Tailwind v4 needs `position="popper"` for the portal to size correctly.
- Scrubber uses `document.body.style.cursor` on drag — be careful not to leave it set if unmount happens mid-drag (cleanup effect removes the listeners, but cursor reset happens in the pointerup handler, not on unmount).

---

## 2026-04-21 — Initial foundations + full editor loop

**Goal:** Stand up a production-quality monorepo for a Dazl-like visual editor with the full loop (preview → click → chat → AI → AST edit → HMR → re-lock) working end-to-end.

**Shipped:**
- pnpm + Turbo monorepo scaffold: strict TS, Zod boundaries, ESLint flat config, Prettier, `.nvmrc`, `.env`/`.env.example` (Node 22 `loadEnvFile`).
- `@product/jsx-runtime` — port of `@dazl/dev`, populates `window.__propsToSource`. MIT attribution preserved.
- `@product/protocol` — single source of truth for wire types (JSXSource, WSEnvelope, ToolCall, ChatPart, Preview↔Editor, AST-edit API).
- `@product/ast-engine` — Babel + recast edits (`setJSXProp`, `updateJSXText`) with **property-based coord-preservation tests** (11 tests, 200-run fuzz).
- `@product/bridge` — WS server (node) split from client+postMessage (browser) to keep `node:http` out of browser bundles.
- `@product/preview-agent` — fiber walk to `__propsToSource`, click handler, selection overlay, Vite HMR relock; emits `selected` with `tag` / `text` / `className`.
- `@product/ai` — Claude Opus 4.7 turn loop with prompt-cached system + tools.
- `@product/server` — WS routing, sandboxed file I/O (`resolveInsideRoot`), AST-edit path + AI turn path.
- `@product/demo-app` — Vite + React 19 + Tailwind 4 sample. **esbuild JSX** (not `@vitejs/plugin-react`) to keep `__source` line numbers 1:1 with the source file.
- `@product/editor-ui` — React app: Sidebar (chat) on the **left**, Preview in the **middle**, **Design panel** on the **right** with: tag badge + source, text editor (when leaf), className editor, chip groups (size / weight / rounded / px / py / background / text color). Chips hit `astEdit.apply` directly — no AI turn.
- `@product/e2e` — Playwright click-to-select smoke.
- **AI self-navigation:** added `listFiles`, `readFile`, `findJSXElement` tools. `turn.ts` became a multi-iteration loop (up to 12) with `tool_result` feedback; edits apply inline so read-after-edit works. AI now edits without a selection.

**Trade-offs / deferred:**
- No React Fast Refresh. esbuild JSX keeps `__source` lines correct, but at the cost of Fast Refresh (full reload on edit). Follow-up: source-map remap layer.
- Single-file edits only. Multi-file coordination, dry-run / transactional semantics, rollback: deferred.
- No validation loop (typecheck / build errors fed back to the AI). Next biggest UX lever after self-nav.
- No code editor / Monaco. `file-edit` diffs render as `<pre>`.
- No CRDT, no auth, no publishing, no history UI.

**Tests:** 35 passing across 7 suites. `pnpm build`, `pnpm test` clean.

**Gotchas to remember:**
- `__source.columnNumber` is 1-indexed (React convention). `ast-engine` matches on `loc.start.column === columnNumber - 1`.
- Vite dev URLs carry `?t=…` cache-busters on `fileName`; server strips with `split('?')[0]`.
- `useWS` creates its WS client inside `useEffect` (not `useMemo`) to survive React 19 StrictMode double-mount.
- `@vitejs/plugin-react`'s preamble shifts `__source` lines by ~19. That's why we use esbuild's JSX transform directly.
