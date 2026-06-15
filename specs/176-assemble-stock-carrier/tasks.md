# Tasks

- [x] **T001** Add a timing-fence presence assertion to `check-shape-parity.py` — fail when any `companion-standard/commands/speckit.*.md` body lacks the `timing` part fence + speckit-extension/scripts/check-shape-parity.py
- [x] **T002** Verify the guard catches a regression (delete a timing fence, confirm non-zero exit, restore) + speckit-extension/scripts/check-shape-parity.py
- [x] **T003** Update the "Known limitations" drift entry in `docs/template-profiles.md` to the resolved state (timing single-sourced; stock body = raw upstream template; vendored-body assembly deferred) + docs/template-profiles.md
- [x] **T004** Add the carrier-shape + deferred-assembly note to `speckit-extension/docs/node-model.md` + speckit-extension/docs/node-model.md
- [x] **T005** Add a user-facing CHANGELOG entry and bump the version + speckit-extension/CHANGELOG.md, speckit-extension/extension.yml
- [x] **T006** Refresh the spec-kit extension README where it describes the stock carrier + speckit-extension/README.md
- [x] **T007** Lock the guard with regression tests and verify all gates: `npm run compile && npm test` + 3 parity checks + Python suite + speckit-extension/tests/test_nodes.py
