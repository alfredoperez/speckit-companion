# Contract: CLI selection & composition

The real spec-kit `preset` vocabulary (corrects the backlog's `preset use`).

## Commands

| Intent | Command |
|--------|---------|
| Install (dev/local) | `specify preset add --dev ./speckit-extension/presets/sdd-lean [--priority N]` |
| Install (catalog, future) | `specify preset add sdd-lean [--priority N]` |
| List installed | `specify preset list` |
| Inspect | `specify preset info sdd-lean` |
| Re-order precedence | `specify preset set-priority sdd-lean <N>` (lower = higher precedence) |
| Temporarily skip (template-type only) | `specify preset disable sdd-lean` / `enable sdd-lean` |
| Full off (restores stock commands) | `specify preset remove sdd-lean` |
| Debug which file wins | `specify preset resolve speckit.specify` |

## Resolution & composition rules (FR-003, FR-009)

- Stack, highest → lowest: project-local overrides (`.specify/templates/overrides/`) → presets by priority → extensions by priority → spec-kit core (`.specify/templates/`).
- Lower priority number wins; equal priority → alphabetical by id.
- `sdd-lean` defaults to a priority above the `companion` extension (presets always outrank extensions) and above `lean` when both are installed and the SDD shape is wanted.
- Strategy used: `replace` (the four commands fully replace their core namesakes). `prepend`/`append`/`wrap` exist in the installed build but are unused here.

## Acceptance (SC-002, SC-005)

- A single `specify preset add` (or the VS Code toggle) switches the project to the SDD-lean shape — no manual template editing.
- `specify preset remove` (or toggle off) reverts in one action.
- `specify preset resolve speckit.specify` reports `sdd-lean` as the winning layer when installed; deterministic across repeated runs (SC-005).
- Documented precedence when composed with another preset that also `replaces: speckit.specify`: the lower priority number wins; `set-priority` makes the outcome explicit.
