# Tasks: Release QA trusts a real fold on the Copilot app

- [x] **T001** Write `judgeAutoFold` (real invocations only, fold signature from the record, full call detail) + .claude/skills/release-qa/canvas-harness/auto-folds.mjs
- [x] **T002** Call `judgeAutoFold` from `autoFolds` + .claude/skills/release-qa/canvas-harness/checks.mjs
- [x] **T003** [P] Test FR-001: a view, glob and search of the tasks command's files count as no run + .claude/skills/release-qa/canvas-harness/auto-folds.test.mjs
- [x] **T004** [P] Test FR-002: the 2026-11-08 shape passes; boundaries minutes apart or by ai fail + .claude/skills/release-qa/canvas-harness/auto-folds.test.mjs
- [x] **T005** [P] Test FR-003: a real plan invocation fails with the whole call in the evidence + .claude/skills/release-qa/canvas-harness/auto-folds.test.mjs
- [x] **T006** Test FR-004: add the harness tests to the `test:canvas` glob and run it + package.json
