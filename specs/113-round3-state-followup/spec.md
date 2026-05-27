# Feature Specification: Round-3 State Followup

**Feature Branch**: `fix/round-3-state-cleanup-v2`  
**Created**: 2026-05-27  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate Full Lifecycle with Round-3 Fixes (Priority: P1)

A developer runs a full Specify → Plan → Tasks → Implement lifecycle against a real spec to confirm the round-3 state-machine fixes work end-to-end. The `.spec-context.json` history should have real timestamps, correct `by` attribution, no duplicate completions, and the Approve button should remain hidden on already-completed stepper tabs.

**Why this priority**: This is the core acceptance gate for all round-3 fixes. If the lifecycle doesn't produce a clean history, the fixes are incomplete.

**Independent Test**: Can be fully tested by running `/speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement` on any spec and inspecting the resulting `.spec-context.json`.

**Acceptance Scenarios**:

1. **Given** a fresh spec with no `.spec-context.json`, **When** the full lifecycle runs to completion, **Then** `status` ends at `"implemented"` (never `"completed"`)
2. **Given** a completed step in the stepper, **When** the user navigates back to that step's tab, **Then** the Approve button is hidden on the already-completed tab
3. **Given** a `complete` history entry, **When** the entry was written by the AI mid-run, **Then** `by` is `"ai"` and the timestamp is a real wall-clock value (not midnight)
4. **Given** a lifecycle initiated by clicking an extension button, **When** the seed history entry is written, **Then** `by` is `"extension"` and `at` matches the dispatch timestamp
5. **Given** a child doc tab (data-model, research) is viewed, **When** the user clicks Approve or Regenerate, **Then** the action targets `ctx.currentStep`, not the viewed doc type

---

### User Story 2 - Fix Stepper Visual Lag (F16) (Priority: P2)

A developer fixes the issue where the stepper still shows an in-progress orange ring after step completion while the status badge has already flipped. The stepper must re-derive its state on filesystem-watcher updates, not only on user clicks.

**Why this priority**: This is a visible regression affecting every lifecycle run. It self-heals on any click, but it undermines trust in the status UI.

**Independent Test**: Can be tested by completing any step via Approve and observing that the stepper ring clears immediately without requiring a follow-up click.

**Acceptance Scenarios**:

1. **Given** the Approve button is clicked to complete a step, **When** the filesystem watcher fires with the updated `.spec-context.json`, **Then** the stepper ring updates to the completed state without any additional user interaction
2. **Given** the status badge shows `PLANNED`, **When** no user action has occurred since step completion, **Then** the stepper tab for the plan step no longer shows the orange in-progress ring

---

### User Story 3 - Fix Copilot Step-Completion Drop (F11) (Priority: P2)

A developer strengthens the preamble so that Copilot reliably writes the step-completion history entry before ending its turn. When `handleApprove` is clicked for the next phase, it should not need to backfill a missing completion entry from the previous step.

**Why this priority**: Missing completion entries corrupt the lifecycle history and produce misleading UI states. The backfill workaround masks the root cause.

**Independent Test**: Can be tested by running three consecutive lifecycles and checking that each `.spec-context.json` has a `kind: "complete"` entry for every completed step with no backfilled timestamps.

**Acceptance Scenarios**:

1. **Given** the AI finishes the specify step, **When** the turn ends, **Then** a `{ step: "specify", kind: "complete", by: "ai" }` entry is present in `history[]` with a real timestamp
2. **Given** the next phase button is clicked, **When** `handleApprove` processes the click, **Then** no backfill logic is triggered because the completion entry already exists

---

### User Story 4 - Reduce Preamble Token Cost (Priority: P3)

A developer refactors the preamble so that the dispatch-time and `by`-field rules are expressed once (in JSON Schema comments or a shared block) rather than duplicated across prose and the schema. The preamble target is under 4 000 characters.

**Why this priority**: Token cost is a compounding concern — every spec dispatch pays it. A 35 %+ reduction per dispatch is meaningful at scale.

**Independent Test**: Measured by counting characters in the assembled preamble string before dispatch; must be under 4 000 characters without losing any invariant currently enforced.

**Acceptance Scenarios**:

1. **Given** a refactored preamble, **When** its character count is measured, **Then** it is under 4 000 characters
2. **Given** the refactored preamble, **When** a lifecycle runs to completion, **Then** the resulting `.spec-context.json` history still has correct `by` attribution and real timestamps (no regression)

---

### Edge Cases

- What happens when `handleApprove` fires but the completion entry already exists (duplicate guard)?
- How does the stepper handle a `.spec-context.json` update that arrives while the viewer is not focused?
- What happens if the preamble refactor accidentally removes a rule that was only in prose (not schema)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `handleApprove` handler MUST target `ctx.currentStep` when recording a step completion, not the currently-viewed doc type
- **FR-002**: The `handleRegenerate` handler MUST target `ctx.currentStep` when marking a step for regeneration
- **FR-003**: The `shouldShowApprove` function MUST return `false` when the viewed stepper tab is behind `ctx.currentStep`
- **FR-004**: The `lastEntryIsCompletionFor` function MUST accept both kind-based and legacy self-loop shapes
- **FR-005**: The stepper component MUST re-derive `stepHistory` on filesystem-watcher updates, not only on user actions
- **FR-006**: The preamble MUST pin `DISPATCH TIME UTC` at dispatch time and use it for both `selectedAt` and the seed entry `at`
- **FR-007**: The seed-write block MUST be fenced with an instruction to ignore schema proposals from the feature description
- **FR-008**: The `by` field MUST use `"extension"` for entries the extension dispatches and `"ai"` for entries the AI appends
- **FR-009**: `vscode:prepublish` MUST chain `tsc` before `vsce package` to prevent stale dist from shipping
- **FR-010**: The Copilot preamble MUST include a sticky "MUST DO BEFORE ENDING" rule that reliably triggers the step-completion history entry write
- **FR-011**: The preamble MUST be under 4 000 characters after refactoring, without removing enforced invariants

### Key Entities

- **`.spec-context.json`**: Per-spec state file tracking `currentStep`, `status`, and `history[]`; written by extension and AI
- **History entry**: An append-only record `{ step, substep, kind, from?, by, at }` — the source of truth for per-step timing
- **Stepper component**: The webview UI element that renders per-step tab states; derives visual state from `history[]`
- **Preamble**: The context block prepended to every AI dispatch; contains JSON Schema, invariants, and attribution rules

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A full Specify → Plan → Tasks → Implement lifecycle produces a `.spec-context.json` where every step has both a `kind: "start"` and a `kind: "complete"` entry with real (non-midnight) timestamps
- **SC-002**: After clicking Approve to complete any step, the stepper tab updates to the completed visual state within the same filesystem-watcher cycle — no extra click required
- **SC-003**: Across three consecutive lifecycle runs, zero instances of `handleApprove` triggering a completion-entry backfill for the previous step
- **SC-004**: The assembled preamble string is under 4 000 characters without removing any invariant currently enforced
- **SC-005**: `status` ends at `"implemented"` after the implement step — never advances to `"completed"` without an explicit user Mark-Completed action

## Assumptions

- The round-3 fixes documented in PR #182 are already merged; this spec tracks follow-on items only
- F11 (step-completion drop) is a Copilot-specific issue; Claude and Gemini are not affected
- F16 (stepper visual lag) self-heals on any click; no data loss occurs
- Preamble refactoring must not change observable AI behaviour — only reduce character count
