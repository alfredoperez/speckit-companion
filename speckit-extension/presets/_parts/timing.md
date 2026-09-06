## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI). The model is **finish-only**: each task and each substep records a *single* finish event, and its duration is the gap to the previous finish (or the step's start). Never a `start`+`complete` pair for a task or substep — a pair stamped at one instant is what produces `0s` ticks and bursts.

- **Never hand-edit `.spec-context.json`.** Record every finish by **running the writer script**, never by editing the JSON file yourself — a hand-authored edit is what corrupts the file (a duplicated `status` key). The script stamps the real clock, writes atomically, and is idempotent. The commands below are the only way you touch timing.
- **Always close your own step — the after-hook is a preference, not a guarantee.** The last thing you do in a step, *after* emitting any mandatory after-hook block, is close it yourself:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <this step> --advance --by ai
  ```

  `--advance` appends the step-level complete **and** flips `status` to that step's canonical completed value, in one atomic write. It is **idempotent and first-writer-wins**: when the after-hook did dispatch, its extension-stamped close already landed and this call is a no-op that changes nothing. When the hook did *not* dispatch, this is the only thing that closes the step.

  Run it every time. `EXECUTE_COMMAND` is an instruction addressed to a runtime, and in a terminal session that runtime is you — so *dispatching the hook* and *printing the words "Executing the hook"* produce identical output and nothing downstream can tell them apart. A run once sat at `status: tasking` for eight and a half minutes with the next step unreachable because the block was printed and not run, and that stall is now permanently part of that step's recorded duration. Losing `by: extension` on the completion attribution costs nothing; losing the completion costs the run.

  **Implement is the exception: it does not run this call at all.** Its own final node already wrote `completed`, which closes the implement step in the same write, and the writer declines an advance on a completed spec — so the call is a round-trip that records nothing.

  For **clarify and analyze** use `--finish` instead of `--advance` — they record a boundary without owning a status:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <this step> --finish --by ai
  ```
- **Substeps — one finish each, via the script.** For each substep boundary (plan: `research`, `design`; tasks: `generate`), the moment that substep ends, run:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <step> --substep <name> --finish --by ai
  ```

  One call per substep, each stamped with its own real clock at the moment it finishes — never two substeps in one batch, never a separate `start`. The delta between consecutive finishes is each substep's duration.
- **Implement — finishing a task *is* logging it (finish-only).** Recording a task's finish is the **closing action of that task**, done the instant its work is complete and before you start the next one — not a bookkeeping pass you batch at the end of a phase. **A batch is a defect, and it is now caught:** the doctor clusters task finishes and names any group stamped inside a few seconds of each other, because those timestamps measure when you wrote the batch, not how long each task took. On one measured run 16 of 25 finishes landed under a tenth of a second apart, and implement's durations are permanently untrustworthy as a result — history is append-only, so this cannot be repaired afterwards. Implement records almost no substep boundaries by design; the per-task journal *is* its shape, which is why batching it erases the only fine-grained record the step has. The closing action is a single append (feature dir from `.specify/feature.json`):

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --close-task <TaskID> --by ai --did "<one-line summary of what this task did>" --files "<comma,separated,files,touched>"
  ```

  `--close-task` appends the finish **and** folds it in one call: the line lands in `.spec-context.events.jsonl` with its own real clock (`date -u` is stamped by the script), the panel's Tasks card is populated from `--did`/`--files`, and the task's `- [ ]` box in `tasks.md` is flipped to `- [x]`. **Do NOT hand-edit that checkbox** — the script owns it. Do NOT hand-author per-task JSON, and do NOT write a per-task `start`.

  Re-closing a task never double-counts, so a retry is safe.

  **A fanned-out worker closes in two halves instead.** Folding is a read-modify-write on the shared file, and two folders is the contention the append log exists to prevent — so a worker appends only:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
  ```

  and the MAIN agent folds each returned result with `--materialize`, one at a time. Run `--materialize` once more at a wave join as a backstop; the end-of-step hook folds anything left and fills any task you did not journal.

  What is trustworthy here is the **per-task summary** (`did`/`files`) and the order tasks completed, plus the **step-level** start→complete span, which the scripts stamp exactly. The per-task *timestamps* are best-effort: they record when each finish was written, not a measured duration. That is fine — the summaries are the point.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
