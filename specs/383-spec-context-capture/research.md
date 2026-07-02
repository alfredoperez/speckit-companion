# Research: Capture the full reasoning trail

**Feature**: 383-spec-context-capture · Decisions behind [plan.md](./plan.md). Grounded in the live two-run capture experiment (stock vs Companion, 2026-07-01) and a read of the writer's existing mechanisms.

## D1 — How structured values ride a CLI flag

- **Decision**: each list flag (`--decision`, `--verified`, `--concern`) accepts **JSON-or-plain-text**: if the value parses as a JSON object with the field's identity key (`decision` / `what` / `note`), store it as-is; otherwise wrap the raw string under that key. `--expectation` stays a plain string list.
- **Rationale**: command bodies are prose executed by different AIs across 8 providers — a strict JSON-only flag would fail on the weakest emitter; a plain string still captures the signal. JSON unlocks the full shape (`why`, `rejected`, `command`, `warnings`) when the emitter can produce it.
- **Alternatives considered**: (a) *multiple paired flags* (`--decision` + `--why` + `--rejected`) — rejected: ambiguous when repeated, hard to de-dupe, triples the argparse surface; (b) *strict JSON only* — rejected: brittle for weaker CLI providers, and a lost capture is worse than a thin one.

## D2 — De-dup identity per field

- **Decision**: de-dupe additively, preserving first-seen order, keyed on the identity value — `decision` text for decisions, `what` for verifications, `note` for concerns, the string itself for expectations, `req` for coverage entries (coverage upserts: later writes replace that requirement's entry).
- **Rationale**: mirrors `set_living_specs_loaded` (ordered, de-duped, additive, no history entry) — the proven pattern for repeat-safe AI-emitted writes; idempotency is what makes "run the capture call again" safe.
- **Alternatives considered**: full-object equality — rejected: a reworded `why` would duplicate the same decision.

## D3 — Where `classification` lives

- **Decision**: a dedicated `--classification '<json>'` flag storing one object `{projectedFiles, projectedTasks, scopeSignal, verdict}`; keep the existing scalar `size` field untouched as the quick verdict readers already use.
- **Rationale**: `--set` coerces scalars only (`_coerce_value`), so an object can't ride it; and `size` is read by plan/tasks today — changing its shape would break them.
- **Alternatives considered**: four `--set` scalars (`classification_files=…`) — rejected: pollutes the top level and can't be validated as one unit.

## D4 — Timing integrity without a new on-disk field

- **Decision**: no new on-disk flag. The `by` field already distinguishes authorship; fix the **derivation** (`specContext.ts` step-history derivation) to compute durations only between extension-stamped boundaries, treating `by: ai`/`cli`/`derive` timestamps as ordering-only. Document the rule in both schema docs.
- **Rationale**: the data needed is already persisted; adding `nonDurational: true` per entry would bloat every history line and require a migration for old files.
- **Alternatives considered**: per-entry flag — rejected as redundant with `by`; writer-side synthetic durations — rejected: fabricating precision is the exact dishonesty being fixed.

## D5 — The skipped/no-op marker

- **Decision**: reuse `last_action` via the existing `--set` (zero new writer code): command bodies record e.g. `--set last_action="living specs evaluated — skipped (not configured)"` at the gate. Genuine friction goes to `--concern`.
- **Rationale**: the marker is a breadcrumb, not a list; `last_action` is exactly the "what just happened" slot and it already exists in the type.
- **Alternatives considered**: a new `skipped[]` list — rejected: audit needs "did it fire this run", not an accumulating history that would grow stale entries.

## D6 — Which layer gets the emitting calls

- **Decision**: edit the **node fragments** under `speckit-extension/nodes/` (and shared `presets/_parts/` where a rule spans commands), then regenerate the assembled commands with `assemble-nodes.py`; never hand-edit the assembled `commands/speckit.companion.*.md`.
- **Rationale**: nodes are the source of truth; the shape-parity check asserts assembled output matches, so direct edits get overwritten or fail CI.

## D7 — Coverage map shape

- **Decision**: keyed map via `--coverage-req FR-001 --tasks "T001,T002" --tests "path.test.ts::case,other.test.ts"` cloning `_upsert_task_summary` (non-destructive merge: a later call with only `--tests` fills tests without erasing tasks). Stored as `coverage: {"FR-001": {tasks: [...], tests: [...]}}`.
- **Rationale**: two-phase emission (tasks-complete writes req→tasks; implement-close fills tests) needs upsert semantics, which the task-summary pattern already proves.
- **Alternatives considered**: array-of-objects `coverage[]` — rejected: upserting into an array needs a scan; a map keyed by requirement id is the natural query shape ("is FR-004 tested?" = one lookup).

## D8 — `step_summaries` shape

- **Decision**: `--step-summary '<json|text>'` keyed by the current `--step`: `step_summaries: {plan: {summary, key_finding?, risks?}}`; plain text wraps as `{summary}`.
- **Rationale**: the type already declares `step_summaries` as skill-authored; this just gives it a reliable script writer with the same JSON-or-text tolerance as D1.

## Out of scope (confirmed unobtainable)

Model identity, token counts, and precise per-step durations require reading the AI's response back; dispatch is one-way by design. Not faked, documented as such.
