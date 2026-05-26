# Research: Fix Inline Comment Persistence

## Decision 1: Root cause

**Decision**: The bug is in `webview/src/spec-viewer/editor/currentDoc.ts`. When `spec.md` is the
active document, `navState.value.currentDoc` equals `'specify'` (the workflow step name), not
`'spec'` (the core document type). The guard `d === 'spec' || d === 'plan' || d === 'tasks'` does
not recognise `'specify'`, so `currentDoc()` returns `null`.

**Why this affects only `spec.md`**: The other two document-producing steps in `DEFAULT_WORKFLOW`
have names `'plan'` and `'tasks'` which exactly match the `CoreDocumentType` values. Only the first
step is named `'specify'` while its output file is `spec.md`. `plan.md` and `tasks.md` use steps
whose `name` equals their `CoreDocumentType`, so they work.

**Trace**:

1. `scanDocuments` iterates `DEFAULT_WORKFLOW.steps`. Step 0 has `name: 'specify'`, `file:
   'spec.md'`. It pushes `{ type: 'specify', fileName: 'spec.md', isCore: true }`.
2. `getDocumentTypeFromPath('…/spec.md', steps)` finds the step whose `file === 'spec.md'` and
   returns `step.name → 'specify'`.
3. `sendContentUpdateMessage` builds `navState` with `currentDoc: documentType → 'specify'`.
4. The webview receives the message and sets `navState.value.currentDoc = 'specify'`.
5. `currentDoc()` checks `d === 'spec' || d === 'plan' || d === 'tasks'` → `false` → returns
   `null`.
6. `persistAdd()` early-exits → no `addComment` message posted → comment not persisted.
7. `restoreComments()` early-exits → no comments rendered on reopen.
8. `submitAllRefinements()` early-exits → refinement never dispatched to AI.

**Rationale**: The alias `'specify'` → `'spec'` is already handled in the extension (e.g.
`deriveStepBadgesWithAlias` writes `out['spec'] = out['specify']`), but the webview's `currentDoc()`
was never updated to handle it.

---

## Decision 2: Fix location — webview `currentDoc.ts`

**Decision**: Fix in `webview/src/spec-viewer/editor/currentDoc.ts` by mapping `'specify'` to
`'spec'` inside `currentDoc()`.

**Rationale**:
- Single-point fix; all consumers (`persistAdd`, `restoreComments`, `submitAllRefinements`) call
  `currentDoc()` and will benefit automatically.
- Returning `'spec'` (not `'specify'`) ensures the value matches `ReviewCommentDoc`, and that
  comments stored on disk carry `doc: 'spec'` — keeping the stored data aligned with
  `CoreDocumentType`.
- No changes needed to extension-side handlers: they accept `CoreDocumentType = 'spec' | 'plan' |
  'tasks'`.

**Alternatives considered**:
- Fix in `getDocumentTypeFromPath` to return `'spec'` instead of step.name for the specify step →
  broader impact, could change step-tab rendering elsewhere; rejected in favour of the narrower fix.
- Normalise in `sendContentUpdateMessage` → also works but changes a more central code path; fix in
  `currentDoc.ts` is the least-invasive change.
- Fix in each call-site (`persistAdd`, `restoreComments`, `submitAllRefinements`) → three places to
  update instead of one; rejected.

---

## Decision 3: Secondary fix — `sourceDoc` lookup in `messageHandlers.ts`

**Decision**: Also fix the `sourceDoc` lookup in `handleAddComment` and `dispatchDocRefinement`
to fall back to file-name matching when type lookup returns `undefined`.

**Rationale**:
- In `handleAddComment`, when `sourceDoc` is `undefined` (because `d.type === 'specify'` ≠
  `doc === 'spec'`), `sourceLines` stays `null`. The comment is still persisted but stores no
  surrounding text context. This degrades the AI prompt quality for the "Refine" action.
- In `dispatchDocRefinement`, the `filename` fallback `${doc}.md → 'spec.md'` is coincidentally
  correct, but relies on the naming convention holding. Explicit lookup is safer.
- Fix: also match `d.fileName === \`${doc}.md\`` as a secondary criterion.

**Alternatives considered**:
- Leave as-is (secondary only) — acceptable for a minimal fix but reduces comment context quality.
- Maintain a global `SPECIFY_ALIASES` map — more explicit but over-engineered for a two-value case.

---

## Decision 4: No data-model or contract changes

**Decision**: No changes to `ReviewComment` shape, `.spec-context.json` schema, or public API.

**Rationale**: `ReviewComment.doc` already uses `'spec' | 'plan' | 'tasks'` (i.e. `ReviewCommentDoc`),
and the fix preserves that by returning `'spec'` from `currentDoc()`. All stored data, extension
handlers, and webview consumers remain compatible without migration.

---

## Files affected

| File | Change |
|------|--------|
| `webview/src/spec-viewer/editor/currentDoc.ts` | Map `'specify'` → `'spec'` in return guard |
| `src/features/spec-viewer/messageHandlers.ts` | Fallback to fileName match in `sourceDoc` lookup (×2) |

No new files, no schema changes, no migration needed.
