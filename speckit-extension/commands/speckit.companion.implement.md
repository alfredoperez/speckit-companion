---
description: "Companion implement — execute tasks.md in dependency order, then mark complete"
---

## User Input

```text
$ARGUMENTS
```

<!-- speckit-companion:part step-start -->
## Record this step's start — before anything else runs

A step's recorded window has to contain the work it claims. Stamping the start partway down the body means the extension hooks, and any node above the stamp, ran outside the window the step later reports — on one measured run half the elapsed clock belonged to no step at all. So this is the first instruction in the command, ahead of the hooks.

Let `<step>` be this command's phase and `<status>` its in-progress status: `specify`/`specifying`, `plan`/`planning`, `tasks`/`tasking`, `implement`/`implementing`.

**Which feature directory this step stamps against decides when it stamps.**

- **A step that mints its own feature directory** — any fresh-spec entry point, `specify` and `auto` among them — has nothing to stamp against yet. `.specify/feature.json` is this step's *output*: it still points at the **previous** spec, so stamping now would write this run's status onto finished work. Resolve the directory first, then stamp the instant it exists and before any other work in the step.
- **Every other step** reads the feature directory it was given — from the invocation, or from `.specify/feature.json`, which by then points at this spec. Stamp immediately, before the extension hooks and before any node.

In both cases the call is the same:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step <step> --status <status> --kind start --by extension
```

Two things keep this honest:

- **Run it, never hand-write it.** The script stamps the real clock and writes atomically. A hand-authored entry in `.spec-context.json` is what corrupts the file.
- **A second start is refused, not reconciled.** History is append-only, so if the extension already seeded this step's start, this call appends nothing and the earlier timestamp stands. Running it is always safe; skipping it is what loses the window.
<!-- /speckit-companion:part step-start -->

<!-- speckit-companion:part speckit-hooks -->
## Pre-Execution Checks — stock spec-kit extension hooks

Companion runs **on top of** stock spec-kit, so a project's installed spec-kit **extensions** (git, and any others registered in `.specify/extensions.yml`) must still fire on a Companion run exactly as they do on a stock `/speckit.*` run. This is separate from Companion's own node-hooks (`.specify/companion.yml`): both fire. Like the rest of the pipeline, checking these hooks must **never fail the host command** — if anything is missing or malformed, skip silently and continue.

Let `<step>` be this command's phase: `specify`, `plan`, `tasks`, or `implement`.

**Before-hooks — run these *now*, before any of the work below.**
- Check whether `.specify/extensions.yml` exists in the project root. If it does not, skip silently — there are no hooks.
- If it exists, read it and look for entries under `hooks.before_<step>`. If the YAML cannot be parsed, skip hook checking silently and continue normally.
- Filter out hooks where `enabled` is explicitly `false` (no `enabled` field means enabled), **and hooks whose `extension` is `companion`** — those exist so a stock `/speckit.*` run still records its lifecycle, and this command records its own in its own body, so dispatching them here is a turn that rewrites what this step just wrote. Every other extension's hooks fire as normal.
- Do **not** interpret or evaluate a hook's `condition` expression yourself: a hook with no `condition` (or a null/empty one) is executable; a hook with a non-empty `condition` is left to the HookExecutor — skip it here.
- For each executable hook, emit one block based on its `optional` flag:
  - **Optional** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
- If no before-hooks are registered, skip silently.

**After-hooks — run these once this command's work is fully reported, before handing off.**
- Re-check `.specify/extensions.yml`; if absent or unparseable, skip silently. Look under `hooks.after_<step>`, applying the same `enabled` / `condition` filtering as above.
- For each executable hook, emit one block:
  - **Optional** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
- If no after-hooks are registered, skip silently.

For `specify`, branch creation is normally one of these `before_specify` hooks (the git extension); spec directory and file creation are always handled by the command body itself.
<!-- /speckit-companion:part speckit-hooks -->

## Outline

Execute `tasks.md` phase by phase in dependency order. Each phase is laid out as ordered **waves** split by `⟶ Wait …` join lines — a dependency map where tasks within a wave are independent and a `⟶ Wait` marks where the next tasks depend on what came before. Build each task inline, in turn, stopping at each `⟶ Wait` line until the wave above is done. (A host with subagents *may* parallelize a wave whose tasks are each heavy enough to be worth a separate worker, but inline is the default and usually faster for ordinary edits.) Each task's finish is logged as it completes; then mark the spec complete.
<!-- speckit-companion:phase execute -->
<!-- speckit-companion:node implement-exec -->
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md` (and `data-model.md` / `contracts/` if present). The step's start is already stamped, above.

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. `tasks.md` lays each phase out as ordered **waves** separated by `**⟶ Wait …**` join lines. The waves are a **dependency map**: tasks inside one wave are independent of each other (any order is safe), and a `⟶ Wait` line marks where the next tasks depend on everything above it. **Execute wave by wave, in order, and stop at each `⟶ Wait` line until the wave above is done** before starting the next. Halt on a failed task and report the cause.

3. **Build a wave's tasks yourself, in turn — inline is the default.** Implement each task in the wave directly (write its file), in any order within the wave since they're independent. Closing a task is **one call, the moment its work is complete** — not at the end of the wave:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --close-task <TaskID> --by ai --did "<one line>" --files "<files>"
   ```
   `--close-task` appends the finish and folds it in one go: the panel updates and the task's `tasks.md` box is checked (never hand-edit the checkbox). The append carries its own real clock, so per-task timing is unchanged. This is the main agent closing its own task, which is why the two halves can be one call.
   - *A fanned-out worker still closes in two halves.* If your host has a subagent/`Task` tool **and** a wave's tasks are each substantial enough that a separate worker would pay for its own startup, you may dispatch one subagent per task instead. Each makes only its task's edits and **appends its own finish and nothing more** — `--task <TaskID> --kind complete --by ai --did … --files … --append`. Workers never fold: two writers on the shared file is the race the append log exists to prevent. As each result returns, you run `--materialize` yourself. For the common case (small files, quick edits) the overhead does **not** pay off, so inline is both the default and usually the faster choice. Either way the result is identical.

4. **After each wave, reconcile, then cross the join line.** Type-check/build the wave's files together and fix any seam drift, then run `--materialize` once more as a backstop — it is idempotent, so re-folding never double-counts, and it catches any finish whose fold was missed. `tasks.md` is owned only through `--materialize` (the script flips the boxes), so it never diverges from the journal. Now move past the `⟶ Wait` line to the next wave.

5. **Run the project's own checks before you call this done.** Validating against the spec's **Functional Requirements** and **Success Criteria** by reading is not validation — a test you wrote and never executed is a guess about your own code. Run the suite and the type-check/build the project actually uses (read them from its `package.json` scripts, `Makefile`, or the repo's own instructions; do not invent a command).

   - **A test you authored that fails is your task, not a follow-up.** Fix it now. Shipping a red suite is a defect the run introduced, and it is the single most common way a finished-looking run is not finished.
   - **A pre-existing test your change invalidated is also yours.** Renaming what a component shows breaks the test asserting the old text; updating it is part of the change, not scope creep.
   - **A test file that does not compile counts as failing.** Check the suite actually ran, not merely that the command exited.
   - **If you genuinely cannot run them** — no test script exists, or the environment forbids it — say so explicitly in the summary and record it as a concern below. Do not describe a read-through as though it were a run.

   Then report a short summary of what was built and anything left undone.

6. **Capture what was verified and decided** — the audit trail a resume/handoff needs, recorded the moment validation ends (best-effort; JSON when you can, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --batch '{
     "verified":   [{"what": "<check>", "command": "<cmd>", "result": "<outcome>", "warnings": ["<seen-and-dismissed>"]}],
     "decisions":  [{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}],
     "concerns":   [{"note": "<friction/workaround/residual risk>", "step": "implement"}],
     "coverage":   [{"req": "FR-001", "tests": "<path.test.ts::case,other.test.ts>"}],
     "step_summary": {"summary": "<what shipped in one line>"},
     "last_action": "<final breadcrumb, e.g. all tasks done — 18/18 tests pass>"
   }'
   ```

   **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`. Include only the keys you actually have — an empty list is not the same as an absent one, and on a clean run `concerns` is genuinely absent.
   The `--verified` entries are where "did it actually run" is settled, so record the command you ran and its real outcome — `"result": "142/142 pass"` — never a restatement of intent. If a check could not be run, record that as a `--concern` naming what was skipped and why, and do **not** record a `--verified` for it: a verification entry for a check that never happened is worse than no entry, because every later reader trusts it.

   One `--verified` per real check (tests, build, manual pass — include warnings you saw and judged benign), one `--coverage-req … --tests …` per requirement a test covers, one `--decision` per genuine implementation choice. Record `--concern` only for real friction — on a clean run record none (the empty list is itself the signal). All additive and de-duped; re-runs never duplicate.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
<!-- /speckit-companion:node implement-exec -->
<!-- /speckit-companion:phase execute -->
<!-- speckit-companion:phase wrap-up -->
<!-- speckit-companion:node complete -->
7. **Mark the spec complete.** Once every task in `tasks.md` is checked off and the work validates, finish the lifecycle so the spec lands at `completed` instead of stopping at `implemented`.

   **"Validates" means the project's own checks ran and passed.** A spec MUST NOT be marked complete over a failing suite the run introduced — fix it, or leave the spec at `implemented` and say why. Completing on red is how a run that looks finished ships broken code, and the completed status is the one signal a reader trusts without opening anything. Where the checks genuinely could not be run, record that as a concern before completing, so the state says "finished, unverified" rather than implying "finished, verified". Run from the repository root (the feature directory resolves on its own):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai --set workflow=companion
   ```
   The `--set` pins which workflow finished the spec in the same write, so a mid-run join keeps Companion dispatch. This is the only sanctioned writer of `completed`: it closes the implement step and promotes an `implemented` spec — or an `implementing` one whose tasks are all checked — straight to `completed`, keeping `currentStep` at `implement`. Best-effort and idempotent: if `python3` is unavailable, warn and skip without failing the host command; a spec already `completed` is left untouched. When the spec-kit workflow engine drives the run, its terminal `mark-complete` step calls the same path, so running it here too is harmless.

   - **Account for every loaded capability first — a delta or an explicit skip, never silence.** Living specs stay current only if completion writes the change back, so before folding, read `livingSpecs.loaded` in this feature's `.spec-context.json`. Go through **every** name in that list; each gets exactly one of two outcomes. For a loaded capability whose *behavior* this feature actually changed, append a delta block to this feature's `spec.md` capturing the real new or changed requirement, and mark it with that capability's name so the fold routes it to the right spec:
     ```markdown
     ## ADDED Requirements
     <!-- capability: <name> -->

     ### <the new capability requirement, as a testable statement>

     #### Scenario: <name>
     - **WHEN** <trigger>
     - **THEN** <observable outcome>
     ```
     Pick the verb by whether the requirement heading already exists in the capability's living spec (`capabilities/<name>/spec.md`): a requirement that is **not already there** goes under `## ADDED Requirements`, even if it revises the same behavior area. Reserve `## MODIFIED Requirements` for changing the body of a requirement whose heading is already in the living spec — the heading must match an existing one for the edit to replace it in place. Use `## REMOVED Requirements` when you deleted one, `## RENAMED Requirements` (`### Old heading -> New heading`) for a rename. Write one block per changed capability, each with its own `<!-- capability: <name> -->` marker — several marked blocks fan out, each capability spec receiving only its own requirements. Never invent requirements to pad the list. The write lands in this feature's PR diff, so it is reviewed there.

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
<!-- /speckit-companion:node complete -->
<!-- speckit-companion:node handoff -->
<!-- speckit-companion:part timing -->
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
<!-- /speckit-companion:part timing -->

**Nothing follows.** This step's own final node wrote `completed`; the run is over.

<!-- speckit-companion:part self-advance -->
## Self-advance — hand off to the next step

This is one step in the Companion pipeline. How the run continues depends on the environment you are running in; do not invoke a separate headless/deterministic run command for the everyday flow.

- **On an agentic CLI that keeps acting after a step finishes:** once this step's work is complete, dispatch the next step's `/speckit.companion.*` command and keep going. The order is fixed and this step's own handoff names its successor — there is no file to open to find out.
- **Pause at every review gate, and name the command that continues.** Where the workflow marks a `gate` (e.g. review-spec, review-plan), stop and wait for approval rather than running past it. When you stop, **name the next command literally** — "approve and run `/speckit.companion.plan <feature_dir>`", not "approve to move to plan". A gate message that makes the reader work out what comes next is the workflow failing to hand off, not restraint. Only continue once the gate is approved.
- **Nothing follows implement.** Implement's own final node writes `completed` through `write-context.py --mark-complete`, so the spec is already finished when this step ends. Do not dispatch `/speckit.companion.mark-complete` afterwards: it is the manual recovery command and the workflow engine's terminal step, not a step a run adds for itself. There is exactly one writer of `completed`; never introduce a second.
- **Degrade gracefully on a one-shot environment.** If your environment runs one step and then stops, the handoff simply does not fire: finish this step, record its progress, and stop. The run stays valid and resumable, and the next step is triggered manually (by the developer or the companion panel). Completion likewise stays a manual action there.
<!-- /speckit-companion:part self-advance -->
<!-- /speckit-companion:node handoff -->
<!-- /speckit-companion:phase wrap-up -->

<!-- speckit-companion:part orchestrator -->
## Node hooks — run the project's `before`/`after` inserts

This command is assembled from ordered **nodes**. A project can attach its own work at the boundary *before* or *after* any node by declaring it in `.specify/companion.yml`. You are the runtime: read that file (if present) and run those hooks at the right moments. Like the rest of the pipeline, this must **never fail the host command** — degrade and continue.

**Find the hooks for this command.** Look up `commands.<this-command>.hooks` in `.specify/companion.yml`. It has two anchors, `before` and `after`, each keyed by a node id from this command's order. Run a node's `before` hooks immediately before that node's work, and its `after` hooks immediately after. When several hooks sit at one anchor, run them **top to bottom, in declared order**.

**Hook types:**

- `{ type: command, run: "<shell>" }` — run the shell command with your terminal/Bash tool, then continue. *If you have no terminal tool* (some chat-only providers), do not pretend to: report the command you would have run and continue.
- `{ type: prompt, text: "<instruction>" }` — treat the text as an inline instruction and act on it before moving on.
- `{ type: node, ref: <id> }` — read `.specify/companion/nodes/<id>.md` and carry out its body as if it were part of this command.

**Background hooks.** Any hook may add `background: true`. Kick it off and continue the pipeline immediately without waiting for it to finish — it must not hold the spec prisoner. Use it for slow, independent side-effects (a test run, a build, a notification): for a `command`, launch it detached (e.g. append `&` or use `nohup … &`); for a `node`/`prompt`, do its work without blocking the next step. Report its result whenever it lands, but never block on it. **Do not** mark a `background` hook on anything that writes `.spec-context.json` (the timing/capture calls): those are fast already and run a read-modify-write on the shared file, so two of them racing in the background can lose an update. Background is for side-effects, not bookkeeping.

**Failure handling (never abort the host command):**

- **No `.specify/companion.yml`** → there are no hooks; run the command exactly as written. Do not warn.
- **The file is malformed / unparseable** → ignore it, note one short warning, and run the shipped command unchanged.
- **A hook is anchored to a node that isn't in this run's order** (e.g. a recipe dropped it) → warn once and skip that anchor's hooks.
- **A `type: node` hook's `ref` file is missing** → this is a real misconfiguration: report it clearly and stop before doing damage, rather than silently skipping.

If a hook's own work fails (a `command` exits non-zero, a `node` can't complete), report it and — unless the failure clearly makes the rest unsafe — continue the pipeline. The host command's own output is never blocked by a hook.
<!-- /speckit-companion:part orchestrator -->
