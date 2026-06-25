# Tasks: Auto-load living specs into specify & plan (LS·2)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Issue**: #362

Dependency-ordered. `[P]` marks tasks that can run in parallel (independent files).

## Phase 1 — Recording write path (the data contract)

- [x] **T001** Add `set_living_specs_loaded(feature_dir, names)` helper to `write-context.py` — merge a de-duped, order-preserving capability-name list onto `ctx["livingSpecs"]["loaded"]`, never rebuilding the record, never touching lifecycle keys. + speckit-extension/scripts/write-context.py
- [x] **T002** Add the `--living-specs <name>` argparse flag (repeatable) + dispatch branch + success-print line in `write-context.py` main. + speckit-extension/scripts/write-context.py
- [x] **T003** Add pytest coverage: records names in order, de-dups across calls, merges onto existing context without dropping other fields, refuses to write under no-names, writes nothing for opt-out. + speckit-extension/tests/test_living_specs.py

## Phase 2 — Node bodies (specify + plan)

- [x] **T004** Create `nodes/specify/load-living-specs.md` — best-effort prose: gate on `livingSpecs.enabled`, run resolver `--changed … --json` over in-scope files, read each `capabilities/<name>/spec.md` most-specific-first, record via `--living-specs`; skip silently on any miss; never write a living spec. Use an unnumbered note to avoid the #319 double-number trap. + speckit-extension/nodes/specify/load-living-specs.md
- [x] **T005** Insert `load-living-specs` into `nodes/specify/_order.yml` after `resolve-dir`, before `draft-spec`. + speckit-extension/nodes/specify/_order.yml
- [x] **T006** Edit `nodes/plan/gather-context.md` — add the reuse-or-resolve living-specs paragraph (prefer `livingSpecs.loaded` from `.spec-context.json`; only re-resolve if absent), best-effort, read-only. + speckit-extension/nodes/plan/gather-context.md

## Phase 3 — Assemble + re-bless golden

- [x] **T007** Run `assemble-nodes.py` to regenerate `commands/speckit.companion.specify.md` + `…plan.md`; verify the ASSEMBLED specify body does not double-number. + speckit-extension/commands/speckit.companion.specify.md, speckit-extension/commands/speckit.companion.plan.md
- [x] **T008** Re-bless golden with `capture-golden.py`; confirm `assemble-nodes.py --check` + `check-shape-parity.py` pass. + speckit-extension/tests/golden/commands/

## Phase 4 — Sandbox demo + evidence

- [x] **T009** [P] Extend `bench/living-specs/ls-lib.mjs` — add an LS·2 bake (todos capability w/ populated spec, changed files under it) + a `runRecordWrite` helper that runs the real `write-context.py --living-specs` against the sandbox and re-reads `.spec-context.json`. + examples/todo-claude/bench/living-specs/ls-lib.mjs
- [x] **T010** Add the LS2 runner to `bench/living-specs/ls-demos.mjs` — assert resolver resolves the capability for the changed files AND the recording write path produces `livingSpecs.loaded`; capture to `evidence/LS2.json` with honest `mode`/`verdict` (every value from real exec/read). + examples/todo-claude/bench/living-specs/ls-demos.mjs
- [x] **T011** Run `node ls-demos.mjs LS2`; confirm `evidence/LS2.json` written with repo-relative paths only (no `/Users/`). + examples/todo-claude/bench/living-specs/evidence/LS2.json

## Phase 5 — Docs + version + verify

- [x] **T012** [P] Update `speckit-extension/README.md` (living-specs read-path behavior) + `speckit-extension/CHANGELOG.md` (user-facing entry) + bump `extension.yml` version. + speckit-extension/README.md, speckit-extension/CHANGELOG.md, speckit-extension/extension.yml
- [x] **T013** Run full verification: `npm run compile && npm test`, `pytest speckit-extension/tests/`, `check-shape-parity.py`, capture eval. Fix any failures. + (verification)
- [x] **T014** Append the LS·2 section to the vault `living-specs/status.html` and flip the LS·2 board row to shipped (honest mode). + ~/dev/GitHub/obsidian-vault/Projects/speckit companion/product/living-specs/status.html
