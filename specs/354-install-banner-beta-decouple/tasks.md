# Tasks: Decouple the install banner from the beta setting

- [x] **T001** Remove the `isCompanionWorkflowEnabled` short-circuit from `readInstallPromptEnabled()` and update its JSDoc to describe beta-independent gating + src/speckit/specKitExtensionInstall.ts
- [x] **T002** Drop the now-unused `isCompanionWorkflowEnabled` import (keep `coerceLegacyBoolean`) + src/speckit/specKitExtensionInstall.ts
- [x] **T003** Add a test covering "beta off + extension missing → banner shows" and note visibility no longer reads the beta setting + src/features/spec-editor/installBanner.test.ts
- [x] **T004** Confirm both render sites already gate on `shouldShowInstallPrompt(readInstallPromptEnabled(), …)`; correct README if it documents beta gating + src/features/spec-editor/specEditorProvider.ts, src/features/spec-viewer/specViewerProvider.ts, README.md
- [x] **T005** Run `npm run compile && npm test` and confirm green + (verification)
