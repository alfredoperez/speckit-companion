# Contract: Offline Favorites (internal)

No network API. The spec has no Verbatim Constraints section, so identifiers below come from plan.md and research.md.

## Queue slice: `src/entities/favorite-queue/favorite-queue.model.ts`

Injected slice, persisted by the root redux-persist config.

State: `{ items: { slug: string, favorite: boolean }[] }`. Array order is the order made. At most one item per `slug`.

| Name | Kind | Behavior |
| --- | --- | --- |
| `enqueue` | action | Adds `{ slug, favorite }`. If an opposite item exists for `slug`, removes it and adds nothing. Same item twice is stored once. |
| `dequeue` | action | Removes the head item. |
| clear action | action | Empties `items`. Dispatched in `logout.mutation.ts` `onSuccess`, beside `resetSession()`. Exact name set when built. |
| `selectQueueCount` | selector | `items.length`. |

## `isNetworkError(e)`: `src/shared/api/network-error.lib.ts`

`axios.isAxiosError(e) && !e.response`. True only when no response was received. Any error with a response (rejection, validation) is false.

## `startFavoriteSync()`: `src/features/favorite-sync/favorite-sync.service.ts`

- Called from `BootstrappedRouter` in `src/app/browser-router.tsx`, after store rehydration.
- Adds one `online` listener. Runs once at start if `navigator.onLine`.
- Run handles the head item via `favoriteArticle()` / `unfavoriteArticle()` in `~shared/api/api.service`:
  - accepted or server error: `dequeue`, continue.
  - no response: stop, keep the rest waiting.
- A module flag prevents overlapping runs.
- After a run, invalidates `ARTICLES_ROOT_QUERY_KEY`.

## Mutations

`favorite-article.mutation.ts` and `unfavorite-article.mutation.ts` set `networkMode: 'always'`. In `onError`, when `isNetworkError`, call `enqueue` and return without rollback. `onSettled` skips the invalidate for that case.

## Header count: `src/pages/layout/layout.ui.tsx`

Small component in `UserLayout`, outside the session Suspense, reading `selectQueueCount`. Renders a plain number, nothing when 0, signed-in only.
