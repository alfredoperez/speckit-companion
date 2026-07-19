# Tasks: Drift stops claiming "in sync" when it could not check

- [x] **T001** Read the repository's shallow-boundary commits once per run + speckit-extension/scripts/drift.py
- [x] **T002** Split the baseline lookup so "never committed" and "history unreadable" become different skip reasons + speckit-extension/scripts/drift.py
- [x] **T003** Skip a capability whose baseline is a shallow boundary, with the shallow reason + speckit-extension/scripts/drift.py
- [x] **T004** Rework the clean-run summary for mixed runs and append the fetch-full-history hint + speckit-extension/scripts/drift.py
- [x] **T005** Add real depth-1 and depth-3 clone fixtures and the shallow-skip tests + speckit-extension/tests/test_living_specs.py
- [x] **T006** Add the rendering tests for mixed, all-skipped, full-clone, and exit-code cases + speckit-extension/tests/test_living_specs.py
- [x] **T007** Update the changelog and the drift command's README description + speckit-extension/CHANGELOG.md, speckit-extension/README.md
