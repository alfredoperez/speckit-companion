# Load specs for a change — Living Spec

## Purpose

Before a feature is drafted, the assistant should already know how the area it touches behaves. This capability answers "which durable rules describe these files?" and hands over only those, so nobody re-explains the codebase and no run is briefed with a whole file when three requirements would do.

## Requirements

### A changed file resolves to its capabilities, most specific first
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py -->

Given changed files, the resolver SHALL return every capability that owns at least one of them, ordered so the capability whose matching glob names the longest literal path comes first, with ties broken by name. The default output is a short readable list and `--json` gives the full record with each capability's spec path, location and whether the file exists.

#### Scenario: a leaf and its parent both match
- **WHEN** `src/checkout/cart/x.ts` changes and both `checkout` and `checkout-cart` claim it
- **THEN** the result is `checkout-cart` then `checkout`

### A requirement's file marker narrows what a change is handed
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py -->

A requirement MAY carry a `<!-- touches: <globs> -->` marker under its heading, and a change is then handed that requirement only when a changed file matches one of the globs. A requirement with no marker is always handed over, a spec with no marker anywhere is read whole, and a capability whose markers all miss is still returned with its purpose and no requirements. The marker is never shown as part of the requirement's text. When the narrowing cannot be asked for at all, every loaded capability's spec SHALL be read whole instead, because narrowing must never cost a step the context it would otherwise have had.

#### Scenario: a partly marked spec
- **WHEN** a spec has one requirement marked for `src/a/**`, one unmarked, and `src/b/x.ts` changes
- **THEN** only the unmarked requirement is handed over, along with the spec's purpose

#### Scenario: the narrowing is unavailable
- **WHEN** specify or plan cannot get an answer about which requirements apply
- **THEN** each loaded capability's spec is read whole and the step continues

### A requirement can point at a rule under another capability
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py -->

A requirement MAY carry `<!-- aligns: <capability>#<heading> -->`, and a load that asks to follow these edges SHALL also receive the named requirement, even when no changed file touches that capability. Only one hop is followed, and headings match exactly. The plan step's load and each implement worker's own slice SHALL follow these edges, so a worker handed one phase still sees the rules guarding the code it writes; the specify draft does not. `--leaned-on-by` answers the reverse question: which requirements point at this one.

#### Scenario: a guard explained elsewhere
- **WHEN** an implement worker's slice matches a requirement that aligns with `session-access#Writing requires being signed in`
- **THEN** that requirement from `session-access` is added to the worker's slice, marked as reached through the edge

### Specify records what it loaded and plan reuses it
<!-- touches: apps/speckit-extension/scripts/record-living-specs.py, apps/speckit-extension/scripts/resolve-spec-paths.py -->

At specify, the capabilities that own the change's files SHALL be recorded, most specific first, under `livingSpecs.loaded` in the feature's `.spec-context.json`, and plan reads that list instead of resolving again. Recording writes nothing when nothing matched, leaves a one-line note saying whether living specs were not configured, matched nothing, or loaded, and never fails or blocks the run. Specify and plan never create or edit a living spec, and a matched capability whose spec file is not written yet is skipped quietly.

#### Scenario: nothing in the change belongs to a capability
- **WHEN** specify runs on files no capability claims
- **THEN** no `livingSpecs.loaded` list is written and the note says nothing matched

### House rules reach the step they are written for
<!-- touches: apps/speckit-extension/scripts/companion_config.py, apps/speckit-extension/scripts/resolve-spec-paths.py -->

A project-wide `rules:` block in the registry MAY list guidance under `spec` and `plan`. The `spec` lines SHALL reach the specify step and the `plan` lines the plan step, delivered with the same resolver answer that carries the requirements. A `rules:` block that will not parse is dropped with a warning and the step runs as if it were absent.

#### Scenario: a malformed rules block
- **WHEN** `rules:` holds something that is not a list of lines per step
- **THEN** the step receives no guidance, a warning is reported, and the step still runs

### One slice of a spec can be read from the terminal
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py, apps/speckit-extension/commands/speckit.companion.living-show.md -->

`/speckit.companion.living-show` SHALL print a capability's requirement headings with their count, one requirement in full with its scenarios, or the requirements that describe one file grouped by capability, in the spec's own words and using the same reading rules a load uses. It is read-only and every miss is an answer: an unregistered capability lists the registered ones, a registered capability with no file says so, a heading that matches nothing lists the headings that exist, and an ambiguous name lists the candidates.

#### Scenario: asking for a capability that is not registered
- **WHEN** `--headings payments` is asked and no such capability exists
- **THEN** the output says it is not registered, lists the capabilities that are, and exits successfully
