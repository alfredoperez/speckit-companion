---
description: "Task list for feature 115-footer-generating-status"
---

# Tasks: Footer "Generating…" as status, "Mark step complete" as secondary

**Input**: Design documents from `/specs/115-footer-generating-status/`
**Prerequisites**: plan.md, spec.md

**Tests**: No automated test tasks generated — the spec relies on manual
visual verification via Storybook + Extension Development Host (per plan.md
"No quickstart" rationale). Acceptance is covered by existing
`FooterActions.stories.tsx` snapshots and SC-001..SC-004 manual checks.

**Organization**: Single user story (P1). All implementation work belongs
to US1; no foundational prerequisites beyond the existing footer module.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1 only here)
- File paths are absolute or repo-root-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new setup required — the change is confined to existing
webview component + CSS partial. The bundler / TS config / Preact runtime
are all in place.

_(intentionally empty)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational work — `runningStep`, `runningStepLabel`,
`runningStepArtifactReady`, `runningStepStartedAt`, the
`markStepComplete` message, the `secondary` Button variant, the
`actions-left` / `actions-right` flex regions, and the `.btn-spinner`
keyframe all already exist and are reused as-is.

_(intentionally empty)_

---

## Phase 3: User Story 1 - In-flight footer reads as one live action, not two competing buttons (Priority: P1) 🎯 MVP

**Goal**: Restructure the in-flight footer so "Generating <Step>…"
renders as a non-clickable status chip on the right and
"Mark step complete" sits on the left styled as a quiet secondary
override — uniformly across specify / plan / tasks / implement.

**Independent Test**: Dispatch `/speckit.plan` (or any pipeline step)
from the spec viewer in the Extension Development Host and watch the
in-flight state. Confirm: (a) "Generating <Step>…" is no longer
button-shaped and does not invite a click; (b) "Mark step complete" is
on the **left** with a visibly lighter/secondary style; (c)
"Mark step complete" stays clickable for the full in-flight duration;
(d) once generation finishes, the footer reverts to the normal
post-completion next-step CTA on the right with no leftover in-flight
chrome.

### Implementation for User Story 1

- [X] T001 [P] [US1] Add `.actions .footer-generating-chip` selector block to `webview/styles/spec-viewer/_footer.css` (pill shape via `border-radius: 999px`, accent-tinted background using `color-mix(in srgb, var(--accent) 12%, transparent)`, accent border at 50% alpha, accent text color, `font-size: 12px`, `font-weight: 600`, `letter-spacing: 0.02em`, `padding: 6px 12px`, `display: inline-flex`, `align-items: center`, `gap: 6px`, `user-select: none`, `pointer-events: none`, `flex-shrink: 0`) plus a nested `.actions .footer-generating-chip .btn-spinner` rule sizing the spinner to `width: 11px`, `height: 11px`, `border-width: 2px`. (FR-001)

- [X] T002 [US1] Restructure the `if (isGenerating && runningStep)` early-return branch in `webview/src/spec-viewer/components/FooterActions.tsx` (lines ~94–115): move the `Button label="Mark step complete" variant="secondary"` into the `actions-left` div, and replace the `Button label="Generating …" variant="primary" loading` in `actions-right` with a `<span class="footer-generating-chip is-running" role="status" aria-live="polite" title="The AI is generating this step — this status updates once the artifact is ready">` containing `<span class="btn-spinner" aria-hidden="true" />` followed by the text `Generating {ns.runningStepLabel ?? 'step'}…`. Preserve the existing `onClick={send({ type: 'markStepComplete' })}` handler verbatim and keep the surrounding `<Toast id="action-toast" />`. (FR-001, FR-002, FR-003, FR-005, FR-006)

- [X] T003 [US1] In `webview/src/spec-viewer/components/FooterActions.stories.tsx`, audit the in-flight stories (`GeneratingPlan`, `GeneratingTasks`, and any sibling `Generating*` / `*ArtifactReady` stories) to confirm their navState shape still triggers the `isGenerating && runningStep` branch with the new layout. No story-data changes are expected (per plan.md); update only if a story relied on the prior right-side button arrangement and now mis-snapshots. Re-snapshot the four-step matrix (specify / plan / tasks / implement) for SC-001 coverage if a snapshot/visual-regression sweep is in use. (SC-001)

- [ ] T004 [US1] (USER MANUAL VERIFICATION) Manually verify the four edge cases listed in spec.md against the updated footer in the Extension Development Host: (a) rapid step transitions — only one in-flight chip visible at a time, "Mark step complete" re-associates to the newly active step; (b) long-running implement step — "Mark step complete" stays clickable indefinitely, chip never auto-hides; (c) approve / inline-comment footer modes — unchanged by the new styling; (d) status-detection failure — chip stays "Generating…" until user clicks the override; (e) narrow viewer widths — left action and right chip wrap/compress without overlap. (FR-007, SC-002, SC-003, SC-004, all Edge Cases)

**Checkpoint**: In-flight footer renders with one live status chip on the right and one quiet secondary override on the left, uniformly across all four pipeline steps. All other footer modes (post-completion, approve, inline-comment, archived, reactivate) are visually unchanged.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T005 [P] Update `docs/viewer-states.md` "Footer button matrix" section to reflect the new in-flight footer layout (left: secondary "Mark step complete"; right: non-clickable "Generating <Step>…" chip) per CLAUDE.md docs map for footer/button changes.

- [X] T006 [P] Add a CHANGELOG.md entry under the next-version "Fixed" or "Changed" heading summarizing: "Spec viewer in-flight footer: 'Generating <Step>…' is now a non-clickable status chip on the right; 'Mark step complete' demoted to a secondary action on the left."

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: empty — skip.
- **Phase 2 (Foundational)**: empty — skip.
- **Phase 3 (US1)**: starts immediately. T001 and T002 are independent files (CSS vs. TSX) and can run in parallel. T003 depends on T002 (the rendered DOM changes). T004 depends on T001+T002 landing (it's the manual verification pass).
- **Phase 4 (Polish)**: depends on US1 completion. T005 and T006 are independent files and can run in parallel.

### Within User Story 1

- T001 (CSS) ∥ T002 (TSX) — different files, no dependency.
- T003 (stories audit) — after T002.
- T004 (manual edge-case verification) — after T001 + T002.

### Parallel Opportunities

- T001 ∥ T002 within Phase 3.
- T005 ∥ T006 within Phase 4.

---

## Parallel Example: User Story 1

```bash
# Launch CSS and component changes together:
Task: "Add .footer-generating-chip selector block to webview/styles/spec-viewer/_footer.css"
Task: "Restructure isGenerating && runningStep branch in webview/src/spec-viewer/components/FooterActions.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 are empty — start directly at Phase 3.
2. Land T001 + T002 in parallel.
3. Run T003 to confirm Storybook still tells the truth.
4. Run T004 manual verification across the four steps + edge cases.
5. **STOP and VALIDATE**: SC-001..SC-004 met against the live viewer.
6. Polish (T005 + T006) and ship.

### Notes

- The feature is intentionally small — one component branch, one CSS class, one CHANGELOG line, one doc table update.
- No automated tests added; manual visual checks per SC-001..SC-004 are the acceptance gate (consistent with plan.md "No quickstart" rationale).
- Out of scope: approve flow, inline-comment composer, post-completion next-step CTA, archive/reactivate footers, any `runningStep*` derivation logic in `src/features/spec-viewer/`.
