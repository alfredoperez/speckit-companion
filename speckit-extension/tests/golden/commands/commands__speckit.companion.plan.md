---
description: "Companion plan — implementation plan with research & design artifacts"
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
- Filter out hooks where `enabled` is explicitly `false`. A hook with no `enabled` field is enabled by default.
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

Produce an implementation plan and its design artifacts in phases: load context → write `plan.md` (Summary, Constitution Check, Project Structure) → Phase 0 research → Phase 1 design (data model, contracts).
**Right-size this plan to the change.** Before anything else, read the recorded size from the spec's context — `.spec-context.json` → the `size` field (treat a missing value as `normal`). That size sets the budget for the steps below; **apply it to them, omitting anything it says to skip.**

- **`normal`** — produce the full plan and every design artifact exactly as the step describes. No trimming.
- **`oversized`** — produce the same full plan and every design artifact, and open it with a short **Scale note**: one or two sentences naming how many files and areas the change spans and what a reader should watch for. Size never trims here — an oversized change gets *more* signposting, not less.
- **`simple`** — a small change does not need the full ceremony. Produce a **lean** plan:
  - `plan.md`: keep the **Summary** only. **Skip the Project Structure section** (the task list already names every file) and **skip the Constitution Check** unless there is a real violation to flag.
  - **Skip `data-model.md`** — fold the one or two types into the plan's prose.
  - Write the design rationale as a short **Key Decisions** note folded into `plan.md` (a few Decision/why lines), not a separate `research.md`, unless a decision genuinely needs its own page.
  - Generate `contracts/` only if the feature exposes an interface a consumer or test codes against.

This budget governs every step that follows. Where a later step would produce something the budget skips, omit it — do not produce it and then delete it.
1. Read `.specify/feature.json` for the feature directory. The step's start is already stamped, above. Load `<feature_directory>/spec.md` and `.specify/memory/constitution.md` if present — the inputs the plan must satisfy. **Read what `specify` already recorded before opening a file.** `specify` writes what it read onto `.spec-context.json` under `context` — the code areas it looked at, and the constraints it found there. Read those entries first and treat them as the map: they name where the feature attaches, so you open the files they point at rather than rediscovering them. On one measured run this step was the longest section of the whole run at 2m47s, re-reading the area `specify` had already read and already described. The entries carry locations, not content, so you will still open the files that matter — but you should be filling gaps in a map you were handed, not drawing it again. If no `context` entries were recorded, investigate from scratch as below.

Then **investigate the codebase** to understand where this feature attaches: the patterns it must follow (state/store, routing, persistence, component and test conventions) and the exact files it will touch. Read inline by default. **The exception worth parallelizing:** a *large or unfamiliar* codebase with several **independent areas** to map — there, reading is genuinely heavy (each area means opening many files), so when your host has subagents, dispatch one read-only subagent per area in a single message, each returning a **distilled finding** (the pattern to copy, the concrete file paths, the conventions to match) rather than a dump of file contents. That is the case where a separate worker pays for its startup. For a small or familiar codebase, just read the areas yourself in turn — identical result, less overhead. Collect the findings as the research basis for the plan.

   **Reuse the living specs already loaded, and read them by requirement (best-effort, opt-in, read-only).** If `specify` loaded living specs for this feature, it recorded them on `.spec-context.json` under `livingSpecs.loaded` — **reuse that record instead of re-resolving**. Read `<feature_directory>/.spec-context.json`; if `livingSpecs.loaded` lists capability names, ask the resolver what each should contribute for the files this change touches:
   ```bash
   python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <files…> --requirements-for --json
   ```
   Each entry arrives most-specific first with either `"whole": true` — read that `spec` file entirely, as before — or `"whole": false` plus a `purpose` and the `requirements` to contribute, which is all you read. Each requirement carries its `heading` and its full `body`, so the narrowed load hands you the normative prose and its scenarios rather than a list of headings to go and resolve. A capability's spec is often hundreds of lines describing behaviour this plan will never touch; the listed requirements are the ones about the files you are changing, plus every requirement its author left unmarked, so a partly-marked spec can never starve the plan of context. If the resolver is unavailable or the call fails, read each recorded capability's spec whole (a centralized capability's spec is at `capabilities/<name>/spec.md`; if a name doesn't resolve there it is colocated, so find its `spec` path with `--all --json` and match the recorded name) — the narrowing is an optimization and must never cost the plan its brief. Only if no list was recorded (e.g. `plan` runs without a prior `specify` load) and `livingSpecs.enabled` is true may you resolve fresh against the files this change touches. Either way this is read-only and best-effort: a missing config, missing record, or missing spec file is skipped silently and never blocks the plan — and never write a living spec from here.

   **Pull the architecture tier ONLY for an architecture-significant plan (lazy, opt-in, read-only).** A capability's living spec ships a cold sibling — `<spec>.arch.md` (structure, diagrams, the decisions behind the area's shape) — that the hot `.spec.md` deliberately leaves out. Load it **only when this plan is architecture-significant**, judged by the same recorded size signal the budget above uses: read `.spec-context.json` → `size` and load the arch tier when it is **`normal` or `oversized`**, and **never** when it is **`simple`** (a small fast-path change must not pay to pull the cold tier). Do not hardcode the `.arch.md` filename — ask the resolver for each loaded capability's tier paths and read the `arch` one when it exists: `python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --all --json` returns each capability's `tiers.arch.path` and `tiers.arch.exists`. For every capability you loaded above, if `tiers.arch.exists` is true read `tiers.arch.path` into context as the structural frame for the plan; skip any whose arch tier is absent. This is best-effort and read-only exactly like the spec load — a missing config, missing tier, or unavailable resolver is skipped silently and never blocks or fails the plan, and you never write an `.arch.md` from here.
2. Create `<feature_directory>/plan.md` with these sections, in order (this is the full, `normal`/`oversized` shape — the **size budget above governs**: at `simple` size it keeps only the Summary and skips the rest unless genuinely needed). Lead each with prose; reserve `inline code` for real identifiers (paths, types, packages), not ordinary nouns — a sentence that is mostly code spans is a rewrite.
   - **Summary** — 2–4 plain-language sentences: the primary requirement plus the technical approach. If a stack choice genuinely isn't obvious from the codebase (a new language, a newly-added dependency, a non-default storage or test setup), name it in a sentence here; otherwise don't restate the project's known stack.
   - **Project Structure** — the concrete source layout this feature touches, as a short tree of real directories/files, plus a one-line **Structure Decision**. Use the actual paths; do not leave placeholder option-trees in the output. *(Skipped at `simple` size per the budget — the task list already names every file.)*
3. **Constitution Check** — add a `## Constitution Check` section to `plan.md` as a table: one row per constitution principle with a PASS / justified-violation assessment. This is a gate before Phase 0 research, re-checked after Phase 1 design. If a violation is genuinely necessary, justify it in a short **Complexity Tracking** table (violation | why needed | simpler alternative rejected). Omit Complexity Tracking when there are no violations; ERROR on an unjustified gate failure.
4. **Phase 0 — Research (first).** Write `<feature_directory>/research.md` before the Phase 1 docs, since they build on its decisions. *(The size budget above governs: at `simple` size, fold the rationale into a short Key Decisions note in `plan.md` instead of a separate `research.md`.)* For each genuine unknown the plan leaves open — a stack or dependency choice the codebase doesn't already settle, an integration, or a significant design choice — record a short entry as **Decision** (what you chose) / **Rationale** (why) / **Alternatives considered** (what else, and why not). Resolve every `NEEDS CLARIFICATION` here — this is where a maintainer sees *why* the design is shaped this way.

5. **Phase 1 — Design & contracts.** With research settled, generate the design artifacts the size budget keeps. They are **independent documents that share no evolving state**, so write them in any order. Inline (one after another) is the default — composing a short design doc is light work that doesn't pay back a separate worker's startup. Only when the documents are genuinely large *and* your host has subagents is it worth generating them concurrently (one subagent per document); the result is identical either way.
   - `<feature_directory>/data-model.md` — the entities this feature introduces or reshapes: fields, relationships, validation rules drawn from the requirements, and any state transitions.
   - `<feature_directory>/contracts/` — the interface the feature exposes (API / CLI / schema, or a UI contract listing routes and the identifiers a consumer/test codes against). **Copy every identifier from the spec's Verbatim Constraints exactly — never rename, recase, pluralize, or invent an identifier the spec already pinned; those exact strings *are* the contract.** Skip the directory only when the feature exposes no interface at all.
   After the documents return, re-check the Constitution Check against the final design.

   **`design` closes after `contracts/`, not after the last document you happened to write.** Phase 1 is one numbered step producing several artifacts, so the boundary has no natural end and gets stamped at whichever file felt last — on one measured run `design` recorded 21s for about 56s of work because `contracts/` was written after the boundary was closed. Record the `design` substep finish only once every Phase 1 artifact this size budget keeps is on disk.

6. **Capture the plan's reasoning** so the *why* survives the session (best-effort; JSON when you can produce it, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step plan --batch '{
     "decisions": [{"decision": "<what you chose>", "why": "<why>", "rejected": "<the alternative not taken>"}],
     "step_summary": {"summary": "<one-line rollup>", "key_finding": "<the most load-bearing thing you learned>"}
   }'
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set approach="<2-3 sentence how-summary>"
   ```
   Record one `decisions` entry per genuine choice from Phase 0; skip trivia. These are additive and de-duped — re-running them never duplicates. **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`.

**Output**: `<feature_directory>/plan.md` plus `research.md`, `data-model.md`, and `contracts/` when applicable.
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
<!-- /speckit-companion:part timing -->

<!-- speckit-companion:part self-advance -->
## Self-advance — hand off to the next step

This is one step in the Companion pipeline. How the run continues depends on the environment you are running in; do not invoke a separate headless/deterministic run command for the everyday flow.

- **On an agentic CLI that keeps acting after a step finishes:** once this step's work is complete, read the Companion workflow definition (`speckit-extension/workflows/speckit-companion.workflow.yml`) to learn which step comes next, then continue into it on your own — dispatch the next step's `/speckit.companion.*` command and keep going through the pipeline.
- **Pause at every review gate, and name the command that continues.** Where the workflow marks a `gate` (e.g. review-spec, review-plan), stop and wait for approval rather than running past it. When you stop, read the next step out of the workflow definition and **name its command literally** — "approve and run `/speckit.companion.plan <feature_dir>`", not "approve to move to plan". The workflow file knows the command; a gate message that makes the reader work it out is the workflow failing to hand off, not restraint. Only continue once the gate is approved.
- **Terminal step after implement.** After the implementation step finishes (and any commit step), the workflow's final step is `mark-complete`. Run it so the spec lands at `status: completed`. That step writes `completed` only through `write-context.py --mark-complete`, which refuses unless the spec is already `implemented` — never introduce a second completed-writer.
- **Degrade gracefully on a one-shot environment.** If your environment runs one step and then stops, the handoff simply does not fire: finish this step, record its progress, and stop. The run stays valid and resumable, and the next step is triggered manually (by the developer or the companion panel). Completion likewise stays a manual action there.
<!-- /speckit-companion:part self-advance -->

**Pin the workflow identity before handing off.** Record that this spec runs the **Companion** workflow, so the next dispatch is a Companion command and not a stock one. A spec that joined Companion after `specify` has never had this written, and the shared writer defaults `workflow` to `speckit` — so without this the footer advance silently dispatches stock `/speckit.plan`'s successor. Idempotent, and a required deterministic write (skip only if `python3` is genuinely unavailable):

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set workflow=companion
```

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
