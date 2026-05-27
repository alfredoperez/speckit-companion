# Tasks: Round-3 State Followup

**Input**: Design documents from `/specs/113-round3-state-followup/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Paths are workspace-relative

---

## Phase 1: Setup

**Purpose**: Confirm baseline — no new project structure or dependencies needed. All changes go into existing files.

- [X] T001 Verify TypeScript compiles cleanly before starting: `npm run compile` from repo root

---

## Phase 2: User Story 1 & 2 — F16 Stepper Visual Lag Fix (Priority: P1/P2)

**Goal**: After a step completion entry is written to `.spec-context.json`, the stepper badge updates within the same filesystem-watcher cycle — no extra user click required.

**Independent Test**: Open any in-progress spec in the viewer. Manually append a `kind: "complete"` history entry to `.spec-context.json` in a terminal. Observe the stepper ring clears without clicking anything in the viewer.

### Implementation

- [X] T002 [US1] Extend `viewerStateUpdated` message type to include optional `navState` field in `webview/src/spec-viewer/types.ts`
  - Add `navState?: { stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>; currentStep?: string; badgeText?: string }` to the `{ type: 'viewerStateUpdated'; ... }` union member

- [X] T003 [US1] Update `webview/src/spec-viewer/index.tsx` handler for `viewerStateUpdated` to merge `navState` when present
  - In the `case 'viewerStateUpdated':` branch, after setting `viewerState.value` and `historyEntries.value`, add: `if (message.navState) { navState.value = { ...navState.value, ...message.navState }; }`

- [X] T004 [US1] Extend `refreshContextIfDisplaying` in `src/features/spec-viewer/specViewerProvider.ts` to compute and include `navState` partial in the posted message
  - After deriving `viewerState`, compute `derivedStepHistory` from `specCtx.history` via `deriveStepHistory()`
  - Compute `navStatePartial = { stepHistory: mapStepHistoryKeys(derivedStepHistory), currentStep: specCtx.currentStep, badgeText: derived.badgeText }`
  - Include `navState: navStatePartial` in the `postMessage({ type: 'viewerStateUpdated', ... })` call

- [ ] T005 [US2] Manually verify F16 fix: open viewer on a spec, manually write `kind: "complete"` to `.spec-context.json`, confirm stepper badge flips without a click — *requires manual test by user*

---

## Phase 3: User Story 3 — F11 Copilot Step-Completion Drop Fix (Priority: P2)

**Goal**: The preamble's "MUST DO BEFORE ENDING" block is visually prominent enough that Copilot reliably writes the step-completion history entry before ending its turn.

**Independent Test**: Run 3 consecutive single-step lifecycle dispatches in Copilot Chat. Inspect `.spec-context.json` after each — every completed step must have a `kind: "complete"` entry with a real (non-midnight) timestamp. `handleApprove` must not backfill any missing entry.

### Implementation

- [X] T006 [US3] Strengthen the "MUST DO BEFORE ENDING" block in `src/ai-providers/promptBuilder.ts` → `renderPreamble()`
  - Replace the current inline prose lines (`MUST DO BEFORE ENDING — all three required: ...`) with a Unicode box-drawing block:
    ```
    ╔══════════════════════════════════════════════════════════════════╗
    ║  MANDATORY FINAL WRITE — DO THIS BEFORE YOUR TURN ENDS          ║
    ║  □ Flip status to "<completedStatus>"                           ║
    ║  □ Append { step, substep: null, kind: "complete", by: "ai",   ║
    ║      at: <date -u output> } — no "from" field on complete       ║
    ║  □ Print "<donePhrase>" as the final terminal line              ║
    ╚══════════════════════════════════════════════════════════════════╝
    ```
  - Keep the explanatory sentences that follow (what happens if skipped) but move them immediately after the box

---

## Phase 4: User Story 4 — Preamble Token Cost Reduction (Priority: P3)

**Goal**: The assembled preamble for any single-step dispatch is ≤ 4 000 characters without removing any currently-enforced AI invariant.

**Independent Test**: After refactoring, run `node -e "const p = require('./dist/ai-providers/promptBuilder'); console.log(p.buildSingleStepPrompt({command:'x',step:'specify',specDir:'/tmp/t'}).split('<!-- /speckit-companion:context-update -->')[0].length)"` and confirm output < 4000.

### Implementation

- [X] T007 [P] [US4] In `renderSharedRules()` in `src/ai-providers/promptBuilder.ts`: remove the `AUTHORSHIP` prose block (lines starting with `'AUTHORSHIP (\`by\` field):'` through the end of the block — 6 lines)
  - Replace with a single line: `'AUTHORSHIP: See the "by" field in the schema above — "extension" for entries this extension dispatches; "ai" for entries you append.'`

- [X] T008 [P] [US4] In `renderSharedRules()`: compress the `TIMESTAMPS` block from 5 lines to 2 lines
  - Keep: `DISPATCH TIME (UTC): ${dispatchUtc}` and `For additional entries, run date -u +"%Y-%m-%dT%H:%M:%SZ" and paste. Never type by hand.`
  - Remove: the 3 explanatory sentences about why hand-typed times are unreliable (already implied by the instruction)

- [X] T009 [US4] Measure assembled preamble character count after T007+T008 changes
  - Build the extension (`npm run compile`) and run the measurement command from quickstart.md
  - If count is still > 4 000: identify the next largest block and trim; if ≤ 4 000: done

---

## Phase 5: Polish & Validation

**Purpose**: Cross-cutting verification and final cleanup.

- [X] T010 [P] Run TypeScript compiler to confirm no type errors: `npm run compile`
- [X] T011 [P] Run the test suite to confirm no regressions: `npm test`
- [ ] T012 Run manual lifecycle validation: Specify → Plan → Tasks → Implement on any spec in Copilot Chat
  - Confirm: all four steps have `kind: "complete"` entries with real timestamps
  - Confirm: status ends at `"implemented"` after implement (never `"completed"`)
  - Confirm: stepper badges flip without extra clicks on each step completion

---

## Dependencies

```
T001 (baseline)
 └─ T002 → T003 → T005   (F16 webview chain: type → handler → verify)
 └─ T004              (F16 extension side — can parallel T002/T003)
 └─ T006              (F11 preamble)
 └─ T007, T008        (token cost — parallel to each other)
     └─ T009          (measure after both applied)
 └─ T010, T011        (compile + test — after all code changes)
     └─ T012          (lifecycle validation — final)
```

## Parallel Execution

Tasks that can run in parallel once T001 is done:
- **T002 + T004**: webview type change and extension-side `refreshContextIfDisplaying` change are in different files
- **T007 + T008**: both are edits to `renderSharedRules` in promptBuilder.ts — apply as a single multi-replace
- **T010 + T011**: compile check and test suite are independent

## Implementation Strategy

**MVP scope (deliver value in one pass)**: T001 → T002 → T003 → T004 → T005 (F16 fix). This is the most visible regression and can be verified immediately without a full lifecycle run.

**Second pass**: T006 (F11) + T007/T008/T009 (tokens). These require Copilot Chat sessions to validate so they take longer to verify.

**Final**: T010 → T011 → T012 (full validation).

## Task Count Summary

| Phase | Story | Tasks | Notes |
|-------|-------|-------|-------|
| 1 | Setup | 1 | Baseline compile check |
| 2 | US1/US2 | 4 | F16 stepper fix (3 code + 1 verify) |
| 3 | US3 | 1 | F11 preamble box |
| 4 | US4 | 3 | Token reduction + measure |
| 5 | Polish | 3 | Compile, test, lifecycle |
| **Total** | | **12** | |
