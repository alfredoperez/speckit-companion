# Tasks: One implement-complete marker

- [x] **T001** Add a multi-path regression test to `speckit-extension/tests/test_context.py` that drives a full implement close through the live per-task path, the end-of-step hook (context-updater complete branch), the materialize fold, and mark-complete, asserting exactly one step-level implement-complete entry + speckit-extension/tests/test_context.py
- [x] **T002** Extend the test (or add a sibling) asserting the single-marker guarantee holds when the closing paths attribute the close to different actors (`ai` vs `extension`) + speckit-extension/tests/test_context.py
- [x] **T003** Run the test suite (`python3 -m unittest discover speckit-extension/tests`) and shape-parity check; confirm green. If red, fix the bypassing path minimally through the shared de-duplicated writer + speckit-extension/scripts/write-context.py
- [x] **T004** Add a user-facing CHANGELOG line to `speckit-extension/CHANGELOG.md` noting the implement step records a single completion marker + speckit-extension/CHANGELOG.md
