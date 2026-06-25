# Implementation Plan — Fold-back / archive-as-merge (LS·3)

**Issue:** #363 · Surface: spec-kit extension (`speckit-extension/**`)

## Technical context

- **Language:** Python 3 (stdlib only) for the fold script; Node ESM for the bench harness.
- **Builds on:** LS·1 resolver (`speckit-extension/scripts/resolve-spec-paths.py`) and LS·2 recording path (`write-context.py --living-specs`, `set_living_specs_loaded`).
- **Storage:** `capabilities/<name>/spec.md` (living specs); `.spec-context.json` per spec dir (`livingSpecs.synced`, additive — kept OUT of the strict capture schema like `livingSpecs.loaded`).
- **Reuse:** import resolver functions (`load_living`, `match_changed`, `_resolve_spec`) rather than re-interpreting config.

## Approach

### 1. Fold script — `write-context.py --fold-living-spec`

Add a new subcommand to `write-context.py` (sibling of `set_living_specs_loaded`). It:

1. **Parses the feature spec** for top-level delta blocks: `## ADDED / MODIFIED / REMOVED / RENAMED Requirements`. Each block contains one or more requirement sub-sections (heading + scenarios, OpenSpec shape). Supports an optional `<!-- capability: <name> -->` marker per block.
2. **Resolves the target capability** via the LS·1 resolver. Determines in-scope capabilities from the feature's changed files (git-derived, falling back to `--all` when the change surface is unknown) and picks the most-specific. An explicit marker overrides/adds a target.
3. **Applies deltas** to each target's `capabilities/<name>/spec.md` at requirement granularity:
   - ADDED → append requirement+scenarios.
   - MODIFIED → replace the requirement matched by heading.
   - REMOVED → delete the matched requirement.
   - RENAMED → rename the matched requirement's heading.
4. **No-op when no delta block** (common additive case). **Idempotent** — re-running folds nothing already present.
5. **Logs** a one-line per-capability sync summary and records synced capability names into `livingSpecs.synced` via a `set_living_specs_synced` helper mirroring `set_living_specs_loaded`.
6. **Opt-in / best-effort:** feature off / no config → inert, exit 0, no writes. Never fails the host command.

### 2. Wire into mark-complete

`mark-complete` already shells `write-context.py --mark-complete`. After that completion write succeeds, the command body / node also runs `write-context.py --fold-living-spec --by ai`. Command-body change → regenerate golden (`capture-golden.py`) and confirm `check-shape-parity.py` passes.

### 3. `check_living_spec.py`

New sibling of `check_capture.py` (same `Report` / `--json` shape). Given a before-spec, after-spec, and the feature spec's deltas, asserts: every ADDED requirement present in after, REMOVED gone, MODIFIED changed, RENAMED renamed, count delta correct, idempotency.

### 4. Tests + bench

- Extend `speckit-extension/tests/test_living_specs.py`: ADDED/MODIFIED/REMOVED/RENAMED, write-most-specific, the `<!-- capability -->` marker, no-delta no-op, idempotency, opt-out.
- Extend the bench harness (`ls-lib.mjs` / `ls-demos.mjs`) with an LS3 runner (`mode: real+seeded-spec`) that seeds a real `capabilities/todos/spec.md` + a real feature spec with a genuine `## ADDED Requirements` delta, runs the real fold, captures before/after + `git diff --no-index` + `check_living_spec.py` assertions to `evidence/LS3.json`.

## Files to change

| File | Change |
|---|---|
| `speckit-extension/scripts/write-context.py` | `--fold-living-spec` subcommand + delta parser + fold applier + `set_living_specs_synced` |
| `speckit-extension/commands/speckit.companion.mark-complete.md` | shell the fold after completion |
| `speckit-extension/nodes/implement/complete.md` | same fold step in the node |
| `speckit-extension/tests/golden/commands/commands__speckit.companion.mark-complete.md` | re-blessed golden |
| `speckit-extension/scripts/check_living_spec.py` (new) | fold assertions, Report/--json shape — placed beside check_capture? No: lives in scripts/ |
| `speckit-extension/tests/test_living_specs.py` | new fold tests |
| `examples/todo-claude/bench/living-specs/ls-lib.mjs` | LS3 arrange/act helpers |
| `examples/todo-claude/bench/living-specs/ls-demos.mjs` | LS3 runner |
| `examples/todo-claude/bench/living-specs/evidence/LS3.json` (new) | captured evidence |
| `speckit-extension/README.md`, `CHANGELOG.md`, `extension.yml` | docs + version bump |

> `check_living_spec.py` is a sibling of `check_capture.py` per the contract; place it in `.claude/skills/eval-speckit-extension/` next to `check_capture.py` so the bench can import it the same way. Final placement decided in tasks.

## Risks

- **Golden drift** — any change to the mark-complete body re-blesses the golden; must re-run `check-shape-parity.py`.
- **Schema regression** — `livingSpecs.synced` must stay out of the strict capture schema so `check_capture.py` stays green.
- **Parser robustness** — markdown requirement headings vary; keep parsing tolerant and best-effort.

## Summary

**Problem:** Feature specs describe how they change a capability, but that knowledge dies with the feature spec. The durable living spec never learns.

**Solution:** At mark-complete, fold the feature spec's ADDED/MODIFIED/REMOVED/RENAMED requirement deltas into the resolved capability's living spec — write-most-specific, no-op when there's nothing to fold, idempotent on re-run, and entirely opt-in. The feature spec was the proposal; the living spec becomes the record.
