---
id: pick-blocks
name: Pick the plan's blocks
kind: author
command: plan
reads: [plan-doc]
---
   **Add a block to `plan.md` only where the change needs one.** Skip this at `simple` size. Decide each row, then run the command with the names that apply, or `none`, and write what it prints into `plan.md`.

   | Block | Write it when |
   |---|---|
   | `calls` | the change crosses functions or files |
   | `code` | one line needs a note to be understood |
   | `states` | the change adds or alters a lifecycle |
   | `screens` | the change alters what a person sees |

   ```bash
   python3 .specify/extensions/companion/scripts/plan-blocks.py --feature-dir <feature_directory> <names>
   ```
