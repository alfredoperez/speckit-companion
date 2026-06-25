# Tasks — Living Specs tiered consumption (LS·8)

## Phase 1 — Resolver: derive + expose tier paths

- [x] **T001** Add `TIER_SUFFIXES` and `tier_paths(spec, root)` to `resolve-spec-paths.py`, deriving `.arch.md` / `.coverage.md` siblings from a spec path (strip `.spec.md` for colocated, `.md` for centralized) with on-disk existence when `root` given.
- [x] **T002** Include `tiers` on `_entry()` and the synthesized orphan entries in `discover_all()` so `--json` carries them; leave the human render unchanged.

## Phase 2 — Plan node: lazy arch-tier load

- [x] **T003** Append the size-gated arch-tier load instruction to `nodes/plan/gather-context.md` (load on `normal`/`oversized`, skip on `simple`; resolve path via resolver; best-effort/read-only) without a new top-level number.
- [x] **T004** Re-assemble (`assemble-nodes.py`) + re-bless golden (`capture-golden.py`); confirm `assemble-nodes.py --check`, `build-commands.py --check`, and `check-shape-parity.py` all pass.

## Phase 3 — Coverage checker

- [x] **T005** Add `check-coverage.py`: reuse the resolver for tiers, extract requirement ids from `.spec.md`, parse the `.coverage.md` requirement→test map, report per-requirement covered/uncovered; read-only, always exit 0, opt-in inert.
- [x] **T006** Add `speckit.companion.coverage.md` command surface and register it in `extension.yml` `provides.commands`.

## Phase 4 — Tests + docs + version

- [x] **T007** Add `TierPathTests`, `CoverageParseTests`, `CoverageReportTests` to `test_living_specs.py`; pytest green.
- [x] **T008** Update `README.md` (command row + "Coverage and architecture tiers" section), `CHANGELOG.md` (Unreleased LS·8 entry), bump `extension.yml` version 0.16.0 → 0.17.0.

## Phase 5 — Sandbox demo + evidence

- [x] **T009** Add `bakeLs8Repo` / `bakeLs8OptOutRepo` / `runCoverage` / `archTierSelected` to `ls-lib.mjs` and `runLs8` to `ls-demos.mjs` (registered in RUNNERS).
- [x] **T010** Run the LS8 demo, capture deterministic evidence to `evidence/LS8.json` (no absolute paths), verify PASS.
- [x] **T011** Append the LS·8 section to the vault status page, flip the LS·8 row to shipped, bump the shipped count.

## Verify

- [x] `npm run compile && npm test` green (1094 tests).
- [x] pytest green (218 tests).
- [x] `check-shape-parity.py`, `assemble-nodes.py --check`, `build-commands.py --check` green.
- [x] LS8 demo verdict PASS (9/9 assertions), mode `deterministic`.
