# Research: Living specs — trust the fold

## The checks live in two runtimes, held to one fixture set

**Decision**: Implement the checks twice — `living_validate.py` for the command line and the fold, `specShapeCheck.ts` for the editor — and pin both to one shared directory of example specs, with a guard that fails the build when an example is read by only one of them.

**Rationale**: The shipped extension is only what is in the package. A user's project may have the spec-kit scripts installed or may not, and an editor feature that silently does nothing on half the installs is worse than one that does not exist. Shelling out also costs a process on every save. The repository already solved this exact problem for the two requirement slicers, and the drift guard there works: it caught a real divergence during Wave 1.

**Alternatives considered**: Shell out to the script from the editor — rejected, it makes the feature conditional on an install the extension cannot assume, and puts a subprocess in the save path. Put the checks only in the script and let the editor go without — rejected, the shortened feedback loop is most of this wave's value. Compile the Python to WebAssembly or bundle an interpreter — rejected as absurdly disproportionate to six regular-expression checks.

## Severity is two values, and only error stops a fold

**Decision**: `error` and `warning`, nothing else. Only `error` refuses a fold.

**Rationale**: Severity exists here to answer exactly one question: does this stop the write? A third value would have to mean something, and nothing in the six findings needs a third meaning. The split follows the damage: a delta naming a heading the target does not have would write a section nobody asked for or silently drop a removal, which corrupts the record; a requirement with no scenario is merely untidy and folding it damages nothing.

**Alternatives considered**: A numeric scale — rejected, invented precision nobody would calibrate. Per-check configurability — rejected, it turns "is my record safe" into a project-by-project question and the answer stops being comparable.

## The fold imports the check rather than running it

**Decision**: `living_spec_fold.py` imports `living_validate` and calls it in-process.

**Rationale**: The refusal is a correctness gate, so it must not be defeatable by a missing interpreter, a path problem, or a subprocess that failed for an unrelated reason. In-process, a failure to run the check is a failure the fold can see and reason about. It is also the same file tree — the fold already imports `spec_deltas` and `capture` this way.

**Alternatives considered**: Run the command and parse its JSON — rejected, it makes a correctness gate depend on process spawning and output parsing, and both can fail in ways that look like "no findings".

## An unmatched file marker is a warning, not an error

**Decision**: A `touches` pattern matching nothing on disk reports at warning severity.

**Rationale**: A marker can legitimately describe a directory a change is about to create, or one deleted deliberately while the requirement still describes the behaviour. Marker matching only ever narrows a load, so an unmatched pattern costs a run nothing — it falls back to contributing the requirement anyway. Treating it as an error would refuse folds over a condition that is often correct.

**Alternatives considered**: Error severity — rejected for the reason above. Dropping the check — rejected, a marker that matched nothing for months is usually a rename nobody followed through, and that is worth saying.

## Duplicate headings are per capability, never across them

**Decision**: The duplicate check compares headings within one capability's spec only.

**Rationale**: The heading is the join key for fold-back, coverage identifiers and the viewer's requirement cards, and every one of those is scoped to a single capability. Two capabilities describing "Errors are reported once" are two different requirements about two different areas, and saying otherwise would report a finding on almost every well-formed repository.

**Alternatives considered**: Repository-wide uniqueness — rejected, it is not what any consumer requires and it would produce noise proportional to how well the specs are written.

## Retirement is declared on the capability, in the registry

**Decision**: An optional `retire: true` on the capability's existing registry entry.

**Rationale**: Retiring a capability is a fact about that capability, so it belongs beside its patterns and its spec path, where a reviewer reading the registry entry sees it. It is one key, it is optional, and its absence is the current behaviour.

**Alternatives considered**: A marker inside the spec file — rejected, a fold that empties the file would take the marker with it, so the declaration would be gone the moment it mattered. A command-line flag on the fold — rejected, the fold runs unattended at completion and nobody would be there to pass it. A separate retirement file — rejected, a second place to look for one boolean.

## Findings carry a stable code

**Decision**: Each finding kind has a short stable code, and the code is part of the machine-readable output.

**Rationale**: A refusal message names the finding, and a person fixing it will want to search for what the code means. A stable code also lets a reader recognise the same finding across runs when the human sentence gets reworded, which is what makes the output usable in a script or a hook.

**Alternatives considered**: Match on the human sentence — rejected, it makes the wording load-bearing and unrewordable.
