# Data Model: Spec Explorer Sidebar View

These are the in-memory shapes the node-side reader (`livingSpecsModel.ts`) produces and the provider renders. No persisted storage is introduced — the source of truth is `.specify/companion.yml` plus the on-disk file tree.

## LivingSpecsConfig

The parsed `livingSpecs` block of `.specify/companion.yml`.

| Field | Type | Notes |
|-------|------|-------|
| `enabled` | `boolean` | Defaults to `false` (opt-in). When false, the model returns an empty result. |
| `capabilities` | `CapabilityConfig[]` | Raw capability entries from the config. |

## CapabilityConfig (raw input)

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Capability name. |
| `match` | `string[]` | Membership globs (normalized to a list). |
| `exclude` | `string[]` | Exclusion globs (normalized to a list). |
| `spec` | `string` | Explicit spec path; defaults to `capabilities/<name>/spec.md` when unset. Empty string flags a bad colocated entry (skipped). |

## ResolvedCapability (model output)

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Capability name. |
| `spec` | `string` | POSIX repo-relative resolved spec path. |
| `location` | `'centralized' \| 'colocated'` | `centralized` when `spec === capabilities/<name>/spec.md`, else `colocated`. |
| `exists` | `boolean` | Whether the spec file exists on disk. |
| `tiers` | `Tier[]` | The architecture/coverage siblings that exist on disk. |

## Tier (model output)

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `'arch' \| 'coverage'` | Tier kind. |
| `path` | `string` | POSIX repo-relative path of the sibling. |
| `exists` | `boolean` | Only `exists: true` tiers are rendered as children. |

Tier paths derive from the spec base: strip a trailing `.spec.md` (colocated `billing.spec.md` → `billing`) else `.md` (centralized `capabilities/x/spec.md` → `capabilities/x/spec`), then append `.arch.md` / `.coverage.md`.

## LivingSpecsListing (top-level model output)

| Field | Type | Notes |
|-------|------|-------|
| `enabled` | `boolean` | Mirrors config; drives the empty-state copy ("living specs are off" vs "no specs yet"). |
| `capabilities` | `ResolvedCapability[]` | De-duped by resolved spec path, sorted by name. |
| `orphans` | `string[]` | POSIX repo-relative `*.spec.md` paths claimed by no capability, sorted. |

## Empty-state rules

- `enabled === false` → friendly "Living specs are turned off" message.
- `enabled === true` but `capabilities.length === 0 && orphans.length === 0` → friendly "No living specs yet" message.
- Missing/malformed `.specify/companion.yml` → treated as `enabled: false` (no error).

## Orphan exclusion rules (mirrors the resolver)

A `*.spec.md` file is NOT an orphan when it is: under the `specs/` folder; a reserved tier sibling (`.arch.md` / `.coverage.md`); a capability's claimed spec path; or inside a configured capability's spec directory.
