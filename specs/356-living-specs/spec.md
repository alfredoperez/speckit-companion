# Feature Specification: Living Specs — capability resolver, config + sandbox harness (LS·1)

**Issue:** #361 · **Wave:** Living Specs (Wave 4) · **Surface:** spec-kit extension (`speckit-extension/`)

## Overview

Living Specs lets a team declare the **capabilities** in their codebase — checkout, auth, billing, todos — and say where each one's durable spec lives, either in a central folder or right next to the code it describes. Given a set of changed files, the system can then answer "which capabilities does this change belong to?" so later tickets can keep those specs in sync as the code evolves.

This first slice is the foundation everything else builds on: the **resolver** that does the path math, the **config block** that declares the capabilities, and the **reusable sandbox test harness** that lets every later ticket be verified end-to-end automatically. The feature is **off by default** — with no config, the project behaves exactly like stock spec-kit / Companion.

## User Scenarios & Testing

### User Story 1 - Resolve which capabilities a change belongs to (Priority: P1)

A developer edits a file under their checkout code. They run the resolver with that file and get back the capabilities that own it — most-specific first — so the right living specs can be found and kept current.

**Why this priority:** This is the core value of the slice; without it nothing downstream (sync, fold, drift) has a way to map code to specs.

**Independent Test:** In a repo with a `livingSpecs` config declaring `checkout` (matches `src/checkout/**`) and `checkout-cart` (matches `src/checkout/cart/**`), run `resolve-spec-paths.py --changed src/checkout/cart/x.ts --json` and confirm it returns `[checkout-cart, checkout]` in that order.

**Acceptance Scenarios:**

1. **Given** a config with `checkout` and `checkout-cart` capabilities, **When** the resolver runs against a file under both, **Then** both capabilities are returned with the more specific one (`checkout-cart`) first.
2. **Given** a capability with an `exclude` glob, **When** a changed file matches `match` but also matches `exclude`, **Then** that capability is not returned for the file.
3. **Given** a changed file no configured capability claims, **When** the resolver runs, **Then** it returns no capability for that file (and does not error).

### User Story 2 - Discover every capability and surface orphans (Priority: P2)

A maintainer wants a full picture: every declared capability plus any living spec files lying around on disk that no capability claims. The resolver's `--all` mode unions the configured capabilities with on-disk `*.spec.md` files, de-dupes by resolved path, and flags the unclaimed ones as orphans.

**Why this priority:** Needed for housekeeping and for later drift detection, but the per-change resolution (Story 1) is the MVP.

**Independent Test:** Plant a stray `notes/random.spec.md` in a configured repo, run `--all`, and confirm both configured capabilities appear and the stray file is listed as an orphan.

**Acceptance Scenarios:**

1. **Given** configured capabilities plus on-disk `*.spec.md` files, **When** `--all` runs, **Then** the result unions both sources, de-duped by resolved spec path.
2. **Given** a `*.spec.md` file no capability's spec path claims, **When** `--orphans` (or `--all`) runs, **Then** that file is listed as an orphan.
3. **Given** sibling `.arch.md` / `.coverage.md` files next to a claimed `.spec.md`, **When** orphan detection runs, **Then** those reserved-tier files are never flagged as orphans.

### User Story 3 - Opt-in: feature is inert until enabled (Priority: P1)

A team that has not adopted Living Specs sees no change. With `livingSpecs.enabled` unset or `false` (or no config at all), the resolver returns empty for every mode and every existing command behaves exactly as today.

**Why this priority:** A foundation that changes behavior for non-adopters is a regression; the opt-in guarantee is as important as the resolution itself.

**Independent Test:** Run the resolver in a repo whose config has `enabled: false`; confirm `--changed`, `--all`, and `--orphans` all return empty with exit 0 and no error.

**Acceptance Scenarios:**

1. **Given** `livingSpecs.enabled: false`, **When** any resolver mode runs, **Then** it returns an empty result and exit 0.
2. **Given** no `livingSpecs` block at all, **When** any resolver mode runs, **Then** it behaves identically to `enabled: false`.

### Edge Cases

- A colocated capability declared with no resolvable spec path → clear config error (exit non-zero, message naming the capability).
- A changed file matched by two capabilities with equal specificity → stable, deterministic ordering (tiebreak by name).
- A capability whose `match` glob covers no files on disk → still listed in `--all`, never crashes `--changed`.
- Duplicate resolved spec paths across config + on-disk discovery → de-duped, listed once.

## Requirements

### Functional Requirements

- **FR-001** The system MUST provide a resolver script at `speckit-extension/scripts/resolve-spec-paths.py` with three modes: `--changed <file>...`, `--all`, and `--orphans`, plus a `--json` flag for machine-readable output.
- **FR-002** `--changed` MUST return the capabilities whose membership covers each given file, ordered most-specific first (deepest matching code area), with a stable tiebreak by capability name.
- **FR-003** Capability membership MUST be defined as the `match` globs minus the optional `exclude` globs.
- **FR-004** `--all` MUST return the union of configured capabilities and on-disk `*.spec.md` files, de-duplicated by resolved spec path, and MUST list orphans.
- **FR-005** `--orphans` MUST list `*.spec.md` files on disk that no configured capability's resolved spec path claims; reserved-tier files (`.arch.md`, `.coverage.md`) MUST never be flagged as orphans.
- **FR-006** Capabilities MUST be declared in a `livingSpecs` block in `.specify/companion.yml` with an `enabled` flag (default `false`) and a `capabilities[]` list of `{ name, match, spec, exclude? }`.
- **FR-007** A centralized capability with no explicit `spec` path MUST default to `capabilities/<name>/spec.md`; a colocated capability MUST carry an explicit code-area `spec` path.
- **FR-008** A colocated capability that resolves to no spec path MUST produce a clear config error.
- **FR-009** When `livingSpecs.enabled` is unset or `false`, or no config exists, the resolver MUST be inert: every mode returns empty, exit 0, no error, and no existing command changes behavior.
- **FR-010** `speckit-extension/scripts/companion_config.py` MUST expose a typed `livingSpecs` reader that defaults `enabled` to `false` and returns the normalized capabilities list, following the existing accessor style (`resolve_order` / `merge_hooks`).
- **FR-011** The resolver MUST reuse the path-resolution precedence already proven in `write-context.py` (`resolve_feature_dir` / prefix-match) rather than inventing new matching.
- **FR-012** A pytest suite `speckit-extension/tests/test_living_specs.py` MUST cover match/exclude, most-specific-first ordering, orphan detection, and the `enabled: false` → inert case.
- **FR-013** A reusable sandbox harness runner MUST exist at `examples/todo-claude/bench/living-specs/ls-demos.mjs` (+ `ls-lib.mjs`) importing the existing bench helpers from `../lib.mjs` and `../sync-templates.mjs`, baking a throwaway repo and running the LS·1 demo (arrange / act / assert + opt-out case).
- **FR-014** The config block MUST be documented in `speckit-extension/README.md`, with the change recorded in `speckit-extension/CHANGELOG.md` and `extension.yml` `version` bumped.

### Key Entities

- **Capability** — a named area of the codebase (`checkout`, `todos`). Attributes: `name`, `match` (globs that define membership), optional `exclude` (globs subtracted from membership), `spec` (path to its living spec). Centralized by default at `capabilities/<name>/spec.md`; colocated when given an explicit code-area path.
- **Living spec** — the durable `*.spec.md` document for a capability. Recognized tiers: `.spec.md` (hot, loaded in v1), `.arch.md` / `.coverage.md` (reserved, never orphaned).
- **livingSpecs config** — the `.specify/companion.yml` block: `enabled` flag + `capabilities[]` registry.

## Success Criteria

### Measurable Outcomes

- **SC-001** `resolve --changed src/checkout/cart/x.ts` returns exactly `[checkout-cart, checkout]` in that order.
- **SC-002** `resolve --all` unions configured + on-disk specs, de-dupes by resolved path, and lists every planted orphan.
- **SC-003** With `enabled: false` (or no config), all three modes return empty with exit 0 and no error.
- **SC-004** A colocated capability with no resolvable spec path produces a non-zero exit and a message naming the capability.
- **SC-005** The pytest suite passes and the sandbox demo runs the resolver across modes against a baked throwaway repo, capturing real stdout + exit codes.

## Assumptions

- v1 loads/syncs only `.spec.md` (hot tier); `.arch.md` / `.coverage.md` are reserved names recognized for orphan-exemption but not otherwise processed.
- The default centralized spec root is `capabilities/<name>/spec.md`, separate from feature specs under `specs/NNN-slug/`.
- The sandbox demo for LS·1 is `deterministic` (resolver + pytest, no live AI).

## Verbatim Constraints

- Resolver script path: `speckit-extension/scripts/resolve-spec-paths.py`
- Config block key: `livingSpecs`; flag: `enabled` (default `false`); registry: `capabilities` with `{ name, match, spec }`.
- Centralized default spec path: `capabilities/<name>/spec.md`
- Test file: `speckit-extension/tests/test_living_specs.py`
- Harness runner: `examples/todo-claude/bench/living-specs/ls-demos.mjs` + `ls-lib.mjs`
- Evidence path: `examples/todo-claude/bench/living-specs/evidence/LS1.json`
- Resolver modes: `--changed`, `--all`, `--orphans`, `--json`
