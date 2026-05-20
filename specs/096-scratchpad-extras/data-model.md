# Data Model: Per-Document Scratchpad Extras

**Feature**: 096-scratchpad-extras
**Date**: 2026-05-20

This feature is file-based and adds no persisted schema beyond plain markdown
files. The "data model" here is (a) the conceptual entities and (b) the
in-memory TypeScript shapes that flow extension → webview.

---

## Entities

### Scratchpad (Extra) Document

A plain markdown file paired one-to-one with a core source document.

| Attribute | Value |
|-----------|-------|
| Identity | `<doctype>-extra.md` in the same spec directory as its source |
| Doctypes | `spec-extra.md`, `plan-extra.md`, `tasks-extra.md` (exactly three) |
| Content | Freeform markdown — notes, questions, deferred concerns, AI instructions |
| Authorship | User only (never AI-generated; not derived from conversation) |
| Cardinality | At most one per source document |
| Lifecycle | Optional, lazily created, durable (persists after apply), committable |
| Workflow role | Non-core — never gates phases, never counted, never triggers lifecycle |

### Source Document

An existing core artifact a scratchpad refines and the target of the apply edit.

| Attribute | Value |
|-----------|-------|
| Doctypes | `spec` (`spec.md`), `plan` (`plan.md`), `tasks` (`tasks.md`) |
| Relationship | One source ↔ at most one scratchpad |
| Apply target | The scratchpad's contents are applied as a direct in-place edit here |

### Pairing / Naming Map

| Source step | Source file | Scratchpad file | Scratchpad doc type |
|-------------|-------------|-----------------|---------------------|
| `spec`  | `spec.md`  | `spec-extra.md`  | `spec-extra`  |
| `plan`  | `plan.md`  | `plan-extra.md`  | `plan-extra`  |
| `tasks` | `tasks.md` | `tasks-extra.md` | `tasks-extra` |

Suffix rule: scratchpad base name = `<source-base>-extra`. Only the three core
source documents participate (custom-workflow steps do not).

---

## TypeScript shape changes

### `SpecDocument` (new optional fields)

Extension: `src/features/spec-viewer/types.ts` (and mirrored in
`webview/src/spec-viewer/types.ts`).

```ts
interface SpecDocument {
  // ...existing fields: type, label, fileName, filePath, exists,
  //    isCore, category, parentStep ...

  /** True when this entry represents a *-extra.md scratchpad. */
  isScratchpad?: boolean;

  /** Source doc type this scratchpad pairs with: 'spec' | 'plan' | 'tasks'. */
  scratchpadFor?: DocumentType;

  /** P2 (FR-016): true when the scratchpad file is non-empty. */
  hasContent?: boolean;
}
```

A scratchpad entry always sets `isCore: false`, `category: 'related'`,
`parentStep` = its source step (so the existing children rail renders it), and
`exists` = real on-disk existence.

### `DocumentType`

Extend the document-type union (extension `types.ts:56` `CORE_DOCUMENTS` area and
webview type) to admit `'spec-extra' | 'plan-extra' | 'tasks-extra'` as valid
related doc types so `switchDocument`/`currentDocument` round-trips cleanly.

### `NavState` passthrough

`NavState.relatedDocs` already carries `SpecDocument[]`; the new fields ride
along automatically. No new top-level `NavState` field is required for the core
loop. (The P2 indicator reads `doc.hasContent` directly off the related doc.)

### Constants

`src/core/constants.ts` — add scratchpad naming, e.g.:

```ts
export const ScratchpadFiles = {
  spec:  'spec-extra.md',
  plan:  'plan-extra.md',
  tasks: 'tasks-extra.md',
} as const;
export const SCRATCHPAD_SUFFIX = '-extra';
```

---

## Derivation rules (documentScanner)

For each **existing** core source doc whose type ∈ {`spec`, `plan`, `tasks`},
synthesize one scratchpad `SpecDocument`:

```
scratchpad = {
  type: `${sourceType}-extra`,
  label: `${SourceLabel} Notes`,        // e.g. "Spec Notes" (distinct from source tab)
  fileName: `${sourceType}-extra.md`,
  filePath: join(specDirectory, `${sourceType}-extra.md`),
  exists: <on-disk existence>,
  hasContent: <exists && file non-empty/whitespace>,   // P2
  isCore: false,
  category: 'related',
  parentStep: sourceType,
  isScratchpad: true,
  scratchpadFor: sourceType,
}
```

Rules:
- **Gate on source existence** — do not synthesize a scratchpad when the source
  doc does not exist (Edge Case: source absent → no scratchpad sub-tab).
- **Show even when the scratchpad file is absent** — `exists: false` is valid; it
  drives the empty-state create flow. (This is why synthesis is independent of
  the recursive related-doc scan, which only emits existing files.)
- **De-dupe** — add the three `*-extra.md` names to the scanner's skip set so the
  generic recursive related-doc scan does not also emit them (otherwise a
  manually-created `spec-extra.md` would appear twice). This also satisfies
  FR-017: an on-disk `*-extra.md` is surfaced through the synthesized entry with
  `exists: true`.

---

## Validation rules (from requirements)

| Rule | Source | Enforced where |
|------|--------|----------------|
| At most one scratchpad per source | FR-001, Assumptions | Synthesis emits exactly one per source type |
| Scratchpad lives beside source in spec dir | FR-002 | `filePath` join on `specDirectory` |
| Never auto-created | FR-003 | Synthesis only models the entry; file written only on explicit `createScratchpad` |
| Sub-tab next to source, same related-doc pattern | FR-004 | `parentStep` + children rail |
| Visually distinguished from source tab | FR-005 | `.step-child--scratchpad` keyed off `isScratchpad` |
| Empty state + single create action when absent | FR-006 | `ScratchpadEmptyState` when `isScratchpad && !exists` |
| Create writes empty file + switches view | FR-007 | `createScratchpad` handler |
| Open in standard editor, same affordance | FR-008 | reuse `editDocument` |
| Refine visible/active only on scratchpad tab | FR-009 | `FooterActions` gates on active doc `isScratchpad` |
| Apply reads full contents, edits matching source | FR-010 | `applyScratchpad` handler resolves `scratchpadFor` |
| Direct in-place edit, no template regeneration | FR-011 | direct-edit prompt; never a slash command |
| No dispatch when empty + indicate nothing to apply | FR-012 | extension empty guard → `actionToast` |
| Non-core: no gating, no task count, no lifecycle | FR-013 | `isCore: false`; existing guards already exclude |
| Committable, not ignored | FR-014 | no ignore rules added (no-op) |
| Remove inline-comment capability fully | FR-015 | deletions per research Decision 6 |
| Indicate scratchpads with content (P2) | FR-016 | `hasContent` flag + sub-tab dot |
| Recognize on-disk-created scratchpads | FR-017 | synthesis reads real existence; generic scan skips `*-extra` |

---

## State transitions

Scratchpad file lifecycle (no `.spec-context.json` involvement):

```
(absent)  --createScratchpad-->  (empty file, exists)
(exists)  --user edits in editor-->  (has content)
(has content) --Refine/applyScratchpad--> (unchanged; durable record kept)
(exists)  --deleted on disk-->  (absent → next view shows empty state)
```

The apply action never mutates the scratchpad (Assumption: persists as a durable
handoff record).
