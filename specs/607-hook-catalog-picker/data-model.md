# Data Model: Attach a hook from a list, not from memory

Nothing new is stored. The catalog is derived per render from files the panel already reads, and is discarded with the message that carried it.

## Offered entry

One thing that can go in a hook of a given kind.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | The identifier written into the configuration. This is what the hook carries; everything else is for the person choosing. |
| `label` | string | What the row reads. For a command this is the identifier itself, because that is the name people use for it. |
| `note` | string, optional | Plain words for what it does, taken from the registry that declared it. Absent when the registry says nothing. |
| `usually` | string, optional | Where it normally attaches, from the lifecycle step the registry places it at. Absent rather than guessed. |
| `from` | string, optional | Which extension registered it, so two extensions offering similar names are distinguishable. |

## Catalog

| Kind | Source | Shape |
|---|---|---|
| Skill | the project's skill directories | already a list of names, widened to entries |
| Node | the project's node directory, then the shipped parts | already a list of names, widened to entries |
| Command | `.specify/extensions.yml` plus Companion's own `hooks:` block | new |
| Instruction | none | no second selector; its value is prose |

The command catalog is de-duplicated on `id`, keeping the first description seen. Order is the order the registries declare, so a stock install reads git's hooks and then Companion's.

## What the form holds

| State | Behaviour on a kind change |
|---|---|
| the chosen kind | set to the new kind |
| the value | cleared, because an identifier for one kind means nothing to another |
| the note | cleared, for the same reason |

This is what the form does today. The change is what the value field offers, not when it is cleared.
