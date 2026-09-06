# Data Model: A living spec is read one requirement at a time

Two records change and one is added. Nothing already on disk changes shape.

## File marker (`touches`)

An optional association from one requirement to the paths it describes.

| Aspect | Value |
| --- | --- |
| Location | Inside a living spec, on the line following a `### ` requirement heading, within the `## Requirements` section |
| Shape | `<!-- touches: <glob>[, <glob>…] -->` — one line, comma-separated, each entry a path or glob relative to the workspace root |
| Written by | Adoption (on each requirement it produces) and sync (write or widen, on each requirement it updates) |
| Read by | The load step, through the resolver; the viewer's outline, for its file count |
| Ignored by | Fold-back, drift, coverage, the viewer's requirement cards, and every markdown renderer — it is an HTML comment |
| Absent | The requirement is treated as describing every file its capability claims, and is contributed by every load |
| Malformed | Treated as absent. A marker naming nothing that exists is still a marker; reporting it belongs to Wave 2's validator |

**Validation**: none in this wave, deliberately. A marker that matches nothing loads its requirement anyway, because the failure direction has to be "read too much", never "read too little".

**Widening semantics**: sync writes the union of what the marker already named and the files it changed. It never narrows — a requirement that used to describe a file it no longer touches keeps claiming it until someone edits the marker by hand, which costs a run one extra requirement rather than losing one.

## Loaded-requirement record (`livingSpecs.loadedRequirements`)

What a run actually read, per capability.

| Aspect | Value |
| --- | --- |
| Location | `.spec-context.json` → `livingSpecs.loadedRequirements` |
| Shape | An object keyed by capability name, each value a list of requirement heading strings, verbatim |
| Sibling of | `livingSpecs.loaded`, the existing list of capability names, **whose shape does not change** |
| Written by | The load step in specify and plan, alongside the existing capability record |
| Absent | A run that loaded a spec with no markers records the capability in `loaded` and writes no entry here — the whole spec was read, so naming every requirement would be noise |
| Read by | The Activity panel's living-specs card, to show which requirements a run saw |

**Why a sibling rather than a richer `loaded`**: `loaded` is a plain list of names that several readers already consume, including the completion accounting that requires every loaded capability to end with a delta or a recorded skip. Changing its element type would break each of those for a feature none of them care about.

## Requirement slice

Not persisted — the in-memory result of parsing a spec, produced identically by both runtimes.

| Field | Meaning |
| --- | --- |
| `heading` | The requirement's heading text, verbatim — no trim, normalize or re-case. This is the join key fold-back, coverage and the viewer's cards already share |
| `touches` | The marker's globs, or absent |
| `body` | The lines from after the heading to the next `### ` or the end of the section |

**Parsing rules**, identical on both sides and pinned by the shared fixtures:

- Fenced blocks (``` or ~~~) are stripped before scanning, matching `requirementIds()`.
- Only `###` headings inside `## Requirements` count. A `####` scenario heading is body.
- A marker is recognised only on the line immediately after its heading; one further down is body.
- Two requirements sharing a heading both appear. Which one a fold-back delta refers to is a Wave 2 validation question.

## The load, as a rule

```
for each capability the resolver matched, in resolver order:
    if the spec carries no marker anywhere  → contribute the whole spec   (today's behaviour)
    else                                    → contribute the Purpose section
                                            + every requirement whose marker matches a changed file
                                            + every requirement carrying no marker
```

A capability whose markers all miss contributes its purpose alone, and is still recorded as loaded — it was consulted, and the completion accounting must still see it.
