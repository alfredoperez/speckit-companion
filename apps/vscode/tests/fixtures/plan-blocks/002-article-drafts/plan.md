# Implementation Plan: Article Drafts and Review

## Summary

Every article gets one of five statuses, and the editor, the lists and the article page change with it. The RealWorld API has no status, note or reviewer, so status and the reviewer note live in a client-side slice that overlays the articles the API returns. The slice follows the injected-slice pattern of `~entities/session/session.model.ts` and is persisted with redux-persist. Rules for who may do what move into `permission.service.ts`, which stays the single source of rights.

This is a client-side stand-in for a server feature: visibility is enforced in the client only (see `research.md`, decision 1).

## Project Structure

```text
src/
  entities/
    article/
      article.contracts.ts        # + ArticleStatusSchema, reviewNote
      article.types.ts            # + ArticleStatus
      article.status.lib.ts **new** # allowed moves, visibility, default Published
      article.status.model.ts **new** # injected slice: status + note per slug
    session/session.contracts.ts  # + optional reviewer flag
  features/
    permission/
      permission.service.ts       # status-aware actions, reviewer + author combine
      permission.types.ts
    article/
      create-article/             # new article starts as Draft
      update-article/             # Save stays in the editor
      send-article-for-review/ **new**
      approve-article/ **new**
      request-article-changes/ **new**
      publish-article/ **new**
      unpublish-article/ **new**
  pages/editor/editor-page.ui.tsx # branch the editor by status
  pages/article/                  # hidden article behaves as not found
  widgets/articles-feed/          # filter unpublished, status label on own
```

**Structure Decision**: one slice per status action under `features/article/`, composed by the editor page, because a slice may not import a sibling slice. The state machine and the visibility rule sit in `entities/article`, below every consumer.

## Call paths

```calls change an article's status
  UpdateEditorPage @ src/pages/editor/editor-page.ui.tsx
~   UpdateArticleForm @ src/pages/editor/editor-page.ui.tsx
+   useCanPerformAction @ src/features/permission/permission.service.ts
+   useSendArticleForReviewMutation **new** @ src/features/article/send-article-for-review/send-article-for-review.mutation.ts
+     canMoveStatus **new** @ src/entities/article/article.status.lib.ts
+     setArticleStatus **new** @ src/entities/article/article.status.model.ts
```
note: every mutation checks `canMoveStatus` against the current status and refuses an illegal move (FR-010).

```calls hide unpublished articles
  ArticlesFeed @ src/widgets/articles-feed/articles-feed.ui.tsx
+   isArticleVisible **new** @ src/entities/article/article.status.lib.ts
```
note: the article page uses the same `isArticleVisible` and shows not-found for a hidden article.

## States

```states article status
Draft: Private, editable by its author. (start)
InReview: Read-only, waiting on a reviewer. shows editor
ChangesRequested: Author sees the note and edits.
Approved: Read-only, ready to publish.
Published: Public. (final)
Draft -> InReview: send for review
ChangesRequested -> InReview: send for review
InReview -> Approved: approve
InReview -> ChangesRequested: request changes
Approved -> Published: publish
Published -> Draft: unpublish
grid:
Draft | InReview | Approved | Published
.     | ChangesRequested | . | .
```
note: Published is not terminal in the product (unpublish returns to Draft). It is marked final only because the grid needs a sink for public articles.

## Screens

```screen editor Editor by status
title: Edit article
chip: In review (new) (1)
text: Reviewer note (new) (2)
field: Title (changed) (3)
row:
  button: Save (changed)
  button: Send for review (new)
  button: Unpublish (new)
```
1: **Banner.** Shown only when In review; the form is read-only.
2: **Note.** Shown above the form only when changes were requested.
3: **Read-only.** Every field is disabled in In review and Approved.

## Constitution Check

`.specify/memory/constitution.md` is still the unfilled template, so there are no principles to gate on. The project rules in `CLAUDE.md` are checked instead.

| Rule | Assessment |
|---|---|
| Layers import downward only, no sibling slice imports | PASS: five action slices composed by `pages/editor` |
| No barrels, full alias paths | PASS |
| `<slice>.<segment>.<ext>` naming | PASS |
| Client state is an injected slice, no second store | PASS: `article.status.model.ts` |
| Routes only from `pathKeys` | PASS |
| Network only through `~shared/api` | PASS: no new calls, status is client state |
| Permissions are the single source of rights | PASS: new actions added to the permission table |
