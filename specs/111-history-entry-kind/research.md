# Research: Explicit History Entry Kind Field

**Feature**: 111-history-entry-kind  
**Date**: 2026-05-27  
**Status**: Complete — no unresolved unknowns  

## Summary

All touch points were identified directly from the existing codebase. No external research was required — the entire scope is an internal TypeScript refactor with a well-understood legacy-migration pattern already present in the same files.

---

## Decision 1: `kind` value names

**Decision**: `"start"` and `"complete"` (not `"started"/"completed"`)  
**Rationale**: Matches the naming already in the spec description, matches the verb-noun pattern of "a `start` entry" vs "a `complete` entry" used throughout the existing code comments and `setStepStarted`/`setStepCompleted` function names. Shorter tokens reduce AI prompt cost.  
**Alternatives considered**: `"started"/"completed"` — rejected because the field names `setStepStarted`/`setStepCompleted` use past-tense for the *action*, not the entry classification.

---

## Decision 2: `from` on complete entries — omit vs null

**Decision**: Omit `from` entirely on complete entries (write the field as absent, not as `null`).  
**Rationale**: The spec says "from is omitted" for complete entries. `JSON.stringify` on an object with a missing key omits it, making round-trip clean. Presence of `from` becomes a secondary signal aligned with `kind`; consumers check `kind` first.  
**Alternatives considered**: Setting `from: null` — rejected; it's an extra byte that carries no information and would complicate the schema (the type of `from` would become `object | null` instead of `object | undefined`).

---

## Decision 3: `from` field cardinality on the TypeScript type

**Decision**: Change `HistoryEntry.from` to `from?: HistoryEntryFrom` (optional).  
**Rationale**: Complete entries don't carry `from`. Making it optional is the minimal TS change; existing call sites that read `e.from?.step` already use optional chaining and need no update beyond replacing the self-loop check with `e.kind === "complete"`.  
**Alternatives considered**: A discriminated union `StartEntry | CompleteEntry` — rejected; the spec says "out of scope: no UI redesign, no behavior changes". A full union type would require every consumer to narrow the type, touching far more call sites than needed.

---

## Decision 4: Legacy normalization strategy

**Decision**: Run normalization in `normalizeSpecContext` (reader), immediately after loading `history` from disk. Synthesize `kind` for each entry that lacks it using the old self-loop rule, and strip `from` from the synthesized complete entries.  
**Rationale**: Centralizes migration at the single read boundary. Every consumer downstream already gets normalized data. Keeping normalization in the reader (not the writer) means the file is only updated on the *next* write, giving a transparent lazy-migration without any forced writes.  
**Alternatives considered**: Eager migration (write a migration utility that rewrites all `.spec-context.json` files on extension activation) — rejected; too aggressive, modifies user files without user action, violates operational safety.

---

## Decision 5: Disambiguation change in `historyHelpers.ts` and `stepHistoryDerivation.ts`

**Decision**: Replace all `e.from?.step === step` and `e.from?.substep === substep` completion checks with `e.kind === "complete"`.  
**Rationale**: This is the explicit goal of the feature. The `kind` field is authoritative; `from` on a complete entry is absent, so the old check would return `false` on new-shape entries anyway — but the new check is clearer and works on both legacy-normalized and new-shape entries identically.  
**Affected locations**:
- `historyHelpers.ts`: `lastEntryIsCompletionFor` — one check.
- `stepHistoryDerivation.ts`: `lastOwnIsCompletion` derivation and `buildSubsteps` completion-skip check.

---

## Decision 6: `dedupeConsecutive` behavior with absent `from`

**Decision**: Keep the existing four-way comparison (`sameFromStep`, `sameFromSubstep`) but treat missing `from` as `{ step: null, substep: null }` via `?? null` — same as the current pattern.  
**Rationale**: A start entry and a complete entry for the same `(step, substep)` are NOT duplicates — they differ in `kind`. After the change, they also differ in `from` (start has `from.step` set; complete has no `from`). The existing comparison already handles this correctly via the `?? null` normalisation, since `complete.from?.step ?? null` = `null` and `start.from?.step ?? null` = the prior step. No change needed.  
**Alternatives considered**: Adding `kind` comparison to dedupe — unnecessary; the `from` comparison already prevents the problematic collapse.

---

## Touch Point Inventory (complete)

| File | What changes |
|------|-------------|
| `src/core/types/specContext.ts` | Add `HistoryEntryKind` type; add `kind` to `HistoryEntry`; make `from` optional |
| `src/core/types/spec-context.schema.json` | Add `kind` field to `historyEntry` $def; make `from` optional |
| `src/features/specs/specContextWriter.ts` | `setStepCompleted` — emit `kind: "complete"`, drop `from`; `setStepStarted` — emit `kind: "start"`; `setSubstepStarted` — emit `kind: "start"`; `setSubstepCompleted` — emit `kind: "complete"`, drop `from` |
| `src/features/specs/specContextReader.ts` | `normalizeSpecContext` — add `normalizeHistoryKind(history)` pass |
| `src/features/specs/historyHelpers.ts` | `lastEntryIsCompletionFor` — replace self-loop check with `e.kind === "complete"` |
| `src/features/specs/stepHistoryDerivation.ts` | `lastOwnIsCompletion` — use `lastOwn?.kind === "complete"`; `buildSubsteps` completion detection — use `s.kind === "complete"` |
| `src/ai-providers/promptBuilder.ts` | Update `SPEC_CONTEXT_SCHEMA` const; update `renderPreamble` and `renderLifecycleBody` prose; update `renderSpecifyCreationLifecyclePreamble` example JSON |
| `src/core/types/spec-context.schema.json` | Add `kind` enum; make `from` non-required |
| `tests/fixtures/spec-context/*.json` | Update 054.json, 055.json, 056.json, 058.json to new shape |
| `src/features/specs/__tests__/specContextWriter.test.ts` | Update assertions; add `kind` checks |
| `src/features/specs/__tests__/stepHistoryDerivation.test.ts` | Update fixtures; add legacy-normalization path tests |
| `tests/unit/specs/specContext.spec.ts` | Add normalization-path tests |
| `specs/_00_demo-specified/.spec-context.json` | Update to new shape |
| `specs/_01_demo-planned/.spec-context.json` | Update to new shape |
| `specs/_02_demo-tasked/.spec-context.json` | Update to new shape |

---

## Resolved Unknowns

All items from the spec's "NEEDS CLARIFICATION" (none were tagged) are resolved:
- **No new dependencies**: purely internal TypeScript change.
- **Back-compat**: normalization in `normalizeSpecContext` is the established pattern (already used for `transitions` → `history` migration and `status` coercion).
- **Test framework**: Jest (`src/__tests__`) + ts-jest (`tests/`). Both suites run with `npm test`.
- **Schema**: embedded in `promptBuilder.ts` as a literal string; also in `spec-context.schema.json` as the canonical artifact.
