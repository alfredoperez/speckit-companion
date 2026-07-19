# Data model — 403 fold idempotency and script split

Nothing persisted changes shape. This feature reshapes how existing structures are processed, and adds one derived structure that lives only for the duration of a fold.

## Delta set

The requirement changes a feature spec declares, grouped by verb. Produced by the delta parser, consumed by the fold.

| Field | Holds | Notes |
|---|---|---|
| `added` | list of (heading, section text) | section text includes its own heading line |
| `modified` | list of (heading, section text) | same shape as added |
| `removed` | list of (heading, empty) | only the heading is meaningful |
| `renamed` | list of (old heading, new heading) | no body |
| `markers` | verb to capability name | routes a block to a named capability |

Unchanged by this feature.

## Rename mapping — new, derived, in-memory only

Built from a delta set's `renamed` entries at the start of each fold and discarded when the fold ends. Nothing is written to disk.

| Property | Rule |
|---|---|
| Source | one entry per rename, old heading to new heading |
| Chaining | a heading is resolved repeatedly until it maps to nothing further, so A to B and B to C resolves A to C |
| Cycle handling | resolution stops after it revisits a heading it has already seen, returning the heading it stopped at, so a cycle terminates instead of looping |
| Ambiguity | when the same old heading is renamed twice, the first entry wins, matching the order the parser produced them |

## Requirement section

A `### ` heading line plus every line up to the next heading of the same or higher level, or the end of the document. The unit every verb operates on. Located by exact heading match after stripping surrounding whitespace. Unchanged by this feature, except that the add verb now writes its section under the rename-resolved heading rather than the heading as authored.

## Living spec document

A per-capability Markdown file holding a title, a `## Requirements` section, and requirement sections beneath it. Created from a scaffold when absent. Shape unchanged.

## Context file

The per-spec record the writer maintains. Fields relevant here — decisions, verifications, concerns, expectations, context entries, coverage, step summaries, classification, and the synced living-spec names — keep their existing shapes and their existing de-duplication rules. The only change is that more than one of them can be written in a single invocation.

## Module dependency graph — new

The split introduces a one-way dependency order among the scripts. It is a structural fact worth stating because a cycle here is what the fifth module exists to prevent.

```
spec_context.py   spec_deltas.py     (no dependencies on siblings)
      │                  │
      ├────► capture.py  │
      ├────► task_sync.py│
      │                  │
      └────► living_spec_fold.py ◄───┘   (also depends on capture.py)
                     │
                     ▼
             write-context.py            (command line; imports all, re-exports their names)
```
