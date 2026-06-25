# Data Model: Living Specs LS·1

## livingSpecs config block (in `.specify/companion.yml`)

```yaml
livingSpecs:
  enabled: false            # bool, default false — opt-in gate
  capabilities:
    - name: checkout        # str, required — capability id
      match: ["src/checkout/**"]   # list[str] globs — membership
      exclude: ["**/*.test.ts"]    # list[str] globs, optional — subtracted from membership
      spec: capabilities/checkout/spec.md  # str, optional — defaults to capabilities/<name>/spec.md
```

### Capability (normalized)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | str | yes | — | capability id; used in default spec path and ordering tiebreak |
| `match` | list[str] | yes | — | globs defining membership; scalar coerced to 1-item list |
| `exclude` | list[str] | no | `[]` | globs subtracted from membership; scalar coerced |
| `spec` | str | no | `capabilities/<name>/spec.md` | living-spec path; explicit path = colocated |

### Membership rule

A file belongs to a capability when it matches **any** `match` glob AND matches **no** `exclude` glob.

### Resolved entry (resolver output, `--json`)

| Field | Type | Notes |
|---|---|---|
| `name` | str | capability id |
| `spec` | str | resolved spec path |
| `location` | "centralized" \| "colocated" | colocated when `spec` not under `capabilities/<name>/` |
| `exists` | bool | whether the spec file is on disk |
| `specificity` | int | literal-prefix length of the matching glob (in `--changed` mode) |

### Tier conventions

- `.spec.md` — hot tier, loaded in v1.
- `.arch.md` / `.coverage.md` — reserved siblings; recognized, never flagged as orphans.

### State / errors

- A capability with `spec` explicitly set to an empty value (colocated, no resolvable path) → config error, non-zero exit, message names the capability.
- `enabled` false/absent → resolver returns empty for all modes.
