---
id: orchestrate
kind: control
command: auto
reads: []
---

## Run the pipeline — every step, no pauses

Run the full Companion pipeline by **invoking each per-step command for real**, in order, without pausing for approval between them. You are the **conductor, not the author**: each step's behavior is defined by its own command body — do **not** write the spec, plan, design docs, task list, or code yourself from scratch. Invoke the command and let *it* do the step the way it's defined.

**This is the rule that makes auto faithful.** A standalone `/speckit.companion.tasks` run produces a size-classified spec, a slim plan with its design artifacts (`research.md`, `data-model.md`, `contracts/`), and a wave-structured task list — because those behaviors live *inside* each command. If you improvise the artifacts here instead of invoking the commands, auto silently drops all of that (no sizing, no design docs, a flat task list) and stops matching the manual flow. So: **invoke, don't reproduce.**

1. **Mark the run unattended.** This run has no human watching it. Set `unattended: true` so project checkpoint hooks record-and-continue instead of asking (see the unattended convention below) — write it into `.spec-context.json`:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set unattended=true
   ```
   Carry `unattended` forward to every step you dispatch.

2. **Invoke each command in order — actually run it, don't re-enact it.** Use your command/skill invocation tool (the same `/speckit.companion.*` command a person would type) for each step, waiting for its full work to finish before starting the next. Each command does its *own* size-classification, artifact generation, and capture — your job is only to call them in sequence and not stop:
   - `/speckit.companion.specify <feature description>` — runs the real specify command: classifies size, writes the full spec, persists the size.
   - `/speckit.companion.plan` — runs the real plan command: the slim plan **plus** `research.md`, `data-model.md`, and `contracts/` (right-sized by the recorded size).
   - `/speckit.companion.tasks` — runs the real tasks command: the wave-structured, dependency-ordered task list.
   - `/speckit.companion.implement` — runs the real implement command: executes the tasks and journals each finish.
   - `/speckit.companion.mark-complete` — the terminal step that writes `status: completed`.
   If your host has no way to invoke another command mid-session, fall back to following each command's body faithfully (read it and do exactly what it specifies — same artifacts, same sizing, same structure); never substitute a quicker improvised version.

3. **Do not pause at review gates.** Where the manual flow would stop and wait for a person at a `gate` (review-spec, review-plan, …), auto instead **records the checkpoint and continues**. Background hooks still fire and review/PR hooks still run — only the human pause is skipped. This is the one behavioral difference from a manual run.

4. **End at `completed`.** mark-complete writes `completed` only through `write-context.py --mark-complete`, which refuses unless the spec is already `implemented`. Run it last so the spec lands at the end of the Active → Completed lifecycle. Never introduce a second completed-writer.

5. **Degrade gracefully on a one-shot environment.** Auto needs an agent that keeps acting after each step finishes. If your environment runs one command and then stops (a plain / one-shot terminal), you cannot chain the steps yourself: run the first step, record its progress, and stop. The run stays valid and resumable — the remaining steps are triggered the normal one-step-at-a-time way (by the developer or the companion panel). No error; auto simply behaves like the manual flow there.
