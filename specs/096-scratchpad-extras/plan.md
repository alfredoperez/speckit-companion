# Implementation Plan: Per-Document Scratchpad Extras

**Branch**: `096-scratchpad-extras` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/096-scratchpad-extras/spec.md`

## Summary

Replace the in-viewer inline review-comment system with **per-document
scratchpad files** (`spec-extra.md`, `plan-extra.md`, `tasks-extra.md`) surfaced
as sub-tabs next to each core source document. A repurposed **Refine** button —
visible only while viewing a scratchpad — reads the scratchpad's full contents
and dispatches a direct, in-place AI edit of the matching source document
(never a template regeneration). Scratchpads are lazily created from an empty
state, stored as plain markdown in the spec directory, committable, and
explicitly excluded from phase gating and task counting. The legacy
inline-comment infrastructure (hover-to-add control, comment cards/dialog,
batch-submit, in-memory refinement state, and its message protocol) is removed
wholesale.

Technical approach: extend `documentScanner` to synthesize a scratchpad
`SpecDocument` per existing core doc (so the existing related-doc "children
rail" renders sub-tabs, including before the file exists); add `isScratchpad` /
`scratchpadFor` to the document model and `NavState`; add webview empty-state +
create flow and a scratchpad-gated Refine button; add `createScratchpad` and
`applyScratchpad` messages with extension handlers that do file I/O and build
the direct-edit prompt (reusing the proven `handleSubmitRefinements` prompt
shape); delete the inline-comment modules, signals, renderer line-actions, CSS,
and dead message types.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact + `@preact/signals` (webview), Webpack 5
**Storage**: File-based — plain markdown scratchpad files in the spec directory; `.spec-context.json` is **not** modified by scratchpads
**Testing**: Jest + ts-jest (BDD `describe`/`it`, VS Code mock at `tests/__mocks__/vscode.ts`); Storybook for webview components
**Target Platform**: VS Code extension (desktop), webview UI in browser context
**Project Type**: single (VS Code extension with a bundled Preact webview)
**Performance Goals**: No regression in viewer responsiveness; scratchpad existence/has-content checks bounded to ≤3 files per spec, run during the existing scan/content-update pass
**Constraints**: Extension isolation — all behavior in `src/` and `webview/` only; no edits to `.claude/**` or `.specify/**`. The AI apply instruction must be built as prompt text in extension code. Direct edits only — never invoke a `/speckit-*` slash command for apply
**Scale/Scope**: 3 scratchpad types × N specs; net code reduction (inline-comment system removed); ~15-20 touched files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility & Configuration | PASS | No provider changes; reuses existing provider dispatch (`executeInTerminal`). |
| II. Spec-Driven Workflow | PASS | Scratchpads are `isCore: false` — never gate Specify→Plan→Tasks→Implement, never counted, never trigger lifecycle. Verified existing guards already exclude non-core files. |
| III. Visual & Interactive | PASS | Sub-tabs, empty state, create/refine/edit buttons — all GUI surfaces. |
| IV. Modular Architecture | PASS | Reuses the modular spec-viewer structure (provider / messageHandlers / html / webview components / CSS partials). Net reduction in modules. |

**Initial gate: PASS** — no violations, Complexity Tracking empty.
**Post-design re-check: PASS** — design introduces two new messages and two
optional model fields; no architectural deviation.

## Project Structure

### Documentation (this feature)

```text
specs/096-scratchpad-extras/
├── plan.md              # This file
├── research.md          # Phase 0 output (design decisions)
├── data-model.md        # Phase 1 output (entities + model changes)
├── quickstart.md        # Phase 1 output (manual verification walkthrough)
├── contracts/
│   └── webview-messages.md   # Phase 1 output (message protocol changes)
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── core/
│   └── constants.ts                         # Add scratchpad file-name constants + suffix
└── features/spec-viewer/
    ├── types.ts                             # SpecDocument: +isScratchpad, +scratchpadFor; DocumentType extends
    ├── documentScanner.ts                   # Synthesize scratchpad docs per core doc; skip *-extra in generic scan
    ├── specViewerProvider.ts                # Carry scratchpad fields + hasContent into NavState
    └── messageHandlers.ts                   # +createScratchpad, +applyScratchpad handlers; remove dead comment handlers

webview/
├── src/spec-viewer/
│   ├── types.ts                             # SpecDocument mirror fields; message union edits
│   ├── signals.ts                           # Remove refinement signals
│   ├── components/
│   │   ├── NavigationBar.tsx                # Scratchpad sub-tab styling hook
│   │   ├── FooterActions.tsx                # Scratchpad-gated Refine + Edit buttons
│   │   ├── ScratchpadEmptyState.tsx         # NEW — empty state + create action
│   │   ├── InlineComment.tsx                # DELETE (+ stories)
│   │   └── InlineEditor.tsx                 # DELETE (+ stories)
│   ├── editor/                              # DELETE refinements.ts, inlineEditor.ts, lineActions.ts, index.ts
│   ├── modal.ts                             # DELETE (legacy refine modal)
│   ├── markdown/
│   │   ├── renderer.ts                      # Remove line-action wrapping (line-add-btn, line-comment-slot)
│   │   └── scenarios.ts                     # Remove row-add-btn injection
│   └── App.tsx / index.tsx                  # Render empty state when active doc is a non-existent scratchpad; drop line-action setup
└── styles/spec-viewer/
    ├── index.css                            # Update @imports
    ├── _refinements.css / _editor.css / _modal.css   # DELETE
    ├── _navigation.css                      # Add .step-child--scratchpad + has-notes dot
    ├── _line-actions.css                    # Remove .line-add-btn rules
    └── _tables.css                          # Remove .row-add-btn / comment-row rules

tests/                                       # Extension-side unit tests (scanner injection, handlers, empty guard)
```

**Structure Decision**: Single VS Code-extension project. All work lands in the
existing `src/features/spec-viewer/` (extension side) and
`webview/src/spec-viewer/` (webview side) modules plus shared `src/core/`
constants — the modular spec-viewer layout the codebase already uses. No new
top-level structure.

## Phase 0: Research

Complete — see [research.md](./research.md). No `NEEDS CLARIFICATION` remained.
Key resolved decisions:

1. Scratchpads surface via synthesized related docs in `documentScanner` so the
   existing children rail renders them — including before the file exists.
2. `SpecDocument` gains `isScratchpad` + `scratchpadFor`, carried into `NavState`.
3. Refine is a scratchpad-gated button in `FooterActions`, posting
   `applyScratchpad`; the extension builds a direct-edit prompt reusing the
   `handleSubmitRefinements` shape (no slash command, no setup scripts).
4. Lazy create via a new `createScratchpad` message + `fs.writeFile`.
5. Edit reuses the existing `editDocument` handler.
6. Inline-comment system removed wholesale (components, editor modules, signals,
   renderer line-actions, CSS, dead messages). `toggleCheckbox` retained unless
   proven coupled to the removed line-action menu.
7. Non-core guarantees already enforced by existing guards — no new gating code.
8. P2 has-notes indicator via a `hasContent` flag on the scratchpad doc.
9. Scope limited to spec/plan/tasks only.

## Phase 1: Design & Contracts

Complete — artifacts generated:

- [data-model.md](./data-model.md) — Scratchpad/Source document entities, the
  `SpecDocument` field additions, `NavState` passthrough, naming map, and
  lifecycle/validation rules.
- [contracts/webview-messages.md](./contracts/webview-messages.md) — the new
  `createScratchpad` / `applyScratchpad` messages, the `actionToast` response
  for the empty guard, and the removed message types.
- [quickstart.md](./quickstart.md) — end-to-end manual verification covering all
  three user stories, edge cases, and the removal acceptance (SC-005).

**Agent context update**: `CLAUDE.md` "Active Technologies / Recent Changes"
already covers TS 5.3 + VS Code API + Preact + file-based storage; this feature
introduces no new technology, so no agent-context edit is required.

## Phase 2: (Deferred to /speckit.tasks)

Task breakdown will be generated by `/speckit.tasks`. Suggested phasing for the
task author (P1 first; P2 last):

1. **Model + scanner** (P1, US1/US2 prerequisite): add constants and
   `SpecDocument` fields; synthesize scratchpad docs in `documentScanner`; skip
   `*-extra.md` in the generic related scan; carry fields + `hasContent` into
   `NavState`.
2. **Create flow** (P1, US2): `createScratchpad` message + handler (empty
   `fs.writeFile`, re-scan, switch view); `ScratchpadEmptyState` component;
   render it when the active doc is a non-existent scratchpad.
3. **Apply flow** (P1, US1): `applyScratchpad` message + handler (read file,
   resolve `scratchpadFor` → `<source>.md`, empty guard → `actionToast`, else
   build direct-edit prompt → `executeInTerminal`); scratchpad-gated Refine
   button in `FooterActions`; Edit affordance reusing `editDocument`.
4. **Removal** (P1, FR-015/SC-005): delete inline-comment components, editor
   modules, signals, renderer line-actions, CSS partials/rules, and dead message
   types/handlers; verify `toggleCheckbox` coupling.
5. **Visual distinction** (P1, FR-005): `.step-child--scratchpad` styling.
6. **Activity indicator** (P2, FR-016): has-notes dot on the scratchpad sub-tab.
7. **Tests + docs**: unit tests (scanner injection incl. source-absent skip and
   on-disk recognition, apply empty guard, create); update `README.md`
   ("Reading Specs"), `docs/viewer-states.md` (footer Refine), and `CHANGELOG.md`.

## Complexity Tracking

> No constitution violations — section intentionally empty.
