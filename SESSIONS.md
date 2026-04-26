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

## 2026-04-25 — Floating bottom-center tool palette

**Goal:** Replace the top toolbar's Edit/Preview segmented control with a floating Figma-style tool palette pinned to the bottom-center of the preview pane. Selection capture should only be active when the user explicitly turns the Select tool on — clicks pass through to the live preview otherwise.

**Shipped:**
- `packages/editor-ui/src/FloatingToolbar.tsx` (new) — `position: absolute` pill at `bottom-4 left-1/2 -translate-x-1/2 z-10` over the preview pane, `pointer-events-auto` only on the inner pill so clicks pass through everywhere else. First button is the Select tool: inline cursor SVG (Lucide `MousePointer2` path), `aria-pressed`, accent fill when active, hover tint when inactive, `title="Select (V)"`. Designed to grow more buttons (zoom, hand, comment) without layout changes.
- `packages/editor-ui/src/Toolbar.tsx` — dropped `ModeSwitch` + the `mode` / `onModeChange` props. Top bar is now status-only (connection + preview dots, 100% zoom indicator). Single canonical control surface for tool selection lives in `FloatingToolbar`.
- `packages/editor-ui/src/App.tsx` — render `<FloatingToolbar mode={mode} onModeChange={setMode} />` as a sibling of `<PreviewPane>` inside the existing `flex-1 relative` wrapper, so it overlays only the preview area, not the side panels. The V keyboard shortcut and the existing `panelsVisible = mode === 'edit'` guard both keep working unchanged — semantics preserved, surface relocated.
- `packages/editor-ui/src/useSelection.ts` — added `setMode(mode: 'edit' | 'preview'): void` to the public return type (pre-existing type/impl drift; the impl already exported it, the signature didn't).

**Design decisions:**
- *Select tool replaces Edit/Preview, not a third state.* When the Select tool is OFF, the editor enters the existing preview mode (panels collapse, iframe interactive). When ON, the existing edit mode (panels visible, selection capture active). Daniel picked this over a coexist-with-segmented-control or a sub-tool model — Figma/Sketch convention.
- *Floating bar overlays the preview only, not panels.* Keeps the tool palette out of the way of the chat sidebar and design panel; mirrors how Figma's toolbar sits over the canvas.

**Deferred / known issues:**
- More tools (zoom, hand, comment) — slot in as additional `<ToolButton>` rows when needed.
- Pre-existing `exactOptionalPropertyTypes` TS errors in `design/Select.tsx`, `RadiusPicker.tsx`, `SizePicker.tsx`, `WeightPicker.tsx` — `disabled?: boolean` propagating through `Select` primitive. Not introduced by this session; out of scope.

**Tests:** No new tests this session (UI-only relayout, no behavior change). `vite build` produces a clean 378 KB JS bundle in 721ms.

---

## 2026-04-21 — Structural AST edits (add / wrap / delete / move)

**Goal:** Add the four structural primitives to the engine, protocol, and AI tool layer, so both the AI and future panel controls can change tree shape — not just attributes and text.

**Shipped:**
- `packages/protocol/src/index.ts` — `jsxElementDescriptorSchema`, `jsxPositionSchema`, and four new discriminants in `toolCallSchema`: `addElement`, `wrapElement`, `deleteElement`, `moveElement`. Wrapper descriptor omits `text` (the child is the target element).
- `packages/ast-engine/src/edit.ts` — `applyEdits` reworked into a two-pass: (1) build a `{line:col → {node, parent}}` target map up front, (2) mutate. Lets callers mix structural + attribute ops in one batch without coord drift. Four new mutators + helpers (`buildJSXElement`, `replaceInParent`, `containsNode`, `ensureClosingElement`). Extended `EditError` codes: `parent-self-closing`, `cannot-delete-root`, `invalid-move`, `invalid-parent`.
- `packages/ai/src/tools.ts` + `turn.ts` — four new tool schemas exposed to Claude, system-prompt bullets, and corresponding dispatch + descriptor parsing in `runTool`. Centralized `EDIT_TOOL_NAMES` set. Fixed a pre-existing doc bug: `columnNumber` is 1-indexed, not 0-indexed.
- `packages/server/src/server.ts` — `opFileName(op)` helper covers all six op variants in one place (used by both `applyEdit` and `groupOpsByFile`). Rejects cross-file `moveElement` with a clear error.
- Tests — `structural-edits.test.ts` (new, 8 edge cases + batch-mix semantics), `edit.test.ts` (+7 smoke tests), `preserve-coords.test.ts` (+4 above-anchor property tests for structural ops), `tools.test.ts` updated to assert the new tool surface, `protocol.test.ts` updated for each new schema variant. **All 13 task runs green, 35 ast-engine tests passing, build clean on all 9 packages.**

**Design decisions:**
- *Target resolution up front.* Every op's coord resolves against the pre-batch AST. Node references survive mutations, so a delete followed by a setJSXProp doesn't suffer coord drift. Property-tested.
- *Relaxed coord invariant for structural ops.* Documented in CLAUDE.md: strict for attribute/text ops, "above-anchor only" for structural. Below-anchor shifts are fine because HMR regenerates `__source`.
- *Same-file moves only.* Cross-file move rejected at the server boundary. Waits on the multi-file transactional roadmap item.
- *Descriptor shape.* `{ tag, props?: Record<string,string>, text? }`. No nested children in one call — chain ops instead. Covers ~95% of AI-driven structural asks; keeps the schema narrow.

**Deferred (out of scope for this slice, called out in the plan):**
- Editor-UI panel buttons for structural edits. The engine + AI tools prove out first; UI comes in a follow-up.
- Cross-file moves. Blocked on multi-file transactional semantics.
- Descriptor support for JSX expression attrs, nested JSX children, or component imports.
- Auto-expanding a self-closing parent to accept new children. For now, rejected with `parent-self-closing`.

**Gotchas worth knowing:**
- `wrapElement` targeting the root of a component return works because `replaceInParent` falls back to scanning arbitrary parent keys (ReturnStatement.argument, ArrowFunctionExpression.body, etc.) when the parent isn't a JSXElement/JSXFragment.
- `moveElement` clones the subtree (`t.cloneNode(node, true)`) before re-inserting. Avoids recast path invalidation when the same node is removed then attached elsewhere.
- The `preserve-coords.test.ts` "above-anchor" helper uses source-order filtering (`l.line < anchorLine`), which is conservative — a stricter claim is possible but this shape is robust to recast's indentation choices.

**Tests:** 35 ast-engine + 8 protocol + 4 ai + the unchanged rest → all 13 package runs green, build clean.

---

## 2026-04-21 — `product-worker` subagent

**Goal:** Create a project-level Claude Code agent that inherits all the architectural context, invariants, and scope filters needed to work on `/product` without reloading them every conversation.

**Shipped:**
- `/Users/daniel/Desktop/reverse-engineering/.claude/agents/product-worker.md` — full agent definition with:
  - Audience filter (design engineers only)
  - Monorepo layout (9 packages + responsibilities)
  - Non-negotiable invariants (coord preservation, Zod boundaries, protocol-first, 1-indexed columns, sandboxed file I/O)
  - UI3 design tokens table
  - Workflow rules (SESSIONS.md prepending, build+test before done, dev server URLs, env management)
  - Gotchas (no @vitejs/plugin-react, StrictMode WS, Vite `?t=` query, Radix Select popper)
  - Deferred items list (validation loop, structural edits, state variants, Fast Refresh, multi-file, tokens, collab/publishing/auth)

**How to invoke:** The main Claude Code agent will auto-delegate to `product-worker` for any task matching its description (code changes inside `/product`). The description explicitly rules out `/info` research and backend/full-stack work.

**Gotcha:** The agent file's `description` field drives auto-delegation. Keep it specific about WHEN to use and WHEN NOT — that's what the dispatcher reads.

---

## 2026-04-21 — Audience locked: design engineers

**Goal:** Make the product's audience explicit in the codebase so roadmap decisions stay aligned.

**Shipped:**
- `README.md` now opens with a "Who this is for" section: **design engineers** (JSX / Tailwind / visual composition). Explicitly out of scope: backend/API/DB work. Named the right peer set (Dazl, Tempo, v0, Bolt, Figma Sites/Make) and the wrong one (Cursor, Aider, full-stack agents) so positioning drift is self-correcting.
- Cross-session memory record saved so future conversations evaluate feature requests through this lens.

**Decision filter (new):** "Does this help a design engineer iterate faster on a visual surface?" If no, out of scope. This rules out ideas like "edit server code" or "understand API routes" while keeping the real roadmap (validation loop, structural edits, state variants, Fast Refresh) comfortably in-bounds.

**Tests:** Unchanged. Documentation-only change.

---

## 2026-04-21 — Simplify pass (review findings applied)

**Goal:** Run three parallel reviewers (reuse / quality / efficiency) plus a UX-focused one over the smart-panel slice. Aggregate findings, fix the high-impact ones, defer scope-creep items.

**Shipped — performance:**
- All unparametrized RegExp generators promoted to module-scope constants in `packages/editor-ui/src/design/className-utils.ts` (`TEXT_SIZE_PATTERN`, `FONT_WEIGHT_PATTERN`, `RADIUS_PATTERN`, `FLEX_DIRECTION_PATTERN`, `ALIGN_ITEMS_PATTERN`, `JUSTIFY_CONTENT_PATTERN`, `TEXT_ALIGN_PATTERN`, `DISPLAY_MODE_PATTERN`). Per DesignPanel render: **~25 RegExp allocs → 0**. Back-compat function-style accessors (`textSizePattern()` etc.) retained so nothing else had to change.
- `colorGroupPattern` now looks up a pre-baked `COLOR_PATTERNS` record; `spacingGroupPattern` uses a `Map<string, RegExp>` cache.
- `replaceGroup` simplified: single `classList` split, dead duplicate-return branch removed.

**Shipped — quality:**
- Redundant `liveClass = classNameDraft` alias removed from `DesignPanel.tsx`; `classNameDraft` passed to sections directly. `SectionProps` field count 11→9.
- New `design/primitives/LabeledField.tsx` — deduped `Field` and `LabeledRow` that were separately defined in `sections.tsx` and `LayoutPicker.tsx`.
- `SpacingRow` helper inside `sections.tsx` collapses `PaddingSection`'s two near-identical Scrubbers and `GapSection`'s third copy into one parameterized component.
- `tailwind-palette.ts` arrays typed as `readonly SegItem<K>[]` so `LayoutPicker` and `AlignPicker` no longer need `as readonly SegItem<K>[] as SegItem<K>[]` double casts.
- `useEffect` dependency in DesignPanel pruned from `[selectionKey, selection?.className, selection?.text]` to `[selectionKey]`.
- `LayoutPicker` uses `classList(liveClass)` instead of hand-rolled `split(/\s+/).filter(Boolean)`.

**Shipped — UX refinements (high-impact from reviewer):**
- **Scrubber full-row drag.** Whole 24px row is now the drag surface (previously just the 24px icon prefix). Input element excluded from drag via `closest('input')` check. Added `role="spinbutton"` + `aria-valuenow` + `aria-label`.
- **Layout section redesigned as `[Flex] [Grid] [Off]` segmented switch.** Replaces the "Enable Flex" button + "disable layout" text link. Grid is now first-class. `DISPLAY_MODES` constant + `displayMode()` helper in `className-utils.ts`. Direction row only in flex mode; align/justify in both flex and grid; block mode clears all of them.

**Deferred (called out by reviewers, intentionally not done here):**
- Text-content unsaved-edits lost when selection changes mid-typing. Real bug but outside simplify scope.
- Inline shade preview in ColorPicker trigger — reviewer's suggestion, but trigger already shows a 14px `Swatch` before the class name. No-op.
- `<div role="button">` → button role detection. Requires preview-agent sending `role` attr.
- `<a>` without children defaulting to text role — minor heuristic tweak, defer.
- 3×3 Figma align-grid — panel is 260px wide; single-row segmented controls are the right fit. Revisit if width grows.
- Section collapsing — not needed at current section count.
- Stringly-typed `'flex'` / `'grid'` string literals in `LayoutPicker` — acceptable given the CSS spec uses these; no magic strings elsewhere.

**Tests:** 35/35 passing. Build clean on all 9 packages. Dev boots as before.

**Gotchas:**
- Promoted patterns kept back-compat function accessors (`textSizePattern = () => TEXT_SIZE_PATTERN`) so existing import sites resolve. New code should use the constant directly.
- `DISPLAY_MODES` exposes a `block` option — writing "block" to className would be wrong (you'd want no flex/grid at all). Handled by `LayoutPicker.setMode` stripping flex/grid without adding anything when mode === 'block'.
- `SpacingRow` passes the constructed `spacingGroupPattern(prefix)` into both the `findClass` call and the `replaceGroup` call — the pattern is cached in the module-level Map so repeated lookups are O(1).

---

## 2026-04-21 — Smart role-based Design panel + Layout/Align

**Goal:** Panel reshapes per element role (text / button / input / image / container / fallback) — show only relevant sections. Added Layout (flex direction / align / justify) for containers and Text align for text.

**Shipped:**
- `packages/editor-ui/src/design/role.ts` — `Role` type, `roleOf(selection)` heuristic over `tag + text + className`, `ROLE_SECTIONS` map (ordered `SectionId[]` per role), `ROLE_LABEL` for the panel subtitle badge.
- `packages/editor-ui/src/design/primitives/SegmentedControl.tsx` (new) — extracted from `Toolbar.tsx`'s `ModeSwitch`. Generic over value type `<V extends string>`, flex-1 segments so it can fill a field width. Reused for: Edit/Preview toggle in Toolbar, Flex direction, Align-items, Justify-content, Text-align.
- `packages/editor-ui/src/design/tailwind-palette.ts` — added `FLEX_DIRECTIONS` (4), `ALIGN_ITEMS` (5), `JUSTIFY_CONTENT` (6), `TEXT_ALIGNS` (4). Each entry: `{ key, label, title }` with Unicode direction glyphs for labels.
- `packages/editor-ui/src/design/className-utils.ts` — added `flexDirectionPattern`, `alignItemsPattern`, `justifyContentPattern`, `textAlignPattern`, `isFlexContainer(className)`.
- `packages/editor-ui/src/design/LayoutPicker.tsx` — three `SegmentedControl` rows inside a labeled field layout. Shows `+ Enable Flex` button when `flex`/`grid` isn't present; once enabled, offers `disable layout` to strip all flex classes cleanly.
- `packages/editor-ui/src/design/AlignPicker.tsx` — single `SegmentedControl` for text-align.
- `packages/editor-ui/src/design/sections.tsx` — one file of 10 named section components (`ElementSection`, `ContentSection`, `TypographySection`, `TextAlignSection`, `FillSection`, `ShapeSection`, `LayoutSection`, `PaddingSection`, `GapSection`, `ClassesSection`) all sharing a `SectionProps` interface.
- `packages/editor-ui/src/DesignPanel.tsx` rewrite — iterates `ROLE_SECTIONS[role]` and dispatches through a `SECTION_RENDER` map. Panel header now shows the detected role as a subtle uppercase badge in the top-right of the header. State management (`classNameDraft`, `text`, `selectionKey` effect) and `setClassName` path are identical to before.
- `packages/editor-ui/src/Toolbar.tsx` — swapped inline `SegmentButton` for the shared `SegmentedControl` (pixel-identical).

**Role → sections map:**

| Role | Sections |
|---|---|
| text | Element · Content · Typography · Text align · Classes |
| button | Element · Content · Typography · Fill · Shape · Padding · Classes |
| input | Element · Fill · Shape · Typography · Padding · Classes |
| image | Element · Fill · Shape · Classes |
| container | Element · Fill · Shape · Layout · Padding · Gap · Classes |
| fallback | Element · Fill · Shape · Padding · Classes |

**Deferred:**
- State variants (hover / focus / disabled) — next slice.
- Image controls (object-fit, aspect-ratio, src/alt).
- Input-specific affordances (type, placeholder editing).
- 3×3 Figma-style align grid (kept single rows for 260px panel width).
- React component role introspection (preview-agent only sends HTML tag name, lowercase).

**Tests:** 35/35 passing. Build clean on all 9 packages.

**Gotchas:**
- `textAlignPattern` is an explicit whitelist (`^text-(left|center|right|justify)$`) so it doesn't collide with `text-sm` (size) or `text-blue-600` (color).
- `LayoutPicker` differentiates "no flex class" from "flex is disabled" — the "Enable Flex" button appends `flex` without touching other classes; "disable layout" strips `flex`/`grid` AND all direction/align/justify classes so the element cleanly returns to block flow.
- Role detection is heuristic and UI-only: `<Button>` (custom component) renders as `<button>` at runtime and classifies as button. A `<div>` wrapping only text classifies as container (designers can select the inner text node or use the Classes field if typography is needed).
- Section components all consume the same `SectionProps` interface so the panel can render them via a `Record<SectionId, Component>` dispatch map. Adding a new section is literally one file + one map entry.

---

## 2026-04-21 — Edit / Preview mode switch

**Goal:** A top toolbar with a segmented Edit/Preview control. Edit = today's behavior. Preview = panels hide, iframe expands full-width, click interception disabled so the demo app is fully interactive.

**Shipped:**
- `@product/protocol`: new `mode` message in `editorToPreviewSchema` (`{kind: 'mode', mode: 'edit' | 'preview'}`).
- `@product/preview-agent`: gates click interception on `mode === 'edit'`. When switching to preview, overlay hides but `currentSource` is retained so switching back re-places the ring. When switching back to edit with a prior selection, overlay is restored without a round-trip.
- `packages/editor-ui/src/Toolbar.tsx` (new) — 40px top bar: status chips (connected / preview) on the left, [Edit | Preview] segmented control centered, a placeholder 100% on the right for future zoom/device presets. UI3-styled: 2px padding around the segmented group, active segment has the `--ui-bg` surface + 0.5px border ring.
- `editor-ui/src/useSelection.ts` — added `setMode(mode)` that posts to the iframe.
- `editor-ui/src/App.tsx` — mode state, syncs to the agent via useEffect (including on previewReady, so HMR reloads restore the mode). Panels are conditionally rendered; preview mode drops Sidebar + DesignPanel entirely so iframe takes the full width. `V` toggles mode (when not typing); `Escape` exits Preview.

**Deferred:**
- Per-panel minimize icons in the toolbar (UI3's two-rect toggle on each side). Next slice; lets the user hide one panel while in Edit.
- Animated panel collapse (currently mount/unmount — no slide animation).
- Zoom control (the 100% on the right is a placeholder).
- Device/breakpoint presets (mobile / tablet / desktop widths for the iframe).

**Tests:** 35 passing.

**Gotchas:**
- Mode is synced to the iframe on every `previewReady` change too — otherwise a refresh of the demo-app would lose the mode setting since the agent re-initializes.
- Preview mode passes `selection={null}` to `PreviewPane` so the overlay box disappears. The actual selection state is preserved in `useSelection`, so returning to Edit restores the box.
- `V` hotkey is disabled when the user is typing (checks `INPUT` / `TEXTAREA` / `contentEditable`). `Escape` always exits preview since there's no other conflict.

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
