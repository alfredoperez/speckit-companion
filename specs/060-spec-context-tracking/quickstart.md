# Quickstart: Spec-Context Tracking

## For workflow prompt authors

Every Companion skill prompt (`speckit-*`, `sdd*`) begins and ends with a standard block:

**Pre-step**

1. Read `.spec-context.json` (create from minimal template if missing).
2. Set `stepHistory.<step>.startedAt = now()`, `completedAt = null`.
3. Append a `transition` `{ step, substep: null, from: {step: prevStep, substep: null}, by: "extension", at: now() }`.
4. Set `currentStep = <step>` and `status = "<step>ing"` (e.g. `planning`).
5. Atomic-write the file (preserve unknown fields).

**Post-step**

1. Set `stepHistory.<step>.completedAt = now()`.
2. Append closing `transition`.
3. Advance `currentStep` to the next step OR set `status` to a terminal value if final.
4. Atomic-write.

For **substeps**, repeat the same pattern using `stepHistory.<step>.substeps[]` and `transition.substep`.

## For viewer code

- Never inspect file existence to compute step state. Read `.spec-context.json` only.
- Use `stateDerivation.deriveViewerState(ctx)` to get `{status, steps, pulse, highlights, footer}`.
- Re-render on file change events for `.spec-context.json` only.

## Manual verification (maps to acceptance tests)

1. **No false-positive plan**: Create a spec dir with a template `plan.md` only. Open viewer → Plan badge reads "Not started", no pulse on Plan.
2. **Tab switching**: On a spec mid-plan, switch Specify/Plan tabs → header reads "Planning" on both.
3. **Completed**: Mark `status: completed` → no step pulses anywhere.
4. **Fast-SDD**: Run Fast workflow → all `stepHistory` entries have `startedAt` and `completedAt`; `status` is terminal.
5. **Terminal-only backfill**: Open a SpecKit-CLI-only spec with no context file → minimal context written, no step marked completed.
6. **Footer tooltips**: Hover every footer button on every step → tooltip names scope ("whole spec" or "this step").
7. **SDD Auto visibility**: Auto button shown only on Specify tab while status is `draft`/`specifying`.

## Schema validation

`contracts/spec-context.schema.json` is the canonical JSON Schema. Tests validate the four sample fixtures (`054`, `055`, `056`, `058`) after migration helpers run.
