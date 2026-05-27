# Implementation Plan: Explicit History Entry Kind Field

**Branch**: `fix/spec-context-state-progression` | **Date**: 2026-05-27 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/111-history-entry-kind/spec.md`

## Summary

Replace the `from.step === step` self-loop convention in `.spec-context.json` history entries with an explicit `kind: "start" | "complete"` field. The writer always emits the new shape; the reader normalizes legacy entries on load so existing files migrate transparently on the next write. All disambiguation logic in `historyHelpers.ts`, `stepHistoryDerivation.ts`, and `promptBuilder.ts` is updated to drive from `kind`, not from the self-loop pattern.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)  
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5  
**Storage**: File-based — `.spec-context.json` per spec directory under workspace `.claude/specs/`  
**Testing**: Jest with ts-jest (`src/features/specs/__tests__/`) + mocha/chai (`tests/`)  
**Target Platform**: VS Code Extension Host (Node.js)  
**Project Type**: Single project (VS Code extension)  
**Performance Goals**: N/A — file I/O only, no hot path  
**Constraints**: Back-compat required; no data loss on existing files  
**Scale/Scope**: ~15 files touched; ~200–350 lines changed

## Constitution Check

*Pre-design gate — all pass.*

| Principle | Gate | Result |
|-----------|------|--------|
| I. Extensibility | Does not change provider or workflow config API | ✅ PASS |
| II. Spec-Driven Workflow | Enhances the core history log schema; strengthens pipeline metadata quality | ✅ PASS |
| III. Visual and Interactive | No UI changes; viewer behavior preserved | ✅ PASS |
| IV. Modular Architecture | All changes are confined to existing focused modules | ✅ PASS |

*Post-design gate: no new violations introduced. No Complexity Tracking table needed.*

## Project Structure

### Documentation (this feature)

```text
specs/111-history-entry-kind/
├── spec.md              ✅ (created by /speckit.specify)
├── research.md          ✅ (Phase 0 — this run)
├── data-model.md        ✅ (Phase 1 — this run)
├── plan.md              ✅ This file
└── tasks.md             (Phase 2 — /speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── core/
│   └── types/
│       ├── specContext.ts               # HistoryEntryKind type; kind on HistoryEntry; from? optional
│       └── spec-context.schema.json     # kind enum field; from becomes non-required
├── features/
│   └── specs/
│       ├── specContextWriter.ts         # Emit kind on all 4 writer helpers; drop from on complete
│       ├── specContextReader.ts         # normalizeHistoryKind() pass in normalizeSpecContext
│       ├── historyHelpers.ts            # lastEntryIsCompletionFor: kind check replaces self-loop
│       ├── stepHistoryDerivation.ts     # lastOwnIsCompletion + buildSubsteps: kind checks
│       └── __tests__/
│           ├── specContextWriter.test.ts       # Add kind assertions
│           └── stepHistoryDerivation.test.ts   # Add kind-based + legacy-normalization tests
└── ai-providers/
    └── promptBuilder.ts                 # SPEC_CONTEXT_SCHEMA + prose instructions updated

tests/
├── fixtures/
│   └── spec-context/
│       ├── 054.json  ─┐
│       ├── 055.json  ─┤  Update to new kind-based shape
│       ├── 056.json  ─┤
│       └── 058.json  ─┘
└── unit/
    └── specs/
        └── specContext.spec.ts           # Add legacy-normalization path coverage

specs/
├── _00_demo-specified/.spec-context.json   # Update to new shape
├── _01_demo-planned/.spec-context.json     # Update to new shape
└── _02_demo-tasked/.spec-context.json      # Update to new shape
```

**Structure Decision**: Single project, existing module structure. All changes are surgical edits within already-established files; no new files or directories are created.

---

## Phase 0: Research

*Complete. See [research.md](research.md) for all decisions and rationale.*

Key decisions:
- `kind` values: `"start"` and `"complete"` (concise, matches existing function names)
- Complete entries: `from` field is **absent** (not null), making `from` optional on the type
- Legacy normalization: added to `normalizeSpecContext` reader, same pattern as the existing `transitions` → `history` migration
- Disambiguation change: all self-loop checks replaced with `e.kind === "complete"` checks

---

## Phase 1: Design

### 1a. Type Changes — `specContext.ts`

**New type:**
```typescript
export type HistoryEntryKind = 'start' | 'complete';
```

**Updated `HistoryEntry`:**
```typescript
export interface HistoryEntry {
    step: StepName;
    substep: string | null;
    kind: HistoryEntryKind;           // NEW — "start" or "complete"
    from?: HistoryEntryFrom;          // Changed: optional (absent on complete entries)
    by: HistoryEntryBy;
    at: string;
}
```

*`HistoryEntryFrom` is unchanged. The `Transition` alias is updated to reference the new `HistoryEntry`.*

---

### 1b. Writer Changes — `specContextWriter.ts`

Four helpers are updated:

| Helper | Before | After |
|--------|--------|-------|
| `setStepStarted` | `{ step, substep: null, from: { step: prev, substep: null }, by, at }` | + `kind: "start"` |
| `setStepCompleted` | `{ step, substep: null, from: { step: step, substep: null }, by, at }` | `kind: "complete"`, **drop `from`** |
| `setSubstepStarted` | `{ step, substep, from: { step, substep: null }, by, at }` | + `kind: "start"` |
| `setSubstepCompleted` | `{ step, substep, from: { step, substep }, by, at }` | `kind: "complete"`, **drop `from`** |

The `assertAppendOnly` check compares via `JSON.stringify`, which handles missing keys correctly — no changes needed there.

---

### 1c. Reader / Normalizer Changes — `specContextReader.ts`

Add a pure helper `normalizeHistoryKind(entries: HistoryEntry[]): HistoryEntry[]` that runs after the existing `transitions` → `history` coercion:

```
for each entry:
  if entry.kind is already set → keep unchanged
  else:
    for step entries (substep == null):
      if entry.from?.step === entry.step → kind = "complete", delete entry.from
      else                               → kind = "start"   (keep from)
    for substep entries (substep != null):
      if entry.from?.substep === entry.substep → kind = "complete", delete entry.from
      else                                     → kind = "start"   (keep from)
    if neither applies (malformed entry) → kind = "start" (safe fallback)
```

Call site: inside `normalizeSpecContext`, after `const history = ...`, before passing to `SpecContext`.

---

### 1d. Disambiguation Changes

**`historyHelpers.ts` — `lastEntryIsCompletionFor`:**

```typescript
// Before:
return e.from?.step === step && e.substep == null;

// After:
return e.kind === 'complete' && e.substep == null;
```

**`stepHistoryDerivation.ts` — `lastOwnIsCompletion`:**

```typescript
// Before:
const lastOwnIsCompletion = lastOwn?.from?.step === g.step && lastOwn?.substep == null;

// After:
const lastOwnIsCompletion = lastOwn?.kind === 'complete' && lastOwn?.substep == null;
```

**`stepHistoryDerivation.ts` — `buildSubsteps` completion skip:**

```typescript
// Before:
const isCompletion = s.from?.substep === s.substep;

// After:
const isCompletion = s.kind === 'complete';
```

**`stepHistoryDerivation.ts` — `buildSubsteps` next-completion check:**

```typescript
// Before:
const nextIsMatchingCompletion = next && next.substep === s.substep && next.from?.substep === s.substep;

// After:
const nextIsMatchingCompletion = next && next.substep === s.substep && next.kind === 'complete';
```

---

### 1e. Schema Changes — `spec-context.schema.json`

In the `historyEntry` `$def`:
1. Add `"kind"` to `properties` with `{ "type": "string", "enum": ["start", "complete"] }`.
2. Add `"kind"` to the `required` array.
3. Remove `"from"` from the `required` array (now optional — absent on complete entries).

---

### 1f. Prompt Builder Changes — `promptBuilder.ts`

Two surfaces updated:

**`SPEC_CONTEXT_SCHEMA` literal (embedded JSON Schema):**
- Add `"kind": { "enum": ["start", "complete"] }` to history entry `properties`.
- Add `"kind"` to the history entry `required` list.
- Remove `"from"` from history entry `required` (mark it as optional with a comment).

**`renderPreamble` / `renderLifecycleBody` prose instructions:**

Replace:
> Append a completion history entry `{ step: "…", substep: null, from: { step: "…", substep: null }, by: "extension", at: … }`

With:
> Append a completion history entry `{ step: "…", substep: null, kind: "complete", by: "extension", at: … }` *(no `from` field on complete entries)*

And start-entry instructions gain `kind: "start"`.

**`renderSpecifyCreationLifecyclePreamble` example JSON** — add `"kind": "start"` to the seed history entry.

---

### 1g. Test Fixtures — `tests/fixtures/spec-context/`

All four fixtures (`054.json`, `055.json`, `056.json`, `058.json`) are updated:
- Each `transitions` entry gains `kind` (inferred from the self-loop rule).
- Complete entries (self-loop) have `from` removed.

The tests that load these fixtures serve as the regression baseline for legacy-normalized behavior. A separate set of legacy-fixture tests (no `kind` field, self-loop present) is added to `specContext.spec.ts` to explicitly cover the normalization path.

---

## Quickstart: New History Entry Shapes

### Start entry (step)
```json
{
  "step": "plan",
  "substep": null,
  "kind": "start",
  "from": { "step": "specify", "substep": null },
  "by": "extension",
  "at": "2026-05-27T12:00:00Z"
}
```

### Complete entry (step)
```json
{
  "step": "plan",
  "substep": null,
  "kind": "complete",
  "by": "extension",
  "at": "2026-05-27T12:45:00Z"
}
```

### Start entry (substep)
```json
{
  "step": "implement",
  "substep": "phase1",
  "kind": "start",
  "from": { "step": "implement", "substep": null },
  "by": "extension",
  "at": "2026-05-27T13:00:00Z"
}
```

### Complete entry (substep)
```json
{
  "step": "implement",
  "substep": "phase1",
  "kind": "complete",
  "by": "extension",
  "at": "2026-05-27T13:20:00Z"
}
```

### Legacy entry (old shape — still accepted by the reader)
```json
{
  "step": "plan",
  "substep": null,
  "from": { "step": "plan", "substep": null },
  "by": "extension",
  "at": "2026-05-27T12:45:00Z"
}
```
*Reader synthesizes `kind: "complete"` and removes `from`; normalized on next write.*

---

## Complexity Tracking

*No constitution violations. No entries required.*
