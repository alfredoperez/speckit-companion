# Data Model: Brownfield Adoption Wizard (Living Specs LS·5)

## Capability (registry entry)

A capability is a named area of behavior, registered under `livingSpecs.capabilities[]` in `.specify/companion.yml`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Stable handle; the idempotency key for the register helper. |
| `match` | string list | yes (for a useful capability) | Globs that define membership. Adoption derives a default from the area path, e.g. `["src/billing/**"]`. |
| `exclude` | string list | no | Globs to subtract. Defaults to empty. |
| `spec` | string | no | Spec path. Defaults to centralized `capabilities/<name>/spec.md`. |

**Validation / rules**:
- Append is keyed on `name`: a name already present in `livingSpecs.capabilities[]` is a no-op.
- An entry with no usable `match` would never resolve; adoption always supplies a match derived from the adopted area.
- The shape mirrors exactly what `companion_config.load_living_specs` normalizes, so the resolver reads an appended capability with no special-casing.

## Drafted living spec (document)

The markdown document the wizard writes to `capabilities/<name>/spec.md`. Structural contract:

| Element | Requirement |
|---------|-------------|
| Title line | `# <Capability> — Living Spec` (well-formed per #363). |
| Draft banner | A line marking the whole spec `[DRAFT]`, near the top. |
| `## Requirements` | Required section heading. |
| Requirement tag | Each requirement carries `observed` (from the code surface) or `inferred` (extrapolated). |
| Clarification marker | Low-confidence requirements carry inline `[NEEDS CLARIFICATION: …]`. |
| `## Uncovered` | Section listing files the assistant could not read (unreadable/over-budget). |

## Registry block (`.specify/companion.yml` `livingSpecs`)

| Field | Type | Notes |
|-------|------|-------|
| `enabled` | bool | Opt-in. Adoption may create the block; it does not flip unrelated settings. |
| `capabilities` | list of Capability | Adoption appends to this list incrementally. |

State transition: `register-capability.py` reads the current block (absent → minimal new block; present → preserved), then either appends one capability (name not present) or leaves it unchanged (name present). Malformed config → refuse to write.
