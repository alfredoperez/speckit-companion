# Tasks: Workflow Builder lanes

## Wave 1

- [x] **T001** Render the join between lanes as an arrow, a "then <step>" line and the add-step button; drop the phase rule + apps/vscode/webview/src/pipeline-builder/Canvas.tsx
- [x] **T002** Style bounded lanes, header band, join column, quiet phase labels, and the stacked narrow layout + apps/vscode/webview/styles/pipeline-builder.css

## Wave 2

- [x] **T003** Test FR-002/FR-003/FR-005: one join per pair, its arrow, its "then <step>" copy, and the add button still opens the form after the left step + apps/vscode/webview/src/pipeline-builder/__tests__/Board.test.tsx
- [x] **T004** Test FR-001/FR-004/FR-007: lane border and header band rules read host tokens, the phase label has no rule element + apps/vscode/webview/src/pipeline-builder/__tests__/Board.test.tsx
- [x] **T005** [P] Update the interaction story that walks the seams + apps/vscode/webview/src/pipeline-builder/__stories__/Interactions.stories.tsx
- [ ] **T006** [P] Changelog line + CHANGELOG.md

## Wave 3

- [ ] **T007** Run tsc, related jest tests, and the builder visual test; update the pixel baselines on purpose + apps/vscode/webview/src/pipeline-builder/__screenshots__/
