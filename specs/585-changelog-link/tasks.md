# Tasks: Changelog link opens the right product's release

- [x] **T001** Add a failing test asserting View Changelog opens the offered version's own release address · `src/speckit/updateChecker.test.ts`
- [x] **T002** Build the changelog address from the offered version so it resolves by tag · `src/speckit/updateChecker.ts`
- [x] **T003** [P] Add the user-facing changelog entry under Unreleased · `CHANGELOG.md`
- [x] **T004** Verify no shipped source still resolves a release through the shared latest lookup, and run the suites · `src/`

T001 blocks T002; T003 is independent; T004 waits on all.
