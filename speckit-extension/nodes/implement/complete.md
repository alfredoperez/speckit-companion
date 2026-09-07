---
id: complete
name: Mark the spec complete
kind: control
command: implement
reads: []
---
8. **Mark the spec complete.** Once every task in `tasks.md` is checked off and the work validates, finish the lifecycle so the spec lands at `completed` instead of stopping at `implemented`.

   **"Validates" means the project's own checks ran and passed.** A spec MUST NOT be marked complete over a failing suite the run introduced — fix it, or leave the spec at `implemented` and say why. Completing on red is how a run that looks finished ships broken code, and the completed status is the one signal a reader trusts without opening anything. Where the checks genuinely could not be run, record that as a concern before completing, so the state says "finished, unverified" rather than implying "finished, verified". Run from the repository root (the feature directory resolves on its own):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai --set workflow=companion
   ```
   The `--set` pins which workflow finished the spec in the same write, so a mid-run join keeps Companion dispatch. This is the only sanctioned writer of `completed`: it closes the implement step and promotes an `implemented` spec — or an `implementing` one whose tasks are all checked — straight to `completed`, keeping `currentStep` at `implement`. Best-effort and idempotent: if `python3` is unavailable, warn and skip without failing the host command; a spec already `completed` is left untouched. When the spec-kit workflow engine drives the run, its terminal `mark-complete` step calls the same path, so running it here too is harmless.

   - **Account for every loaded capability first — a delta or an explicit skip, never silence.** Living specs stay current only if completion writes the change back, so before folding, read `livingSpecs.loaded` in this feature's `.spec-context.json`. An absent key or an empty list means nothing was loaded and there is nothing to account for; skip to the fold. Go through **every** name in that list; each gets exactly one of two outcomes. For a loaded capability whose *behavior* this feature actually changed, append a delta block to this feature's `spec.md` capturing the real new or changed requirement, and mark it with that capability's name so the fold routes it to the right spec:
     ```markdown
     ## ADDED Requirements
     <!-- capability: <name> -->

     ### <the new capability requirement, as a testable statement>

     #### Scenario: <name>
     - **WHEN** <trigger>
     - **THEN** <observable outcome>
     ```
     Pick the verb by whether the requirement heading already exists in the capability's living spec (`capabilities/<name>/spec.md`): a requirement that is **not already there** goes under `## ADDED Requirements`, even if it revises the same behavior area. Reserve `## MODIFIED Requirements` for changing the body of a requirement whose heading is already in the living spec — the heading must match an existing one for the edit to replace it in place. **Read the existing headings before choosing:** a new heading that says what an existing one says in other words is that requirement, changed, and belongs under MODIFIED with the existing heading — an ADDED near-duplicate is how a spec grows two requirements for one behaviour, and the validator warns on it. Any `// simplified:` ceiling you left in this feature's code goes under a `## Known limits` heading in the same block, one line each, so the spec records what was deliberately not built. Use `## REMOVED Requirements` when you deleted one, `## RENAMED Requirements` (`### Old heading -> New heading`) for a rename. Write one block per changed capability, each with its own `<!-- capability: <name> -->` marker — several marked blocks fan out, each capability spec receiving only its own requirements. Never invent requirements to pad the list, and add a third scenario to an existing requirement only when it covers a failure the first two miss — say which, in the scenario name. The write lands in this feature's PR diff, so it is reviewed there.

     For a loaded capability whose behavior this feature did **not** change — one you merely read for context — do not stay silent: record an explicit skip so "correctly nothing" is distinguishable from "silently nothing." One call per untouched capability:
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --living-spec-skip "<name>: <one-line reason it wasn't changed>"
     ```
     By the end, every name in `livingSpecs.loaded` is accounted for — a delta block or a recorded skip. A capability that is neither is a hole the fold will flag loudly.

   - **Fold living-spec deltas (opt-in, best-effort).** After the completion write, fold the deltas you just authored into the durable living spec — OpenSpec's "archive" step:
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --fold-living-spec --by ai
     ```
     It parses the feature spec for `## ADDED / MODIFIED / REMOVED / RENAMED Requirements` blocks and applies each to the resolved `capabilities/<name>/spec.md` — the changed-files-matched capability for unmarked blocks, and every `<!-- capability: <name> -->`-marked capability for the rest. Opt-in (only acts when `livingSpecs.enabled: true`), a clean no-op when there is no delta block, idempotent on re-run, and records the synced names onto `livingSpecs.synced`. Never fails the host command.
