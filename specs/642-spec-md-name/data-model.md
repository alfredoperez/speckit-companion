# Data Model: New specs are written as spec.md

## Feature spec file

The one entity this feature reshapes. A feature folder holds at most one feature spec, a markdown file at the top of the folder.

**Names**
- `spec.md`: the name Companion writes for every new spec, and the name stock spec-kit commands look for.
- `<short-name>.spec.md`: the legacy name, found in about thirty existing folders. Companion no longer writes it, but every reader still accepts it.

**Relationships**
- Belongs to one feature folder under `specs/`, next to `plan.md`, `tasks.md` and `.spec-context.json`.
- Living-spec files under `capabilities/` are a different entity and keep their `<name>.spec.md` names.

**Resolution order**
1. A file matching `*.spec.md` in the folder, first in sorted order.
2. Otherwise `spec.md`, returned even when absent so a writer knows the name to create.

`feature_spec_path` owns this order. The order is unchanged by this feature, because no step writes both names.

**Validation rules**
- A folder never holds both names. No Companion step creates the second one (FR-004). If a hand-made folder holds both, readers keep the current choice and the named file wins.
- Specify and auto write `spec.md` (FR-001). Every step that loads the spec names `spec.md` first and falls back to the legacy name (FR-002).
- The artifact check, the doctor and the quality check accept either name by asking the resolver, never by a literal file name (FR-003).

**State transitions**
- None. A spec file is not renamed or migrated. Old folders stay on the legacy name, and new folders start on `spec.md`.
