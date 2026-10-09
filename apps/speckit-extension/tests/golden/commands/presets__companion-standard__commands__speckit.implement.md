---
description: Execute the implementation plan by processing and executing all tasks defined in tasks.md
scripts:
  sh: scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
  ps: scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
strategy: wrap
---

<!-- speckit-companion:part concise -->
## The smallest thing that works

**Before building anything, stop at the first rung that holds:** does it need to exist at all; does this codebase already have it; does the standard library, the platform, or an installed dependency do it; can it be one line; only then, the minimum code that works. Fix the cause where every caller passes through, not the symptom one caller reported. Delete rather than add, boring rather than clever: no interface with one implementation, no factory for one product, no scaffolding for later. Lean governs what you build and write, not how the work is split: sending work to a worker where a step says to is not extra.

**Write it the way you would say it.** One idea per sentence. No em-dashes: a full stop, a comma or a colon says it. Say what happens, not what the system "shall be capable of". Never a section that exists to say "N/A": remove it instead.

**The same test governs what you write, and again once it is written.** A section nobody acts on is removed, not filled in. No requirement for what a type or a test already enforces. A third scenario has to cover a failure the first two miss. Then reread and cut: the sentence restating the one before it, the example longer than its rule, the clause defending a choice nobody challenged, the prose repeating a table. Each reads as thoroughness and is what makes a body too long to follow.

**Never simplify away** validation at a trust boundary, error handling that prevents data loss, security, accessibility, or anything the spec asks for. **A corner cut on purpose** carries `// simplified: <ceiling>, <what to do when it binds>` in the code and one `concerns` entry in this step's capture.
<!-- /speckit-companion:part concise -->

<!-- speckit-companion:part step-start -->
## Record this step's start: before anything else runs

A step's recorded window has to contain the work it claims. Stamping the start partway down the body leaves the extension hooks, and any node above the stamp, outside the window the step later reports. So this is the first instruction in the command, ahead of the hooks.

Let `<step>` be this command's phase and `<status>` its in-progress status: `specify`/`specifying`, `plan`/`planning`, `tasks`/`tasking`, `implement`/`implementing`.

**Which feature directory this step stamps against decides when it stamps.**

- **A step that mints its own feature directory**, meaning any fresh-spec entry point such as `specify` or `auto`, has nothing to stamp against yet. `.specify/feature.json` is this step's *output*: it still points at the **previous** spec, so stamping now would write this run's status onto finished work. Resolve the directory first, then stamp the instant it exists, before any other work in the step.
- **Every other step** reads the feature directory it was given, from the invocation or from `.specify/feature.json`, which by then points at this spec. Stamp immediately, before the extension hooks and before any node.

In both cases the call is the same:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step <step> --status <status> --kind start --by extension
```

Add `--at "<dispatch time>"` when the dispatcher printed one; otherwise the script stamps now. Two things keep this honest:

- **Run it, never hand-write it.** The script stamps the real clock and writes atomically. A hand-authored entry in `.spec-context.json` is what corrupts the file.
- **A second start is refused, not reconciled.** History is append-only, so if the extension already seeded this step's start, this call appends nothing and the earlier timestamp stands. Running it is always safe; skipping it loses the window.
<!-- /speckit-companion:part step-start -->

{CORE_TEMPLATE}

<!-- speckit-companion:part timing -->
## Timing: keep `.spec-context.json` honest

Record every boundary by **running the writer script**. Never edit `.spec-context.json` yourself; a hand-authored edit is what corrupts the file. The model is **finish-only**: one finish per task and per substep, its duration the gap back to the previous finish. Never a `start`+`complete` pair for either, which stamps a `0s` tick and measures nothing.

- **Close your own step**, as the last thing you do, after emitting any mandatory after-hook block:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <this step> --advance --by ai
  ```

  `--advance` appends the step's complete and flips `status` in one atomic write. It is idempotent and first-writer-wins, so it changes nothing when the after-hook already closed the step, and it is the only thing that closes the step when that hook was printed rather than dispatched. Run it every time, with two exceptions: **clarify** and **analyze** use `--finish`, which records a boundary without owning a status; **implement** runs neither, because its own final node writes `completed` and closes the step in the same write.

- **One finish per substep, the moment it ends.** Plan records `research` and `design`, tasks records `generate`, implement records `living-review` and `living-fold` when living specs are on. Never two in one batch, never a separate start: a finish measures the gap back to the previous boundary, so several stamped together at the close of a step read as `0s` each and record nothing.

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <step> --substep <name> --finish --by ai
  ```

- **Closing a task is that task's last action, not a bookkeeping pass you batch later.** Feature dir from `.specify/feature.json`:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --close-task <TaskID> --by ai --did "<one line>" --files "<files>"
  ```

  One call appends the finish with its own real clock, folds it into the panel, and flips that task's box in `tasks.md`. Never hand-edit that box or hand-author per-task JSON, and never write a per-task start. Re-closing is safe. **Batching is a defect the doctor catches**: it names any cluster of finishes stamped seconds apart, because those timestamps record when the batch was written, and history is append-only so it cannot be repaired afterwards. Trust the per-task summaries and their order; the timestamps are best-effort.

  **A fanned-out worker appends only**, because folding is a read-modify-write and two folders contend:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
  ```

  The MAIN agent folds each returned result with `--materialize`, one at a time, and once more at a wave join as a backstop.

- **Never write the next step's start.** The next command owns it. Writing it here renders a phantom "Generating <next>…".
<!-- /speckit-companion:part timing -->
