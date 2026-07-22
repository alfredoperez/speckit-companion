---
id: complete
kind: control
command: implement
reads: []
---
5. **Mark the spec complete.** Once every task in `tasks.md` is checked off and the work validates, finish the lifecycle so the spec lands at `completed` instead of stopping at `implemented`. Run from the repository root (the feature directory resolves on its own):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai
   ```
   This is the only sanctioned writer of `completed`: it closes the implement step and promotes an `implemented` spec — or an `implementing` one whose tasks are all checked — straight to `completed`, keeping `currentStep` at `implement`. Best-effort and idempotent: if `python3` is unavailable, warn and skip without failing the host command; a spec already `completed` is left untouched. When the spec-kit workflow engine drives the run, its terminal `mark-complete` step calls the same path, so running it here too is harmless.

   - **Author the fold-back deltas first (only for capabilities you changed).** Living specs stay current only if completion writes the change back, so before folding, read `livingSpecs.loaded` in this feature's `.spec-context.json`. For each loaded capability whose *behavior* this feature actually changed, append a delta block to this feature's `spec.md` capturing the real new or changed requirement, and mark it with that capability's name so the fold routes it to the right spec:
     ```markdown
     ## ADDED Requirements
     <!-- capability: <name> -->

     ### <the new capability requirement, as a testable statement>

     #### Scenario: <name>
     - **WHEN** <trigger>
     - **THEN** <observable outcome>
     ```
     Pick the verb by whether the requirement heading already exists in the capability's living spec (`capabilities/<name>/spec.md`): a requirement that is **not already there** goes under `## ADDED Requirements`, even if it revises the same behavior area. Reserve `## MODIFIED Requirements` for changing the body of a requirement whose heading is already in the living spec — the heading must match an existing one for the edit to replace it in place. Use `## REMOVED Requirements` when you deleted one, `## RENAMED Requirements` (`### Old heading -> New heading`) for a rename. Write one block per changed capability, each with its own `<!-- capability: <name> -->` marker — several marked blocks fan out, each capability spec receiving only its own requirements. Only write a block for a capability whose behavior genuinely changed; skip the ones you merely read, and never invent requirements to pad the list. The write lands in this feature's PR diff, so it is reviewed there.

   - **Fold living-spec deltas (opt-in, best-effort).** After the completion write, fold the deltas you just authored into the durable living spec — OpenSpec's "archive" step:
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --fold-living-spec --by ai
     ```
     It parses the feature spec for `## ADDED / MODIFIED / REMOVED / RENAMED Requirements` blocks and applies each to the resolved `capabilities/<name>/spec.md` — the changed-files-matched capability for unmarked blocks, and every `<!-- capability: <name> -->`-marked capability for the rest. Opt-in (only acts when `livingSpecs.enabled: true`), a clean no-op when there is no delta block, idempotent on re-run, and records the synced names onto `livingSpecs.synced`. Never fails the host command.
