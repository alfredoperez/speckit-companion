# Quickstart — Verifying Timing fidelity v2

How to exercise and verify the feature end-to-end. Mirrors the issue's Acceptance section.

## Prerequisite — install the rebuilt extensions

The new behavior is invisible until both rebuilt extensions are installed (the deployed pre-#213 build's dispatch instructions override the new bodies). From the repo:

```bash
/install-local        # bumps version + installs the VS Code extension AND the spec-kit companion extension locally
```

Confirm the spec-kit side is active: `.specify/presets/<id>/` exists and the re-emitted body (e.g. `.claude/skills/speckit-plan/SKILL.md`) carries the `speckit-companion:timing` partial in its finish-only form. (Do **not** use `specify preset resolve` — it reports template overrides only.)

## US1 + US3 — honest timing on a real run

1. Run a full pipeline on a throwaway spec: `/speckit.specify …` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.
2. Inspect the timeline: `python3 .claude/skills/eval-speckit-extension/check_capture.py specs/<NNN>-<slug>/`
3. **Expect**:
   - `per-task-substeps`: one finish event per task, `substep==task`.
   - `per-task-no-duplicates`: each task has ≤1 finish (no repeated `(task, kind)`).
   - `task-cadence`: source `live` (script-stamped), gaps **non-zero** — no `0s` ticks, no end-of-step burst.
   - No two substeps (plan `research`/`design`, tasks `generate`) share a timestamp.
4. **US3 backstop**: if the assistant closed implement before journaling each task, the `after_implement` hook still fills every task — `per-task-matches-tasksmd` shows `MISSING []`.

## US2 — profile toggle activates the preset

1. In VS Code settings set `speckit.companion.templateProfile` to `lean` (no manual `specify preset …` command).
2. **Expect**: `.specify/presets/companion-lean/` exists, `.specify/presets/companion-standard/` does not.
3. Run `/speckit.plan` on a fresh spec → lean document shape (drops data-model/research/contracts/quickstart/checklist).
4. Flip to `standard` → `companion-standard` present, `companion-lean` gone. Flip to `off` → neither present.

## Acceptance gate — eval green on both profiles

```bash
python3 .claude/skills/eval-speckit-extension/check_capture.py --strict specs/<standard-run>/   # exit 0
python3 .claude/skills/eval-speckit-extension/check_capture.py --strict specs/<lean-run>/       # exit 0
```

Both must exit 0. Run the umbrella eval skill for the full report: `/eval-speckit-extension`.

## Unit tests

```bash
npm test    # reconciler (bundled-path activation), stepHistoryDerivation (finish-delta), specContext writers
```

> Reminder: after manual play, restore the demo fixtures — `git restore specs/_00_demo-specified specs/_01_demo-planned specs/_02_demo-tasked`.
