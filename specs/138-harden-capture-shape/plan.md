# Plan: Harden spec-context capture — verify cadence + lock the record shape

## Summary

Make capture *verifiable* and the on-disk record *self-describing*. The eval (`check_capture.py`) gains a cadence-span check that fails a run whose `by:ai` task finishes are clustered into a tiny fraction of the implement step's real duration (the spec-136 pattern: 13 finishes across 0.9s of a 399.8s step = 0.22%), and validates every `history[]` entry against the JSON schema with its enums (`by`/steps/statuses) loaded *from* the schema so the two can't drift. The writers stop emitting two redundant fields — the `from` pointer (derivable from the prior entry) and the per-task `substep` mirror of `task` — and stop writing the date-only `updated` marker; readers stay tolerant of all three on legacy records, so prior specs keep passing and rendering.

## Technical Context

- **Language**: Python 3 (stdlib only — the eval and capture scripts), TypeScript 5.3 (ES2022, strict) for the GUI writer/derivation/types.
- **Storage**: `.spec-context.json` per spec dir; schema at `src/core/types/spec-context.schema.json` is the format authority.
- **Testing**: `check_capture.py` run against `specs/136-*` (must now FAIL on cadence) and against every prior `specs/*` (must still PASS — FR-010); Jest for TS derivation tolerance.
- **Threshold**: `MIN_CADENCE_SPAN_PCT` — informed default **5%** (low single-digit). spec-136 at 0.22% fails with ~20× margin; a healthy run spreads finishes across most of the step. Tunable; gated to `by:ai` (live-claimed) finishes only — the `by:extension` end-of-step backstop legitimately clusters and is exempt.
- **Constraint**: capture scripts are stdlib-only and best-effort (never fail the host command); the eval is a tracked project skill, not sourced from kaiku.

## Decisions

- **Which redundant fields to drop** (FR-005/FR-006): (1) `from` on `start` entries — fully derivable from the previous entry's step; (2) the `substep: "<task>"` mirror on per-task implement entries — `task` already carries the id. Per-task entries become `{step:"implement", substep:null, task:"T001", kind:"complete", by, at}`. Keep `task` as the canonical per-task identifier (it is the semantically-named field and is the dominant detection path in both the eval and TS).
- **`updated` marker** (FR-007): drop it entirely. It is date-only (`_today()`), strictly less precise than the ms-stamped `history[]` events, and no reader consumes it (grep-confirmed: no TS/webview reader). Dropping beats downgrading to ISO.
- **Backward compatibility** (FR-010): readers (`stepHistoryDerivation.ts` `sameFromStep`/`sameFromSubstep`, `_entry_kind` in `write-context.py`, `_has_complete`) already tolerate absent `from`; keep schema `additionalProperties` permissive so legacy `from`/`substep`-mirror/`updated` validate as undeclared extras. Stop *writing* them; never reject *reading* them.
- **Schema is the single vocab source** (FR-008): the eval loads `CANONICAL_STEPS`/`CANONICAL_STATUSES`/`VALID_BY` from `spec-context.schema.json` enums instead of hard-coding parallel lists.

## Approach & Structure (by file, in attack order)

1. **`src/core/types/spec-context.schema.json`** (format authority — do first; everything else conforms to it). In `$defs/historyEntry`: remove the `from` property declaration (writer no longer emits it; legacy tolerated via permissive `additionalProperties`); keep `task` optional and `substep` nullable; leave `required` as `[step, substep, kind, by, at]`. This is the FR-003/FR-004 contract.

2. **`speckit-extension/scripts/write-context.py`** (primary writer). In `update_context` start branch: drop the `from` key (and the `step_from` call). In `journal_task_finish` and `sync_tasks`: emit `substep: null` (not `substep: tid`), keep `task: tid`; update `_has_complete` to key the per-task case on `task` rather than `substep`. Remove the three `ctx["updated"] = _today()` writes (and `_today` if now unused). Leave `_entry_kind`'s legacy `from` inference intact (reads only).

3. **`speckit-extension/scripts/derive-from-files.py`** (FR-011 — the one-shot combined-artifact reconstruction). Align to the same shape: drop `from` on the step `start`; for per-task entries emit finish-only `{substep:null, task, kind:"complete"}` (drop the legacy start+complete pair and the `from`); remove `updated`. It already routes through `wc.*` shared helpers, so this is a shape edit, not a new write site.

4. **`.claude/skills/eval-speckit-extension/check_capture.py`** (the verifier — FR-001/002/003/008). (a) Load `CANONICAL_STEPS`/`CANONICAL_STATUSES`/`VALID_BY` by parsing the schema JSON (path relative to repo root); fall back to inline constants if unreadable. (b) New `entries-match-format` check: validate each `history[]` entry's field types + enums against the schema's `historyEntry` def (minimal stdlib validator — required keys present, `step`/`kind`/`by` in enum, `substep` string|null, `at` parseable). A single malformed entry → FAIL (SC-002). (c) New `task-cadence-span` FAIL check: compute implement step span (step `start.at` → step `complete.at`) and `by:ai` task-finish span (first→last); if `len(ai task finishes) >= 3` and `finish_span < step_span * MIN_CADENCE_SPAN_PCT/100`, FAIL; `by:extension` backstop finishes exempt. (d) Update `per-task-substeps` (substep is now null for tasks — assert `task` present instead of `substep==task`); keep `per-task-no-duplicates` keyed on `(task, kind)`.

5. **`src/features/specs/specContextWriter.ts`** (GUI writer). Stop building/emitting `from` (lines ~159, ~194). Per-task GUI writes (if any) follow the `substep:null`+`task` shape. No `updated`.

6. **`src/core/types/specContext.ts`** (types). Mark `from?` as legacy-read-only in the doc comment (keep the field for reading old records); update the `task` comment (no longer "equals substep"). `HistoryEntryFrom` stays for legacy parsing.

7. **`src/features/specs/stepHistoryDerivation.ts` / `stateDerivation.ts`** (readers — FR-010 verification). Confirm `sameFromStep`/`sameFromSubstep` and `e.task`/`e.substep` reads degrade cleanly when `from` is absent and `substep` is null for tasks; add/adjust a Jest case proving a record with neither `from` nor a substep-mirror derives identically.

8. **`speckit-extension/presets/_shared/timing-partial.md`** + **`src/ai-providers/promptBuilder.ts`** (FR-009 — instruction text; kept in lock-step by `check-shape-parity.py`). Strengthen the implement wording to explicitly require journaling each task finish *at the moment it completes* and to explicitly forbid dumping all finishes in one end-of-step batch. Drop the `"from": {…}` line from the promptBuilder example entry so the dispatched instruction matches the new shape.

9. **Docs** (required, same change): `docs/capture-and-timing.md` (cadence-span assertion, dropped fields, schema-as-vocab-source), `docs/spec-context-schema.md` (drop `from`, note legacy tolerance), and `speckit-extension/CHANGELOG.md` (user-facing: "malformed/bursted captures now caught"). No version bump.

10. **Verify**: run `check_capture.py specs/136-*` → expect cadence FAIL; run it across all other `specs/*` → expect zero newly-failing (SC-005); run `check-shape-parity.py` → OK.

## Constitution Check

No `.specify/memory/constitution.md` gates defined for this repo beyond the stylistic rules already in CLAUDE.md (stdlib-only scripts, isolation, docs-with-change). All satisfied — no structural violation to justify, Complexity-Tracking table omitted.

## Out of Scope

- In-flight "running now" rendering from a step-start anchor — tracked in #229; this feature is finish-only and adds no per-task `start` event.
- Migrating existing records to strip `from`/`updated`/substep-mirror on disk — they remain valid for reading (FR-010); no rewrite pass.
- A full JSON-Schema engine in the eval — a minimal field/enum validator covering `historyEntry` is sufficient (stdlib-only constraint).
- Changing the per-task delta/duration model or the parallel-`[P]` attribution limitation.
