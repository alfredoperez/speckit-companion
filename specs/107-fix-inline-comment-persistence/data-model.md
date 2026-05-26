# Data Model: Fix Inline Comment Persistence

## No schema changes required

The existing `ReviewComment` shape and `.spec-context.json` schema are correct and unchanged.

---

## Existing types (reference)

### `ReviewComment` (`webview/src/spec-viewer/types.ts`)

```ts
export type ReviewCommentDoc = 'spec' | 'plan' | 'tasks';
export type ReviewCommentStatus = 'pending' | 'applied';

export interface ReviewComment {
    id: string;
    doc: ReviewCommentDoc;       // ← always 'spec', 'plan', or 'tasks'
    comment: string;
    status: ReviewCommentStatus;
    anchor: {
        line: number;
        blockText: string;
        heading: string | null;
    };
    createdAt: string;           // ISO timestamp
}
```

### `.spec-context.json` (relevant fields)

```json
{
  "reviewComments": [
    {
      "id": "<uuid>",
      "doc": "spec",
      "comment": "...",
      "status": "pending",
      "anchor": {
        "line": 5,
        "blockText": "...",
        "heading": null
      },
      "createdAt": "2026-05-26T00:00:00.000Z"
    }
  ]
}
```

---

## Key invariant maintained by this fix

After the fix, `currentDoc()` returns `'spec'` (not `'specify'`) when `spec.md` is active. This
ensures:

- `addComment` messages carry `doc: 'spec'` → stored in `.spec-context.json` as `doc: 'spec'`
- `restoreComments()` filters `c.doc === 'spec'` → matches stored comments
- `pendingForDoc(ctx, 'spec')` in `dispatchDocRefinement` → matches stored comments

The `ReviewCommentDoc = 'spec' | 'plan' | 'tasks'` type continues to be the canonical set of
valid doc identifiers. `'specify'` is a workflow step name; it is not and never was a valid
`ReviewCommentDoc` value.
