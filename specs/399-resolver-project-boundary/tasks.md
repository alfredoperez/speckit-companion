# Tasks: Living-spec resolution stops at nested project boundaries

- [x] **T001** Add a boundary-aware living-spec file walk that prunes any subdirectory containing `.specify/companion.yml`, never pruning the scan root + speckit-extension/scripts/resolve-spec-paths.py
- [x] **T002** Route `find_orphans` through the boundary-aware walk so unclaimed discovery stops at nested projects + speckit-extension/scripts/resolve-spec-paths.py
- [x] **T003** Route `discover_all` through the same walk so the full inventory and the unclaimed list share one file set + speckit-extension/scripts/resolve-spec-paths.py
- [x] **T004** Disambiguate discovered capability names against configured names and against each other + speckit-extension/scripts/resolve-spec-paths.py
- [x] **T005** [P] Add regression tests for the boundary stop, the opted-out nested project, and an unreadable nested config + speckit-extension/tests/test_living_specs.py
- [x] **T006** [P] Add regression tests for orphans/`--all` agreement and discovered-name uniqueness + speckit-extension/tests/test_living_specs.py
- [x] **T007** [P] Document the nested-project boundary where discovery is described + speckit-extension/README.md
- [x] **T008** [P] Add the user-facing `[Unreleased]` changelog entry + speckit-extension/CHANGELOG.md
- [x] **T010** Apply the same nested-project boundary to the sidebar's Living Specs walk so the editor and CLI listings agree + src/features/specs/livingSpecsModel.ts
- [x] **T011** [P] Add a sidebar regression test for the nested-project boundary + src/features/specs/__tests__/livingSpecsModel.test.ts
- [x] **T012** [P] Document the sidebar boundary and add the user-facing root `[Unreleased]` changelog entry + docs/sidebar.md, CHANGELOG.md
- [x] **T009** Run the extension test suite, `npm run compile && npm test`, and `check-shape-parity.py`; verify the original reproduction now reports nothing from nested projects
