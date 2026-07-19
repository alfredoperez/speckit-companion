# Research — 403 fold idempotency and script split

## Decision 1 — Fix the fold by resolving ADDED through the rename map, not by post-normalizing

**Decision**: Make the ADDED verb rename-aware. Before ADDED runs, build the delta set's rename map (source heading to target heading, chain-resolved). For each ADDED unit, resolve its heading through that map to its final name, rewrite the section's heading line to that final name, and check for existence under the final name. Additionally, when the same final heading also appears under MODIFIED, use the MODIFIED body — the edit is the later, more specific statement of the requirement's content.

**Rationale**: The break is precisely that ADDED's existence check runs against pre-rename state. Once ADDED asks "does my heading, after every rename in this delta set, already exist?" the add-and-rename case collapses to a single append on the first fold and a skip on every fold after. The add-and-edit case is fixed by giving the two verbs one agreed body instead of two that alternate. Both are local changes inside one function; neither changes the behavior of a delta set whose verbs target different headings.

**Alternatives considered**:
- *Normalize the document once after all verbs apply* (deduplicate headings, collapse blank lines). Rejected: it would paper over the duplication rather than stop it, and a deduplication pass has to pick a winner between two same-named sections — reintroducing the same ambiguity at a place with less information about intent. It also risks rewriting parts of a living spec no delta touched.
- *Reorder the verb pipeline so ADDED runs first.* Rejected: it fixes add-then-rename by accident and breaks nothing visibly, but it does not fix add-plus-edit (the bodies still alternate), and it silently changes the meaning of every existing delta set that relies on the current order.
- *Patch the newline handling around each splice* (the issue's original filed description). Rejected: measured — it changes nothing, because the divergence is a section count problem, not a whitespace problem.

## Decision 2 — The split needs a fifth module for the shared store, not four

**Decision**: Create five sibling modules, not the four the issue names: `spec_deltas.py`, `living_spec_fold.py`, `task_sync.py`, `capture.py`, plus `spec_context.py` holding the store primitives every one of them needs — reading and atomically writing the context file, resolving the feature directory, the history log accessors, the git helpers, and the canonical step and status vocabulary.

**Rationale**: The four named modules are not independent of each other. The fold module records what it synced, so it needs a context writer; the task-sync module reads and writes the history log; the capture module does nothing but read-modify-write the context file. If those primitives stay in `write-context.py`, every new module has to import back into the file that imports them, and Python does not survive that cycle cleanly — least of all for a module loaded by a hyphenated filename. Putting the shared store in its own module makes the dependency graph a clean one-way fan: `spec_context` at the bottom, `spec_deltas` beside it with no dependencies at all, then `capture` and `task_sync`, then `living_spec_fold`, then the command line on top. That is what makes each file readable in isolation, which is the whole point of the issue.

**Alternatives considered**:
- *Inject the primitives as arguments* into the fold and task-sync functions. Rejected: it turns a straightforward call into indirection purely to dodge an import, and every caller of those functions (including the eval scripts) would have to supply them.
- *Lazy imports inside the function bodies*, mirroring how the fold already loads the path resolver. Rejected: it hides a real dependency from every tool that reads imports — including the packaging gate, which derives what ships by scanning imports. A dependency the packing gate cannot see is exactly the failure that shipped a broken archive before.

## Decision 3 — `write-context.py` re-exports every moved name

**Decision**: After the move, `write-context.py` imports the moved names into its own namespace so anything that already reaches for them through it keeps working unchanged.

**Rationale**: Four things outside the script import it as a module and call its internals directly: the derive-from-files fallback, the status reader, the extension's own test suites, and the living-spec eval check. Between them they reach for the delta parser, the requirement-span finder, the delta applier, the task-marker parser, and most of the store core. The requirement that no caller needs editing is only satisfiable if the old names still resolve. Re-exporting also means the move is provably behavior-neutral: the same objects, reachable by the same paths.

**Alternatives considered**:
- *Update every importer to reach for the new modules directly.* Rejected: it breaks the stated constraint that nothing outside needs editing, and it converts a mechanical move into a change with a blast radius across the eval skills.

## Decision 4 — Capture flags become additive; lifecycle modes stay exclusive

**Decision**: Split the dispatch into two groups. The capture flags — the ones that add information to the context file without moving the spec through its lifecycle — all run, each printing its own confirmation line. The lifecycle modes — task sync, mark complete, finish, advance, materialize, per-task journal, and the default step update — keep the existing first-match-wins ladder.

**Rationale**: The reported data loss is entirely within the capture group: two additive writes where only one lands. Those are genuinely composable — each touches a different field. The lifecycle modes are not: they are alternative interpretations of the same invocation, and running several would be a new behavior nobody asked for and nothing tests. Keeping the ladder for those bounds the change to the bug. The default step update must stay suppressed when any capture flag ran, exactly as today, or a bare capture call would start writing lifecycle history it never wrote before.

**Alternatives considered**:
- *Make everything additive.* Rejected: unbounded behavior change to a command line that must not change, for no reported problem.
- *Make the conflict an error.* Rejected: the extension's writes are best-effort by design and must never fail the host command; turning a working call into a failure is worse than the bug.

## Decision 5 — Prove the command line is unchanged by differential comparison, not by inspection

**Decision**: Build a comparison harness that runs a matrix of invocations against the pre-split script and the post-split script in identical fresh directories, and compares the printed output, the exit code, and the resulting context file for each.

**Rationale**: "The interface did not change" is a claim about every path, and a reviewer cannot verify it by reading a diff that moves a thousand lines. A differential run over the flag matrix turns it into evidence. The pre-split script is available from git for the duration of the change, so the comparison costs almost nothing.

**Alternatives considered**:
- *Rely on the existing test suite.* Rejected: it is good coverage but it was written against the behavior it happens to exercise, not against the full flag surface; it would not catch a flag that quietly stopped being recognised.
