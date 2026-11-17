# Tasks: Implement records the ways an agent lowered the bar

- [x] **T001** Write the diff scanner (added lines, untracked files, kinds, reason, coverage drop, cap) + apps/speckit-extension/scripts/lowered_bar.py
- [x] **T002** Run the scan inside `--verify-run` and replace the previous scan's concerns, never raising + apps/speckit-extension/scripts/capture.py
- [x] **T003** [P] Pack the new module + apps/speckit-extension/scripts/package-manifest.py, .vscodeignore
- [x] **T004** [P] Show the scan's concerns in the receipts + apps/speckit-extension/scripts/receipts.py
- [x] **T005** Test FR-001..FR-007 through `write-context.py --verify-run` in a temp git repo: `.skip` names file:line, clean diff adds none, reasoned vs unreasoned, coverage drop, replace on re-run, exit 0 on a hit + apps/speckit-extension/tests/test_lowered_bar.py
- [x] **T006** Test FR-008: receipts list the scan's concerns + apps/speckit-extension/tests/test_lowered_bar.py
- [x] **T007** Changelog line + apps/speckit-extension/CHANGELOG.md

## Phase 2: Convergence

- [x] T008 Stay silent when git refuses the scan (not a git project), keep the line for a timeout, per Edge Cases (contradicts)
