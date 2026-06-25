# Tasks — Drift command (LS·6)

## Phase 1 — Config

- [ ] T001 Add `exempt` to `load_living_specs` in `companion_config.py` (default `["*.config.*","*.test.*","**/migrations/**"]`), normalized via `_as_list`, falling back to the default when unset.

## Phase 2 — Drift script

- [ ] T002 New `speckit-extension/scripts/drift.py`: import resolver functions by path; per-capability spec-commit lookup (`git -C <root> log -n1`), changed-file diff, membership filter, exempt filter, spec self-exclusion. Anchor all git to `--root`.
- [ ] T003 Classification: scan `specs/*/.spec-context.json` changed/modified sets → `tracked` vs `unspeced`.
- [ ] T004 Reporting: per-capability human report; single all-clear line when every capability in sync; `--json` machine object; uncommitted-spec skip note; always exit 0; opt-in inert when disabled.

## Phase 3 — Command + registration

- [ ] T005 New `speckit-extension/commands/speckit.companion.drift.md` — thin invoker.
- [ ] T006 Register `speckit.companion.drift` in `extension.yml` `provides.commands`; bump `extension.version`.

## Phase 4 — Tests

- [ ] T007 pytest in `test_living_specs.py`: `unspeced` classification, `tracked` classification, exempt filter, in-sync all-clear, uncommitted-spec skip, opt-out inert. Calls real `drift.py` functions.

## Phase 5 — Docs

- [ ] T008 `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` — document the drift command.

## Phase 6 — Sandbox demo + evidence

- [ ] T009 `ls-lib.mjs`: `bakeLs6Repo` (todos in-sync + drifted + exempt + a tracked-via-context file), `runDrift`, a commit helper.
- [ ] T010 `ls-demos.mjs`: `runLs6` + register in `RUNNERS`; capture `evidence/LS6.json` from a real run.
- [ ] T011 Append LS·6 section to `status.html`, flip LS·6 row to shipped.

## Phase 7 — Verify

- [ ] T012 `npm run compile && npm test`; pytest green; `check-shape-parity.py` OK; LS·6 demo PASS.
