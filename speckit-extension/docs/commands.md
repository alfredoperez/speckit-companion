# Commands & hooks

The extension follows spec-kit's bundled-extension pattern exactly: a **lifecycle hook** runs a **command-markdown** file, which tells the agent to **run a script**.

```
/speckit.specify  →  after_specify hook  →  speckit.companion.after-specify  →  write-context.py  →  .spec-context.json
```

## The seventeen commands

Everything the extension declares, by family. The README's [Commands](../README.md#commands) table is the short version; this page is the detail. Both are checked against the extension's own command list on every build, so neither can fall behind a rename.

| Family | Commands |
|--------|----------|
| [Pipeline](#pipeline-commands) | `speckit.companion.specify`, `speckit.companion.plan`, `speckit.companion.tasks`, `speckit.companion.implement`, `speckit.companion.auto`, `speckit.companion.classify`, `speckit.companion.mark-complete` |
| [Run state](#read-commands-status--resume) | `speckit.companion.status`, `speckit.companion.resume` |
| [Living specs](#living-specs-commands) | `speckit.companion.living-adopt`, `speckit.companion.living-drift`, `speckit.companion.living-sync`, `speckit.companion.living-coverage`, `speckit.companion.living-move` |
| [Hooks](#lifecycle-hooks) | `speckit.companion.after-specify`, `speckit.companion.after-plan`, `speckit.companion.after-tasks`, `speckit.companion.after-implement` |

## Lifecycle hooks

Registered in the extension's `extension.yml` (and, once installed, in the project's `.specify/extensions.yml`):

| Hook | Command | optional | Effect |
|------|---------|----------|--------|
| `after_specify` | `speckit.companion.after-specify` | `false` (auto-runs) | Record specify completion into `.spec-context.json` |
| `after_plan` | `speckit.companion.after-plan` | `false` (auto-runs) | Record plan completion (`currentStep=plan`, `status=planned`) into `.spec-context.json` |
| `after_tasks` | `speckit.companion.after-tasks` | `false` (auto-runs) | Record tasks completion (`currentStep=tasks`, `status=ready-to-implement`) into `.spec-context.json` |
| `after_implement` | `speckit.companion.after-implement` | `false` (auto-runs) | Per-task journaling on implement (`currentStep=implement`); `status=implemented` when all tasks checked |

`optional: false` means the agent runs it **automatically** with no prompt. (For contrast, the bundled `git` extension's `after_specify` commit hook is `optional: true`, so it only *offers* to run.) ROADMAP step 2 shipped `after_plan` / `after_tasks` / `after_implement`, so the full `specify → plan → tasks → implement` lifecycle is now captured automatically — see [../ROADMAP.md](../ROADMAP.md).

## `speckit.companion.after-specify`

The first command. It carries no business logic itself — it resolves the active feature and invokes the writer script, mirroring `speckit.git.feature.md`. The three commands below follow the same pattern.

**What the agent runs:**

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step specify --status specified --by extension
```

**Flags** (`scripts/write-context.py`):

| Flag | Default | Meaning |
|------|---------|---------|
| `--step` | `specify` | Canonical step (`specify`/`clarify`/`plan`/`tasks`/`analyze`/`implement`). A non-canonical value (incl. legacy `done`) is a no-op. |
| `--status` | `specified` | Canonical lifecycle status written to the file. |
| `--by` | `extension` | Authorship tag on the appended transition. |
| `--feature-dir` | — | Explicit target dir; otherwise resolved (see [how-it-works.md](./how-it-works.md#active-directory-resolution)). |
| `--tasks-file` | — | Per-task journaling mode: append one transition per completed task marker in this `tasks.md`. Idempotent; sets `status=implementing` until all checked, then the `--status` value. |

**Graceful degradation:** if `python3` is missing the command warns and skips; if the active feature directory can't be resolved the script warns and exits 0. It never fails the host spec-kit command.

## `speckit.companion.after-plan`

Runs after `/speckit.plan`. Resolves the active feature and records the plan step's **completion boundary** (the plan body records the matching start when it begins, so both ends of the span are extension-stamped in order).

**What the agent runs:**

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step plan --status planned --kind complete --by extension
```

## `speckit.companion.after-tasks`

Runs after `/speckit.tasks`. Resolves the active feature and records the tasks step's **completion boundary** (the tasks body records the matching start when it begins, so both ends of the span are extension-stamped in order).

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

Two user-invokable commands turn the captured state into something actionable. Both are **read-only** with respect to `.spec-context.json` (resume writes state only indirectly, via the `after_*` hook of the command it dispatches). Both run `.specify/extensions/companion/scripts/status-context.py`, which reads the canonical state — or derives it from on-disk files when the state file is missing/malformed (`source: derived`) — and emits a human summary plus a final machine line `RESOLUTION: { … }`.

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

Writes `<feature_directory>/spec.md` — prioritized user stories with acceptance scenarios, functional requirements, key entities, edge cases, and measurable success criteria — plus `checklists/requirements.md`. It also **classifies the change's size** (`simple` / `normal` / `oversized`, against a 5-file / 10-task bar) and records the verdict, which is what the later steps read to right-size themselves. A `simple` verdict fast-tracks: specify additionally emits a lean `plan.md` and a real `tasks.md` in the same pass, and the spec lands at the tasks step ready to implement.

### `speckit.companion.plan`

Writes `plan.md` (summary, constitution check, project structure) plus `research.md`, `data-model.md`, and `contracts/` as the recorded size warrants — at `simple` size it keeps the summary and folds the rest inline. When living specs are configured it reads the capabilities in scope into context first, and pulls each one's architecture tier only for an architecture-significant change.

### `speckit.companion.tasks`

Writes `tasks.md`: a dependency-ordered checklist grouped by user story into phases, and within each phase into **waves** separated by explicit join lines. Tasks inside a wave are independent; a join marks where the next tasks depend on everything above. That layout is the execution map `implement` reads.

### `speckit.companion.implement`

Executes `tasks.md` wave by wave in dependency order, journaling each task's finish the moment it completes and folding the journal into `.spec-context.json` after each wave. It owns the `- [ ]` checkboxes through that fold rather than editing them by hand, then marks the spec complete at the end.

### `speckit.companion.auto`

Runs the whole pipeline hands-off — specify → plan → tasks → implement → completed — with no approval pauses. It rides on the same per-step commands above, so it cannot drift from them. It sets an `unattended` signal that project checkpoint hooks read: a hook that would normally stop and ask a person records the checkpoint and keeps going instead. On a one-shot terminal it degrades gracefully, running the first step and stopping.

### `speckit.companion.classify`

Emits a `small | normal | oversized` size signal for the Companion workflow's routing step, which is how a small change skips the review pauses and an oversized one gets extra scrutiny. The thresholds live in the command and the workflow, not in a setting. Dispatched by the workflow engine rather than typed.

### `speckit.companion.mark-complete`

The workflow's terminal step. Writes `status: completed` — and it is the **only** sanctioned writer of that status:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai
```

It refuses unless the spec is already `implemented` (or `implementing` with every task checked), leaves an already-completed spec untouched, and keeps `currentStep` at `implement`. When living specs are on, completion is also where a feature spec's `## ADDED / MODIFIED / REMOVED / RENAMED Requirements` deltas fold back into the durable living spec.

## Living-specs commands

All five are **opt-in by presence**: with no `livingSpecs` block in `.specify/companion.yml`, or `enabled: false`, each reports nothing and changes nothing. The read commands are read-only and never fail the build — they always exit success, so a surrounding workflow decides whether to treat findings as a gate.

### `speckit.companion.living-adopt`

Brownfield adoption wizard. Point it at one code area; it reads that area's surface, proposes capabilities for just that area, and drafts a living spec for each from what the code already exposes. Every draft wears its limits openly — the spec is marked `[DRAFT]`, each requirement is tagged `observed` or `inferred`, uncertain items carry `[NEEDS CLARIFICATION: …]`, and unreadable files are listed under `## Uncovered`. You confirm, and the capability is registered so the resolver recognizes it. Incremental by design: one area at a time, never a whole-repo bootstrap, and a re-run on an adopted area is a safe no-op.

### `speckit.companion.living-drift`

Per capability, the source files that changed since its living spec was last committed, classified `tracked` (it went through the pipeline but was never folded back) or `unspeced` (it changed entirely outside the pipeline). Add `--working` to also count working-tree changes — uncommitted edits, deletions, and untracked files. Exempt generated code, tests, or migrations with a `livingSpecs.exempt` glob list. A capability whose spec isn't committed yet is **skipped**, not passed — the run reports how many it checked versus skipped, so "clean" is never confused with "did not run".

### `speckit.companion.living-sync`

The write-side twin of drift: sync every affected living spec from your current changes — uncommitted, deleted, and untracked files included — in one pass. It groups the changes by capability using the same computation as `living-drift --working`, then updates each affected spec scoped to that capability's changed files, update-not-regenerate, so clarifications and hand-written detail survive. Reports what was synced and what was skipped (a never-committed spec belongs to `living-adopt`), and leaves the spec edits uncommitted so they commit with the code that caused them.

### `speckit.companion.living-coverage`

Reads each capability's `.coverage.md` tier and reports, per requirement, which have a test mapped and which are uncovered.

### `speckit.companion.living-move`

Moves a living spec between central storage (`capabilities/<name>/spec.md`) and colocation next to its code, taking the spec file, its tier siblings (`.arch.md`, `.coverage.md`), and the registry entry together so the three cannot end up disagreeing. Reversible — moving back restores the prior layout.
