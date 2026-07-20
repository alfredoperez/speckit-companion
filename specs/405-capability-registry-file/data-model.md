# Data Model: Capability registrations get their own file

## Capability registry (`living-specs.yml`, project root)

The project's record of which capabilities exist. Committed to version control. Created on first registration; absent means living specs were never adopted.

| Field | Type | Rules |
|---|---|---|
| `enabled` | boolean | Defaults to `false` when absent. A registry created by the adoption helper is born `true`. `false` means the project has deliberately opted out, and every reader stays inert. |
| `exempt` | list of glob strings | The drift exemption list. When the key is absent entirely, the shipped defaults apply (`*.config.*`, `*.test.*`, `**/migrations/**`). An explicitly empty list means no exemptions. |
| `capabilities` | list of capability entries | Defaults to empty. An empty list is adopted-but-empty, not an error. |

The file also accepts a top level that is a single `livingSpecs:` mapping; the loader unwraps it and treats its contents as the three fields above. This exists so that copying the old block into the new file by hand works.

### Capability entry

| Field | Type | Rules |
|---|---|---|
| `name` | string | Required; the idempotency key. An entry with no name is skipped. |
| `match` | string or list of glob strings | Membership patterns. Coerced to a list. A capability with no `match` never resolves. |
| `exclude` | string or list of glob strings | Exclusion patterns. Coerced to a list. Optional. |
| `spec` | string | Path to the living spec. Absent means the centralized default, `capabilities/<name>/spec.md`. Declared but empty stays empty so the resolver can flag the bad path. |

## Companion settings (`.specify/companion.yml`)

Unchanged except that it no longer owns capability registrations.

| Field | State after this change |
|---|---|
| `commands.*.hooks`, `commands.*.nodes` | Stays. Pipeline hooks and recipes are install-adjacent settings and belong here. |
| `livingSpecs` | Legacy. Read as a fallback when no registry file exists; removed by the next write. A block left behind after a registry file exists is reported as stale and ignored. |

## Resolution outcome

What the shared location rule returns to every caller.

| Field | Meaning |
|---|---|
| `origin` | `registry` when the answer came from `living-specs.yml`; `legacy` when it came from the old settings file; `none` when the project has adopted neither. |
| `path` | The project-relative path the answer came from; absent when `origin` is `none`. |
| `legacy_stale` | True when a registry file answered *and* the old file still carries a capability block. |
| `warnings` | Plain-language notes: a stale legacy block, or a registry file that could not be parsed. Empty for a project that never adopted. |

## State transitions

| From | Event | To |
|---|---|---|
| Never adopted (neither file) | A capability is registered | Registry file created with `enabled: true` and the one capability |
| Legacy only | Any read | Legacy answers; nothing changes on disk |
| Legacy only | A capability is registered or relocated | Registry file written with the full set; the capability block is removed from the old file; the move is reported |
| Registry only | Any read or write | Registry answers; the old file is not consulted |
| Both | Any read | Registry answers; a stale-legacy warning is raised |
| Both | A capability is registered or relocated | Registry answers and is rewritten; the stale block is removed from the old file |
