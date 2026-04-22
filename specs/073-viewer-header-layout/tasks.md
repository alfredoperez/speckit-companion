# Tasks: Viewer Header Layout

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-22

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** [P] Split header JSX into badges row + title row — `webview/src/spec-viewer/components/SpecHeader.tsx` | R001, R003, R006
  - **Do**: Wrap `spec-badge` and `spec-header-branch` inside a new `<div class="spec-header-badges">` row, and `spec-header-title` (plus `spec-date`) inside `<div class="spec-header-main">`. Keep the existing `data-has-context` attribute and empty-state return at line 18.
  - **Verify**: `npm run compile` passes; open a spec — row 1 shows status + branch pills, row 2 shows the title.
  - **Leverage**: current structure at `webview/src/spec-viewer/components/SpecHeader.tsx:22-43`.

- [x] **T002** [P] Stack `.spec-header` vertically with inline badge row — `webview/styles/spec-viewer/_content.css` | R001, R004, R006
  - **Do**: Change `.spec-header` to `flex-direction: column; align-items: stretch; gap: var(--space-2)`. Add `.spec-header-badges { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }` and `.spec-header-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-3); }`. Leave `.spec-header[data-has-context="true"] ~ #markdown-content h1:first-of-type` rule untouched.
  - **Verify**: `npm run compile` passes; badges sit above title with no extra divider; completed/archived status colors still apply.
  - **Leverage**: existing `.spec-header` rules at `webview/styles/spec-viewer/_content.css:197-206`.

- [x] **T003** [P] Stop emitting the `.spec-file-link` pill — `webview/src/spec-viewer/markdown/preprocessors.ts` | R002
  - **Do**: In `preprocessSpecMetadata`, remove the `if (label === 'Plan' || label === 'Spec') { fileLinks.push(value); continue; }` branch and drop the `fileLinkHtml` construction. Reduce `replacement` to `${metaBar}${title}\n`. Remove the now-unused `fileLinks` array.
  - **Verify**: `npm run compile` passes; `npm test` passes; opening a `plan.md` or `tasks.md` shows no pill between the divider and the first heading.
  - **Leverage**: `webview/src/spec-viewer/markdown/preprocessors.ts:30, 48-52, 75-82, 86`.

- [x] **T004** Manual viewer smoke check *(depends on T001, T002, T003)* — n/a | R001, R002, R004, R005
  - **Do**: Run `/install-local`, reload VS Code, open an in-progress spec (e.g. `specs/072-immediate-status-update/tasks.md`) and a completed spec. Confirm two-row header, hidden file pill, no duplicated H1, and intact status-color variants.
  - **Verify**: Visual layout matches spec R001–R006; no console errors in the webview devtools.

- [x] **T005** [P] Decouple viewed state from done state in StepTab — `webview/src/spec-viewer/components/StepTab.tsx` | R007, R008
  - **Do**: Reorder the `canonicalState` precedence block so `done` (stepDocExists || vsCompleted) is checked before `current` (isViewing), and append `isViewing && 'current'` as an additional class in the `classes` array so a completed tab keeps its `done` canonical state while also getting the `current` viewing marker.
  - **Verify**: `npm run compile` + `npm test` pass; a completed step tab that is being viewed renders with classes `step-tab done current` (✓ + outline).
  - **Leverage**: existing canonical-state block at `webview/src/spec-viewer/components/StepTab.tsx:60-76`.

- [x] **T006** [P] Restore `.step-tab.current` outline — `webview/styles/spec-viewer/_navigation.css` | R007
  - **Do**: Add back the outline rule for the currently viewed tab (removed in PR #118) next to the existing `.step-tab.current .step-label` rule:
    ```css
    .step-tab.current {
        outline: 1px solid var(--accent, #4a9eff);
        outline-offset: 2px;
        border-radius: 4px;
    }
    ```
  - **Verify**: `npm run compile` passes; currently viewed step shows a visible accent frame that coexists with the `.done` ✓ styling.
  - **Leverage**: prior version of `_navigation.css` (pre-PR #118) — the same outline rule lived here.
