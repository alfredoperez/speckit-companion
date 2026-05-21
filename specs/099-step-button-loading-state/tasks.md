# Tasks: Step Button Loading State

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** [P] Create content-aware artifact detector — `src/features/spec-viewer/stepArtifact.ts` | R003, R008
  - **Do**: Add `hasNonTrivialArtifact(specDir: string, step: string): Promise<boolean>`. Map step → filename (`specify→spec.md`, `plan→plan.md`, `tasks→tasks.md`; `implement` returns `false` here — its readiness is task-progress driven, handled in the provider). Read the file, strip YAML frontmatter and whitespace, return `true` only when the remaining body clears a small threshold (e.g. ≥1 non-empty heading or ≥40 non-whitespace chars). Missing file → `false`.
  - **Verify**: `npm run compile` passes; unit test (T009) green.
  - **Leverage**: existing fs read patterns in `src/features/spec-viewer/` (e.g. staleness/`computeStaleness`).

- [x] **T002** [P] Add running-step readiness fields to extension `NavState` — `src/features/spec-viewer/types.ts` | R001, R005
  - **Do**: Add `runningStepArtifactReady?: boolean` and `runningStepStartedAt?: string | null` to the `NavState` interface.
  - **Verify**: `npm run compile` passes.

- [x] **T003** [P] Mirror readiness fields + add `markStepComplete` message — `webview/src/spec-viewer/types.ts` | R001, R006
  - **Do**: Add the same two fields to the webview `NavState` type; add `| { type: 'markStepComplete' }` to `ViewerToExtensionMessage`.
  - **Verify**: `npm run compile` passes.

- [x] **T004** [P] Add `loading` prop to shared Button — `webview/src/shared/components/Button.tsx` | R001
  - **Do**: Add `loading?: boolean`; when true, render a spinner glyph (`<span class="btn-spinner" aria-hidden="true" />`) before the label and force `disabled`.
  - **Verify**: `npm run compile` passes; Button story still renders.

- [x] **T005** [P] Spinner styles — `webview/styles/spec-viewer/_actions.css` | R001
  - **Do**: Add `.btn-spinner` + a `@keyframes` rotation; reuse existing motion/pulse tokens if present. Ensure it inherits the disabled button's color.
  - **Verify**: spinner animates in the Generating button (visual check during T008).

- [x] **T006** [P] Compute & ship running-step readiness from the provider — `src/features/spec-viewer/specViewerProvider.ts` *(depends on T001, T002)* | R002, R003, R005
  - **Do**: Beside the existing `runningStep` derivation (~L862), capture the running entry's `startedAt` and call `hasNonTrivialArtifact(specDirectory, <sdd step>)` (use `implement` task-completion percent for the implement step). Set `runningStepArtifactReady` and `runningStepStartedAt` on the `navState` object (~L873).
  - **Verify**: `npm run compile` passes; nav-state test (extend existing) shows fields populated for an in-flight step and `ready=true` once the artifact exists.

- [x] **T007** [P] Handle `markStepComplete` message — `src/features/spec-viewer/messageHandlers.ts` *(depends on T003)* | R006
  - **Do**: Add a `case 'markStepComplete'` that resolves the running step (startedAt, no completedAt) and calls `completeStep(specDirectory, step, 'extension')`, then `deps.updateContent(...)` to refresh.
  - **Verify**: `npm run compile` passes; clicking "Mark step complete" advances the footer.
  - **Leverage**: existing `handleApprove` / `completeStep` usage in this file.

- [x] **T008** Render the Generating state in the footer — `webview/src/spec-viewer/components/FooterActions.tsx` *(depends on T003, T004, T005, T007)* | R001, R002, R004, R005, R006
  - **Do**: Replace the `visible = isRunning ? [] : vs.footer` hide. When a step is running and `runningStepArtifactReady` is false (and not past the recovery timeout computed from `runningStepStartedAt`), render a disabled `Generating {label}…` Button (`loading`) plus a secondary "Mark step complete" Button posting `{ type: 'markStepComplete' }`. Re-enable to the normal forward button once `runningStepArtifactReady` (or `completedAt`) is true; on timeout, fall back to the current step's enabled label. Applies to all transitions.
  - **Verify**: `npm run compile` passes; clicking a step shows Generating… disabled until the artifact lands, then re-enables.

- [x] **T009** [P] Unit-test the artifact detector — `src/features/spec-viewer/__tests__/stepArtifact.test.ts` *(depends on T001)* | R003, R008
  - **Do**: BDD tests: non-trivial file → true; empty / whitespace-only / frontmatter-only / stub → false; missing file → false.
  - **Verify**: `npm test` passes.

- [x] **T010** [P] Update viewer-states doc — `docs/viewer-states.md` *(depends on T008)* | R001, R004
  - **Do**: Rewrite the "Hide-during-in-flight" note to "Generating-during-in-flight": disabled button + spinner, content-aware completion, manual "Mark step complete", and timeout recovery.
  - **Verify**: doc matches implemented behavior.

- [x] **T011** [P] Update README footer-button description — `README.md` *(depends on T008)* | R001
  - **Do**: Update the "Reading Specs" footer/next-step description so documented behavior matches the Generating state.
  - **Verify**: README reflects the new affordance.

- [x] **T012** Storybook coverage for the Generating state — `webview/src/spec-viewer/components/FooterActions.stories.tsx` *(depends on T008)* | R001, R004, R005, R006
  - **Do**: Updated `inFlightNavState` to drive the new Generating render (recent `runningStepStartedAt`, `runningStepArtifactReady: false`); added dedicated stories — Generating Tasks/Plan, artifact-ready (re-enabled), and recovery-timeout fallback.
  - **Verify**: webview tsc clean; visible in Storybook under Viewer/FooterActions.

- [x] **T013** Suppress optional refinement commands at the closure gate (folded-in fix) — `FooterActions.tsx`, `FooterActions.stories.tsx`, `README.md`
  - **Do**: In the catalog footer path, hide Clarify/Checklist/Analyze whenever the footer offers a `complete`/`reactivate` action (closure-ready), independent of the fuzzy status string. Added an `Implemented — optional commands suppressed` story and a README note.
  - **Verify**: webview tsc clean; footer + full suite (560) pass.
