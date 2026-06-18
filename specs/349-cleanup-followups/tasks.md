# Tasks: Cleanup follow-ups (#349)

Dependency-ordered. T001 (shared helpers) lands first; T002/T005 build on it.

- [x] **T001** Extract `_open_ctx_or_none(feature_dir)` → `(ctx, log, branch)` and `append_complete(log, step, *, substep, task, by, at)` helpers in `speckit-extension/scripts/write-context.py`, and route `journal_finish`, `update_context`, `materialize_log`, `_fold_task_finish`, `mark_spec_complete`, `sync_tasks` through them + `speckit-extension/scripts/write-context.py`
- [x] **T002** Read `tasks.md` once per task finish: thread parsed `(all_ids, done_ids)` markers from `_fold_task_finish` into `_maybe_close_implement` so it derives the 100% verdict from the markers it already parsed + `speckit-extension/scripts/write-context.py`
- [x] **T003** [P] Wrap the bench framing in `<!-- BENCH START -->`/`<!-- BENCH END -->` markers and mark the bench-target phrase + vitest comment in `examples/todo-claude/CLAUDE.md` + `examples/todo-claude/CLAUDE.md`
- [x] **T004** Make `presentAsCleanApp` strip between the BENCH markers and throw loudly on a missing expected marker, instead of fragile literal replacements, in `examples/todo-claude/bench/sync-templates.mjs` + `examples/todo-claude/bench/sync-templates.mjs`
- [x] **T005** GC `.spec-context.events.jsonl` once the implement step closes (in `_maybe_close_implement` after the fold, and in the `--mark-complete` path), never dropping un-folded lines, in `speckit-extension/scripts/write-context.py` + `speckit-extension/scripts/write-context.py`
- [x] **T006** [P] Add python tests: event log absent after step close, GC preserves all folded finishes, threaded-markers close path, in `speckit-extension/tests/test_context.py` + `speckit-extension/tests/test_context.py`
- [x] **T007** [P] Add a bench smoke test asserting a baked cell's CLAUDE.md has zero `bench` references, in `examples/todo-claude/bench/sync-templates.test.mjs` + `examples/todo-claude/bench/sync-templates.test.mjs`
- [x] **T008** Run the full verification gate (compile, jest, assemble-check, shape-parity, python unittest, node bench tests) and update docs/changelog/version + docs/capture-and-timing.md, speckit-extension/CHANGELOG.md, speckit-extension/extension.yml
