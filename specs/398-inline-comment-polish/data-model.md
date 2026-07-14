# Data Model: Inline comments that annotate, not interrupt

## ReviewComment (persisted, `.spec-context.json` → `reviewComments[]`)

The stored record is **unchanged by this feature**. No field is added, removed, or retyped; the schema (`src/core/types/spec-context.schema.json`) needs no edit.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Minted webview-side so the inline annotation and the stored record share it. Preserved across an edit. |
| `doc` | `ReviewCommentDoc` | Which document the comment belongs to. |
| `anchor` | `{ heading: string \| null; blockText: string; line: number }` | Written once at add time; re-anchoring reads it. Never rewritten by an edit. |
| `comment` | string | User-authored text. **The only field an edit mutates.** |
| `status` | `'pending' \| 'applied'` | `pending` on add; flipped to `applied` when the document's comments are dispatched. An edit does not change it. |
| `createdAt` | ISO string | Written once. Preserved across an edit. |

**State transitions**: `pending → applied` (on `runDocRefinement` for the comment's document, via the existing `markApplied`). There is no reverse transition and no new state. Deletion removes the record outright.

**Mutations** (all pure, all in `src/features/spec-viewer/reviewComments.ts`, all funnelled through `persistCommentMutation`):

| Mutation | Existing? | Effect |
|---|---|---|
| `addComment(ctx, rc)` | yes | Appends. |
| `removeComment(ctx, id)` | yes | Drops by id. |
| `markApplied(ctx, ids)` | yes | Sets `status: 'applied'` on the listed ids. |
| `editComment(ctx, id, text)` | **new** | Replaces `comment` on the matching id. Every other field, including `status` and `createdAt`, is carried through untouched. A blank/whitespace-only `text` is a no-op, and an unknown id is a no-op. |

## Refinement (in-memory, webview)

The webview's projection of a comment onto a rendered line. It gains one field.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same id as the stored record. |
| `lineNum` | number | The line the annotation is mounted on. |
| `lineContent` | string | The annotated line's text, for the composer's context header. |
| `comment` | string | The comment text. |
| `lineType` | `LineType` | Drives the composer's context actions. |
| `status` | `ReviewCommentStatus` | **new**, defaults to `pending`. Drives the annotation's state glyph, rail, label, and whether Refine appears. |

**Invariant**: the `pendingRefinements` signal — which drives the footer Refine badge count — holds only refinements whose `status` is `pending`. An applied comment is mounted on its line and tracked in the mount map, but never enters that signal.
