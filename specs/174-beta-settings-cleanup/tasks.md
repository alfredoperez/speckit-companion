# Tasks — Beta Settings Cleanup

- [x] **T001** Rename the enable setting key to `speckit.companion.speckitCompanionWorkflow` and trim its description to one line + `package.json`
- [x] **T002** Trim `installPrompt`, `viewer.activityPanel`, `defaultWorkflow`, and `telemetry` descriptions to one line each; move telemetry's collected/never-collected detail to a README link + `package.json`
- [x] **T003** Update the enable-key constant + `src/core/constants.ts`
- [x] **T004** Add `migrateWorkflowBetaKey()` (per-scope copy old→new, then delete old) following the resumeBeta pattern + `src/core/settingsMigration.ts`
- [x] **T005** Call the new migration in `activate()` inside the existing try/catch, after `migrateResumeBetaToWorkflowBeta`; update the two `companion.workflowBeta` reads to the new key + `src/extension.ts`
- [x] **T006** Update remaining readers to the new key + `src/features/workflows/workflowManager.ts`, `src/features/spec-editor/specEditorProvider.ts`, `src/core/telemetry.ts`
- [x] **T007** Gate the install prompt behind the Companion-enable value (no prompt when workflow off) + `src/speckit/specKitExtensionInstall.ts`
- [x] **T008** Add unit tests for `migrateWorkflowBetaKey()` (carry-over + activation safety) + `tests/`
- [x] **T009** Update README Configuration / Beta section: labels, one-line descriptions, telemetry detail block, install-prompt-follows-workflow + `README.md`
