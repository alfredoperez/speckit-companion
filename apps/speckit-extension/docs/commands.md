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
| [Living specs](#living-specs-commands) | `speckit.companion.living-adopt`, `speckit.companion.living-drift`, `speckit.companion.living-show`, `speckit.companion.living-validate`, `speckit.companion.living-sync`, `speckit.companion.living-coverage`, `speckit.companion.living-move` |
| [Hooks](#lifecycle-hooks) | `speckit.companion.before-step`, `speckit.companion.after-specify`, `speckit.companion.after-plan`, `speckit.companion.after-tasks`, `speckit.companion.after-implement`, `speckit.companion.before-converge`, `speckit.companion.after-converge` |

## Diagnostics

### `speckit.companion.doctor`

Say what actually happened in a run, and where the record, the display, or the run's own claim is at fault. Read-only, always exits `0`, and every core check derives from `.spec-context.json` plus the spec's own documents — so it produces a meaningful verdict on a spec created long before this command existed.

Nothing is read off a prior verdict. Drift is recomputed from scratch and a recorded drift-clean claim that contradicts the recomputation is reported as a false claim. Every check reports whether it ran, was skipped (always with a reason), or is not applicable, so "found nothing" and "could not look" never print the same way.

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
| `drift` | Recomputed drift with its work shown — capability, files, commits — each flag classified `real`, `self-inflicted`, `suspect-baseline`, or `unknown`; plus any recorded claim the recomputation contradicts |
| `completion` | Why a spec did not land as `completed`: refused (with the writer's reason), reported success but never arrived, landed with the display disagreeing, or never attempted |
| `verification` | Whether implement closed having actually run anything — a step that recorded no executed check shipped code nothing was run against. Reports "no record" rather than a problem on a spec that never reached implement |
| `artifact` | Whether each step produced the file it declared — the build derives a manifest of what a run must write from every node's `writes:`, and a step that closed without one of them is named with the node that promised it. A warning, not a gate. An artifact the size budget may fold away is not judged, and a step that produced none of what this pipeline declares reports "no record" |
| `template` | Whether `tasks.md` kept its generated shape — user-story phases containing waves, join lines and checkpoints intact |
| `dispatch` | Whether plan handed out the workers it was told to. `dispatch-briefs.py` prints one reader brief per recorded code area and one writer brief per design document, and each worker checks in to the trace. A closed plan with briefs and no check-ins is a warning naming what it did inline, and so is an implement that folded its living-spec deltas without the reviewer `--living` offered |
| `trace` | What the self-trace recorded: capture calls that failed and why, call counts, payload sizes, per-file rewrite counts, and calls that resolved to no spec at all. Reads the unrecorded-calls marker before deciding a spec has no trace evidence, so a run that could not write its trace at all still reports what it lost |
| `chat` | *(`--chat` only)* From the session transcript: work tried and failed, retried, or stopped; claims the recomputation contradicts; and waste — narration, repeated commands, repeated rewrites |

### The self-trace

Every capture and drift call records itself to `specs/<NNN>/.trace.jsonl` — one line, success or failure, with the reason verbatim. It costs no extra call and adds nothing to any command body: the scripts the pipeline already runs write it from the inside. Size-capped, self-ignoring on first write, read by nothing but the doctor, and safe to delete (a missing trace is a skipped check, never an error).

### Debug mode

Setting `debug: true` in `.specify/companion.yml` is read by the body renderers, but **the renderers are build-time tools and are not part of a release** — so on an installed project this switch currently does nothing. Treat it as a maintainer tool: from a source checkout, `python3 apps/speckit-extension/scripts/build.py --debug` renders the bodies with per-section timing instrumentation, and a plain rebuild removes it again. Never commit an instrumented body.

To instrument a run on an installed project today, attach the instruction as a node hook in your own `.specify/companion.yml` — that mechanism ships and takes effect on the next dispatched command. See the `debug-timing` hook in this repository's own config for the wording.

## Lifecycle hooks

Registered in the extension's `extension.yml` (and, once installed, in the project's `.specify/extensions.yml`):

| Hook | Command | optional | Effect |
|------|---------|----------|--------|
| `before_specify` | `speckit.companion.before-step` | `false` (auto-runs) | Read the clock so `after_specify` can record when specify started; writes nothing |
| `before_plan` | `speckit.companion.before-step` | `false` (auto-runs) | Record plan start (`currentStep=plan`, `status=planning`) into `.spec-context.json` |
| `before_tasks` | `speckit.companion.before-step` | `false` (auto-runs) | Record tasks start (`currentStep=tasks`, `status=tasking`) into `.spec-context.json` |
| `before_implement` | `speckit.companion.before-step` | `false` (auto-runs) | Record implement start (`currentStep=implement`, `status=implementing`) into `.spec-context.json` |
| `after_specify` | `speckit.companion.after-specify` | `false` (auto-runs) | Record specify start, from the time read before it, then specify completion (`currentStep=specify`, `status=specified`) into `.spec-context.json` |
| `after_plan` | `speckit.companion.after-plan` | `false` (auto-runs) | Record plan completion (`currentStep=plan`, `status=planned`) into `.spec-context.json` |
| `after_tasks` | `speckit.companion.after-tasks` | `false` (auto-runs) | Record tasks completion (`currentStep=tasks`, `status=ready-to-implement`) into `.spec-context.json` |
| `after_implement` | `speckit.companion.after-implement` | `false` (auto-runs) | Per-task journaling on implement (`currentStep=implement`); `status=implemented` when all tasks checked |
| `before_converge` | `speckit.companion.before-converge` | `false` (auto-runs) | Record converge start (`currentStep=converge`, status unchanged) into `.spec-context.json` |
| `after_converge` | `speckit.companion.after-converge` | `false` (auto-runs) | Record converge finish (`currentStep=converge`, status unchanged) into `.spec-context.json` |

`optional: false` means the agent runs it **automatically** with no prompt. (For contrast, the bundled `git` extension's `after_specify` commit hook is `optional: true`, so it only *offers* to run.)

## `speckit.companion.before-step`

Runs before `/speckit.specify`, `/speckit.plan`, `/speckit.tasks` and `/speckit.implement`. One command serves all four hooks, and which step is starting decides what it does. For plan, tasks and implement it records the step's start. The start is idempotent: when the GUI already recorded it at dispatch, the call appends nothing and the earlier time stands. A `completed` or `archived` spec is not written.

**What the agent runs** (plan, tasks or implement):

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step <step> --status <status> --kind start --by extension
```

| Step | `--step` | `--status` |
|------|----------|------------|
| plan | `plan` | `planning` |
| tasks | `tasks` | `tasking` |
| implement | `implement` | `implementing` |

For specify it runs no writer. The new feature directory does not exist yet and `.specify/feature.json` still points at the previous spec, so a write at that moment would land on finished work. It reads the clock and keeps what it prints for `after_specify`:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

## `speckit.companion.after-specify`

Runs after `/speckit.specify`. It carries no business logic itself — it resolves the active feature and invokes the writer script, mirroring `speckit.git.feature.md`. The other hook commands follow the same pattern.

**What the agent runs**, in order. First the start, with exactly the time `before_specify` read; this call is skipped when no time was read, and is a no-op when the GUI already recorded the start:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step specify --status specifying --kind start --by extension --at <the time read>
```

Then the finish, every time:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step specify --status specified --kind complete --by extension
```

**Flags** (`scripts/write-context.py`):

| Flag | Default | Meaning |
|------|---------|---------|
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

Runs after `/speckit.converge`. Records converge's finish, again with no `--status`, so the viewer can show how long converge took. When converge appended convergence tasks, the status stays where it was and `/speckit.companion.status` names the next one. Idempotent, like the start.

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

Prints the active spec's current step, status, recorded `decisions[]`, and the next action/command. Falls back to file-derivation when no state file exists.

```bash
python3 .specify/extensions/companion/scripts/status-context.py
# or target an explicit dir:
python3 .specify/extensions/companion/scripts/status-context.py --feature-dir specs/<NNN>-<slug>
```

### `speckit.companion.resume`

Resolves the next step from the same script, then dispatches the next `/speckit.*` command with the recorded `decisions[]` in scope. Inside the implement step it continues at the next unchecked task. On a terminal state (`implemented`/`completed`/`archived`) it reports "Pipeline complete" and dispatches nothing. Resume dispatches the **already-installed** `/speckit.*` commands — it does not require a `specify workflow resume` CLI subcommand, so it works on the stock spec-kit version.

The next-action mapping: `specify/specified → /speckit.plan`, `plan/planned → /speckit.tasks`, `tasks/ready-to-implement → /speckit.implement`, `implement/implementing → /speckit.implement` (at the next unchecked task). In-progress statuses re-dispatch the current step.

## Pipeline commands

The four step commands are the Companion pipeline itself. They mirror stock spec-kit's `/speckit.specify · plan · tasks · implement` deliberately — same step names, same artifacts — so the model carries across; what differs is the leaner shape they emit and the lifecycle capture they carry. Each one records its own timing into `.spec-context.json` as it runs, and each ends by handing off to the next step on a host that keeps working.

### `speckit.companion.specify`

Writes `<feature_directory>/<short-name>.spec.md` — prioritized user stories with acceptance scenarios, functional requirements, key entities, edge cases, and measurable success criteria — plus `checklists/requirements.md`. It also **classifies the change's size** (`simple` / `normal` / `oversized`, against a 5-file / 10-task bar; a change that is hard to undo or hard to check is never `simple`) and records the verdict, which is what the later steps read to right-size themselves. A `simple` verdict fast-tracks: specify additionally emits a lean `plan.md` and a real `tasks.md` in the same pass, and the spec lands at the tasks step ready to implement.

### `speckit.companion.plan`

Writes `plan.md` (summary, constitution check, project structure) plus `research.md`, `data-model.md`, and `contracts/` as the recorded size warrants — at `simple` size it keeps the summary and folds the rest inline. When living specs are configured it reads the capabilities in scope into context first, and pulls each one's architecture tier only for an architecture-significant change.

### `speckit.companion.tasks`

Writes `tasks.md`: a dependency-ordered checklist grouped by user story into phases, and within each phase into **waves** separated by explicit join lines. Tasks inside a wave are independent; a join marks where the next tasks depend on everything above. That layout is the execution map `implement` reads.

### `speckit.companion.implement`

Executes `tasks.md` wave by wave in dependency order, journaling each task's finish the moment it completes and folding the journal into `.spec-context.json` after each wave. It owns the `- [ ]` checkboxes through that fold rather than editing them by hand, then marks the spec complete at the end.

On a host with a subagent tool it hands each user-story phase that owns five or more files to its own worker: the phases are disjoint because the tasks step gave every file exactly one owner phase, the workers only append their finishes, and the main agent folds each result as it returns. The Foundational phase goes through `dispatch-briefs.py --waves`, which splits it into waves (at join lines, `###` blocks and `Wave` headers, so tests stay ahead of the code they test) and prints the next wave that still has unfinished tasks: up to four worker briefs when it holds four or more, otherwise the tasks to build inline. Implement runs it before each Foundational wave and crosses a join line only once that wave's workers have returned; Setup and Polish it builds itself. Without a subagent tool it builds the waves inline exactly as before. Before it folds living-spec deltas, `dispatch-briefs.py --living` hands them to one reviewer with a short rubric (one rule per requirement, a checkable heading, behaviour rather than implementation, no filler) and the shape checker's findings; the reviewer edits the blocks in place and the fold runs after it returns.

### `speckit.companion.auto`

Runs the whole pipeline hands-off — specify → plan → tasks → implement → completed — with no approval pauses. It rides on the same per-step commands above, so it cannot drift from them. After specify returns it reads the recorded size: on a `simple` verdict specify already wrote the lean `plan.md` and `tasks.md` and recorded both steps, so auto prints that it folded them and dispatches implement next instead of running plan and tasks again. It sets an `unattended` signal that project checkpoint hooks read: a hook that would normally stop and ask a person records the checkpoint and keeps going instead. On a one-shot terminal it degrades gracefully, running the first step and stopping.

### `speckit.companion.classify`

Emits a `small | normal | oversized` size signal for the Companion workflow's routing step, which is how a small change skips the review pauses and an oversized one gets extra scrutiny. The thresholds live in the command and the workflow, not in a setting. Dispatched by the workflow engine rather than typed.

### `speckit.companion.mark-complete`

The workflow's terminal step. Writes `status: completed` — and it is the **only** sanctioned writer of that status:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai
```

It refuses unless the spec is already `implemented` (or `implementing` with every task checked), leaves an already-completed spec untouched, and keeps `currentStep` at `implement`. It never refuses for lack of verification: a spec with nothing verified and no concern explaining why completes with one `finished, unverified` concern and a `[companion] Warning:` line. When living specs are on, completion is also where a feature spec's `## ADDED / MODIFIED / REMOVED / RENAMED Requirements` deltas fold back into the durable living spec.

## Living-specs commands

All five are **opt-in by presence**: with no `livingSpecs` block in `.specify/companion.yml`, or `enabled: false`, each reports nothing and changes nothing. The read commands are read-only and never fail the build — they always exit success, so a surrounding workflow decides whether to treat findings as a gate.

### `speckit.companion.living-adopt`

Brownfield adoption wizard. Point it at one code area; it reads that area's surface, proposes capabilities for just that area, and drafts a living spec for each from what the code already exposes. Every draft wears its limits openly — the spec is marked `[DRAFT]`, each requirement is tagged `observed` or `inferred`, uncertain items carry `[NEEDS CLARIFICATION: …]`, and unreadable files are listed under `## Uncovered`. You confirm, and the capability is registered so the resolver recognizes it. Incremental by design: one area at a time, never a whole-repo bootstrap, and a re-run on an adopted area is a safe no-op.

### `speckit.companion.living-drift`

Per capability, the source files that changed since its living spec was last committed, classified `tracked` (it went through the pipeline but was never folded back) or `unspeced` (it changed entirely outside the pipeline). Add `--working` to also count working-tree changes — uncommitted edits, deletions, and untracked files. Exempt generated code, tests, or migrations with a `livingSpecs.exempt` glob list. A capability whose spec isn't committed yet is **skipped**, not passed — the run reports how many it checked versus skipped, so "clean" is never confused with "did not run".

### `speckit.companion.living-show`

Prints one slice of a living spec instead of the whole file: `--headings <capability>` for its requirement headings in file order, `--requirement "<heading>"` for one requirement with its prose and scenarios (add `--capability` to search one capability), and `--file <path>` for the requirements whose markers describe that file, grouped by capability, most-specific first. It uses the same parser the load steps use, so its count is the viewer outline's count and the coverage denominator. Read-only, `--json` available, and every answer exits successfully — an unregistered capability lists the registered ones, a name matching nothing lists the headings that exist, and an ambiguous name lists the candidates rather than guessing. In the editor the same lookup runs the other way: the status bar names how many living specs claim the file you have open, and one click opens the requirement that describes it.

### `speckit.companion.living-validate`

The shape check every other reader assumes has already run. It reports a requirement that states a rule and never says how anyone would know it held, a scenario with a condition and no outcome (or the reverse), two requirements in one capability sharing the heading that fold-back and coverage both join on, a delta block marked for a capability the registry does not list, a MODIFIED or REMOVED entry naming a heading the target spec does not carry, and a file marker whose pattern matches nothing on disk. Each finding carries a severity, a stable code, the file, the line and a one-line fix; `--json` emits them as an object. Read-only and always exits successfully. Severity answers exactly one question — the fold runs these same checks and refuses to write a capability whose deltas carry an error, while a warning never stops anything.

### `speckit.companion.living-sync`

The write-side twin of drift: sync every affected living spec from your current changes — uncommitted, deleted, and untracked files included — in one pass. It groups the changes by capability using the same computation as `living-drift --working`, then updates each affected spec scoped to that capability's changed files, update-not-regenerate, so clarifications and hand-written detail survive. Reports what was synced and what was skipped (a never-committed spec belongs to `living-adopt`), and leaves the spec edits uncommitted so they commit with the code that caused them.

### `speckit.companion.living-coverage`

Reads each capability's `.coverage.md` tier and reports, per requirement, which have a test mapped and which are uncovered.

### `speckit.companion.living-move`

Moves a living spec between central storage (`capabilities/<capability>/<name>.spec.md`) and colocation next to its code, taking the spec file, its tier siblings (`.rules.md`, `.coverage.md`, or a legacy `.arch.md`), and the registry entry together so the three cannot end up disagreeing. Reversible — moving back restores the prior layout.
