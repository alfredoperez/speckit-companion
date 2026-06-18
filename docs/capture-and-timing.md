# Capture & Timing Architecture

How `.spec-context.json` gets written, why some of it is exact and some of it is best-effort, and what the eval asserts. Read this before touching capture hooks, the timing partial, the preset bodies, `write-context.py`, or `check_capture.py` — it exists so the flow doesn't have to be re-derived from the code each time.

## The two capture mechanisms

Every entry in `history[]` comes from one of two surfaces. They differ in *who* writes and in *how reliable* the timing is.

### 1. Deterministic writes — exact, ~100% reliable

The extension or a script writes these; nothing depends on the AI's judgement.

| Trigger | Code | `by` | Writes |
|---|---|---|---|
| GUI lifecycle button (sidebar/viewer) | `src/features/specs/stepLifecycle.ts` → `specContextWriter.ts` | `extension` | step `start`/`complete`, `setStatus`, `setProfile` (atomic temp+rename) |
| Command-body self-capture | the companion `specify`/`implement` bodies call `write-context.py --kind start`/`--kind complete` | `extension` | **specify** start (right after the dir is created) + complete (at the end) → a real begin→end span; **implement** start (at begin) |
| `after_implement` hook | `write-context.py --tasks-file` → `sync_tasks()` (run by `speckit.companion.capture-implement`) | `extension` | first **materializes** any pending append-log lines, then a **single finish** per task not already journaled (finish-only backstop), then the implement step's **complete** — all stamped with the script's own clock |
| Append-log fold | `write-context.py --materialize` → folds `.spec-context.events.jsonl` into `history[]`/`task_summaries` | `ai`/`extension` | every appended per-task finish, replayed through the same fold core as the live path (idempotent), in one write per batch |
| Other lifecycle hooks | `write-context.py` (run by `speckit.companion.capture*`) | `extension` | step **start** (plan→planned, tasks→ready-to-implement, …) |
| Reconstruction fallback | `speckit-extension/scripts/derive-from-files.py` | `derive` | state rebuilt from on-disk artifacts when a hook never fired (same start+complete shape) |

These carry **sub-second (ms) precision** because they read the real clock at write time, and they are monotonic because they fire in order.

### 2. Best-effort AI journaling — coarse, NOT guaranteed

The **timing part** — authored once in `speckit-extension/presets/_parts/timing.md`, assembled into every companion preset command body by `build-commands.py`, and injected into the GUI dispatch preamble by `src/ai-providers/promptBuilder.ts` — has the AI record `by: "ai"` finishes for the steps the lifecycle hooks don't close. **The AI never hand-edits `.spec-context.json`** — it always runs the writer script, which stamps the real clock, writes atomically, and dedups. (Hand-authoring was what corrupted the file in practice — a second top-level `status` key the AI then had to repair.) Two cases:

- **Self-close — plan/tasks/clarify/analyze only.** When one of those step's own work ends, the AI runs `write-context.py --step <step> --finish --by ai`. `--finish` (`journal_finish`) appends a single step-level `complete` to `history[]` and touches **nothing else** — `status`/`currentStep` stay owned by the lifecycle hooks. **specify** and **implement** are excluded (closed by scripts in §1).
- **Substeps.** Each substep boundary (plan: `research`, `design`; tasks: `generate`) is recorded with `write-context.py --step <step> --substep <name> --finish --by ai` the moment it finishes — same script path, idempotent on `(step, substep)`.

Per-task timing is journaled **live by the AI via a script** (finish-only): after each task it runs `write-context.py --task <id> --kind complete --append`, which writes **one** finish line to `.spec-context.events.jsonl` and never reads or rewrites the shared `.spec-context.json`. Because a script stamps each line, this carries **ms precision** and honest deltas (the gap between consecutive finishes is each task's real duration) — not hand-authored JSON. The append-only path exists so the hot loop never hits the "read the file first" retry churn, and so **parallel workers (subagents) can each record their own finish at the same time without contending** on the shared file — a single `O_APPEND` write of a short line is atomic across appenders.

Those appended lines are folded into `history[]`/`task_summaries` by `write-context.py --materialize`, run after each batch and at step close. The fold replays every line through the *same* core the live read-modify-write path uses, so the materialized entries are byte-identical to journaling each task inline — only batched into one write instead of one per task. It is idempotent (dedup on `(implement, task)`), so re-folding the whole log per batch never double-counts, and it computes the implement step-close exactly as the inline path does. **`--materialize` also owns the `tasks.md` checkboxes**: it flips `- [ ]` → `- [x]` for every journaled task (`_mark_tasks_done`, a single writer), so the AI never hand-edits the checkbox and a fanned-out subagent only appends its finish — `tasks.md` is *derived* from the event log, never a second source the two can diverge on. The `after_implement` hook is the backstop: it materializes anything the AI didn't fold and fills any task the live path missed (§1). The remaining genuinely-hand-authored `by:ai` entries — the plan/tasks/clarify/analyze self-closes and the single-finish substep boundaries — carry **second precision** and are only as accurate as the AI's discipline allows.

Once the implement step **closes** (every task journaled and `tasks.md` at 100%, or `--mark-complete`), the `.spec-context.events.jsonl` append log is **garbage-collected** — removed only *after* the final fold, so no un-materialized line is ever dropped. Everything in it has already landed in `history[]`/`task_summaries`; deleting it means re-running the same spec dir can't re-fold stale finishes from a prior run. A materialize that does *not* close the step leaves the log in place (more tasks pending).

## Why the split exists (the dispatch model)

The extension dispatches a command as **text** — to a terminal, the host editor's chat, or the Claude GUI panel — and **receives no completion callback**. It cannot observe "the AI finished this step at time T." So the only timing signals the host can trust are:

1. **GUI button clicks** — user-driven, host-observed → deterministic.
2. **In-command hook scripts** — the AI runs them at a fixed point in the command (the "check for extension hooks" step) → deterministic-ish (depends on the command reaching that step, which it reliably does).

Anything finer than a step boundary — a step's *real* end time, per-task cadence — has no host-observable signal. The fix (applied 2026-06-08) is to move that capture off the AI and into **scripts the command runs**: the specify body brackets itself with `--kind start`/`--kind complete` calls, and the `after_implement` hook journals every task + the implement close. The script reads the real clock, so these are deterministic even though the host never saw the step finish.

## The reliability principle

> **"Run a script" is reliable. "Author JSON with an embedded live timestamp" is best-effort.**

The AI executes commands faithfully — every lifecycle hook fired on every run. It is far less reliable at pausing mid-work to hand-author a JSON entry with a freshly-shelled `date -u`. The lever for raising fidelity is therefore to **convert timing capture from "AI authors JSON" to "AI runs a script that stamps its own clock"** — the script reads the real time (ms precision, no hand-typing, no format drift), and calling a script is the kind of action the AI does reliably.

This principle is also what the eval encodes: deterministic writes are held to a strict bar; AI-journaled timing is graded as quality, not pass/fail.

## Fixed — deterministic timing (2026-06-08)

Both gaps the financial-page E2E exposed were closed by moving capture off the AI (see the reliability principle above):

- **specify now self-closes.** The specify body calls `write-context.py --kind start` right after it creates the dir and `--kind complete` at the end (`by:extension`, ms precision) → a real begin→end span instead of a `complete` synthesized at plan-start. The late `after_specify` hook-start is collapsed by the broadened start-dedup in `update_context` (a step is started once).
- **per-task no longer bursts.** The AI stopped hand-authoring per-task JSON; the `after_implement` hook's `sync_tasks()` writes each task with the script's own clock.

All remaining `by:ai` writes (the plan/tasks/clarify/analyze self-closes and substep boundaries) now go through `write-context.py --finish`, never a hand-edited JSON file — so the duplicate-`status`-key corruption can't recur. They are the plan/tasks/clarify/analyze self-closes and substep boundaries. History: `Projects/speckit companion/backlog/specify-duration-and-duplicate-start.md`.

## Finish-only journaling (2026-06-08, v2)

The 2026-06-08 fix above made per-task capture *reliable* (the hook owns it) but at the cost of *cadence*: writing a `start` **and** a `complete` for each task at one end-of-step instant produces `0s` ticks (start == complete) and a burst (all tasks share a tight window). v2 moves to a **finish-only** model that recovers honest cadence without re-introducing hand-authored JSON:

- **One finish per task/substep.** A task or substep records a *single* `complete` event — never a start+complete pair. Its duration is the gap to the previous finish (the first measured from the step's `start`). No pair → no `0s` tick; deltas → no unattributed inter-task gap.
- **Live, via a script.** The AI runs `write-context.py --task <id> --kind complete --by ai` as it finishes each task (the live path). A script stamps it, so it is reliable *and* honest (ms precision, real deltas). Substeps emit one hand-authored finish each.
- **Backstop hardened.** `sync_tasks()` writes finish-only too and now journals per-task **even when implement already self-closed** (`status: implemented`): its guard was narrowed from `TERMINAL_STATUSES` to `CROSS_STEP_TERMINAL` (`completed`/`archived` only), so a same-step write is never rejected. `_journaled_tasks` keeps it from duplicating a task the live path captured.
- **Parallel `[P]` caveat.** The delta model can't give each task in a parallel batch its own duration — the batch is attributed to whichever finishes last. Accepted for the common sequential case.
- **Derivation.** `src/features/specs/stepHistoryDerivation.ts` (`buildSubsteps`) computes each row from finish deltas, staying tolerant of legacy start+complete pairs and single boundary markers. A per-task row is named from `task` (or a legacy `substep` mirror); the derivation compares `task` so two distinct finishes don't collapse, and excludes task entries when deciding whether the step itself is closed.
- **Both dispatch surfaces.** The instruction lives identically in `presets/_parts/timing.md` (spec-kit path, assembled into the bodies by `build-commands.py`) and the GUI preamble renderers in `src/ai-providers/promptPreamble.ts` (GUI path); `check-shape-parity.py` guards against a fork. The relocation from `_shared/timing-partial.md` to `_parts/timing.md` changed only where the block is authored — the bytes the AI receives, and therefore the capture, are unchanged.
- **GUI preamble is vscode-free + reusable.** The pure preamble renderers (`renderPreamble`, `renderLifecyclePreamble`, `renderSpecifyCreationLifecyclePreamble`, plus the schema/status/timing blocks) live in `src/ai-providers/promptPreamble.ts` with **no `import vscode`** — the only vscode-dependent parts (the `aiContextInstructions` on/off toggle and `nowUtc()`) stay in `promptBuilder.ts`, which imports and re-exports the renderers so its public API is unchanged. This lets the adoption bench import the compiled `dist/ai-providers/promptPreamble.js` and dispatch each step with the *exact* GUI preamble (`bench/driver.mjs`), so the bench can't drift from the real dispatch path.
- **Both marker formats.** Per-task detection accepts the Companion **bold** form (`- [x] **T001**`) *and* the stock tasks-template **plain** form (`- [x] T001 …`) — `parse_task_markers` (`write-context.py`) and the eval make the `**` optional. Previously the bold-only regex silently no-op'd on a stock `tasks.md`, so the spec got no per-task journal and implement never auto-closed. The TS/GUI task-percent already counted plain checkboxes, so only the Python parsers needed it.

## Record-shape hardening (2026-06-09)

Finish-only made the timing honest; this pass makes the record *self-describing* and the eval able to *catch* a dishonest one. Two moves: tighten what the writers emit, and add the checks that verify it.

- **Dropped redundant fields.** The writers no longer emit three things that carried no new information: the **`from`** pointer on `start` entries (fully derivable from the previous entry's step), the per-task **`substep` mirror** of `task` (the id already lives in `task`, so per-task implement finishes are now `{step:"implement", substep:null, task:"T001", kind:"complete", …}`), and the date-only **`updated`** marker (strictly less precise than the ms-stamped `history[]` `at` values, and no reader consumed it). This applies to all three write sites: `write-context.py`, `derive-from-files.py` (the one-shot combined-artifact path), and the GUI `specContextWriter.ts`.
- **Backward-readable, not migrated.** Records written before this change still carry `from`/`updated`/substep-mirror. The schema keeps `additionalProperties: true`, so those validate as undeclared extras; readers (`stepHistoryDerivation.ts`, `historyHelpers.ts`, the Python `_entry_kind`/`_has_complete`) degrade cleanly when `from` is absent and `substep` is null for tasks. New writers stop *adding* these fields; a record that already carries `from`/`updated`/the substep-mirror keeps them — those are preserved, not stripped (append-only history never rewrites past entries; the read-merge preserves unknown top-level keys). Only legacy `transitions`/`stepHistory` are actively dropped.
- **Cadence-span FAIL + format validation.** The eval gains `task-cadence-span` (the burst detector) and `entries-match-format` (per-entry schema validation) — see *The eval* below.
- **Schema is the single vocabulary source.** `check_capture.py` loads its `by`/step/status enums *from* `spec-context.schema.json` instead of hard-coding parallel lists, so the eval can't drift from the format authority.

## Fast-path lifecycle fold (2026-06-09)

The Companion complexity fast-path — the command-body fold described here (**on by default**, no flag), and separately available as the [Companion workflow routing step](./template-profiles.md#companion-workflow-routing-step) — folds the plan and tasks steps into the `specify` run for a small change. The same pass also emits three lean files — `spec.md` (inline Approach), a `plan.md` pointer, and a real-checklist `tasks.md` — so the file-driven stepper, sidebar, and implement progress agree with this history fold rather than reading "not created". After `specify` self-closes, the simple-mode branch records the folded steps so the history panels read them as satisfied (not missing) instead of dispatching separate `/speckit.companion.plan` / `.tasks` runs:

- **`--substep` flag.** `write-context.py --step <plan|tasks> --kind <start|complete> --substep fast-path` tags the folded step-level entries with `substep: "fast-path"` instead of `null`. The fold is four ordered calls — `plan` start/complete then `tasks` start/complete, the last adding `--status ready-to-implement` — each stamped by the script's own clock (`by:ai`, real timestamps), so the spec lands at `ready-to-implement` in one run.
- **Idempotent on (step, substep).** `_has_step_start` / `_has_complete` dedup on the `(step, substep)` pair, so a folded `fast-path` start/complete never collides with a real step-level (`substep:null`) entry and a re-run never doubles the fold.
- **Eval coverage.** `check_capture.py` asserts a fast-tracked spec's folded `plan`/`tasks` start+complete entries (tagged `fast-path`), real timestamps, and final `ready-to-implement` status — and stays silent on a normal spec.

## Companion workflow run/resume capture (#292)

The Companion pipeline can run as a single spec-kit workflow (`specify workflow run speckit-companion`) on spec-kit's own engine instead of hand-invoked commands — see [`template-profiles.md`](./template-profiles.md#companion-workflow-routing-step). Capture is **unchanged** by this path: the engine dispatches each step's command (`speckit.companion.{specify,plan,tasks,implement}`) exactly as a hand-run would, so the same lifecycle hooks and command bodies fire and write `.spec-context.json` the same way. The two timing models above still hold — deterministic step writes from the hooks, finish-only per-task journaling inside implement.

- **Run/resume keep capture honest.** A workflow run pauses at the review gates and resumes from the exact node with `specify workflow resume <run_id>`; because capture is per-step (not per-run), a resumed run continues writing the canonical `history[]` from wherever it stopped — no step is re-captured or skipped.
- **Terminal `mark-complete`.** The workflow's final step dispatches `speckit.companion.mark-complete`, which calls `write-context.py --mark-complete` — the only sanctioned writer of `status: completed`. It promotes a spec from `implemented` to `completed` (a path `update_context` refuses, since `implemented` is terminal to it), keeps `currentStep: implement`, and is idempotent for an already-shipped spec. The AI never hand-writes `completed`. It also accepts a spec still at `implementing` whose `tasks.md` is **100% checked** — that spec is finished in fact, so it advances `implementing → implemented → completed` in one atomic write (closing the implement step in history). A spec with work left is still refused, so incomplete work can never be shipped. The companion side of this fix has a partner: finishing the last task no longer re-asserts `implementing` (it lands the spec at `implemented`), so the live per-task path and the `sync_tasks` backstop converge on the same closed state.
- **Engine run state is separate.** The engine persists its own run bookkeeping under `.specify/workflows/runs/<run_id>/` (state, inputs, a copy of the workflow). That is the engine's resume substrate; the Companion GUI still reads only each spec's `.spec-context.json`.

## Implement-lifecycle reliability (#277)

The implement step's *settle* (reaching `status: implemented`) is the most fragile link end-to-end — it has no "next step" to trigger its close, IDE-chat dispatch returns no terminal handle, and stock mode has no companion hook. Three guards make it reliable regardless of dispatch mode or which spec is "active":

- **Fallback settle from the always-on `tasks.md` watcher (#244).** The deterministic settle is *no longer owned solely* by the `after_implement` hook. The extension's `tasks.md` watcher (`src/core/fileWatchers.ts` → `shouldCloseImplement` → `completeStep(specDir, 'implement', 'extension')`) writes the implement self-close **and** `status=implemented` (via `deriveCompletedStatus('implement')`) the moment every marker in `tasks.md` is checked under an underway implement step. This is the one mode-agnostic surface, and it targets the file-watched path, so a missed hook can no longer strand a finished implementation at `implementing`. It is guarded against re-close / fast-path-park / backward-clobber by `shouldCloseImplement`.
- **Capture writer settles the spec named by `--tasks-file` (#277 Child 2).** In task-sync mode, `write-context.py` derives the feature dir from the **`--tasks-file` parent**, overriding the active-feature pointer precedence (`SPECIFY_FEATURE_DIRECTORY` → `SPECIFY_FEATURE` → `.specify/feature.json` → git branch). The tasks file's spec dir is authoritative: the spec whose task list is passed is the spec that settles, so settling spec 16's implementation can never land on spec 17 because a later spec is "active". When both `--feature-dir` and `--tasks-file` are supplied and disagree, the writer **refuses to write** (prints the mismatch to stderr, exits 0) rather than silently picking one. `resolve_feature_dir` is unchanged for step-mode and `--task` finish-mode. Covered by `TasksFileResolvesFeatureDirTests` in `speckit-extension/tests/test_context.py`.
- **Viewer refresh over configured spec dirs (#277 Child 3 / #270).** A `.spec-context.json` watcher fires for every configured spec directory (`**/<pattern>/**/.spec-context.json` from `getFileWatcherPatterns`, wired in `fileWatchers.ts`) → `refreshContextIfDisplaying`, so the open viewer re-derives within a debounce window when implement settles (the legacy `.claude`-only watcher missed the default `specs/` layout). The same watcher's `onDidCreate` refreshes the sidebar, and `.specify/specs` is now in the default `specDirectories`, so a spec created under the CLI's `.specify/specs/` layout is discovered and clears the welcome screen.

## Specify settle in stock mode (#332)

`specify` is the one step that needs mode-aware handling. `plan`/`tasks`/`clarify`/`analyze` are always in the AI self-close set (the dispatch preamble tells the AI to write their completion itself), so they settle in any mode. `implement` settles from the always-on `tasks.md` watcher (#244). But `specify` is told to **defer** — "the specify command records its own completion" — which is only true when the **companion** `/speckit.companion.specify` command runs (it calls `write-context.py --kind complete`). In a **stock** project the upstream `/speckit.specify` makes no such call, so nothing closed specify and it stuck at `specifying` forever, with the in-flight footer gate hiding the advance button.

The fix lives in the **dispatch preamble**, not in extension code (`promptBuilder.ts` → `promptPreamble.ts`):

- **Mode-aware self-close.** `aiSelfClosesStep(step, companionInstalled)` adds `specify` to the self-close set when companion is **not** installed. `buildPrompt` keys this off the command family (`/speckit.companion.*` → companion records it → defer; stock command → AI self-closes); the create-spec preamble keys off `workflow === 'companion' && isCompanionInstalled()`. So in stock the preamble gives `specify` the same strong "MANDATORY FINAL WRITE → flip to `specified`, append the `complete` entry" instruction the other AI-closed steps get, and the spec advances on its own.
- **No double-write in companion mode.** When a companion command runs it still records the completion via its script; the preamble keeps telling the AI to defer, so there's no duplicate `ai` complete.
- **(Removed) the #326 artifact-stability watcher.** An earlier attempt added an extension-side `spec.md` quiet-window watcher; it was the wrong layer (the status is written by the AI per the preamble, not by code) and it didn't fire reliably. It was removed in favor of this preamble fix.

## Auto orchestrator — the `unattended` flag (#309)

`/speckit.companion.auto` drives the whole pipeline hands-off. It is a pure **orchestrator**: it dispatches the same per-step `/speckit.companion.*` commands, so capture is unchanged — the same bodies/hooks write `.spec-context.json` at each step exactly as in a manual or GUI run. Auto adds nothing to the lifecycle log itself.

The one new write is the **unattended signal**. Auto runs `write-context.py --set unattended=true` once, near the start of its loop, recording `unattended: true` as a top-level field. `--set` is a generic merge (read → set the named keys → atomic write) that leaves `history`, `status`, and `currentStep` untouched — it is bookkeeping, not a lifecycle event, so it never appends a history entry and never runs the canonical-step guard. Values coerce (`true`/`false` → bool, digits → int, `null`/`none` → null), so `unattended=true` lands as a real boolean.

The flag is a **convention for checkpoint hook authors**, not enforced by the script: a project checkpoint `prompt` hook reads `unattended` and records-and-continues instead of pausing for a person. Background / review / PR hooks are unaffected — only the human pause is skipped. On a one-shot terminal auto can't chain steps, so it degrades to the normal one-step flow (it still sets the flag; there's just no further dispatch to carry it into).

## Preset / command-override mechanism

The document *shape* (stock SpecKit vs Companion) and the timing partial both live in **command-body overrides**, not template files — core commands embed their own structure, and template overrides don't reach `specify` (it copies its template by literal path).

- The stock shape is the stock command bodies carried by the **`companion-standard`** preset (`speckit-extension/presets/companion-standard/`), which `replaces:` the **7** command bodies (`type: command`): specify, clarify, plan, tasks, analyze, implement, constitution. The Companion shape is delivered by the namespaced `/speckit.companion.{specify,plan,tasks,implement}` commands (the extension's `provides.commands`). **Both families are always present** — neither is gated on a mutually-exclusive preset.
- Selected by the **workflow choice** `speckit.defaultWorkflow` (`speckit` | `companion`), recorded per spec in `.spec-context.json` `workflow`. Selection is **dispatch routing, not a preset swap**: each step resolves its workflow's command via `resolveStepCommand`, then `src/features/specs/profileDispatch.ts` `resolveDispatchWithFallback` downgrades a `/speckit.companion.*` command to its stock twin when the extension is missing; the choice adds/removes nothing.
- `specify preset add --dev <bundled path>` **re-emits the agent command bodies** (e.g. `.claude/skills/speckit-specify/SKILL.md`) with the overridden body. To confirm `companion-standard` is active, check that `.specify/presets/companion-standard/` exists **and** the re-emitted body carries the timing partial — **not** `specify preset resolve`, which reports *template* overrides only and prints "No template…" for these `type: command` overrides (not a bug).
- **Both shapes carry the identical timing partial** → switching the workflow changes the document shape, **not** the timing capture. A Companion run shows the same timing behavior as a stock SpecKit run.

See `docs/template-profiles.md` for the full workflow reference.

## Activation ensure (keep the stock family present)

On activation the extension runs an **add-only** ensure — `companionPresetReconciler.ensureStandardFamily` — that adds `companion-standard` from the bundled path (`specify preset add --dev .specify/extensions/companion/presets/companion-standard`) when the stock command files are absent, and is a no-op when present. The `--dev` bundled path is required because catalog-form `add <id>` silently no-ops (the presets aren't published to a catalog). The ensure **never** removes the stock family, so it cannot strand a project: it re-materializes the stock commands on a fresh checkout and recovers a project a prior swap left without them. A one-time migration removes a leftover `companion-turbo` install if present (and the pre-rename `companion-lean` / `sdd-lean` leftovers); the workflow choice itself issues no removes thereafter. CLI failures are logged, not thrown, so activation never breaks.

## Install paths

Capture scripts run from the **installed** extension dir, `.specify/extensions/companion/scripts/write-context.py` — never the dev-source `speckit-extension/scripts/…` (that path doesn't exist in a consumer project). The hooks reference the installed path (mirroring the git extension's `.specify/extensions/<id>/scripts/…` convention).

## The eval

`.claude/skills/eval-speckit-extension/check_capture.py` is the regression net (a tracked project skill — edit it here, it is **not** sourced from kaiju). It bakes in the reliability principle:

- **`timestamps-real` / `timestamps-monotonic`** apply strict checks only to **deterministic** writes (`by:extension`/`derive`/`cli`/`user`): those must be ms-precision and non-decreasing. `by:ai` second-precision and occasional burst is **expected**, reported as cadence quality — not a failure.
- **`per-task-no-duplicates`** pairs by `(task, kind)`: finish-only means a task carries a single `complete` (a `start` may still appear on legacy specs). Only a repeated `(task, kind)` is the real dedup-failure signal (the backstop re-adding a task the live path already journaled).
- **`task-cadence`** reports its source: `live (by:ai, script-stamped)` (non-zero gaps are the honest-cadence signal) vs `backstop (by:extension, end-of-step)` (near-zero gaps acceptable, not a defect).
- **`task-cadence-span`** is the **burst detector** (the FAIL that `task-cadence` couldn't be). It compares the span of `by:ai` task finishes (first→last) against the implement step's *real* `start`→`complete` duration. When ≥ 3 ai finishes span less than **`MIN_CADENCE_SPAN_PCT` (5%)** of the step, the run FAILs — that is a batch dumped at the end masquerading as live cadence (the spec-136 baseline: 13 finishes across 0.22% of a 6m40s step). Non-zero gaps alone pass the old `task-cadence` info row, so this span ratio is what actually catches the burst. `by:extension` backstop finishes are exempt — the end-of-step hook legitimately clusters.
- **`entries-match-format`** validates **every** `history[]` entry against the schema's `historyEntry` definition (required keys present, `step`/`kind`/`by` in enum, `substep` string|null, `task` a string when present, `at` parseable). A single malformed entry FAILs the run.

The eval **loads `CANONICAL_STEPS` / `CANONICAL_STATUSES` / `VALID_BY` (and the entry `required` list) from `src/core/types/spec-context.schema.json`** at startup (walking up to the repo root), falling back to inline constants only if the schema is unreadable. The schema is the single vocabulary source, so the eval's allowed-value lists cannot drift from the format definition. When the capture model changes, update both this doc and the eval in the same change — but the enums now follow the schema automatically.

## Related documents

- `docs/architecture.md` — structural overview of the codebase.
- `docs/spec-context-schema.md` — the on-disk `.spec-context.json` schema.
- `docs/template-profiles.md` — the Companion workflow & pipeline-shape reference.
- `docs/viewer-states.md` — how captured state drives the viewer.
