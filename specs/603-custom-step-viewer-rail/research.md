# Research: A step you add appears in the spec viewer

## Decision 1 — Read the step directory in TypeScript, not through `pipeline-graph.py`

**Decision**: `src/features/workflows/projectSteps.ts` reads `.specify/companion/nodes/*/` with `fs` directly.

**Rationale**: The pipeline builder already gets its structure from `pipeline-graph.py`, and the rule against a second source is real. But the builder reads it once, when a panel opens, and can afford a 30-second Python timeout. The rail resolves a pipeline every time a spec opens and every time the sidebar renders a row. Spawning `python3` on that path would put a process launch behind every tree refresh, and it would make the rail fail to draw on a machine without Python — which FR-007 forbids. What the viewer needs is three fields per step (`after:`, the frame's `description:`, a node's `writes:`), not the whole graph.

**Alternatives considered**: Shell out to `pipeline-graph.py` and reuse `steps[].inSequence` / `after` / `artifacts`. Rejected on cost and on the Python dependency. Cache the graph result across renders — rejected because it puts the process launch back on the first render of every window and still fails without Python.

## Decision 2 — Splice above `COMPANION_WORKFLOW`, never mutate it

**Decision**: `COMPANION_WORKFLOW` stays the exported five-step literal it is today. The splice happens in the shared resolver, producing a new array.

**Rationale**: `COMPANION_WORKFLOW` is read as a constant in several places — `buildWorkflowChoices` reads its name and description, `customWorkflowProgress` builds a signature from it, and the viewer tests assert its exact shape. A mutated export would make each of those workspace-dependent, and SC-003 asks for the existing viewer tests to pass unchanged. Splicing in the resolver keeps the shipped list as the thing every test and every pick surface still sees.

**Alternatives considered**: Rebuild `COMPANION_WORKFLOW` at activation from the workspace. Rejected — it turns a module constant into workspace state and breaks the multi-root case. Write the added step into `speckit.customWorkflows` so the existing machinery picks it up. Rejected by the spec itself (FR-002, SC-005), and it would lose the run history a user-defined workflow does not record.

## Decision 3 — No cache

**Decision**: Read the directory on each resolution.

**Rationale**: The common case is a project with no `.specify/companion/nodes/` at all, where the whole cost is one `readdir` that returns ENOENT. A project with an added step pays one `readdir` plus three small file reads. A cache would need invalidating on any edit to any file under the step directory, which means wiring a watcher and a disposal lifecycle to save an amount of work that has not been measured as a problem.

**Alternatives considered**: Cache per workspace root, invalidated by the existing `**/.specify/**/*` watcher. Held in reserve: if the sidebar becomes slow in a workspace with many specs, that watcher already exists and the cache is a small addition. Cache keyed on the directory's mtime — rejected, a nested `_order.yml` edit does not change the parent's mtime, so placement changes would go unseen.

## Decision 4 — A pipeline is built-in when its steps dispatch the Companion command family

**Decision**: `isBuiltinWorkflow` in `customWorkflowProgress.ts` additionally treats a pipeline whose every step command begins with `speckit.companion.` as built-in.

**Rationale**: That module switches a pipeline to file-presence progression when it does not recognise the step sequence, because a user-defined workflow records no history. A Companion pipeline with an added step no longer matches the literal signature, so without this it would silently start inferring completion from files on disk — precisely what FR-009 rules out. Matching on the command family is what actually distinguishes the two cases: a pipeline dispatching Companion commands is one that captures.

**Alternatives considered**: Compare the sequence with the project's added steps removed. Rejected — it makes the detector depend on the workspace read, which is the coupling this module was written to avoid. Add an explicit flag to `WorkflowConfig`. Rejected as a field that exists only to answer one question the commands already answer.

## Decision 5 — The lifecycle-step predicate comes from the resolved pipeline

**Decision**: Replace the two hardcoded sets — `LIFECYCLE_STEP_NAMES` in `messageHandlers.ts` and `LIFECYCLE_STEPS` in `specCommands.ts` — with one predicate that asks whether the step is in the spec's resolved pipeline and is not `untimed`.

**Rationale**: Those sets exist to stop a start entry being written for a step that records nothing — a user-workflow step, or the terminal `mark-complete`. An added Companion step records everything a shipped one does, so a name-based set answers the wrong question and would leave the run with a completion that never began. The pipeline is already resolved at both call sites.

**Alternatives considered**: Add each project step name to both sets at read time. Rejected — two sets to keep in step is the shape of the bug being fixed. Widen the sets to accept any name — rejected, it would start writing starts for user-workflow steps that record nothing.

## Open point resolved from the spec

The spec asked which of two paths to take (a settings workflow entry, or nothing) and settled on neither: the step directory is the single declaration. Nothing in the codebase contradicts that — `known_steps()` on the Python side already reads the same directory as its vocabulary, so the two halves end up reading one source rather than two.
