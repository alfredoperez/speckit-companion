# Research: A living spec is read one requirement at a time

Phase 0. Every unknown the spec left open, settled with the reason.

## Decision: the marker is an HTML comment directly under the requirement heading

**Decision**: `<!-- touches: <comma-separated globs> -->` on the line following a `### ` requirement heading, inside the `## Requirements` section.

**Rationale**: The spec's hard constraint is that no existing reader changes behaviour. An HTML comment is invisible in every markdown renderer, is already the shape this repo uses for machine-readable markers inside spec content (`<!-- capability: <name> -->` on fold-back delta blocks), and is skipped by every parser here that walks headings. Fold-back matches on heading text and never reads the following line; coverage counts requirement ids; the viewer's card builder passes body lines through verbatim, so the comment rides along inertly.

**Alternatives considered**: YAML frontmatter per requirement — impossible, frontmatter is a document-level construct. A separate sidecar file mapping requirements to globs — rejected: it drifts the moment someone renames a heading, and the whole point is that the marker is written by the same command that writes the requirement. An attribute on the heading itself (`### Name {touches=...}`) — rejected: it changes the heading text, which is the join key for fold-back, coverage and the viewer's cards.

## Decision: globs reuse the resolver's existing matcher, not a new one

**Decision**: A marker's globs are matched with the same glob semantics `living-specs.yml` capability globs already use — `_glob_to_regex` / `_glob_matches` in `resolve-spec-paths.py` on the spec-kit side, `globToRegExp` / `globMatches` in `livingSpecsModel.ts` on the extension side.

**Rationale**: Two glob dialects in one feature is a bug generator, and both files already have a matcher that the registry's own globs are tested against. A marker is the same kind of statement as a capability's `match:` — "these paths" — so it should mean the same thing.

**Alternatives considered**: A stricter prefix-only form — rejected: `src/todos/due-date/**` is the natural way to write this and the issue's own example uses it. A new matcher tuned for markers — rejected: it would drift from the registry's semantics and nobody would know which rules applied where.

## Decision: two parsers, one shared set of test cases

**Decision**: Requirement slicing is implemented twice — TypeScript beside `requirementIds()` for the viewer and the extension, Python in `resolve-spec-paths.py` for the command bodies — and pinned against a shared fixture set so they cannot diverge.

**Rationale**: This is forced. The viewer runs in a webview with no Python, and the command bodies run in a shell with no TypeScript. `requirementIds()` already establishes the pattern of a small parser existing on the TS side; the risk the spec names is not duplication but *divergence*, and the repo already has precedent for pinning two runtimes against one fixture (the step→status map, per `core.spec.md`). A shared fixture directory both suites read is the mechanism.

**Alternatives considered**: Parse only in Python and have the viewer ask the extension — rejected: the viewer's outline must render at paint time from markdown it already has, and a round-trip per open is both slower and a new failure mode. Parse only in TypeScript and shell out from Python — rejected: the command bodies must work with no extension installed.

## Decision: fenced-code handling is copied from `requirementIds()`, not reinvented

**Decision**: Both parsers strip fenced blocks before scanning for headings, using the same fence rule `requirementIds()` uses (a line beginning with ``` or ~~~ toggles the state).

**Rationale**: The spec makes this a requirement because the outline and the coverage denominator must count the same headings. `requirementIds()` is the existing authority on what counts, and it already strips fences. Any new parser that counted differently would make the outline disagree with the coverage badge on the same page.

**Alternatives considered**: A markdown AST parse — rejected: neither side has a markdown parser in scope for this, and the existing line-based approach is what the current denominator is computed from. Matching it matters more than being theoretically better.

## Decision: an unmarked requirement is always loaded, and that is the safety property

**Decision**: A requirement with no marker is contributed by every load, regardless of what changed.

**Rationale**: This is what makes partial adoption safe and it is worth stating as a decision rather than an implementation detail. A marker can only ever *narrow* a load. If markers are absent, wrong, or too narrow, the failure mode is reading more than necessary — never reading less than the code needs. The reverse rule (unmarked means never loaded) would make a half-adopted spec silently starve a run of context, which is a correctness bug disguised as an optimization.

**Alternatives considered**: Treat unmarked as "loaded only when nothing matched" — rejected: it makes the load depend on other requirements' markers, so adding a marker to one requirement silently changes whether an unrelated one is read.

## Decision: the outline reads the cards the renderer already builds

**Decision**: The outline is derived in the same pass that builds requirement cards in `livingComponents.ts`, from the headings that pass already walks.

**Rationale**: The spec forbids a second parse, and `preprocessLivingRequirements` already walks every `###` under `## Requirements` and knows each heading verbatim. Coverage is already keyed by that exact heading text through `setLivingCoverage`, so the outline gets coverage for free from the same store the badges use — guaranteeing the row and the card agree.

**Alternatives considered**: A separate outline component parsing the markdown again — rejected outright by the spec, and it would be the exact mechanism by which the outline and the badges could disagree.

## Decision: selective load changes the node bodies, and the parity gate is re-frozen deliberately

**Decision**: The load instruction changes in `nodes/specify/load-living-specs.md` and `nodes/plan/gather-context.md`; the golden command bodies are regenerated as an explicit task, not as a surprise.

**Rationale**: Those bodies are assembled from nodes and frozen by `check-shape-parity.py`, so any edit reds the gate until the captures are re-blessed. Treating that as a task rather than a failure is the repo's own convention.

**Alternatives considered**: Putting the selection logic entirely in the resolver so the node text never changes — attractive, and partly true: the resolver does the matching. But the node body is what tells the assistant to pass the changed files and read the returned slice, so it has to say so.
