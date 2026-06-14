# Tasks: Sidebar Completed Filter

- [x] **T001** Drop the `IMPLEMENTED` case from the Completed-bucket branch so `implemented` specs fall into the active bucket, and remove the stale "group it with the done specs" comment + src/features/specs/specExplorerProvider.ts
- [x] **T002** Add/adjust a unit test asserting an `implemented` spec lands in Active and a `completed` spec lands in Completed + src/features/specs/__tests__/specExplorerProvider.test.ts
- [x] **T003** [P] Update sidebar filter/group behavior to state `implemented` stays in Active and only `completed` appears under Completed + docs/sidebar.md
- [x] **T004** [P] Update implemented-vs-completed surfacing description + docs/viewer-states.md
- [x] **T005** [P] Add a user-facing release note for the corrected Completed filter behavior + CHANGELOG.md
- [x] **T006** Run `npm test` and `npm run compile` to confirm the partition change and test pass + (no file)
