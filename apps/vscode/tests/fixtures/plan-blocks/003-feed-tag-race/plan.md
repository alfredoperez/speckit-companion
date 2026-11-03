# Implementation Plan: Feed always matches the selected tag

## Summary

The article list can show the previous selection's articles while the new one loads. The cause is `placeholderData: keepPreviousData` in `articlesQueryOptions`: the feed widget keeps rendering the old key's data under the new tag, source or page. The fix is to drop that option so the list only ever renders data stored under the current selection's query key, and to pin the behaviour with tests, including that cancellation and error handling already work. Cancellation itself is already wired: every read in `~shared/api/api.service.ts` takes an `AxiosRequestConfig`, and every query option in the entities forwards TanStack's `signal`.

## Call paths

```calls switch tag or source or page
  BaseArticlesFeed() @ src/widgets/articles-feed/articles-feed.ui.tsx:35
~   articlesQueryOptions() @ src/entities/article/article.api.ts:28
+   articles-feed.test.tsx **new** @ src/widgets/articles-feed/articles-feed.test.tsx
```
note: the tag click only sets URL params. The loader parses them into the filter, and the filter is the query key.

```ts src/entities/article/article.api.ts:44-44 hl=44
    placeholderData: keepPreviousData,
```
pin 44: this line keeps the old key's articles on screen under the new key, so it is the one to delete.

## Project Structure

```
src/
  entities/article/article.api.ts            # drop placeholderData
  widgets/articles-feed/articles-feed.test.tsx   # new: race, cancel, error tests
```

**Structure Decision**: the fix is one line in the entity that owns the read query. The test sits beside the widget that renders the list, as `CLAUDE.md` asks, because the symptom is what the widget shows.

## Constitution Check

`.specify/memory/constitution.md` is still the unfilled template, so there are no principles to check. The project rules in `CLAUDE.md` apply instead.

| Rule | Assessment |
| --- | --- |
| Layers import downward only | PASS: entity change plus a widget test importing entities and shared |
| No barrels, `~` aliases | PASS |
| Server state in TanStack Query, no direct `axios` in components | PASS |
| Tests beside code, `renderWithQueryClient`, Axios mocked | PASS |

Re-checked after design: unchanged.

## Order of work

1. Write the race test first against the current code and confirm it fails (the old tag's articles are shown while the new tag loads).
2. Remove `placeholderData: keepPreviousData` and the unused import.
3. Add the cancel, error and same-tag tests. They are expected to pass without further code; if one fails, fix that cause where it lives (see `research.md`) and record it.
4. Run `yarn test` and `yarn eslint`. SC-004 requires the existing suite to pass unchanged.
