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

Add `--at "<dispatch time>"` when the dispatcher printed one; otherwise the script stamps now. Two things keep this honest:

- **Run it, never hand-write it.** The script stamps the real clock and writes atomically. A hand-authored entry in `.spec-context.json` is what corrupts the file.
- **A second start is refused, not reconciled.** History is append-only, so if the extension already seeded this step's start, this call appends nothing and the earlier timestamp stands. Running it is always safe; skipping it is what loses the window.
<!-- /speckit-companion:part step-start -->

<!-- speckit-companion:part speckit-hooks -->
## Pre-Execution Checks — stock spec-kit extension hooks

Companion runs **on top of** stock spec-kit, so a project's installed spec-kit **extensions** (git, and any others registered in `.specify/extensions.yml`) must still fire on a Companion run exactly as they do on a stock `/speckit.*` run. That is separate from Companion's own node-hooks in `.specify/companion.yml`; both fire. Like the rest of the pipeline this must **never fail the host command** — anything missing or malformed is skipped silently.

Let `<step>` be this command's phase: `specify`, `plan`, `tasks`, or `implement`. Run the pass twice — `hooks.before_<step>` **now, before any of the work below**, and `hooks.after_<step>` once this command's work is fully reported, before handing off.

- **Read `.specify/extensions.yml`.** Absent, unparseable, or carrying no entries for that anchor: skip silently, there is nothing to run.
- **Skip a hook that is `enabled: false`** (no `enabled` field means enabled), **and any hook whose `extension` is `companion`** — those exist so a stock run records its lifecycle, and this command records its own in its own body, so dispatching them is a turn that rewrites what this step just wrote. Every other extension's hooks fire as normal.
- **Leave `condition` to the HookExecutor.** A hook with no condition, or a null or empty one, is executable; one with a non-empty condition is skipped here and never evaluated by you.
- **Emit one block per executable hook.** An optional hook (`optional: true`):

  ```
  ## Extension Hooks

  **Optional Pre-Hook**: {extension}
  Command: `/{command}`
  Description: {description}

  Prompt: {prompt}
  To execute: `/{command}`
  ```

  A mandatory hook (`optional: false`) instead:

  ```
  ## Extension Hooks

  **Automatic Pre-Hook**: {extension}
  Executing: `/{command}`
  EXECUTE_COMMAND: {command}

  Wait for the result of the hook command before proceeding to the Outline.
  ```

  Those are the **before** pass's labels. In the **after** pass drop `Pre-` from the label, and drop the closing wait line — there is nothing left to wait for.

For `specify`, branch creation is normally one of these `before_specify` hooks (the git extension); the spec directory and its files are always created by the command body itself.
<!-- /speckit-companion:part speckit-hooks -->

<!-- speckit-companion:part smallest-thing -->
## The smallest thing that works

**Before building anything, stop at the first rung that holds:** does it need to exist at all; does this codebase already have it; does the standard library, the platform, or an installed dependency do it; can it be one line; only then, the minimum code that works. Fix the cause where every caller passes through, not the symptom one caller reported. Delete rather than add, boring rather than clever: no interface with one implementation, no factory for one product, no scaffolding for later.

**The same test governs what you write.** A section nobody acts on is removed, not filled in. No requirement for what a type or a test already enforces. A third scenario has to cover a failure the first two miss.

**Write it the way you would say it.** One idea per sentence. No em-dashes: a full stop, a comma or a colon says it. Say what happens, not what the system "shall be capable of". Never a section that exists to say "N/A" — remove it instead.

**Never simplify away** validation at a trust boundary, error handling that prevents data loss, security, accessibility, or anything the spec asks for. **A corner cut on purpose** carries `// simplified: <ceiling>, <what to do when it binds>` in the code and one `concerns` entry in this step's capture.
<!-- /speckit-companion:part smallest-thing -->

## Outline

Execute `tasks.md` phase by phase in dependency order. Each phase is laid out as ordered **waves** split by `⟶ Wait …` join lines — a dependency map where tasks within a wave are independent and a `⟶ Wait` marks where the next tasks depend on what came before. Build each task inline, in turn, stopping at each `⟶ Wait` line until the wave above is done. (A host with subagents *may* parallelize a wave whose tasks are each heavy enough to be worth a separate worker, but inline is the default and usually faster for ordinary edits.) Each task's finish is logged as it completes; then mark the spec complete.
<!-- speckit-companion:phase execute -->
<!-- speckit-companion:node implement-exec -->
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md` (and `data-model.md` / `contracts/` if present). The step's start is already stamped, above.

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. `tasks.md` lays each phase out as ordered **waves** separated by `**⟶ Wait …**` join lines. The waves are a **dependency map**: tasks inside one wave are independent of each other (any order is safe), and a `⟶ Wait` line marks where the next tasks depend on everything above it. **Execute wave by wave, in order, and stop at each `⟶ Wait` line until the wave above is done** before starting the next. Halt on a failed task and report the cause.

3. **Hand each user-story phase to a worker where your host has one; build everything else yourself.** Setup, Foundational and Polish stay with you — Setup is trivial, Foundational blocks every story, Polish is cross-cutting. A **story phase** is the unit worth handing off, because it is minutes of work and pages of reading, and every file you open is context you then carry for the rest of the run: on one measured run, reading was 87% of everything the implementing agent took in. Never fan out per *task* — a task is seconds of work against a comparable startup, so it saves nothing and it was tried.

   **Only dispatch story phases whose files are disjoint.** Every task line names its exact file, so compare the file names across the phases before dispatching: two phases naming the same file are not independent whatever the story numbering says, and those run one after another in priority order. Give each worker its phase's task lines, that user story from `spec.md`, and the plan's Structure Decision — then ask it to read what it needs, write the code **and that story's tests**, run the suite, and return only a distilled result: what it built, the files it touched, and any test still failing. A worker that returns file contents has defeated the point.

   ```bash
   # the worker, per task it finishes — append only, never fold
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
   # you, the moment each worker's result returns
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --materialize
   ```

   Folding is a read-modify-write on the shared file and two folders is the race the append log exists to prevent, so **workers only ever append and you do every fold**, in the foreground, one at a time.

4. **Without a worker, build the waves yourself, and close each task as you finish it** — the moment its work is done, never batched at the end of a wave:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --close-task <TaskID> --by ai --did "<one line>" --files "<files>"
   ```
   `--close-task` appends the finish and folds it in one call: the panel updates and the task's `tasks.md` box is checked (never hand-edit the checkbox). It is the main agent closing its own task, which is why the two halves can be one call. The result is identical to the fanned-out path; only what you had to read to get there differs.

5. **At each join line, reconcile before crossing it.** Type-check or build the phase's files together and fix any seam drift — a worker that changed an interface another assumed is exactly what this catches — then run `--materialize` once more as a backstop. It is idempotent, so re-folding never double-counts, and it catches any finish whose fold was missed. `tasks.md` is owned only through `--materialize`, so it never diverges from the journal.

6. **Run the project's own checks before you call this done.** Validating against the spec's **Functional Requirements** and **Success Criteria** by reading is not validation — a test you wrote and never executed is a guess about your own code. Run the suite and the type-check/build the project actually uses (read them from its `package.json` scripts, `Makefile`, or the repo's own instructions; do not invent a command).

   - **A test you authored that fails is your task, not a follow-up.** Fix it now. Shipping a red suite is a defect the run introduced, and it is the single most common way a finished-looking run is not finished.
   - **A pre-existing test your change invalidated is also yours.** Renaming what a component shows breaks the test asserting the old text; updating it is part of the change, not scope creep.
   - **A test file that does not compile counts as failing.** Check the suite actually ran, not merely that the command exited.
   - **If you genuinely cannot run them** — no test script exists, or the environment forbids it — say so explicitly in the summary and record it as a concern below. Do not describe a read-through as though it were a run.

   **Then read your own diff and delete what it does not need** — a helper with one caller, a branch no input reaches, a wrapper that only forwards. Then report a short summary of what was built and anything left undone.

7. **Capture what was verified and decided** — the audit trail a resume/handoff needs, recorded the moment validation ends (best-effort; JSON when you can, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --batch '{
     "verified":   [{"what": "<check>", "command": "<cmd>", "result": "<outcome>", "warnings": ["<seen-and-dismissed>"]}],
     "decisions":  [{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}],
     "concerns":   [{"note": "<friction, residual risk, or a `// simplified:` ceiling you left in the code>", "step": "implement"}],
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
8. **Mark the spec complete.** Once every task in `tasks.md` is checked off and the work validates, finish the lifecycle so the spec lands at `completed` instead of stopping at `implemented`.

   **"Validates" means the project's own checks ran and passed.** A spec MUST NOT be marked complete over a failing suite the run introduced — fix it, or leave the spec at `implemented` and say why. Completing on red is how a run that looks finished ships broken code, and the completed status is the one signal a reader trusts without opening anything. Where the checks genuinely could not be run, record that as a concern before completing, so the state says "finished, unverified" rather than implying "finished, verified". Run from the repository root (the feature directory resolves on its own):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai --set workflow=companion
   ```
   The `--set` pins which workflow finished the spec in the same write, so a mid-run join keeps Companion dispatch. This is the only sanctioned writer of `completed`: it closes the implement step and promotes an `implemented` spec — or an `implementing` one whose tasks are all checked — straight to `completed`, keeping `currentStep` at `implement`. Best-effort and idempotent: if `python3` is unavailable, warn and skip without failing the host command; a spec already `completed` is left untouched. When the spec-kit workflow engine drives the run, its terminal `mark-complete` step calls the same path, so running it here too is harmless.

   - **Account for every loaded capability first — a delta or an explicit skip, never silence.** Living specs stay current only if completion writes the change back, so before folding, read `livingSpecs.loaded` in this feature's `.spec-context.json`. An absent key or an empty list means nothing was loaded and there is nothing to account for; skip to the fold. Go through **every** name in that list; each gets exactly one of two outcomes. For a loaded capability whose *behavior* this feature actually changed, append a delta block to this feature's `spec.md` capturing the real new or changed requirement, and mark it with that capability's name so the fold routes it to the right spec:
     ```markdown
     ## ADDED Requirements
     <!-- capability: <name> -->

     ### <the new capability requirement, as a testable statement>

     #### Scenario: <name>
     - **WHEN** <trigger>
     - **THEN** <observable outcome>
     ```
     Pick the verb by whether the requirement heading already exists in the capability's living spec (`capabilities/<name>/spec.md`): a requirement that is **not already there** goes under `## ADDED Requirements`, even if it revises the same behavior area. Reserve `## MODIFIED Requirements` for changing the body of a requirement whose heading is already in the living spec — the heading must match an existing one for the edit to replace it in place. **Read the existing headings before choosing:** a new heading that says what an existing one says in other words is that requirement, changed, and belongs under MODIFIED with the existing heading — an ADDED near-duplicate is how a spec grows two requirements for one behaviour, and the validator warns on it. A `// simplified:` ceiling you left in the code is **not** a delta entry — inside a delta block every `###` is a requirement heading, so a "Known limits" heading there folds into the capability as a requirement. Record ceilings as `concerns` in this step's capture instead, and let `living-sync` place them. Use `## REMOVED Requirements` when you deleted one, `## RENAMED Requirements` (`### Old heading -> New heading`) for a rename. Write one block per changed capability, each with its own `<!-- capability: <name> -->` marker — several marked blocks fan out, each capability spec receiving only its own requirements. Never invent requirements to pad the list, and add a third scenario to an existing requirement only when it covers a failure the first two miss — say which, in the scenario name. The write lands in this feature's PR diff, so it is reviewed there.

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

Record every boundary by **running the writer script**, never by editing `.spec-context.json` yourself — a hand-authored edit is what corrupts the file. The model is **finish-only**: one finish per task and per substep, its duration the gap back to the previous finish. Never a `start`+`complete` pair for either, which stamps a `0s` tick and measures nothing.

- **Close your own step**, as the last thing you do, after emitting any mandatory after-hook block:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <this step> --advance --by ai
  ```

  `--advance` appends the step's complete and flips `status` in one atomic write. It is idempotent and first-writer-wins, so it changes nothing when the after-hook already closed the step — and when the hook was *printed* rather than dispatched, which is indistinguishable downstream, it is the only thing that closes it. One run sat at `status: tasking` for eight minutes that way. Run it every time, with two exceptions: **clarify** and **analyze** use `--finish`, which records a boundary without owning a status; and **implement** runs neither, because its own final node writes `completed`, which closes the step in the same write.

- **One finish per substep, the moment it ends** — plan records `research` and `design`, tasks records `generate`. Never two in one batch, never a separate start.

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <step> --substep <name> --finish --by ai
  ```

- **Closing a task is that task's last action, not a bookkeeping pass you batch later.** Feature dir from `.specify/feature.json`:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --close-task <TaskID> --by ai --did "<one line>" --files "<files>"
  ```

  One call appends the finish with its own real clock, folds it into the panel, and flips that task's box in `tasks.md`. Never hand-edit that box or hand-author per-task JSON, and never write a per-task start. Re-closing is safe. **Batching is a defect the doctor catches**: it names any cluster of finishes stamped seconds apart, because those timestamps record when the batch was written, and history is append-only so it cannot be repaired afterwards. The per-task summaries and their order are what is trustworthy; the timestamps are best-effort, and that is fine.

  **A fanned-out worker appends only**, because folding is a read-modify-write and two folders contend:

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
  ```

  The MAIN agent folds each returned result with `--materialize`, one at a time, and once more at a wave join as a backstop.

- **Never write the next step's start.** The next command owns it; writing it here renders a phantom "Generating <next>…".
<!-- /speckit-companion:part timing -->

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

**Find the hooks for this command.** An absent or empty `.specify/companion.yml` means no hooks: skip silently, and never warn — an empty file is a project that declared nothing, not a broken one. Look up `commands.<this-command>.hooks` in `.specify/companion.yml`. It has two anchors, `before` and `after`, each keyed by a node id from this command's order. Run a node's `before` hooks immediately before that node's work, and its `after` hooks immediately after. When several hooks sit at one anchor, run them **top to bottom, in declared order**.

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
