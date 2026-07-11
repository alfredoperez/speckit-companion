# Storage — Living Spec (colocated)

> Lives next to `storage.ts`.

## Requirements

- **FR-001** `load(key, fallback)` returns the fallback on missing or corrupt data, never throws. [observed]
- **FR-002** `save(key, value)` serializes to JSON under the given key. [observed]

### Scenario: corrupt data
- WHEN localStorage holds invalid JSON for a key
- THEN `load` returns the fallback and the app renders normally
