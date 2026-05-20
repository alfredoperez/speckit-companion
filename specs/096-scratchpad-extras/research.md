# Research: Per-Document Scratchpad Extras

**Feature**: 096-scratchpad-extras
**Date**: 2026-05-20
**Input**: `spec.md`, current spec-viewer codebase

This document resolves the technical unknowns for replacing inline review
comments with per-document scratchpad files. There were no open
`NEEDS CLARIFICATION` markers in the spec; the items below are the design
decisions derived from reading the existing implementation.

---

## Decision 1 — How scratchpad sub-tabs are surfaced

**Decision**: Inject scratchpad documents into the `SpecDocument[]` produced by
`documentScanner.scanDocuments()`, one per existing core source document
(spec, plan, tasks), with `parentStep` set to the source step so the existing
"step children" rail renders them automatically.

**Rationale**: The viewer already renders a second-row sub-tab rail in
`NavigationBar.tsx` (`webview/src/spec-viewer/components/NavigationBar.tsx:119-142`)
driven entirely by `relatedDocs` whose `parentStep === currentDoc`. Adding the
scratchpad as a related document with `parentStep: 'spec' | 'plan' | 'tasks'`
reuses that rail with zero new navigation logic. FR-004 explicitly asks to
follow "the same pattern used for related documents."

**Critical nuance — show the tab before the file exists**: The recursive
related-doc scan only adds files that exist on disk
(`documentScanner.ts:244-252`, `exists: true`). A scratchpad must appear as a
sub-tab even when its file does not exist yet (FR-006 empty state), so the
scanner must *synthesize* a scratchpad entry for each existing source doc with
`exists` reflecting the real on-disk state — independent of the recursive scan.
The injection must run only when the **source** doc exists (Edge Case: "Source
document absent → scratchpad sub-tab is not offered").

**Alternatives considered**:
- *Let the generic recursive scan pick up `*-extra.md`*: rejected — it only
  surfaces files that already exist, so it cannot render the empty-state create
  affordance, and it would mis-label them as generic related docs.
- *A separate sub-tab system parallel to related docs*: rejected — duplicates
  the rail rendering and violates the "same pattern" requirement.

---

## Decision 2 — Distinguishing scratchpad docs in the model

**Decision**: Add two optional fields to `SpecDocument` (extension
`src/features/spec-viewer/types.ts:87-111` and the mirrored webview type):
`isScratchpad?: boolean` and `scratchpadFor?: DocumentType` (the source doc
type, e.g. `'spec'`). Carry both through `NavState.relatedDocs` to the webview.

**Rationale**: The webview needs to (a) style the sub-tab differently (FR-005),
(b) render the empty-state / create flow for non-existent scratchpads (FR-006),
and (c) decide when the Refine button is visible (FR-009). A typed flag is the
minimal, explicit signal; `scratchpadFor` lets the extension resolve the target
source file when applying.

**Alternatives considered**:
- *Infer scratchpad-ness from the `-extra.md` suffix in the webview*: rejected —
  scatters naming knowledge across layers; the extension already owns naming.

---

## Decision 3 — The repurposed "Refine" (apply) button

**Decision**: Render the Refine button in `FooterActions.tsx`, visible and
active **only** when the active document is a scratchpad
(`navState.currentDoc` resolves to a doc with `isScratchpad === true`). Clicking
posts a new `applyScratchpad` message. The extension handler reads the
scratchpad file, resolves the source path from `scratchpadFor`
(`<sourceType>.md`), and dispatches a **direct-edit** prompt via
`executeInTerminal` — never a slash command.

**Rationale**: The proven direct-edit pattern already exists in
`handleSubmitRefinements` (`messageHandlers.ts:578-606`): it builds a free-form
prompt that says "Edit `<path>` in place… DO NOT regenerate from any template…
DO NOT run any setup script." This is exactly FR-010/FR-011, and it was added
specifically to fix template-regeneration overwrites (issue #153, spec
093-fix-refine-overwrite). The new handler reuses this prompt shape with the
scratchpad's full contents as the instruction body.

**Note on the existing `refine` footer id**: `FooterActions.tsx` already lists
`'refine'` in `RIGHT_IDS` (line 90-97) and renders it with the `enhancement`
variant, but the extension never emits a `refine` footer action
(`getFooterActions` in `footerActions.ts` has no such id; `FooterActionIds` in
`constants.ts:283` lacks `REFINE`; the `footerAction` switch in
`messageHandlers.ts:112-135` would hit the "Unknown footerAction id" default).
So the id is vestigial. The new Refine button is wired as its own conditional
control in `FooterActions.tsx` keyed off `isScratchpad`, posting a dedicated
`applyScratchpad` message — not routed through the generic `footerAction`
catalog. This keeps scratchpad-tab gating in the webview where the active doc is
known.

**Empty guard (FR-012)**: The extension owns file contents, so emptiness is
enforced at dispatch: if the scratchpad is empty/whitespace, the handler skips
`executeInTerminal` and posts an `actionToast` ("Nothing to apply — scratchpad
is empty"). The button stays visible on scratchpad tabs per FR-009; the guard is
the source of truth.

**Alternatives considered**:
- *Route through the `footerAction` catalog + `getFooterActions`*: rejected —
  footer derivation works from `.spec-context.json` state, which does not know
  the active tab; scratchpad-vs-source gating is a webview concern.
- *Send a `/speckit-*` slash command*: rejected — those re-run setup scripts and
  overwrite the source from a template (the exact bug FR-011 forbids).

---

## Decision 4 — Lazy creation flow

**Decision**: The empty-state create action posts a new `createScratchpad`
message with the scratchpad doc type. The extension creates an empty file with
`vscode.workspace.fs.writeFile` in the spec directory, then re-scans and switches
the view to the new scratchpad (content update). The existing markdown file
watcher (`**/{specDir}/**/*.md`, `fileWatchers.ts`) also refreshes the viewer.

**Rationale**: FR-003 (lazy, never auto-created), FR-007 (create + switch). All
file I/O stays on the extension side per the project's isolation rule. No
template is used — the file is created empty.

**Alternatives considered**:
- *Create on first edit in the editor*: rejected — FR-006/FR-007 require an
  explicit in-app create action from the empty state.

---

## Decision 5 — Edit affordance

**Decision**: Reuse the existing `editDocument`/`editSource` message + handler
(`messageHandlers.ts:166-190`, opens `currentDocument.filePath` in the VS Code
text editor beside). Surface an explicit "Edit" control on the scratchpad view
so it uses the same affordance as other documents (FR-008).

**Rationale**: The handler already opens the current document for editing;
scratchpads are just another document. No new editing machinery needed.

---

## Decision 6 — Removing the inline-comment infrastructure (FR-015)

**Decision**: Delete the inline review comment system wholesale and prune its
message protocol. Concretely:

- **Webview components**: `components/InlineComment.tsx`, `components/InlineEditor.tsx`
  (+ their `.stories.tsx`).
- **Webview editor modules**: `editor/refinements.ts`, `editor/inlineEditor.ts`,
  `editor/lineActions.ts`, `editor/index.ts`, and legacy `modal.ts`.
- **Signals** (`signals.ts`): `pendingRefinements`, `activeEditor`,
  `refineLineNum`, `refineContent`.
- **Renderer line actions**: the `wrapWithLineActions` / `line-add-btn`
  injection in `markdown/renderer.ts` and `row-add-btn` in `markdown/scenarios.ts`,
  plus `.line-comment-slot`.
- **CSS**: `_refinements.css`, `_editor.css`, `_modal.css`; the `.line-add-btn`
  rules in `_line-actions.css`; `.row-add-btn`/comment-row rules in `_tables.css`;
  update `index.css` imports.
- **Message protocol** (`types.ts` both sides + `messageHandlers.ts`):
  remove `submitRefinements`, `refineLine`, and the inline-editor context-action
  messages `editLine` / `removeLine` (only reachable from the removed line-action
  menu) and their handlers; remove the `Refinement`/`LineType` types once unused.

**Keep**: `toggleCheckbox` (task-checkbox toggling) is independent of inline
comments — **verify during implementation** whether it is triggered by direct
checkbox clicks in the rendered markdown (keep) or only via the removed
line-action menu (remove). Treat "keep unless proven coupled" as the default.

**Rationale**: SC-005 requires none of the removed controls remain reachable.
All comment state was in-memory only (no persistence), so removal needs no
migration (Assumption: existing ephemeral comments need no migration).

---

## Decision 7 — Non-core guarantees (FR-013, FR-014)

**Decision**: No new gating code is required. Scratchpads carry `isCore: false`.

**Rationale**: Verified the existing guards already exclude non-core files:
- Task counting parses **only** `tasks.md`
  (`phaseCalculation.calculateTaskCompletion`: `if (docType !== TASKS) return 0`).
- Phase completion checks **only** core docs / step history
  (`phaseCalculation.calculatePhases`).
- The tasks watcher pattern is `**/{specDir}/**/tasks.md` — it never matches
  `tasks-extra.md`.
- `.spec-context.json` is untouched by scratchpads; lifecycle/status logic does
  not read scratchpad files.

FR-014 (committable, not ignored): nothing to do — the extension adds no ignore
rules; plain files in the spec dir are committed by default.

---

## Decision 8 — Activity-surface indication (FR-016, P2)

**Decision**: Surface a lightweight "has notes" indicator on the scratchpad
sub-tab (and/or the activity panel) when the scratchpad file is non-empty.
Implement minimally and mark **P2** — it may ship after the core loop.

**Rationale**: FR-016 is `SHOULD` and Priority P2. The scanner already knows
each scratchpad's existence; computing "has content" requires reading the file
(cheap, only the 1-3 scratchpads). Pass a `hasContent` flag on the scratchpad
`SpecDocument` and render a small dot on the sub-tab.

**Alternatives considered**:
- *Full Activity-panel row per scratchpad*: deferred — heavier than the P2 scope
  needs for the initial release.

---

## Decision 9 — Scope: only the three core documents

**Decision**: Generate scratchpads only for `spec`, `plan`, `tasks` — never for
custom-workflow steps or non-core related docs.

**Rationale**: Assumptions + Out of Scope both restrict this version to the
three core documents. Gate scanner injection to those three known core types
(not "any core step"), so custom workflows do not sprout scratchpads.

---

## Constitution alignment

- **Extension isolation** (CLAUDE.md): All changes live in `src/` and `webview/`.
  The apply prompt is built by extension code (the sanctioned "prompt text the
  extension builds" surface). No edits to `.claude/**` or `.specify/**`.
- **II. Spec-Driven Workflow**: Scratchpads are explicitly non-core and never
  gate the Specify→Plan→Tasks→Implement pipeline.
- **III. Visual & Interactive**: Sub-tabs, empty state, create/refine buttons.
- **IV. Modular Architecture**: Reuses the existing modular spec-viewer
  structure; nets a *reduction* in modules (inline-comment system removed).

No violations; Complexity Tracking is empty.
