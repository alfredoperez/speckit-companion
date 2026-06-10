# Tasks: Resume button — beta-gate it, and respect the command family the spec ran

Dependency-ordered, grouped by execution layer. `[P]` = touches a different file with no incomplete dependency (safe to run in parallel).

## Setup

- [x] **T001** Confirm working tree is clean and on a fresh branch off `main` for `140-resume-beta-family`; verify `/install-local` path resolves the bundled spec-kit extension (no setup code change — gate check before edits).

## Foundational (blocking — later tasks depend on these)

- [x] **T002** Add `resumeBeta: 'speckit.companion.resumeBeta'` to `ConfigKeys` (next to `complexityFastPath`) in `src/core/constants.ts` (FR-001).
- [x] **T003** [P] Add `resumeBeta: 'speckit.resumeBeta'` to `CONTEXT_KEYS` and include it in the `resetAllContextKeys` activation reset list (default `false`) in `src/core/utils/contextKeys.ts` (FR-002, FR-003).

## Core work (one task per file)

- [x] **T004** Add the `speckit.companion.resumeBeta` boolean property (default `false`, `scope: window`) under the **Beta Features** configuration group in `package.json` (FR-001).
- [x] **T005** Gate both visible resume menu entries — the inline action and the `7_modification` context entry (the two `when: "... viewItem == spec-active || viewItem == spec-tasks-done"` clauses) — by appending `&& speckit.resumeBeta` in `package.json`; leave eligibility conditions and the `when: false` palette-hide entry untouched (FR-002). Depends on T003 (context key) + T004 (setting).
- [x] **T006** Rewrite `title`/`description`/`enumDescriptions` for all four Beta settings (`speckit.viewer.activityPanel`, `speckit.companion.templateProfile`, `speckit.companion.complexityFastPath`, new `resumeBeta`) in `package.json` — effect before mechanism, ~2 lines max, keep the "(opt-in beta)"/default signal; keys and enum values unchanged (FR-008). Depends on T004.
- [x] **T007** In `src/extension.ts` activation, read `companion.resumeBeta` and `setContextKey(CONTEXT_KEYS.resumeBeta, enabled)` alongside the existing `templateProfile`/`complexityFastPath` activation block (FR-002, FR-003). Depends on T002, T003.
- [x] **T008** In the `onDidChangeConfiguration` handler in `src/extension.ts`, add an `if (e.affectsConfiguration(ConfigKeys.resumeBeta))` branch that re-reads the setting and re-sets the context key — no reload, no `.specify/companion.yml` write (FR-003). Depends on T007.
- [x] **T009** In `speckit-extension/scripts/status-context.py`, add the `COMPANION_STEP_COMMAND` map (specify/plan/tasks/implement → `/speckit.companion.<step>`) mirroring `STEP_COMMAND`'s keys (FR-004, FR-005).
- [x] **T010** In `speckit-extension/scripts/status-context.py`, add the `_step_command(step, profile)` helper returning the companion map when `profile == "turbo"` else `STEP_COMMAND`, both via `.get(step)` (FR-005). Depends on T009.
- [x] **T011** In `speckit-extension/scripts/status-context.py`'s `resolve()`, read `profile = ctx.get("profile")` and replace every `STEP_COMMAND.get(...)` / hard-coded `"/speckit.implement"` assignment in the resolution paths (implement-continue, advance, finish/advance fall-through) with `_step_command(step, profile)`; leave the derived no-ctx path stock (FR-006, FR-007). Depends on T010.

## Integration (wiring + verification of behavior)

- [x] **T012** Run `/install-local` (or rebuild) and verify: with `resumeBeta` off the ▶ button is absent on eligible specs, toggling it on (no reload) shows it, and toggling off hides it again (SC-001, SC-002). Depends on T005, T008.
- [x] **T013** Verify a `profile: "turbo"` spec resolves `/speckit.companion.<step>` and a `standard`/absent spec resolves `/speckit.<step>` for plan/tasks/implement and the fall-through cases — exercise `status-context.py` resolution directly (SC-003, SC-005). Depends on T011.

## Polish (docs + validation against Success Criteria)

- [x] **T014** [P] Update root `README.md` Beta Features section to document `resumeBeta` and the beta-gated resume button (FR-009).
- [x] **T015** [P] Add a user-facing entry to root `CHANGELOG.md` for the resume gate/setting (FR-009).
- [x] **T016** [P] Update `speckit-extension/README.md` and `speckit-extension/CHANGELOG.md` to describe the command-family-aware resume resolution (FR-009).
- [x] **T017** [P] Note in `docs/sidebar.md` that the resume button is now beta-gated (FR-009).
- [x] **T018** Final validation pass against SC-001…SC-005: confirm the 4 Beta setting descriptions read at ~2 lines effect-first (SC-004) and there are 0 cross-family mismatches; reset any demo fixtures touched.

## Dependencies

- T002, T003 are foundational and block T005, T007, T008 (extension-side gate).
- T004 blocks T005 and T006 (same `package.json`, distinct sections).
- T007 blocks T008 (same activation surface in `extension.ts`).
- T009 → T010 → T011 form a strict chain inside `status-context.py`.
- Integration: T012 depends on T005 + T008; T013 depends on T011.
- Polish docs (T014–T017) depend only on the behavior they document being settled (T005/T008/T011) and can otherwise run anytime; T018 closes the spec.

## Parallel

- T002 and T003 touch different files and can run together (both foundational, no interdependency).
- The two `status-context.py` tasks (T009→T011) and the extension-side tasks (T002–T008) are in separate files/extensions and their two chains can progress in parallel.
- Doc tasks T014, T015, T016, T017 each touch a different file and are fully parallelizable once the behavior is final.
