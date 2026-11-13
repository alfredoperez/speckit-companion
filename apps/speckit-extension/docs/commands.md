# Commands & hooks

The extension follows spec-kit's bundled-extension pattern exactly: a **lifecycle hook** runs a **command-markdown** file, which tells the agent to **run a script**.

```
/speckit.plan  →  before_plan hook  →  speckit.companion.before-step  →  write-context.py  →  .spec-context.json  (start)
               →  after_plan hook   →  speckit.companion.after-plan   →  write-context.py  →  .spec-context.json  (finish)
```

## The twenty-four commands

Everything the extension declares, by family. The README's [Commands](../README.md#commands) table is the short version; this page is the detail. Both are checked against the extension's own command list on every build, so neither can fall behind a rename.

| Family | Commands |
|--------|----------|
| [Pipeline](#pipeline-commands) | `speckit.companion.specify`, `speckit.companion.plan`, `speckit.companion.tasks`, `speckit.companion.implement`, `speckit.companion.auto`, `speckit.companion.classify`, `speckit.companion.mark-complete` |
| [Run state](#read-commands-status--resume) | `speckit.companion.status`, `speckit.companion.resume` |
| [Diagnostics](#diagnostics) | `speckit.companion.doctor` |
| [Hooks](#lifecycle-hooks) | `speckit.companion.before-step`, `speckit.companion.after-specify`, `speckit.companion.after-plan`, `speckit.companion.after-tasks`, `speckit.companion.after-implement`, `speckit.companion.before-converge`, `speckit.companion.after-converge`, `speckit.companion.on-prompt`, `speckit.companion.on-stop` |

## Diagnostics

### `speckit.companion.doctor`

Say what actually happened in a run, and where the record, the display, or the run's own claim is at fault. Read-only, always exits `0`, and every core check derives from `.spec-context.json` plus the spec's own documents — so it produces a meaningful verdict on a spec created long before this command existed.

Nothing is read off a prior verdict. Every check reports whether it ran, was skipped (always with a reason), or is not applicable, so "found nothing" and "could not look" never print the same way.

```bash
python3 .specify/extensions/companion/scripts/doctor.py                              # the active spec
python3 .specify/extensions/companion/scripts/doctor.py --feature-dir specs/042-x     # one spec
python3 .specify/extensions/companion/scripts/doctor.py --all                         # every spec
python3 .specify/extensions/companion/scripts/doctor.py --json                        # machine-readable
python3 .specify/extensions/companion/scripts/doctor.py --chat                        # + transcript audit
```

| Check | What it answers |
|-------|-----------------|
| `record` | Which steps started and never finished; which checked-off tasks have no journal entry; whether task finishes were written in one burst (so their durations mean nothing); which steps were closed by the wrong author |
| `triage` | For the "status says one thing, the pipeline bar offers another" symptom: *records disagree with each other* (a capture defect) or *records are consistent* (a display defect) |
| `bleed` | Where one step did the next step's work — plan content in the spec, a task checklist in the plan, implementation code in the task list, one task list in two documents, source committed before implement, a pre-implement step that outlasted implement |
| `completion` | Why a spec did not land as `completed`: refused (with the writer's reason), reported success but never arrived, landed with the display disagreeing, or never attempted |
| `verification` | Whether implement closed having actually run anything — a step that recorded no executed check shipped code nothing was run against. Reports "no record" rather than a problem on a spec that never reached implement |
| `artifact` | Whether each step produced the file it declared — the build derives a manifest of what a run must write from every node's `writes:`, and a step that closed without one of them is named with the node that promised it. A warning, not a gate. An artifact the size budget may fold away is not judged, and a step that produced none of what this pipeline declares reports "no record" |
| `template` | Whether `tasks.md` kept its generated shape — user-story phases containing waves, join lines and checkpoints intact |
| `dispatch` | Whether plan handed out the workers it was told to. `dispatch-briefs.py` prints one reader brief per recorded code area and one writer brief per design document, and each worker checks in to the trace. A closed plan with briefs and no check-ins is a warning naming what it did inline |
| `trace` | What the self-trace recorded: capture calls that failed and why, call counts, payload sizes, per-file rewrite counts, and calls that resolved to no spec at all. Reads the unrecorded-calls marker before deciding a spec has no trace evidence, so a run that could not write its trace at all still reports what it lost |
| `chat` | *(`--chat` only)* From the session transcript: work tried and failed, retried, or stopped; claims the recomputation contradicts; and waste — narration, repeated commands, repeated rewrites |

### The self-trace

Every capture call records itself to `specs/<NNN>/.trace.jsonl` — one line, success or failure, with the reason verbatim. It costs no extra call and adds nothing to any command body: the scripts the pipeline already runs write it from the inside. Size-capped, self-ignoring on first write, read by nothing but the doctor, and safe to delete (a missing trace is a skipped check, never an error).

### Debug mode

Setting `debug: true` in `.specify/companion.yml` is read by the body renderers, but **the renderers are build-time tools and are not part of a release** — so on an installed project this switch currently does nothing. Treat it as a maintainer tool: from a source checkout, `python3 apps/speckit-extension/scripts/build.py --debug` renders the bodies with per-section timing instrumentation, and a plain rebuild removes it again. Never commit an instrumented body.

To instrument a run on an installed project today, attach the instruction as a node hook in your own `.specify/companion.yml` — that mechanism ships and takes effect on the next dispatched command. See the `debug-timing` hook in this repository's own config for the wording.

## Lifecycle hooks

Registered in the extension's `extension.yml` (and, once installed, in the project's `.specify/extensions.yml`):

| Hook | Command | optional | Effect |
|------|---------|----------|--------|
| `before_specify` | `speckit.companion.before-step` | `false` (auto-runs) | Save the start time outside the project until the spec folder exists; writes no record |
| `before_plan` | `speckit.companion.before-step` | `false` (auto-runs) | Record the plan start |
| `before_tasks` | `speckit.companion.before-step` | `false` (auto-runs) | Record the tasks start |
| `before_implement` | `speckit.companion.before-step` | `false` (auto-runs) | Record the implement start |
| `after_specify` | `speckit.companion.after-specify` | `false` (auto-runs) | Record the saved specify start, then the specify finish |
| `after_plan` | `speckit.companion.after-plan` | `false` (auto-runs) | Record the plan finish |
| `after_tasks` | `speckit.companion.after-tasks` | `false` (auto-runs) | Record the tasks finish |
| `after_implement` | `speckit.companion.after-implement` | `false` (auto-runs) | Sync implement progress from `tasks.md` |
| `before_converge` | `speckit.companion.before-converge` | `false` (auto-runs) | Record the converge start |
| `after_converge` | `speckit.companion.after-converge` | `false` (auto-runs) | Record the converge finish |

`optional: false` means the agent runs it **automatically** with no prompt. (For contrast, the bundled `git` extension's `after_specify` commit hook is `optional: true`, so it only *offers* to run.)

`speckit.companion.on-prompt` and `speckit.companion.on-stop` are not hooks. spec-kit runs them from its runtime events (a prompt submitted, a turn ended) and they record step starts and finishes with no model in the loop. Agents without events keep the hooks above.

## `speckit.companion.before-step`

Runs before `/speckit.specify`, `/speckit.plan`, `/speckit.tasks` and `/speckit.implement`. One command serves all four hooks, and which step is starting decides what it does. For plan, tasks and implement it records the step's start. The start is idempotent: when the GUI already recorded it at dispatch, the call appends nothing and the earlier time stands. A `completed` or `archived` spec is not written.

**What the agent runs**, with the step that is about to run:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --hook start --step <step>
```

For plan, tasks and implement the writer records the start with that step's in-progress status. For specify it writes no record: the new feature directory does not exist yet and `.specify/feature.json` still points at the previous spec, so a write at that moment would land on finished work. It saves the clock to a file kept outside the project, keyed by the repository, and `after_specify` records it once the folder exists. A saved start more than an hour older than the folder is an abandoned run's and is dropped.

## `speckit.companion.after-specify`

Runs after `/speckit.specify`. It carries no business logic itself — it resolves the active feature and invokes the writer script, mirroring `speckit.git.feature.md`. The other hook commands follow the same pattern.

**What the agent runs**:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --hook finish --step specify
```

The writer records the start saved by `before_specify` (a no-op when the GUI already recorded it), then the specify finish.

**Flags** (`scripts/write-context.py`):

| Flag | Default | Meaning |
|------|---------|---------|
| `--hook` | — | `start` or `finish`: the one-call form the hook pages use, with `--step`. The writer maps the step and boundary to the status and kind; pass no `--status`, `--kind` or `--tasks-file`. A bad call exits 0. |
| `--step` | `specify` | Canonical step (`specify`/`clarify`/`plan`/`tasks`/`analyze`/`implement`/`converge`). A non-canonical value (incl. legacy `done`) is a no-op. |
| `--status` | `specified` | Canonical lifecycle status written to the file. |
| `--kind` | `start` | Which boundary of the step this call records: `start` or `complete`. |
| `--at` | — | The time a step start is recorded at, as an ISO-8601 UTC stamp. Step starts only; every other boundary is stamped live. |
| `--by` | `extension` | Authorship tag on the appended transition. |
| `--feature-dir` | — | Explicit target dir; otherwise resolved (see [how-it-works.md](./how-it-works.md#active-directory-resolution)). |
| `--tasks-file` | — | Per-task journaling mode: append one transition per completed task marker in this `tasks.md`. Idempotent; sets `status=implementing` until all checked, then the `--status` value. |

**Graceful degradation:** if `python3` is missing the command warns and skips; if the active feature directory can't be resolved the script warns and exits 0. It never fails the host spec-kit command.

## `speckit.companion.after-plan`

Runs after `/speckit.plan`. Resolves the active feature and records the plan step's **completion boundary** (the `before_plan` hook records the matching start, so both ends of the span are extension-stamped in order).

**What the agent runs:**

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step plan --status planned --kind complete --by extension
```

## `speckit.companion.after-tasks`

Runs after `/speckit.tasks`. Resolves the active feature and records the tasks step's **completion boundary** (the `before_tasks` hook records the matching start, so both ends of the span are extension-stamped in order).

**What the agent runs:**

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step tasks --status ready-to-implement --kind complete --by extension
```

## `speckit.companion.after-implement`

Runs after `/speckit.implement` in task-sync mode: it appends one transition per completed `- [x] **T###**` marker in `tasks.md`. Idempotent — re-running adds only newly-checked markers; status stays `implementing` until all markers are checked, then becomes `implemented`.

**Live per-task cadence vs. this backstop.** When `speckit.aiContextInstructions` is on (default), the implement-step preamble the GUI prepends instructs the AI to journal each task *as it finishes it* — a `history[]` entry `{ step: "implement", substep: "<TaskID>", task: "<TaskID>", kind: "start", by: "ai", at: <real `date -u`> }` — so the activity log reflects real per-task timing instead of one end-of-run burst. Because those live entries carry the `task` id, this hook dedupes against them and becomes a no-op backstop, only journaling tasks the AI missed (or all of them when the preamble is disabled).

**What the agent runs:**

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step implement --status implemented --by extension --tasks-file specs/<NNN>-<slug>/tasks.md
```

## `speckit.companion.before-converge`

Runs before `/speckit.converge`. Resolves the active feature and records converge's start. Converge owns no status, so the call passes no `--status` and the spec's status never moves. A re-fired hook adds nothing, and a `completed` or `archived` spec is not written.

**What the agent runs:**

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step converge --kind start --by extension
```

## `speckit.companion.after-converge`

Runs after `/speckit.converge`. Records converge's finish, again with no `--status`, so the viewer can show how long converge took. When converge appended convergence tasks, the status stays where it was and `/speckit.companion.status` names the next one. When it added none and every task is checked, the spec is marked completed, in manual, auto and stock runs alike. On a spec that is already completed, the pass is recorded, the spec stays completed, and a concern names any open tasks the pass added. Idempotent, like the start.

**What the agent runs:**

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step converge --kind complete --by extension
```

## Derive-from-files fallback

`.specify/extensions/companion/scripts/derive-from-files.py` reconstructs `.spec-context.json` from on-disk artifacts when a hook never fired. Stdlib-only; reuses `write-context.py`'s feature-dir resolution and its no-backward-clobber guard, so it never drags an already-advanced or terminal spec backward. It writes the same canonical schema, tagged `by: "derive"`.

It infers the lifecycle from what's present: `spec.md` → `specify`/`specified`, `plan.md` → `plan`/`planned`, `tasks.md` → `tasks`/`ready-to-implement`, and all task markers checked → `implement`/`implemented`, plus git as a signal.

**Invocation:**

```bash
python3 .specify/extensions/companion/scripts/derive-from-files.py
# or target an explicit dir:
python3 .specify/extensions/companion/scripts/derive-from-files.py --feature-dir specs/<NNN>-<slug>
```

See [how-it-works.md](./how-it-works.md) for what the writer guarantees (atomic, append-only, no-regress) and the canonical schema.

## Read commands: status & resume

Two user-invokable commands turn the captured state into something actionable. Both are **read-only** with respect to `.spec-context.json` (resume writes state only indirectly, via the `before_*` and `after_*` hooks of the command it dispatches). Both run `.specify/extensions/companion/scripts/status-context.py`, which reads the canonical state — or derives it from on-disk files when the state file is missing/malformed (`source: derived`) — and emits a human summary plus a final machine line `RESOLUTION: { … }`.

### `speckit.companion.status`

Prints the active spec's current step, status, recorded `decisions[]`, and the next action/command. Falls back to file-derivation when no state file exists. It runs the script with `--plain`, which leaves out the `RESOLUTION` line (that line is for `resume`), and the assistant prints the output unchanged, with no summary of its own.

```bash
python3 .specify/extensions/companion/scripts/status-context.py --plain
# or target an explicit dir:
python3 .specify/extensions/companion/scripts/status-context.py --plain --feature-dir specs/<NNN>-<slug>
```

### `speckit.companion.resume`

Resolves the next step from the same script, then dispatches the next `/speckit.*` command with the recorded `decisions[]` in scope. Inside the implement step it continues at the next unchecked task. On a terminal state (`completed`/`archived`) it reports "Pipeline complete" and dispatches nothing. Resume dispatches the **already-installed** `/speckit.*` commands — it does not require a `specify workflow resume` CLI subcommand, so it works on the stock spec-kit version.

The next-action mapping: `specify/specified → /speckit.plan`, `plan/planned → /speckit.tasks`, `tasks/ready-to-implement → /speckit.implement`, `implement/implementing → /speckit.implement` (at the next unchecked task), `implement/implemented → /speckit.converge`. In-progress statuses re-dispatch the current step.

## Pipeline commands

The four step commands are the Companion pipeline itself. They mirror stock spec-kit's `/speckit.specify · plan · tasks · implement` deliberately — same step names, same artifacts — so the model carries across; what differs is the leaner shape they emit and the lifecycle capture they carry. Each one records its own timing into `.spec-context.json` as it runs, and each ends by handing off to the next step on a host that keeps working.

### `speckit.companion.specify`

Writes `<feature_directory>/spec.md` (older projects have `<short-name>.spec.md`, and every step still reads it) — prioritized user stories with acceptance scenarios, functional requirements, key entities, edge cases, and measurable success criteria — and checks it once against a short quality list. Before drafting it **classifies the change's size** (`simple` / `normal` / `oversized`: simple is understood, touches nothing high-risk, and could be finished from the request and the diff) and records the verdict, which is what the later steps read to right-size themselves. A `simple` verdict fast-tracks: specify additionally emits a lean `plan.md` and a real `tasks.md` in the same pass, and the spec lands at the tasks step ready to implement.

### `speckit.companion.plan`

Writes `plan.md` (summary, constitution check, project structure) plus `research.md`, `data-model.md`, and `contracts/` as the recorded size warrants — at `simple` size it keeps the summary and folds the rest inline. 

### `speckit.companion.tasks`

Writes `tasks.md`: a dependency-ordered checklist grouped by user story into phases, and within each phase into **waves** separated by explicit join lines. Tasks inside a wave are independent; a join marks where the next tasks depend on everything above. That layout is the execution map `implement` reads.

### `speckit.companion.implement`

Executes `tasks.md` wave by wave in dependency order, journaling each task's finish the moment it completes and folding the journal into `.spec-context.json` after each wave. It owns the `- [ ]` checkboxes through that fold rather than editing them by hand. It ends at `implemented` and hands off to converge, which is what completes the spec.

On a host with a subagent tool it hands each user-story phase that owns five or more files to its own worker: the phases are disjoint because the tasks step gave every file exactly one owner phase, the workers only append their finishes, and the main agent folds each result as it returns. The Foundational phase goes through `dispatch-briefs.py --waves`, which splits it into waves (at join lines, `###` blocks and `Wave` headers, so tests stay ahead of the code they test) and prints the next wave that still has unfinished tasks: up to four worker briefs, two tasks each at least, when it holds four or more tasks across five or more files, otherwise the tasks to build inline. Implement runs it before each Foundational wave and crosses a join line only once that wave's workers have returned; Setup and Polish it builds itself. Without a subagent tool it builds the waves inline exactly as before.

### `speckit.companion.auto`

Runs the whole pipeline hands-off — specify → plan → tasks → implement → converge — with no approval pauses. It repeats implement and converge until a converge pass adds no task, three passes at most, then stops with a concern. It rides on the same per-step commands above, so it cannot drift from them. After specify returns it reads the recorded size: on a `simple` verdict specify already wrote the lean `plan.md` and `tasks.md` and recorded both steps, so auto prints that it folded them and dispatches implement next instead of running plan and tasks again. It sets an `unattended` signal that project checkpoint hooks read: a hook that would normally stop and ask a person records the checkpoint and keeps going instead. On a one-shot terminal it degrades gracefully, running the first step and stopping.

### `speckit.companion.classify`

Emits a `small | normal | oversized` size signal for the Companion workflow's routing step, which is how a small change skips the review pauses and an oversized one gets extra scrutiny. The thresholds live in the command and the workflow, not in a setting. Dispatched by the workflow engine rather than typed.

### `speckit.companion.mark-complete`

Marks a spec complete by hand; the workflow's last step is converge. Writes `status: completed` through `--mark-complete`, the one writer of that status, which every path below goes through:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai
```

It refuses unless the spec is already `implemented` (or `implementing` with every task checked), and leaves an already-completed spec untouched. It never refuses for lack of verification: a spec with nothing verified and no concern explaining why completes with one `finished, unverified` concern and a `[companion] Warning:` line. Converge completes the spec in every run: once every task is checked, including any task converge added and built in the same pass, closing converge marks the spec completed, with no assistant involved. An added task left open keeps it at `implemented`. This command is left for marking a spec complete by hand.
