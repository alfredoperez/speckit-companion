# Tasks: Resume guard when spec-kit extension missing

- [ ] **T001** [P] Add `speckit.companion.installed` to the `speckit.specs.resume` view/item/context when-clause · package.json
- [ ] **T002** [P] Route the resume handler through `resolveDispatchWithFallback('speckit.companion.resume', …)` — suppress + standard install warning on `fellBack`, unchanged dispatch otherwise · src/features/specs/specCommands.ts
- [ ] **T003** Add suppression test: `speckit.companion.resume` → `command: null, fellBack: true` without the extension · src/features/specs/profileDispatch.test.ts
- [ ] **T004** [P] Docs: note the Resume button requires the companion extension · docs/sidebar.md + CHANGELOG.md fix entry
- [ ] **T005** Verify: full jest + both tsc; validate against FR-001…FR-004 · (no new files)

Dependency note: T003 waits on T002's guard wiring; T001/T002/T004 are independent; T005 last.
