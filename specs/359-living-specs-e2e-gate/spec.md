# End-to-end sandbox validation gate for Living Specs (LS·4)

**Issue:** #364 · **Wave:** Living Specs (Wave 4) · **Surface:** dev harness · **Type:** chore / validation

## Overview

The Living Specs production logic shipped across three earlier slices: the capability resolver (LS·1), the read path that auto-loads matching capability specs into specify and plan (LS·2), and the fold-back that merges a feature's requirement deltas into the durable living spec at mark-complete (LS·3). What was missing was a single test that proves the whole loop works together, end to end, before v1 is called done.

This work is that gate. It does not add product features. It runs the full loop on a disposable repo: one capability under a living spec, then two features in sequence — feature A is purely additive (no delta block, so the fold is a clean no-op and the living spec stays exactly as it was), and feature B carries a real requirement delta that folds in. The point is to confirm the living spec **accumulates** across both runs: it stays unchanged for the additive feature, gains feature B's new requirement, and still keeps everything that was there before. Nothing gets clobbered; it only grows.

It also proves the opt-out: with Living Specs disabled, running the same delta feature through completion produces zero living-spec side effects — the capability spec is byte-identical and no new capability files appear. Stock behavior is untouched.

The whole thing is captured as honest evidence (real script runs, real file reads, before/after snapshots and diffs) and recorded to the bench evidence file plus the vault status page.

## User Stories (prioritized)

### US1 — Two sequential features accumulate into the living spec (P1)

Starting from a baked repo with one `todos` capability and a real living spec, when I run feature A (additive, no delta) and then feature B (a real `## ADDED Requirements` delta), the living spec stays unchanged after feature A and, after feature B, contains feature B's new requirement **and** still contains everything that was there before.

**Acceptance:**
- After feature A's fold, the living spec is byte-identical to its pre-A state (clean no-op).
- After feature B's fold, the living spec contains feature B's new requirement.
- After feature B's fold, the living spec still contains the original requirement (no clobber).
- The living spec grows monotonically across the two runs (length after-B ≥ length before, with new content added).
- Real before / after-A / after-B snapshots and unified diffs are captured from real script + file reads.

### US2 — Opt-out produces zero living-spec side effects (P1)

In a sibling repo with Living Specs disabled (`enabled: false`), running the same delta feature through the fold produces no living-spec writes at all.

**Acceptance:**
- `capabilities/todos/spec.md` is byte-identical before and after.
- No new `capabilities/**` files are created.
- No `livingSpecs.synced` field is recorded.

### US3 — Evidence is honest and repo-relative (P1)

Every value in the evidence comes from a real `execFileSync` / `readFileSync`. If any live step does not settle, the verdict is `INCONCLUSIVE`, never a fabricated pass. Paths in the committed evidence are repo-relative — no absolute home paths or usernames.

**Acceptance:**
- Evidence is written to `examples/todo-claude/bench/living-specs/evidence/LS4.json`.
- `mode` is honest per run: `real+seeded-spec` for the accumulation runs, `deterministic` for the opt-out.
- A `verdict` of `PASS` / `INCONCLUSIVE` reflects whether the live steps settled.

## Functional Requirements

### Accumulation demo (mode = real+seeded-spec)
- Bake one throwaway repo with a `todos` capability + a real living spec.
- Run feature A (ADDITIVE, no delta block) through the real fold — assert a clean no-op (living spec byte-identical).
- Run feature B (a real `## ADDED Requirements` delta) through the real fold — assert it folds in.
- Assert monotonic accumulation: after-A == before; after-B contains B's new requirement AND everything from before; no clobber.
- Capture real before / after-A / after-B snapshots and unified diffs.

### Opt-out run (mode = deterministic)
- Bake a sibling repo with `enabled: false`.
- Run the same delta feature through the fold.
- Assert byte-equality of the capability spec before/after and an empty `capabilities/**` file-tree diff (no new files).
- Record the byte-equality boolean and the empty file-tree diff.

### Harness & evidence
- Reuse the existing bench harness (`ls-lib.mjs`, `ls-demos.mjs`) and the merged scripts (`resolve-spec-paths.py`, `write-context.py --fold-living-spec`, `check_living_spec.py`). Do not rebuild production logic.
- Add only a thin extension to drive two sequential folds + the opt-out, reusing `cloneDir` / `gitInitCell` / `resetFolder` / `stripCompanion`.
- Capture to `evidence/LS4.json` per the evidence contract (commands, file-tree diff, before/after + unified diffs, assertions, mode, verdict).
- Append an LS·4 section to the vault status page and flip the LS·4 board row to shipped; bump the page's shipped count (LS·4 is the v1 gate).

## Non-Functional Requirements

- **NFR001 — honesty:** every captured value is real (`execFileSync` / `readFileSync`); no value is hand-authored to fake a pass. Live steps that fail to settle set `verdict: INCONCLUSIVE`.
- **NFR002 — path hygiene:** committed evidence carries only repo-relative paths; no `/Users/` or username leaks.
- **NFR003 — no production change:** this is a validation gate. Any genuinely-new production helper (unlikely) stays minimal and tested.

## Out of Scope

- Drift detection and any further Living Specs features (post-v1).
- Authoring deltas in the GUI.
- A live-AI specify/plan run inside the harness (out of the harness's scope; the AI-authored prose is seeded so only the fold under test runs real).

## Open question resolved

LS·4 reuses the LS·3 fold helpers (`bakeLs3Repo`-style arrange, `runFold`, `unifiedDiff`, `runCheckLivingSpec`) rather than introducing a new fold path — the accumulation story is two sequential `runFold` calls against one repo, with feature A's spec carrying no delta and feature B's carrying a real one.
