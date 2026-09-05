# Data Model: A step you add appears in the spec viewer

No persisted entity is introduced. One read-only shape is added, and one existing shape gains entries it did not have before.

## ProjectStep (new, read-only)

One step a project added, as it is read off `.specify/companion/nodes/<step>/`. It exists only between the directory read and the splice; nothing writes it.

| Field | Source on disk | Rule |
|---|---|---|
| `name` | the directory name under `.specify/companion/nodes/` | Must match `[a-z][a-z0-9-]*`, the same shape the builder enforces when it creates the directory. A name that does not match is skipped. |
| `label` | `description:` in `_frame.md` | Falls back to the directory name with dashes replaced by spaces, which is what the builder writes when no label was given. No new label field is introduced. |
| `after` | `after:` in `_order.yml` | Empty when the key is absent. Only a value naming one of `specify`, `plan`, `tasks`, `implement` places the step; anything else is treated as unplaced. |
| `writes` | `writes:` in a node file inside the directory | Empty when no node declares one. The first declared value wins. |

### Validation and skipping

A directory is skipped, silently, when any of these hold. Skipping one never stops the others being read (FR-007).

- The name collides with a shipped step (`specify`, `plan`, `tasks`, `implement`, `mark-complete`, `auto`) — the shipped definition stands, and no duplicate is drawn.
- The name does not match the allowed pattern.
- `_order.yml` is absent or unreadable.
- `after:` is absent, empty, or names a step that is not one of the shipped four — the step is unplaced, so it is left out of the rail (FR-003). It remains launchable by hand, exactly as it is today.

### Ordering

Placed steps are inserted immediately after the step they name. Two steps naming the same `after` both appear, ordered by directory name, so the rail does not reshuffle between openings.

## WorkflowStepConfig (existing, unchanged shape)

A `ProjectStep` becomes an ordinary `WorkflowStepConfig` — the type every surface already consumes. This is what makes the timing denominator, the footer label, and the forward walk work without changing any of them.

| `WorkflowStepConfig` field | From `ProjectStep` |
|---|---|
| `name` | `name` |
| `label` | `label` |
| `command` | `speckit.companion.${name}` |
| `file` | `writes`, when a node declared one |
| `actionOnly` | `true` when no node declared a `writes:` |
| `untimed` | never set — an added step is expected to record a duration (FR-010) |

## Resolved pipeline (existing concept, new content)

The ordered `WorkflowStepConfig[]` a spec travels. Today it is `COMPANION_WORKFLOW.steps` verbatim; after this change it is that list with the project's placed steps inserted. Rules that hold:

- The splice applies only when the resolved workflow is the Companion pipeline. A spec recorded against stock SpecKit or a user-defined workflow gets its list unchanged (FR-008).
- `mark-complete` stays terminal. A step placed after `implement` lands before it, never after.
- A workspace with no `.specify/companion/nodes/` produces a list identical to today's (SC-003).

## State transitions

None added. Which steps are done still comes from the recorded `history[]` in `.spec-context.json`, and an added step is journaled by the same writer as a shipped one — the Python side already accepts it, because `known_steps()` reads the same step directory. File presence is not, and does not become, evidence (FR-009).
