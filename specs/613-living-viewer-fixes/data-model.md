# Data Model: Living Viewer Fixes

No stored data changes. Spec files, `.spec-context.json` and the viewer protocol keep their shape. Two in-memory shapes grow a field.

## Capability tree node (`livingSpecsModel.ts`)

| Field | On | Meaning |
|---|---|---|
| `label` | leaf | The readable name, minus the leading words every sibling leaf in the group shares. Never empty. |
| `label` | group | The folder segment as words: `companion-commands` becomes `Companion Commands`. |

Rules:

- A spec's folder is a group segment when it holds two or more capability specs. With one, the folder collapses into the leaf, as today.
- Shared-word stripping compares leaves of one group only, and only when the group has two or more leaves.
- When stripping would leave a label empty, the label keeps its last word.
- `name` on the leaf stays the exact capability name. The tooltip's first line reads from it.

## Requirement rail mark (`toc.ts`)

| Card state | Dot |
|---|---|
| drifted | yes, warning colour |
| adopted | yes, review colour |
| new (`data-req-new`, neither of the above) | yes, success colour |
| confirmed | none |

## Overview chip groups (`LivingSpecsCard.tsx`)

| Group label | Members |
|---|---|
| `Updated by this run` | chips with `synced: true` |
| `Read for context` | every other chip |

An empty group is not rendered. Chip text is `readableName(name)`. The click payload keeps the exact `capabilityName`.
