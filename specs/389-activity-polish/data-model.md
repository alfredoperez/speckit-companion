# Data Model: Activity panel polish

One entity is reshaped; nothing else in the panel's data changes, and `.spec-context.json` is untouched.

## ActivityTab (webview tab model)

| Field | Type | Change | Rule |
|---|---|---|---|
| `id` | `'decisions' \| 'work' \| 'proof' \| 'notes'` | unchanged | — |
| `label` | `string` | unchanged | — |
| `count` | `number \| undefined` | **semantics change for proof/notes** | Decisions: decision count. Work: task count (when > 0). Proof: uncovered-requirement count, only when > 0. Notes: open-concern count, only when > 0. `undefined` renders no badge. |
| `warning` | `boolean \| undefined` | **new** | `true` on proof/notes badges (they exist only as attention signals); absent on decisions/work. Renderer adds the warning class. |

### Invariants

- Tab **presence** rules are unchanged: Proof renders when checks or coverage exist; Notes when concerns, comments, or living-spec info exist. A tab can be present with no badge.
- `defaultActivityTab` is unchanged: Proof when uncovered or concerned, else Decisions, else first.
- A `warning` badge is always a positive count — the model never emits `count: 0`.

## State transitions

Badge appearance follows data refreshes: coverage gaining its last test drops the Proof badge on the next render; a new concern adds the Notes badge. No persisted state.
