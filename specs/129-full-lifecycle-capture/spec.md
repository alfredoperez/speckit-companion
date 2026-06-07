# Spec: Full Lifecycle Capture

**Slug**: 129-full-lifecycle-capture | **Date**: 2026-06-07

## Summary

Step 1 proved one spec-kit lifecycle hook (`after_specify`) can fire, run `write-context.py`, and write the Companion-canonical `.spec-context.json` end-to-end. This step extends that proven chain to the entire pipeline — registering `after_plan`, `after_tasks`, and `after_implement` hooks, journaling each task completion inside implement, and adding a stdlib-only `derive-from-files.py` that reconstructs state from the on-disk artifacts plus git when a hook didn't fire. After this step, `.spec-context.json` is a complete event journal of any pipeline run, and a missing or stale state file is recoverable rather than fatal. This is ROADMAP step 2 (see `speckit-extension/ROADMAP.md`).

## Requirements

### Full lifecycle hooks

- **R001** (MUST): Register three new lifecycle hooks in `speckit-extension/extension.yml` — `after_plan`, `after_tasks`, and `after_implement` — each firing a companion capture command that runs `write-context.py` with the step/status for that lifecycle event. They sit alongside the existing `after_specify` hook without removing or breaking it.
- **R002** (MUST): Each hook writes the canonical `currentStep` + `status` pair for its event and appends a `transitions[]` entry with `by: "extension"` — `after_plan` → `currentStep: plan` / `status: planned`; `after_tasks` → `currentStep: tasks` / `status: ready-to-implement`; `after_implement` → `currentStep: implement` / `status: implemented`. These match the canonical vocabulary in `src/core/types/specContext.ts`.
- **R003** (MUST): Each new hook is `optional: false` so it auto-runs with no agent prompt, matching the `after_specify` hook's behavior (not the `git` extension's `optional: true` commit hooks).
- **R004** (MUST): The captures reuse the existing `write-context.py` writer and its guarantees (read-then-merge, append-only `transitions`, atomic write, no-backward-clobber, legacy `done` rejection) without forking a second writer. Per-step values are supplied via the existing `--step` / `--status` / `--by` flags.
- **R005** (MUST): Register the three new hooks in this repo's `.specify/extensions.yml` manual-testing fixture (and the installed `.specify/extensions/companion/` copy) so a real `/speckit.plan`, `/speckit.tasks`, and `/speckit.implement` trigger the companion captures alongside the existing `git` commit hooks.

### Derive-from-files fallback

- **R006** (MUST): Ship `speckit-extension/scripts/derive-from-files.py` — stdlib-only, runnable anywhere `python3` is available — that scans a `specs/<NNN>-<slug>/` directory and infers `currentStep` + `status` from which artifacts exist (`spec.md` → specify/specified, `plan.md` → plan/planned, `tasks.md` → tasks/ready-to-implement, all tasks completed → implement/implemented) plus matching git history.
- **R007** (MUST): The derive writer emits the same canonical `.spec-context.json` schema as `write-context.py` (same step/status vocabulary, same `transitions[]` shape) and tags its appended transition with an authorship value identifying it as a derived capture (e.g. `by: "derive"`).
- **R008** (MUST): Derive resolves the target feature directory using the same precedence as `write-context.py` (`--feature-dir` → `SPECIFY_FEATURE_DIRECTORY` → `SPECIFY_FEATURE` → `.specify/feature.json` → git branch prefix) and reuses that resolution rather than a "most-recently-modified" heuristic.
- **R009** (MUST): Derive is read-then-merge and never regresses a more-advanced spec — it honors the same no-backward-clobber guard and terminal-status protection as `write-context.py`, so running it against a spec whose hooks already captured a later step does not drag it backward.
- **R010** (SHOULD): Derive treats task completion by reading task markers in `tasks.md` (checked vs unchecked) to distinguish `ready-to-implement` (tasks exist, not all done) from `implemented` (all tasks done), so a partially-implemented spec is not reported as finished.

### Per-task journaling

- **R011** (MUST): The implement capture appends a transition per task completion — not only one transition per stage — so `.spec-context.json` records the granular progression through `tasks.md` during implementation.
- **R012** (MUST): Per-task transitions remain append-only and preserve every existing/unknown top-level key, consistent with the step-1 write contract; replaying or re-running implement never rewrites or shrinks the journal.

### Regression tests

- **R013** (MUST): Ship committed regression tests (replacing step 1's throwaway-probe verification) covering: append-only transitions, no-backward-clobber, and unknown-key preservation for the lifecycle captures.
- **R014** (MUST): The test suite includes a "rebuild from scratch via derive" round-trip — delete the state file, run `derive-from-files.py`, and assert the reconstructed `currentStep`/`status` matches the on-disk artifacts within one step's accuracy.
- **R015** (SHOULD): Tests run with stdlib `python3` only (no new third-party dependency), consistent with the agent-agnostic, Python-only posture of the extension.

## Scenarios

### A full pipeline leaves a complete journal

**When** a developer runs the full pipeline (`/speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement`) on a fresh spec with the `companion` extension registered
**Then** each lifecycle hook auto-fires its capture and `.spec-context.json` ends with a complete, append-only `transitions[]` journal stepping specify→plan→tasks→implement, with `status` ending at `implemented` and per-task transitions recorded during implement.

### A skipped hook is recoverable from disk

**When** a hook didn't fire for a step (agent-mediated best-effort) and `.spec-context.json` is missing or stale
**Then** running `derive-from-files.py` against that feature dir reconstructs `currentStep`/`status` from the on-disk artifacts plus git, writing the same canonical schema, within one step's accuracy of the true state.

### Derive never regresses an advanced spec

**When** `derive-from-files.py` runs against a spec whose state file already records a later step or a terminal status (e.g. `implemented`/`archived`)
**Then** the no-backward-clobber guard leaves the existing state intact and does not drag it back to an earlier inferred step.

### Partial implementation is not reported as done

**When** `tasks.md` has some tasks unchecked and derive runs
**Then** it reports `status: ready-to-implement`, not `implemented`, because not all task markers are complete.

### Lifecycle captures preserve Companion-owned fields

**When** any of the new hooks fires on a feature whose `.spec-context.json` carries Companion-owned keys (e.g. `reviewComments`)
**Then** the read-then-merge writer appends the new transition and updates step/status while preserving every pre-existing top-level key.

## Non-Functional Requirements

- **NFR001** (MUST): All writes remain atomic (temp file + rename) and `transitions` append-only, matching the step-1 write contract.
- **NFR002** (MUST): Every capture and the derive path are best-effort — a missing `python3`, unresolved feature directory, or failed write warns to stderr and exits 0, never failing the host spec-kit command.
- **NFR003** (SHOULD): `derive-from-files.py` is stdlib-only and shares resolution/guard logic with `write-context.py` rather than duplicating it where practical.

## Out of Scope

- `/speckit.companion.status` and `/speckit.companion.resume` commands — they *consume* this journal (ROADMAP step 3); this step only produces the data.
- Any change to the SpecKit Companion VS Code GUI — the canonical schema already covers every step and status, so no GUI work is expected.
- Namespaced own-pipeline commands, templates/presets, complexity detection, living-specs/drift, and auto-mode workflow (ROADMAP steps 4+).
