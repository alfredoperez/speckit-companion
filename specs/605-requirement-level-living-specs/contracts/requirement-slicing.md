# Contract: requirement slicing, the marker, and the outline

The identifiers below are what the two parsers, the load step and the viewer code against. The names the spec pinned appear here exactly as it wrote them.

## The marker

```
<!-- touches: src/todos/due-date/**, src/todos/todo-form.ts -->
```

- Keyword `touches`, lowercase, followed by `:`.
- Comma-separated entries; surrounding whitespace on each is insignificant.
- Glob semantics are the registry's own, so a marker means what the same string would mean in a capability's `match:` list.
- Recognised only on the line immediately following a `### ` heading inside `## Requirements`.

## `resolve-spec-paths.py --requirements-for`

New mode on the existing resolver. Given the changed files, returns per capability what a load should contribute.

| Input | Output |
| --- | --- |
| `--changed <files…> --requirements-for --json` | For each matched capability: `name`, `spec`, `purpose` (the Purpose section text or `null`), `requirements` (a list of `{heading, matched}` for what to contribute), and `whole: true|false` |
| A spec carrying no markers | `whole: true`, and the caller reads the file as it does today |
| A spec whose markers all miss | `whole: false`, `requirements: []`, purpose present |
| No registry, disabled, no match | Exits 0 with an empty result, exactly like the existing modes |

Ordering is the resolver's existing most-specific-first order, unchanged.

## `requirementSlices(specText)` — TypeScript

New export in `src/features/specs/livingSpecsModel.ts`, beside `requirementIds()`.

```ts
interface RequirementSlice {
    heading: string;      // verbatim
    touches?: string[];   // absent when unmarked
    body: string[];       // lines after the heading, up to the next ### or section end
}
function requirementSlices(specText: string): RequirementSlice[];
```

Counts exactly the headings `requirementIds()` counts, from the same fence-stripped text.

## The outline

Derived inside `preprocessLivingRequirements` in `webview/src/spec-viewer/markdown/livingComponents.ts`, from the headings that pass already walks.

| Row element | Source |
| --- | --- |
| Label | The requirement heading, verbatim |
| Coverage | The same heading-keyed store `setLivingCoverage` fills, so the row and the card agree. Unknown renders as unknown, never as `0` |
| File count | The length of that requirement's `touches` list; nothing when unmarked |
| Activation | Moves the view to that requirement's card, by pointer and by keyboard |

Rendered only in living mode. A feature spec never receives it.

## The record

```
livingSpecs.loadedRequirements: { "<capability name>": ["<heading>", …] }
```

Sibling of `livingSpecs.loaded`, whose shape is unchanged. Absent for a capability loaded whole.

## Shared fixtures

`speckit-extension/tests/fixtures/requirement-slices/` holds one spec fragment per case, read by both the Python and the TypeScript suites. A fixture added there and exercised by only one side is itself a test failure — that assertion is what keeps the two parsers from drifting.

Cases the set must carry: no markers at all; every requirement marked; a mix; a marker inside a fenced block (not a marker); a marker one line too far down (body, not a marker); two requirements sharing a heading; a marker matching nothing on disk; a requirement whose marker matches everything the capability claims.
