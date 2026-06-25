# Tasks: Living Specs — capability resolver, config + sandbox harness (LS·1)

Dependency-ordered. `[P]` marks tasks that can run in parallel (independent files).

## Phase 1 — Config reader (foundation)

- [x] **T001** Add `load_living_specs(config)` to `companion_config.py`: returns `{enabled: bool (default false), capabilities: [{name, match[], exclude[], spec}]}`, normalizing scalar match/exclude to lists and defaulting `spec` to `capabilities/<name>/spec.md` + speckit-extension/scripts/companion_config.py

## Phase 2 — Resolver (US1, US2, US3)

- [x] **T002** Create `resolve-spec-paths.py` skeleton: argparse for `--root`/`--changed`/`--all`/`--orphans`/`--json`, load config via `companion_config.load_config` + `load_living_specs`, inert short-circuit when `enabled` false/absent (empty result, exit 0) + speckit-extension/scripts/resolve-spec-paths.py
- [x] **T003** Implement glob membership (`match` minus `exclude`) with a `**` recursive-glob shim + specificity by literal-prefix length + speckit-extension/scripts/resolve-spec-paths.py
- [x] **T004** Implement `--changed`: capabilities owning each file, most-specific first, tiebreak by name; spec-path + location + exists resolution; colocated-no-path → exit 2 error + speckit-extension/scripts/resolve-spec-paths.py
- [x] **T005** Implement `--all` (union config + on-disk `*.spec.md`, de-dup by resolved path) and `--orphans` (unclaimed `*.spec.md`, exempt `.arch.md`/`.coverage.md` + `specs/`/`capabilities/<configured>`) + speckit-extension/scripts/resolve-spec-paths.py

## Phase 3 — Tests

- [x] **T006** [P] Add fixture `tests/fixtures/companion-living-specs.yml` with checkout + checkout-cart + exclude + enabled flag + speckit-extension/tests/fixtures/companion-living-specs.yml
- [x] **T007** Write `test_living_specs.py`: config-reader defaults, match/exclude, most-specific-first ordering, --all union/de-dup, orphan detection + tier exemption, colocated error, enabled:false inert + speckit-extension/tests/test_living_specs.py

## Phase 4 — Sandbox harness

- [x] **T008** [P] Add `ls-lib.mjs`: arrange helpers (bake throwaway repo with src/checkout, companion.yml, planted orphan) importing from ../lib.mjs + examples/todo-claude/bench/living-specs/ls-lib.mjs
- [x] **T009** Add `ls-demos.mjs`: run resolver across modes + pytest via execFileSync, capture real stdout/exit, write evidence/LS1.json (mode deterministic, verdict) + examples/todo-claude/bench/living-specs/ls-demos.mjs

## Phase 5 — Docs & version

- [x] **T010** [P] Document the `livingSpecs` config block in `speckit-extension/README.md`, add CHANGELOG entry, bump `extension.yml` version + speckit-extension/README.md, speckit-extension/CHANGELOG.md, speckit-extension/extension.yml
