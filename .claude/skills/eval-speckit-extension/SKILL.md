---
name: eval-speckit-extension
description: Evaluate the speckit-extension end-to-end against a real spec — verify lifecycle hooks fired, .spec-context.json captured each step into canonical history[], timing is real (not backfilled), and per-task execution was journaled. Umbrella eval for the spec-kit-side extension; grows as features land (auto-mode, etc.). Use when the user says "/eval-speckit-extension", "verify the extension worked", "did the hooks fire", "check the capture", or just ran a /speckit.* spec and wants it validated.
---

# Eval: speckit-extension

The regression net for the `speckit-extension` (the spec-kit-side half of SpecKit Companion). It verifies the assumptions behind each feature against a **real spec the user created**, combining a deterministic file checker with a conversational cross-check of what the user actually did this session. Re-run it whenever a lifecycle/auto-mode/future feature ships.

Eval areas (add a section per feature as the extension grows):
1. **Lifecycle capture** (shipped) — hooks → `write-context.py` → canonical `history[]`; per-task journaling; derive-from-files fallback.
2. _Auto-mode_ (future) — add checks here when it lands.
3. _…_

## Steps

### 1. Resolve the target spec

- If the user named a spec (`NNN` or a dir), use `specs/<that>/`.
- Else pick the spec the user most recently created/ran in **this conversation** (whose `/speckit.*` or `/sdd:*` commands appear above). Fall back to the most recently modified `specs/*/` containing `.spec-context.json`.

### 2. Run the deterministic checker

```bash
python3 .claude/skills/eval-speckit-extension/check_capture.py specs/<NNN>-<slug>/
```

Read the PASS/FAIL/INFO rows and the timing breakdown. (`--json` for machine output; `--strict` to exit non-zero on any FAIL.)

### 3. Conversational cross-check

The checker can't know what the user *did*. Reconstruct it from this conversation and reconcile against the capture:

- List every `/speckit.specify|plan|tasks|implement` (or `/sdd:*`) the user ran this session, with rough timestamps.
- For each, confirm a matching `history[]` entry exists with the expected `step`/`status` and `by: "extension"` (hook fired) — or `by: "ai"` if the AI appended it, `by: "derive"` if reconstructed. (The canonical `by` vocabulary is `extension`/`user`/`cli`/`ai`/`derive`.)
- **Timing reality:** does each capture's `at` land *just after* the command ran (live hook), or are timestamps clustered/round (backfilled)? The `timestamps-real` check flags round-ms; you add the "fired at the right moment" judgement.
- **Task execution:** if `/speckit.implement` ran, confirm per-task substep entries appear. Read `task-cadence`'s **source**: `live (by:ai)` means the AI journaled each task as it finished — non-zero gaps are the real-cadence signal; `hook burst (by:extension)` means the single end-of-step hook synced them — 0ms gaps are *expected* there and not a defect (the AI didn't journal live, so the hook backstopped). Only a *mixed* or duplicated picture is a smell.

### 4. Score the assumptions

Render a verdict table (PASS / PARTIAL / FAIL + one-line evidence):

| # | Assumption (lifecycle capture) |
|---|------------|
| A1 | Each lifecycle step the user ran produced a capture (`after_specify/plan/tasks/implement` → a `history[]` entry). |
| A2 | Writes use canonical `history[]` with explicit `kind` — no legacy `transitions[]`/`stepHistory`. |
| A3 | Timing is real **for deterministic writes** (`by:extension`/`derive`/`cli`/`user`): ms-precision and monotonic (`timestamps-real`/`timestamps-monotonic` check these only). `by:ai` entries carry second precision (`date -u +%SZ`) and may burst — that's graded by `task-cadence`, not failed. See `docs/capture-and-timing.md`. |
| A4 | `/speckit.implement` journaled per-task progress as implement **substeps** (`substep == task id`), matching `tasks.md` completed markers. |
| A5 | No-backward-clobber held — no step regressed; an advanced/terminal spec was never dragged back. |
| A6 | (On demand) `derive-from-files.py` reconstructs the same state from artifacts when a hook didn't fire. Test: back up `.spec-context.json`, delete it, run `python3 speckit-extension/scripts/derive-from-files.py --feature-dir specs/<NNN>-<slug>`, diff, restore. |
| A7 | Per-task journaling is **deduped** — each task carries one `start` + one `complete`, so dedup is checked per `(task, kind)` (`per-task-no-duplicates`); a repeated `(task, kind)` means the `after_implement` hook re-added an already-journaled entry. Live AI entries (`by: ai`, real `date -u` timing) are the cadence source. Real per-task cadence requires `task-cadence` source `live (by:ai)` with non-zero gaps; a `hook burst` source means the AI didn't journal live and the hook backstopped (correct final state, coarse timing — not a defect). |

End with a one-paragraph plain verdict: did the extension work, and where reality diverged from the assumptions.

## Extending

When a feature ships:
- add a deterministic assertion to `check_capture.py` (`run_checks`) and, if it's a new area, a new eval section + assumption block above,
- keep `VALID_BY` / `CANONICAL_STEPS` / `CANONICAL_STATUSES` in `check_capture.py` in sync with `src/core/types/spec-context.schema.json` (the jest drift guard locks schema↔TS; this is the eval side).
