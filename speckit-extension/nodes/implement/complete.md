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

   - **Fold living-spec deltas (opt-in, best-effort).** After the completion write, fold this feature spec's requirement deltas into the durable living spec — OpenSpec's "archive" step:
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --fold-living-spec --by ai
     ```
     It parses the feature spec for `## ADDED / MODIFIED / REMOVED / RENAMED Requirements` blocks and applies them to the resolved `capabilities/<name>/spec.md` (most-specific capability, unless a block carries a `<!-- capability: <name> -->` marker). Opt-in (only acts when `livingSpecs.enabled: true`), a clean no-op when there is no delta block, idempotent on re-run, and records the synced names onto `livingSpecs.synced`. Never fails the host command.
