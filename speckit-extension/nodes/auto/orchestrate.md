---
id: orchestrate
kind: control
command: auto
reads: []
---

## Run the pipeline — every step, no pauses

Drive the full Companion pipeline yourself. Dispatch the per-step `/speckit.companion.*` commands in order and carry each step's output into the next; do **not** stop for approval between steps. The per-step commands are unchanged — you are the driver, they are the work.

1. **Mark the run unattended.** This run has no human watching it. Set `unattended: true` so project checkpoint hooks record-and-continue instead of asking (see the unattended convention below) — write it into `.spec-context.json`:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set unattended=true
   ```
   Carry `unattended` forward to every step you dispatch.

2. **Walk the steps in order**, dispatching each command and continuing as soon as its work is done:
   - `/speckit.companion.specify <feature description>` — the spec (the START is already recorded above).
   - `/speckit.companion.plan` — the plan.
   - `/speckit.companion.tasks` — the task list.
   - `/speckit.companion.implement` — execute the tasks.
   - `/speckit.companion.mark-complete` — the terminal step that writes `status: completed`.

3. **Do not pause at review gates.** Where the manual flow would stop and wait for a person at a `gate` (review-spec, review-plan, …), auto instead **records the checkpoint and continues**. Background hooks still fire and review/PR hooks still run — only the human pause is skipped. This is the one behavioral difference from a manual run.

4. **End at `completed`.** mark-complete writes `completed` only through `write-context.py --mark-complete`, which refuses unless the spec is already `implemented`. Run it last so the spec lands at the end of the Active → Completed lifecycle. Never introduce a second completed-writer.

5. **Degrade gracefully on a one-shot environment.** Auto needs an agent that keeps acting after each step finishes. If your environment runs one command and then stops (a plain / one-shot terminal), you cannot chain the steps yourself: run the first step, record its progress, and stop. The run stays valid and resumable — the remaining steps are triggered the normal one-step-at-a-time way (by the developer or the companion panel). No error; auto simply behaves like the manual flow there.
