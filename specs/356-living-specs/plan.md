# Implementation Plan: Living Specs — capability resolver, config + sandbox harness (LS·1)

## Summary

Build the foundation slice of Living Specs in the spec-kit extension: a Python **capability resolver** that maps changed files to the capabilities (code areas) that own them, a typed `livingSpecs` reader added to the existing config module, a pytest suite, and a thin reusable sandbox harness on top of the existing bench helpers. The resolver mirrors the model already proven in the SDD plugin's `resolve-spec-paths.py` but rebuilt in Companion vocabulary (`capabilities`, `match`/`exclude`/`spec`, `livingSpecs.enabled`). The feature is opt-in: with `enabled` unset/false or no config, the resolver is inert. Stdlib-only Python, matching the rest of `speckit-extension/scripts/`.

## Project Structure

```
speckit-extension/
├── scripts/
│   ├── resolve-spec-paths.py        # NEW — capability resolver (modes: --changed/--all/--orphans, --json)
│   └── companion_config.py          # EXTEND — add typed livingSpecs reader (load_living_specs)
├── tests/
│   ├── test_living_specs.py         # NEW — pytest: match/exclude, ordering, orphans, enabled:false inert
│   └── fixtures/
│       └── companion-living-specs.yml  # NEW — fixture config with a livingSpecs block
├── README.md                        # EXTEND — document the livingSpecs config block
├── CHANGELOG.md                     # EXTEND — release note
└── extension.yml                    # EXTEND — bump version

examples/todo-claude/bench/living-specs/
├── ls-lib.mjs                       # NEW — shared sandbox arrange helpers (imports ../lib.mjs)
├── ls-demos.mjs                     # NEW — thin runner: bake repo, run LS·1 demo, write evidence
└── evidence/
    └── LS1.json                     # NEW (generated) — real captured demo evidence

docs/                                # EXTEND — capability config reference is documented in README; a docs/ note optional
```

**Structure Decision:** Everything lands under `speckit-extension/` (the spec-kit extension's own scripts/tests/docs) plus a new `examples/todo-claude/bench/living-specs/` harness folder. No root `package.json`, root README, or VS Code `src/` changes — the GUI side stays thin for LS·1.

## Constitution Check

No project constitution file enforces additional principles for the spec-kit extension scripts beyond the repo conventions (stdlib-only Python, isolation, two-extensions docs split). All satisfied:

| Principle | Assessment |
|---|---|
| Extension isolation — no `.claude/**` / `.specify/**` runtime edits for behavior | PASS — resolver + config reader live in `speckit-extension/scripts/`, shipped in the extension. |
| Stdlib-only Python in `speckit-extension/scripts/` | PASS — `argparse`, `fnmatch`, `glob`, `os`, `sys`, `json` only; reuses `companion_config`'s YAML reader. |
| Two extensions, two docs sets | PASS — only `speckit-extension/` README/CHANGELOG/`extension.yml` touched. |
| Opt-in / no behavior change for non-adopters | PASS — `enabled` defaults false; inert resolver returns empty. |

No violations; Complexity Tracking omitted.

## Key Decisions

- **Decision:** Reuse `companion_config.py`'s YAML subset reader and add `load_living_specs(config)` as a sibling accessor to `resolve_order` / `merge_hooks`, rather than parsing YAML in the resolver. **Why:** the config module is the executable spec of `.specify/companion.yml`; one parser, no drift. **Alternative rejected:** a second YAML reader in the resolver (duplication, drift risk).
- **Decision:** Membership is `match` globs minus optional `exclude` globs, matched with `fnmatch` against POSIX-normalized relative paths. **Why:** matches the SDD model and the issue's contract; `fnmatch` is stdlib and supports `**` via a recursive-glob shim. **Alternative rejected:** regex patterns (the SDD `pattern` field) — globs read more naturally in the Companion config and match the issue's `match: ["src/checkout/**"]` examples.
- **Decision:** Specificity = length of the longest matching `match` glob's literal prefix that prefixes the file; tiebreak by capability name. **Why:** deterministic "most-specific first" ordering; `src/checkout/cart/**` (longer literal prefix) outranks `src/checkout/**`. **Alternative rejected:** count of path segments (ambiguous on `**`).
- **Decision:** Centralized spec defaults to `capabilities/<name>/spec.md`; a colocated capability supplies an explicit `spec` code-area path. A colocated capability with no resolvable `spec` raises a clear error. **Why:** mirrors OpenSpec's central-vs-colocated split and the issue contract.
- **Decision:** Reserved tiers `.arch.md` / `.coverage.md` are recognized siblings, never orphans; only `.spec.md` is loaded in v1. Orphan scan excludes `specs/` and `capabilities/<configured>`. **Why:** issue contract — never flag reserved-tier files.
- **Decision:** `enabled` defaults `false`; when false/absent the resolver short-circuits to empty results across all modes (exit 0). **Why:** opt-in guarantee (FR-009).
- **Decision:** Sandbox harness mode is `deterministic` — resolver + pytest only, no live AI. **Why:** LS·1 has no AI step; honesty contract requires real `execFileSync` capture, which deterministic mode provides cleanly.
