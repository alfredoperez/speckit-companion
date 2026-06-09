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
| `after_implement` hook | `write-context.py --tasks-file` → `sync_tasks()` (run by `speckit.companion.capture-implement`) | `extension` | a **single finish** per task not already journaled (finish-only backstop), then the implement step's **complete** — all stamped with the script's own clock |
| Other lifecycle hooks | `write-context.py` (run by `speckit.companion.capture*`) | `extension` | step **start** (plan→planned, tasks→ready-to-implement, …) |
| Reconstruction fallback | `speckit-extension/scripts/derive-from-files.py` | `derive` | state rebuilt from on-disk artifacts when a hook never fired (same start+complete shape) |

These carry **sub-second (ms) precision** because they read the real clock at write time, and they are monotonic because they fire in order.

### 2. Best-effort AI journaling — coarse, NOT guaranteed

The **timing partial** — baked into every companion preset command body (`speckit-extension/presets/_shared/timing-partial.md`) and injected into the GUI dispatch preamble by `src/ai-providers/promptBuilder.ts` — *instructs* the AI to append entries with `by: "ai"` using a live `date -u +"%Y-%m-%dT%H:%M:%SZ"`, for the steps the scripts don't own:

- **Self-close — plan/tasks/clarify/analyze only.** When one of those step's own work ends, append `{step, substep:null, kind:"complete", by:"ai", at:<date -u>}`. **specify** and **implement** are deliberately excluded — they are closed deterministically by scripts (see §1), so an `ai` complete there would duplicate the script's.
- **Substeps live.** Each substep boundary (plan: `research`, `design`; tasks: `generate`) appends its own entry the moment it finishes.

Per-task timing is journaled **live by the AI via a script** (finish-only): after each task it runs `write-context.py --task <id> --kind complete`, appending **one** finish event per task. Because a script stamps it, this carries **ms precision** and honest deltas (the gap between consecutive finishes is each task's real duration) — not hand-authored JSON. The `after_implement` hook is the backstop that fills any task the live path missed (§1). The remaining genuinely-hand-authored `by:ai` entries — the plan/tasks/clarify/analyze self-closes and the single-finish substep boundaries — carry **second precision** and are only as accurate as the AI's discipline allows.

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

The remaining `by:ai` writes are the plan/tasks/clarify/analyze self-closes and substep boundaries. History: `Projects/speckit companion/backlog/specify-duration-and-duplicate-start.md`.

## Finish-only journaling (2026-06-08, v2)

The 2026-06-08 fix above made per-task capture *reliable* (the hook owns it) but at the cost of *cadence*: writing a `start` **and** a `complete` for each task at one end-of-step instant produces `0s` ticks (start == complete) and a burst (all tasks share a tight window). v2 moves to a **finish-only** model that recovers honest cadence without re-introducing hand-authored JSON:

- **One finish per task/substep.** A task or substep records a *single* `complete` event — never a start+complete pair. Its duration is the gap to the previous finish (the first measured from the step's `start`). No pair → no `0s` tick; deltas → no unattributed inter-task gap.
- **Live, via a script.** The AI runs `write-context.py --task <id> --kind complete --by ai` as it finishes each task (the live path). A script stamps it, so it is reliable *and* honest (ms precision, real deltas). Substeps emit one hand-authored finish each.
- **Backstop hardened.** `sync_tasks()` writes finish-only too and now journals per-task **even when implement already self-closed** (`status: implemented`): its guard was narrowed from `TERMINAL_STATUSES` to `CROSS_STEP_TERMINAL` (`completed`/`archived` only), so a same-step write is never rejected. `_journaled_tasks` keeps it from duplicating a task the live path captured.
- **Parallel `[P]` caveat.** The delta model can't give each task in a parallel batch its own duration — the batch is attributed to whichever finishes last. Accepted for the common sequential case.
- **Derivation.** `src/features/specs/stepHistoryDerivation.ts` (`buildSubsteps`) computes each row from finish deltas, staying tolerant of legacy start+complete pairs and single boundary markers.
- **Both dispatch surfaces.** The instruction lives identically in `presets/_shared/timing-partial.md` (spec-kit path) and `src/ai-providers/promptBuilder.ts` (GUI path); `check-shape-parity.py` guards against a fork.

## Preset / command-override mechanism

The document *shape* (standard vs lean) and the timing partial both live in **command-body overrides**, not template files — core commands embed their own structure, and template overrides don't reach `specify` (it copies its template by literal path).

- Two presets `companion-standard` / `companion-lean` (`speckit-extension/presets/`), each `replaces:` the same **7** command bodies (`type: command`): specify, clarify, plan, tasks, analyze, implement, constitution.
- Selected by `speckit.companion.templateProfile` (`standard` | `lean` | `off`), persisted to `.specify/companion.yml`, reconciled by `src/features/settings/companionPresetReconciler.ts` (tri-state, mutually exclusive).
- `specify preset add <id>` **re-emits the agent command bodies** (e.g. `.claude/skills/speckit-specify/SKILL.md`) with the overridden body. To confirm a preset is active, check that `.specify/presets/<id>/` exists **and** the re-emitted body carries the timing partial — **not** `specify preset resolve`, which reports *template* overrides only and prints "No template…" for these `type: command` overrides (not a bug).
- **Both presets carry the identical timing partial** → switching profile changes the document shape, **not** the timing capture. A lean run will show the same timing behavior as standard.
- Per-spec override: `.spec-context.json` `profile: 'standard' | 'lean'`; `src/features/specs/profileDispatch.ts` `resolveProfileCommand` swaps `speckit.X` → `speckit.companion.X` for a lean spec across every dispatch path.

See `docs/template-profiles.md` for the full profile reference.

## Activation seam (fixed)

Previously the reconciler issued **catalog-form** `specify preset add <id>`, which silently no-opped because the presets aren't published to a catalog — they're only bundled at `.specify/extensions/companion/presets/`. The setting recorded the intent but no preset activated (default-on `standard` was inert in real projects). **Fixed:** `companionPresetReconciler.presetCommandFor` now installs the `add` op from the bundled path — `specify preset add --dev .specify/extensions/companion/presets/<id>` — while `enable`/`remove` stay id-form. Toggling `speckit.companion.templateProfile` now activates the matching preset with no manual command.

## Install paths

Capture scripts run from the **installed** extension dir, `.specify/extensions/companion/scripts/write-context.py` — never the dev-source `speckit-extension/scripts/…` (that path doesn't exist in a consumer project). The hooks reference the installed path (mirroring the git extension's `.specify/extensions/<id>/scripts/…` convention).

## The eval

`.claude/skills/eval-speckit-extension/check_capture.py` is the regression net (a tracked project skill — edit it here, it is **not** sourced from kaiju). It bakes in the reliability principle:

- **`timestamps-real` / `timestamps-monotonic`** apply strict checks only to **deterministic** writes (`by:extension`/`derive`/`cli`/`user`): those must be ms-precision and non-decreasing. `by:ai` second-precision and occasional burst is **expected**, reported as cadence quality — not a failure.
- **`per-task-no-duplicates`** pairs by `(task, kind)`: finish-only means a task carries a single `complete` (a `start` may still appear on legacy specs). Only a repeated `(task, kind)` is the real dedup-failure signal (the backstop re-adding a task the live path already journaled).
- **`task-cadence`** reports its source: `live (by:ai, script-stamped)` (non-zero gaps are the honest-cadence signal) vs `backstop (by:extension, end-of-step)` (near-zero gaps acceptable, not a defect).

When the capture model changes, update both this doc and the eval in the same change — keep `VALID_BY` / `CANONICAL_STEPS` / `CANONICAL_STATUSES` in `check_capture.py` in sync with `src/core/types/spec-context.schema.json`.

## Related documents

- `docs/architecture.md` — structural overview of the codebase.
- `docs/spec-context-schema.md` — the on-disk `.spec-context.json` schema.
- `docs/template-profiles.md` — the standard/lean profile reference.
- `docs/viewer-states.md` — how captured state drives the viewer.
