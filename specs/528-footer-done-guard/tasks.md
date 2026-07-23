# Tasks: Footer Done Guard

- [x] **T001** Add an early `if (isSpecDone(ctx)) return false;` guard at the top of `shouldShowApprove` so a done spec never surfaces the forward advance action + src/features/spec-viewer/footerActions.ts
- [x] **T002** [P] Add the skew oracle row (`status: implemented`, `currentStep: tasks` → right zone `['archive','complete']`, no `approve`) so the matrix test covers the done/lagging-step case + src/features/spec-viewer/__tests__/footerMatrix.fixtures.ts
- [x] **T003** [P] Update the footer button matrix so a done spec is documented as offering only its finish actions regardless of the recorded current step + docs/viewer-states.md
- [x] **T004** Run the footer matrix suite and the full test run; confirm the new case passes and nothing regresses + npm test
