# Tasks: Harden spec-context capture — verify cadence + lock the record shape

Organized by execution layer and file dependencies. The schema is the format authority, so it goes first; every writer/reader/eval conforms to it. Traceability is to files and `FR-…` requirements.

## Setup

_No setup tasks — all changes land in existing files; stdlib-only scripts, no new deps._

## Foundational (blocking — everything downstream conforms to this)

- [x] **T001** Update `src/core/types/spec-context.schema.json` — in `$defs/historyEntry` remove the `from` property declaration; keep `task` optional, `substep` nullable; leave `required: [step, substep, kind, by, at]`; confirm `additionalProperties` stays permissive so legacy `from`/`substep`-mirror/`updated` still validate as undeclared extras. (FR-003, FR-004, FR-010)

## Core work — one task per writer/reader/eval file (T001 blocks all)

- [x] **T002** [P] Update `speckit-extension/scripts/write-context.py` — in `update_context` start branch drop the `from` key and the `step_from` call; in `journal_task_finish` and `sync_tasks` emit `substep: null` (keep `task: tid`); rekey `_has_complete`'s per-task case on `task` instead of `substep`; remove the three `ctx["updated"] = _today()` writes (and `_today` if now unused); leave `_entry_kind` legacy `from` inference intact (read-only). (FR-005, FR-006, FR-007)
- [x] **T003** [P] Update `speckit-extension/scripts/derive-from-files.py` — align the one-shot combined-artifact path to the same shape: drop `from` on the step `start`; emit finish-only per-task entries `{step:"implement", substep:null, task, kind:"complete"}` (drop the legacy start+complete pair); remove `updated`; keep routing through shared `wc.*` helpers. (FR-011, FR-005, FR-006, FR-007)
- [x] **T004** [P] Update `src/features/specs/specContextWriter.ts` — stop building/emitting the `from` object on start entries (~L159, ~L194); per-task GUI writes follow the `substep:null`+`task` shape; never write `updated`. (FR-005, FR-006, FR-007)
- [x] **T005** [P] Update `src/core/types/specContext.ts` — mark `from?` as legacy-read-only in its doc comment (keep the field + `HistoryEntryFrom` for parsing old records); revise the `task` comment so it no longer claims it "equals substep". (FR-010)
- [x] **T006** Update `.claude/skills/eval-speckit-extension/check_capture.py` — (a) load `CANONICAL_STEPS`/`CANONICAL_STATUSES`/`VALID_BY` by parsing `spec-context.schema.json` enums (path relative to repo root), falling back to inline constants if unreadable; (b) add `entries-match-format` check — a minimal stdlib validator over each `history[]` entry against the `historyEntry` def (required keys present, `step`/`kind`/`by` in enum, `substep` string|null, `at` parseable); a single malformed entry → FAIL; (c) add `task-cadence-span` FAIL check — compute implement step span (`start.at`→`complete.at`) and `by:ai` task-finish span (first→last); when `len(ai task finishes) >= 3` and `finish_span < step_span * MIN_CADENCE_SPAN_PCT/100`, FAIL, with `by:extension` backstop finishes exempt and `MIN_CADENCE_SPAN_PCT` defaulting to `5`; (d) update `per-task-substeps` to assert `task` present (substep now null) and keep `per-task-no-duplicates` keyed on `(task, kind)`. (FR-001, FR-002, FR-003, FR-008)

## Integration — instruction text kept in lock-step (depends on T001 shape)

- [x] **T007** [P] Update `speckit-extension/presets/_shared/timing-partial.md` — strengthen the implement wording to require journaling each task finish *at the moment it completes* and to explicitly forbid dumping all finishes in one end-of-step batch. (FR-009)
- [x] **T008** [P] Update `src/ai-providers/promptBuilder.ts` — apply the same implement-cadence wording as T007 and drop the `"from": {…}` line from the example history entry so the dispatched instruction matches the new shape; keep it parity-clean for `check-shape-parity.py`. (FR-009, FR-004)

## Verification — readers degrade cleanly + suite green (depends on the core writers/eval)

- [x] **T009** Update `src/features/specs/stepHistoryDerivation.ts` (and confirm `stateDerivation.ts`) — verify `sameFromStep`/`sameFromSubstep` and the `e.task`/`e.substep` reads degrade cleanly when `from` is absent and `substep` is null for tasks; add/adjust a Jest case proving a record with neither `from` nor a substep-mirror derives identically to a legacy one. (FR-010)
- [x] **T010** Run the eval gates — `check_capture.py specs/136-*` must now FAIL on cadence (FR-002); run `check_capture.py` across every other `specs/*` and confirm zero newly-failing (FR-010, SC-005); run `check-shape-parity.py` → OK; run `npm test` for the TS derivation tolerance. (SC-001, SC-002, SC-005)

## Polish — docs in the same change

- [x] **T011** [P] Update `docs/capture-and-timing.md` — document the cadence-span assertion, the dropped `from`/`updated`/substep-mirror fields, and schema-as-single-vocab-source. (FR-001, FR-005, FR-008)
- [x] **T012** [P] Update `docs/spec-context-schema.md` — drop `from` from the documented entry shape and note legacy read tolerance. (FR-004, FR-010)
- [x] **T013** [P] Prepend a `speckit-extension/CHANGELOG.md` entry — user-facing: malformed/bursted captures are now caught; no version bump. (Docs)

## Dependencies

- **T001 (schema) blocks everything** — it is the format contract the writers, readers, eval, and instruction text conform to.
- **T002–T005** (writers/types) depend only on T001 and touch separate files → parallelizable.
- **T006** (eval) depends on T001 (loads its enums + validates against `historyEntry`); independent of the writers' edits but should land alongside them.
- **T007–T008** (instruction text) depend on T001's settled shape (drop `from` from the example) → parallelizable with each other.
- **T009** (reader verification + Jest) depends on T002/T004 producing the new shape.
- **T010** (verification gates) depends on T002, T003, T006 being in place — run last among code tasks.
- **T011–T013** (docs/changelog) depend on the behavior being settled (T006 cadence rule, T002/T003 dropped fields) → parallelizable.

## Parallel

- **Writers/types batch:** T002, T003, T004, T005 — all `[P]`, distinct files, only T001 in front.
- **Instruction batch:** T007, T008 — both `[P]`, distinct files. (T008 also satisfies the parity contract with T007.)
- **Docs batch:** T011, T012, T013 — all `[P]`, distinct files, run together once behavior is final.
- T006 (eval) and T009/T010 (verification) are not `[P]` with each other — T010 gates on the others completing.
