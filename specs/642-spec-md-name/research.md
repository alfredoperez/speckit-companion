# Research: New specs are written as spec.md

## Rename the written file, keep reading both

- **Decision**: new specs are `spec.md`; every reader keeps accepting `<name>.spec.md` (owner decision 1).
- **Rationale**: stock spec-kit scripts hard-code `spec.md`, and 30-odd existing folders use the named form.
- **Alternatives considered**: a Companion wrapper for converge, analyze and clarify. Rejected by the owner's decision: a second entry point per stock command.

## Leave the resolver order alone

- **Decision**: `feature_spec_path` keeps returning a named file before `spec.md`.
- **Rationale**: no Companion step writes both names, and three mirrors (Python, TypeScript, the canvas rules) would all have to move together.
- **Alternatives considered**: flipping all three to `spec.md` first. Deferred: no folder needs it today.
