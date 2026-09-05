## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI). The model is **finish-only**: each task and each substep records a *single* finish event, and its duration is the gap to the previous finish (or the step's start). Never a `start`+`complete` pair for a task or substep — a pair stamped at one instant is what produces `0s` ticks and bursts.

- **Never hand-edit `.spec-context.json`.** Record every finish by **running the writer script**, never by editing the JSON file yourself — a hand-authored edit is what corrupts the file (a duplicated `status` key). The script stamps the real clock, writes atomically, and is idempotent. The commands below are the only way you touch timing.
- **Always close your own step — the after-hook is a preference, not a guarantee.** The last thing you do in a step, *after* emitting any mandatory after-hook block, is close it yourself:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <this step> --advance --by ai
  ```

  `--advance` appends the step-level complete **and** flips `status` to that step's canonical completed value, in one atomic write. It is **idempotent and first-writer-wins**: when the after-hook did dispatch, its extension-stamped close already landed and this call is a no-op that changes nothing. When the hook did *not* dispatch, this is the only thing that closes the step.

  Run it every time. `EXECUTE_COMMAND` is an instruction addressed to a runtime, and in a terminal session that runtime is you — so *dispatching the hook* and *printing the words "Executing the hook"* produce identical output and nothing downstream can tell them apart. A run once sat at `status: tasking` for eight and a half minutes with the next step unreachable because the block was printed and not run, and that stall is now permanently part of that step's recorded duration. Losing `by: extension` on the completion attribution costs nothing; losing the completion costs the run.

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
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai --did "<one-line summary of what this task did>" --files "<comma,separated,files,touched>" --append
  ```

  `--append` writes **one line** to `.spec-context.events.jsonl` and does **not** read or rewrite the shared `.spec-context.json`, so it never hits the "read the file first" retry and **parallel workers can each append their own finish at the same time without contending** — the line carries its own real timestamp (`date -u` is stamped by the script). The `--did`/`--files` flags ride along so the Activity panel's Tasks card is populated from the script. **Do NOT hand-edit the `- [ ]` checkbox in `tasks.md`** — the script owns it: materialize flips it to `- [x]` from your appended finish, so a fanned-out subagent only appends and never touches the shared `tasks.md`. Do NOT hand-author per-task JSON and do NOT write a per-task `start`.

  Then **fold the appended lines into `.spec-context.json` — per task, the moment each finish lands.** The fold is the second half of the task's closing action, run by the **MAIN agent only**, in the foreground, one task at a time — for your own task right after its append, and for a fanned-out worker's task the moment its result returns:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --materialize
  ```

  `--materialize` is the one read-modify-write: it folds the finishes into the panel **and checks off the matching `tasks.md` boxes** for every journaled task, idempotently (re-folding never double-counts). The panel only sees folded finishes — the append log is not watched — so folding per task is what makes progress advance task by task instead of jumping in end-of-wave bursts. Workers never run `--materialize` (that would put two writers on the shared file); they only append, and the MAIN agent serializes every fold. Run it once more at each wave join as a backstop, and the end-of-step hook materializes anything left and fills any task you didn't journal. What's trustworthy here is the **per-task summary** (`did`/`files`) and the order tasks completed, plus the **step-level** start→complete span, which the scripts stamp exactly. The per-task *timestamps* are best-effort — they reflect when each finish was recorded, not a precisely measured duration; that's fine, the summaries are the point.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
