# UI Contract: Article Drafts and Review

The feature adds no HTTP, CLI or schema interface (status lives in a client slice, see `research.md` decision 1). The interface is the editor, the article routes and the status model that tests and consumers code against.

## Routes

Taken from `pathKeys` in `src/shared/router.ts`; never written as literals.

| Route | Key | Behaviour added |
|---|---|---|
| `/editor/` | `pathKeys.editor.root` | New article; saved as Draft |
| `/editor/:slug/` | `pathKeys.editor.bySlug(slug)` | Editor branches by status |
| `/article/:slug/` | `pathKeys.article.bySlug(slug)` | Unpublished article behaves as not found for anyone not allowed to read it |

## Status values

Exactly five: `Draft`, `In review`, `Changes requested`, `Approved`, `Published`. An article with no status entry is `Published`.

## Allowed moves

| From | To | Action | Actor |
|---|---|---|---|
| Draft | In review | `send` | author |
| Changes requested | In review | `send` | author |
| In review | Approved | `approve` | reviewer, not the author |
| In review | Changes requested | `requestChanges` (non-empty note) | reviewer, not the author |
| Approved | Published | `publish` | author |
| Published | Draft | `unpublish` | author |

Any other move is refused and leaves the article unchanged.

## Editor controls by status

Action labels (verbatim): `Save`, `Send for review`, `Unpublish`.

| Status | Form | Controls shown | Extra |
|---|---|---|---|
| Draft | editable | `Save`, `Send for review` | |
| In review | read-only | none of `Save` / `Send for review` | in-review banner; approve and request-changes controls for a reviewer who is not the author only |
| Changes requested | editable | `Save`, `Send for review` | reviewer note above the form |
| Approved | read-only | Publish action | |
| Published | n/a | `Unpublish` | |

## Permission actions

Single source: `src/features/permission/permission.service.ts`. Actions: `send`, `approve`, `requestChanges`, `publish`, `unpublish`. Context gains `articleStatus` and `articleAuthorId`. Session user gains optional `reviewer` boolean (default false).

## Article list

A status label is shown only on the signed-in author's own articles that are not `Published`; never on others' articles or on any list viewed by someone else.

## Data shape (client slice)

Keyed by article slug: `{ status, reviewNote }`. The review note is whitespace-trimmed before the empty check; only the latest note is kept.
