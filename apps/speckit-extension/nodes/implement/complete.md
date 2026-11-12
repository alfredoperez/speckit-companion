---
id: complete
name: Close implement
kind: control
command: implement
reads: []
---
10. **Close implement at `implemented`.** Once every task in `tasks.md` is checked off and the work validates, close the step. Implement ends at `implemented`; the next step, `converge`, is what completes the spec when it finds nothing left to build.

   **"Validates" means the project's own checks ran and passed.** A spec MUST NOT be marked complete over a failing suite the run introduced: fix it, or leave the work open and say why. Where the checks genuinely could not be run, record that as a concern before closing, so the state reads "finished, unverified" instead of implying "finished, verified". Run from the repository root; the feature directory resolves on its own:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --advance --by ai --set workflow=companion
   ```
   The `--set` pins which workflow ran the spec in the same write, so a mid-run join keeps Companion dispatch. This closes the implement step and leaves the spec at `implemented`; it never writes `completed`. Best-effort and idempotent: if `python3` is unavailable, warn and skip without failing the host command.

   - **Living specs (only when this project keeps them).** If the spec's `.spec-context.json` lists any `livingSpecs.loaded`, read `.specify/extensions/companion/commands/reference/living-implement-close.md` and follow it now: account for every loaded capability, have the deltas reviewed, and fold them. An absent or empty list means skip this.
