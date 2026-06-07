# Plan: Full Lifecycle Capture

**Spec**: [spec.md](./spec.md)

## Approach

Extend the proven step-1 chain (hook → command-markdown → `write-context.py` → `.spec-context.json`) to the whole pipeline by registering three more `optional: false` hooks (`after_plan`, `after_tasks`, `after_implement`), each backed by a thin per-step capture command that runs the **existing** writer with the right `--step`/`--status`. Per-task journaling rides the `after_implement` capture (companion does not own the implement loop until ROADMAP step 4), so the writer gains a batch task-sync mode that reads completed markers in `tasks.md` and appends one append-only, idempotent transition per completed task. A new stdlib `derive-from-files.py` reuses `write-context.py`'s feature-dir resolution and no-backward-clobber guard to reconstruct `currentStep`/`status` (and per-task transitions) from on-disk artifacts plus git when a hook never fired.

## Architecture

```mermaid
graph LR
  P[/speckit.plan] --> H1[after_plan hook]
  T[/speckit.tasks] --> H2[after_tasks hook]
  I[/speckit.implement] --> H3[after_implement hook]
  H1 --> C1[capture-plan.md]
  H2 --> C2[capture-tasks.md]
  H3 --> C3[capture-implement.md]
  C1 --> W[write-context.py]
  C2 --> W
  C3 --> W
  W --> J[.spec-context.json]
  D[derive-from-files.py] -. fallback .-> J
```

## Files

### Create

- `speckit-extension/scripts/derive-from-files.py` — stdlib-only derive writer; scans a `specs/<NNN>-<slug>/` for `spec.md`/`plan.md`/`tasks.md` + task markers + git history, infers `currentStep`/`status`, reuses `write-context.py`'s resolution + guards, tags transition `by: "derive"`.
- `speckit-extension/commands/speckit.companion.capture-plan.md` — runs `write-context.py --step plan --status planned --by extension`.
- `speckit-extension/commands/speckit.companion.capture-tasks.md` — runs `write-context.py --step tasks --status ready-to-implement --by extension`.
- `speckit-extension/commands/speckit.companion.capture-implement.md` — runs the writer in task-sync mode against `tasks.md`, ending at `--status implemented` when all markers are complete.
- `speckit-extension/tests/test_context.py` — stdlib `unittest` regression suite (append-only, no-backward-clobber, unknown-key preservation, derive round-trip).

### Modify

- `speckit-extension/scripts/write-context.py` — add per-task journaling: a task-sync mode that reads `tasks.md` completed markers and appends one idempotent transition per completed task (sets `currentTask`, never regresses step); factor resolution/guard helpers so `derive-from-files.py` can import them.
- `speckit-extension/extension.yml` — register the three new `provides.commands` and the `after_plan`/`after_tasks`/`after_implement` hooks (`optional: false`).
- `.specify/extensions.yml` — append the `companion` entries under `after_plan`/`after_tasks`/`after_implement`, alongside the existing `git` commit hooks.
- `.specify/extensions/companion/extension.yml` — mirror the new commands + hooks into the installed fixture copy.
- `.specify/extensions/companion/scripts/write-context.py` — mirror the updated writer.
- `.specify/extensions/companion/scripts/derive-from-files.py` — mirror the new derive script (new file in the fixture).
- `.specify/extensions/companion/commands/speckit.companion.capture-{plan,tasks,implement}.md` — mirror the new command-markdowns.
- `speckit-extension/docs/commands.md` — add the three hooks to the lifecycle table and document the new commands + the derive fallback.
- `speckit-extension/ROADMAP.md` — flip step 2 from Planned to Shipped (at implement time).
- `speckit-extension/CHANGELOG.md` — changelog entry for full lifecycle capture + derive fallback.

## Testing Strategy

- **Unit (`python3 -m unittest`)**: against a throwaway temp `specs/_zzz-*/`, assert each capture writes the correct `currentStep`/`status`; assert `transitions` is append-only across re-runs (length grows, `from` = prior state); assert unknown top-level keys (e.g. `reviewComments`) survive; assert the no-backward-clobber guard rejects an earlier-step write over a later/terminal state.
- **Derive round-trip**: build a feature dir with `spec.md`+`plan.md`+`tasks.md` (mixed task markers), delete `.spec-context.json`, run `derive-from-files.py`, assert reconstructed `currentStep`/`status` matches within one step; with all markers complete assert `implemented`, with some unchecked assert `ready-to-implement`.
- **Edge cases**: derive against a spec already at `implemented`/`archived` leaves it intact; missing `python3`/unresolvable feature dir exits 0 without writing.

## Risks

- **Per-task journaling without an owned implement loop**: the `after_implement` hook fires once, so per-task transitions are reconstructed in a batch from `tasks.md` markers rather than streamed live — Mitigation: make the writer idempotent (skip task ids already journaled) so a later live implement command (step 4) can re-sync without duplicating.
- **Fixture drift**: `speckit-extension/` and the installed `.specify/extensions/companion/` copy must stay byte-identical — Mitigation: update both in the same change and add a test (or note) that diffs the two trees.
