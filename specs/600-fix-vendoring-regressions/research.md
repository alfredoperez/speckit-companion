# Research: Fix 0.20.2 Vendoring Regressions

## R1 — Where the guarded shapes live today

**Decision**: Restore each guard to the exact shape the issue documents from 0.20.1; this repo's own history never carried the guarded `_apply_moves` (the guarded copy lived in the vendored downstream reviewed in aiwynai/aiwyn#1862), so the issue's before/after code is the authoritative reference, not a git revert.
**Rationale**: `git log -S "a return value would never arrive"` finds no commit in this repo; the issue quotes the deleted docstring and guard lines verbatim.
**Alternatives considered**: Reverting a commit — rejected, no such commit exists here.

## R2 — Rollback accumulator ownership

**Decision**: `_apply_moves(root, plans, use_git, done)` appends to a caller-owned `done` list and returns `None`; `relocate()` initializes `done: list[tuple[str, str]] = []` before the `try` and calls `_apply_moves` as the first statement inside it.
**Rationale**: `_move` raises `OSError` from `os.makedirs`/`os.replace`; with a return value, a mid-batch raise means the caller never receives the partial list, so `_rollback` in the `except` has nothing to undo. Appending in place makes the partial set visible to the handler.
**Alternatives considered**: Catching inside `_apply_moves` and returning the partial list with the error — rejected, it forks the transaction's error handling into two places and diverges from the documented 0.20.1 shape.

## R3 — Derive dedup guard

**Decision**: Wrap the `kind: "start"` append in `derive()` with `if not wc._has_step_start(log, step, None):`, mirroring `write-context.update_context` (line 163: `if not _has_step_start(log, step, substep)` — derive always writes step-level entries, so `substep` is `None`).
**Rationale**: The sibling writer guards; the two writers of the same log must agree, and the capture-runtime living spec pins "an entry is de-duplicated" as a requirement.
**Alternatives considered**: Deduplicating at read time — rejected, the log is the durable record and every other writer keeps it clean at write time.

## R4 — Atomic registry write

**Decision**: `_write_registry` in `register-capability.py` writes to `config_path + ".tmp"` then `os.replace(tmp, config_path)`, byte-matching `relocate-capability._write_config`'s write tail.
**Rationale**: The issue says to match that implementation exactly rather than invent a second writer; `_write_config` is the surviving atomic sibling for the same file.
**Alternatives considered**: Extracting a shared writer into `companion_config.py` — rejected for this fix: it widens the diff beyond restoring lost behavior, and the two writers differ in how they obtain the spliced content.

## R5 — Which node carries the misnumbered step

**Decision**: `speckit-extension/nodes/implement/complete.md` line 7 opens with `5.`; the preceding node `implement-exec.md` ends at `6.`, so the fix is `5.` → `7.` in `complete.md`, then `assemble-nodes.py` regenerates the bodies and `capture-golden.py` re-blesses the frozen baseline as a deliberate separate act.
**Rationale**: Command bodies are generated (companion-commands living spec); the parity gate compares assembled bodies against the golden, so an intentional wording change requires an explicit re-bless with its own visible diff.
**Alternatives considered**: Editing `commands/speckit.companion.implement.md` directly — rejected, the assembly gate would fail and the edit would be overwritten on the next build.

## R6 — Test placement

**Decision**: Rollback and atomic-write regression tests go in `speckit-extension/tests/test_living_specs.py` (already loads the `relocate` and `regcap` modules); the derive-dedup test goes in `speckit-extension/tests/test_context.py` (already imports `derive-from-files` as `derive_mod`).
**Rationale**: Both suites already build the fixtures (registry roots, spec dirs) these tests need; a new file would duplicate the module-loading boilerplate for hyphenated script names.
**Alternatives considered**: A dedicated regression-test file — rejected as boilerplate duplication.
