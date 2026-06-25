# Plan — Living Specs tiered consumption (LS·8)

**Issue:** #368 · **Branch:** `379-living-specs-tiered-consumption` · **Surface:** spec-kit extension

## Summary

Turn on the two reserved living-spec tiers. The resolver already knows the tier filenames (`.arch.md`, `.coverage.md`) but only exposed them as orphan-exemptions; it never handed their paths to a consumer. This change (1) teaches the resolver to *derive* a capability's tier-sibling paths and surface them in `--json`, (2) edits the plan node so it lazily loads a capability's architecture tier only for an architecture-significant change (size `normal`/`oversized`, never `simple`), reusing the resolver for the path, and (3) ships a deterministic, read-only coverage checker that maps each requirement in a capability's `.spec.md` to the test(s) named in its `.coverage.md`, reporting which requirements are uncovered. Everything stays opt-in: with living specs off, or a capability that ships only `.spec.md`, nothing changes.

## Key decisions

- **Resolver derives, callers reuse.** Tier filenames live in one place (`TIER_SUFFIXES` + `tier_paths()` in `resolve-spec-paths.py`); the plan node and the coverage checker both ask the resolver rather than hardcoding `.arch.md`/`.coverage.md`. Base-name handling: a `<base>.spec.md` colocated path strips `.spec.md`; a centralized `spec.md` keeps `spec` so siblings stay `spec.arch.md` (matching the existing committed fixture).
- **Arch load is a prompt-side instruction, not new code.** The plan node (`gather-context.md`) is the surface that briefs the AI; the lazy-load rule (tie to recorded `size`) is an instruction appended to the existing living-specs paragraph — no new top-level number (avoids the node double-numbering trap), re-blessed golden, shape-parity clean.
- **Coverage mirrors drift's contract.** `check-coverage.py` is read-only and always exits 0 (informational on-ramp, not a gate). It reuses `discover_all()` for capabilities + tiers; requirement ids are extracted from spec bullets/headings (`FR-NNN`, normalized) and matched against coverage-file lines that name a test.

## Project structure

```
speckit-extension/
├── scripts/
│   ├── resolve-spec-paths.py     # + TIER_SUFFIXES, tier_paths(), tiers on _entry/discover_all
│   └── check-coverage.py         # NEW — deterministic requirement→test coverage report
├── nodes/plan/gather-context.md  # + lazy arch-tier load instruction (size-gated)
├── commands/
│   ├── speckit.companion.plan.md         # regenerated (assembled)
│   └── speckit.companion.coverage.md     # NEW — coverage command surface
├── tests/
│   ├── golden/commands/…plan.md          # re-blessed
│   └── test_living_specs.py              # + TierPath / CoverageParse / CoverageReport tests
├── extension.yml                 # + coverage command registration, version 0.16.0 → 0.17.0
├── README.md                     # + "Coverage and architecture tiers" section + command row
└── CHANGELOG.md                  # + Unreleased LS·8 entry

examples/todo-claude/bench/living-specs/
├── ls-lib.mjs                    # + bakeLs8Repo, runCoverage, archTierSelected
├── ls-demos.mjs                  # + runLs8 (registered in RUNNERS)
└── evidence/LS8.json             # captured demo evidence (deterministic, PASS)

specs/379-living-specs-tiered-consumption/  # spec.md, plan.md, tasks.md, .spec-context.json
```

## Constitution check

No violation. Read-only, opt-in, additive; no destructive action; respects the LS·1 inert contract; spec-kit-extension change keeps to its own README/CHANGELOG/version.
