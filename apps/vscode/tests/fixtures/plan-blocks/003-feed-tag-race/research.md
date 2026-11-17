# Research: Feed always matches the selected tag

## Cause of the wrong list

**Decision**: remove `placeholderData: keepPreviousData` from `articlesQueryOptions` in `src/entities/article/article.api.ts`.

**Rationale**: the query key is `['articles', filter]`, so a late response for tag A is stored under A's key and cannot overwrite B's entry. What reaches the screen is `useSuspenseQuery(articlesQueryOptions(filterQuery))` in `BaseArticlesFeed`. With `keepPreviousData`, the new key reports `success` with the old key's data as a placeholder, so Suspense never shows the skeleton and the reader sees tag A's articles under tag B until B resolves. That breaks FR-001 and FR-002 directly. Without it, the widget suspends on the new key and shows the existing `ArticlesFeedSkeleton`, then the right list.

**Alternatives considered**:
- Keep it only for page changes: smoother pagination, but FR-001 says the list shows only the selected page, so a page switch would still show another page's articles.
- Ignore late responses with a request counter in the widget: duplicates what the query key already guarantees and adds client state against the `CLAUDE.md` rule.

**Visible effect**: switching tag, source or page now shows the existing skeleton while loading instead of the old list. No new component or state (FR-007). Assumption: this is acceptable; it is the only way to satisfy FR-001. I did not run the app to confirm the flicker is not jarring.

## Cancellation (FR-003, FR-006)

**Decision**: no new plumbing. Test it instead.

**Rationale**: `getAllArticles`, `getFeedArticles` and `getArticleBySlug` already accept `AxiosRequestConfig`, and `articleQueryOptions`, `articlesQueryOptions`, and the comment, profile, tag and session queries all pass `{ signal }`. TanStack aborts that signal when a query loses its last observer, which happens when the key changes.

**Alternatives considered**: a custom `AbortController` per selection. Rejected, it would duplicate the signal TanStack already provides.

## Cancelled requests show no error (FR-004, FR-005)

**Decision**: no new code unless the test fails. Nothing in `src` handles `isCancel` or `CanceledError`, and `api.instance.ts` passes a non-API error through unchanged.

**Rationale**: TanStack treats an aborted fetch as a cancel and reverts the query without an error state. The test must prove it through the Suspense and `ErrorBoundary` path, and prove that a real failure for the current selection still reaches `ErrorHandler`.

**Alternatives considered**: filter `CanceledError` in `logError` pre-emptively. Rejected until a test shows a cancel reaching it.

## Out of scope, noted

- The favorite and unfavorite mutations call `cancelQueries` on the whole `['articles']` root, which can cancel a list fetch that is still current. It is not the reported bug and the spec does not cover it. Left alone.
- `homePageLoader` and `profilePageLoader` call `prefetchQuery` without awaiting. They prefetch the current selection's key, so they cannot write a wrong list. Left alone.
- The profile page list shares the query, so it gets the same fix for free (author and favorited are in the key).
