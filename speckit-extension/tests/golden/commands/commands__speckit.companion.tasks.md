---
description: "Companion tasks — user-story phased task list"
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

Produce a dependency-ordered task list organized **by user story** into phases (Setup → Foundational → one phase per story → Polish), so each story is an independently testable increment.
**Right-size this task list to the change.** Before drafting, read the recorded size from the spec's context — `.spec-context.json` → the `size` field (treat a missing value as `normal`). **Apply the budget to the step below, omitting anything it says to skip.**

- **`normal`** — produce the full phased task list exactly as the step describes. No trimming.
- **`oversized`** — produce the same full phased task list, and open it with a short **Scale note**: one or two sentences naming how many files and areas the change spans and what a reader should watch for. Size never trims here — an oversized change gets *more* signposting, not less.
- **`simple`** — a small change needs the tasks, not the ceremony around them. Produce a **lean** list:
  - **No baseline/setup task** for "run install/build to confirm green" — that is not real work.
  - Group by phase still (Setup if any → Foundational → the work → Polish), but **drop the per-story `Goal` / `Independent Test` / `Checkpoint` blocks** — a small change ships in one pass, not as separate demoable slices.
  - End with a **one-line** dependency note (what blocks what), **not** the full "Dependencies & Execution Order" + "Parallel Opportunities" prose.
  - Keep every task line precise (the `T###`, the exact file, the requirement) — trim the framing, never the tasks themselves.

This budget governs the step that follows. Where it would produce something the budget skips, omit it.
1. Read `.specify/feature.json` for the feature directory. The step's start is already stamped, above. Load `plan.md` and `spec.md` (required), plus `data-model.md`, `contracts/`, and `research.md` if present.

2. Create `<feature_directory>/tasks.md` organized **by user story**, so each story can be implemented, tested, and delivered as an independent increment. Use the line format `- [ ] **T###** [P?] [US#] Description · exact/file/path`:
   - `[P]` marks a task that is **independent** of the others in its wave — a different file with no incomplete dependency, so it can be built in any order (or in parallel on a host that wants to).
   - `[US#]` maps the task to a user story from the spec for traceability.

3. **Make the dependency structure explicit — group each phase's work into ordered waves, never a flat list.** A reader (human or agent) must see at a glance *which tasks are independent* and *where work has to wait*:
   - A **wave** is a set of tasks that touch different files and don't depend on each other, so they can be built in any order. Head it with a line like `**Wave 1 — independent (different files):**` and tag each of its tasks `[P]`.
   - Between waves, write an explicit join line — `**⟶ Wait for Wave 1 to finish, then:**` — before the tasks that depend on the previous wave. Those form the next wave (or run singly).
   - A wave of one is fine — a single task, no `[P]`. Same-file or dependent tasks are **never** in the same wave. Group every genuinely-independent task of the phase into one wave, so the dependency boundaries are honest.
   This wave layout is the execution map implement reads — it replaces the old scattered-`[P]` list. (Implement builds the tasks inline by default; the wave grouping documents the dependency order and tells a subagent-capable host which tasks *could* run together.)

4. Group the waves into phases, in this order:
   - **Phase 1: Setup** — project structure, config, and tooling prerequisites shared by everything.
   - **Phase 2: Foundational** — core infrastructure that BLOCKS all stories (shared models/types, providers, routing, persistence). No user-story work begins until this phase is done.
   - **Phase 3 onward: one phase per user story**, in priority order (P1 first = the MVP slice). For each story: an optional `### Tests` block (include only when the spec or constitution asks for tests — write them to fail first), then `### Implementation` laid out as waves (foundation/models first, then the independent components/UI wave, then the integration wave), then a **Checkpoint** line stating the story is now independently functional and testable.
   - **Final phase: Polish** — cross-cutting cleanup, docs, and validation against the spec's Success Criteria. **Single-owner validation:** by default this phase generates a task that runs the test/lint suites to validate against the Success Criteria. Skip that suite-run task ONLY when the project has explicitly handed validation to a post-implement hook — read `.specify/companion.yml` and look under `commands.implement.hooks.after.implement-exec` for a hook entry that carries the marker `owns: validation` (the project's explicit statement that this hook runs the Success-Criteria suites). Presence of a hook is NOT the signal — review, PR, and deploy hooks share this same anchor; only the `owns: validation` marker is. When a marked hook is present, emit a deferring task (`- [ ] **T###** Validate against Success Criteria — owned by the project's post-implement validation hook (no separate suite run)`) instead of a second run. With no marked hook (the common case, or `companion.yml` absent/malformed), Polish owns validation and generates the suite-run task as usual. Either way the suites run in exactly one place.

5. End with a **Dependencies & Execution Order** section: the phase dependencies (Setup → Foundational → stories → Polish) and a one-line restatement of each phase's waves (which wave blocks which). Each task names the concrete file it creates or edits.

6. **Capture the requirement→task map** so "which tasks cover FR-X?" is answerable from the context file (best-effort; skip silently if `python3` is unavailable — the implement step fills each requirement's tests later). Carry each requirement's one-line text as its `title` so the requirement is captured as readable content, not just an id:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --batch '{
     "coverage": [
       {"req": "FR-001", "title": "<the requirement one-line text>", "tasks": "T001,T004"},
       {"req": "FR-002", "title": "<…>", "tasks": "T005"}
     ],
     "step_summary": {"summary": "<task count + phase shape in one line>"}
   }'
   ```

   **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`.

**Output**: `<feature_directory>/tasks.md` organized by user story into dependency-ordered phases, each phase laid out as explicit waves with join points.
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

**The next step is `implement`** — dispatch `/speckit.companion.implement <feature_dir>`.

<!-- speckit-companion:part self-advance -->
## Self-advance — hand off to the next step

This is one step in the Companion pipeline. How the run continues depends on the environment you are running in; do not invoke a separate headless/deterministic run command for the everyday flow.

- **On an agentic CLI that keeps acting after a step finishes:** once this step's work is complete, dispatch the next step's `/speckit.companion.*` command and keep going. The order is fixed and this step's own handoff names its successor — there is no file to open to find out.
- **Pause at every review gate, and name the command that continues.** Where the workflow marks a `gate` (e.g. review-spec, review-plan), stop and wait for approval rather than running past it. When you stop, **name the next command literally** — "approve and run `/speckit.companion.plan <feature_dir>`", not "approve to move to plan". A gate message that makes the reader work out what comes next is the workflow failing to hand off, not restraint. Only continue once the gate is approved.
- **Nothing follows implement.** Implement's own final node writes `completed` through `write-context.py --mark-complete`, so the spec is already finished when this step ends. Do not dispatch `/speckit.companion.mark-complete` afterwards: it is the manual recovery command and the workflow engine's terminal step, not a step a run adds for itself. There is exactly one writer of `completed`; never introduce a second.
- **Degrade gracefully on a one-shot environment.** If your environment runs one step and then stops, the handoff simply does not fire: finish this step, record its progress, and stop. The run stays valid and resumable, and the next step is triggered manually (by the developer or the companion panel). Completion likewise stays a manual action there.
<!-- /speckit-companion:part self-advance -->

**Pin the workflow identity in the same call that closes the step.** Record that this spec runs the **Companion** workflow, so the next dispatch is a Companion command and not a stock one. A spec that joined Companion after `specify` has never had this written, and the shared writer defaults `workflow` to `speckit` — so without it the footer advance silently dispatches the stock successor. `--set` writes a plain field and appends no history, so it rides alongside `--advance` rather than costing a call of its own:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step <this step> --advance --by ai --set workflow=companion
```

Idempotent, and a required deterministic write — skip only if `python3` is genuinely unavailable. This replaces the bare `--advance` the timing rules describe; run one or the other, never both.

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
