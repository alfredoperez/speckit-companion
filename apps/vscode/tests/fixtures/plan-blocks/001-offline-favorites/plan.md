# Implementation Plan: Offline Favorites

## Summary

When a favorite or unfavorite gets no response from the server, the app keeps the optimistic change and stores it in a persisted queue instead of rolling back. A new injected Redux slice holds the queue, the header reads its length, and a small sync service replays the queue in order when the browser reports it is online and once on launch. Server-answered errors keep today's rollback.

One non-obvious fix is needed: React Query pauses mutations while the browser is offline, so `onError` never fires. Both mutations set `networkMode: 'always'` so the request is sent and fails with no response.

## Project Structure

```
src/
├── app/
│   └── browser-router.tsx                 # start sync once the store has rehydrated
├── entities/
│   └── favorite-queue/
│       ├── favorite-queue.model.ts        # new: injected slice, selectors
│       └── favorite-queue.test.tsx        # new
├── features/
│   ├── article/
│   │   ├── favorite-article/favorite-article.mutation.ts      # keep change on network failure, enqueue
│   │   └── unfavorite-article/unfavorite-article.mutation.ts  # same
│   ├── favorite-sync/
│   │   ├── favorite-sync.service.ts       # new: replay queue, online listener
│   │   └── favorite-sync.test.tsx         # new
│   └── session/logout/logout.mutation.ts  # clear the queue on success
├── pages/layout/layout.ui.tsx             # header count
└── shared/api/network-error.lib.ts        # new: isNetworkError
```

**Structure Decision**: the queue lives in `entities` because both mutation features write to it and a feature cannot import a sibling. The replay lives in its own feature slice so the app layer can start it.

## Call paths

```calls Offline favorite
  FavoriteArticleBriefButton() @ src/features/article/favorite-article/favorite-article.ui.tsx:6
~   useFavoriteArticleMutation() @ src/features/article/favorite-article/favorite-article.mutation.ts:9
+     isNetworkError() **new** @ src/shared/api/network-error.lib.ts
+     enqueue() **new** @ src/entities/favorite-queue/favorite-queue.model.ts
```
note: the unfavorite mutation changes the same way, and `enqueue` cancels an opposite waiting change for that slug.

```calls Catch-up
  BootstrappedRouter() @ src/app/browser-router.tsx:16
+   startFavoriteSync() **new** @ src/features/favorite-sync/favorite-sync.service.ts
      favoriteArticle() @ src/shared/api/api.service.ts:58
+     dequeue() **new** @ src/entities/favorite-queue/favorite-queue.model.ts
```
note: replay uses the api calls directly because the mutation hooks need a component.

## States

```states Waiting change
Queued: Stored offline, waiting to be sent. (start)
Sending: Being sent during catch-up.
Sent: Server accepted it, removed from the list. (final)
Dropped: Server rejected it, removed from the list. (final)
Cancelled: Opposite change made, removed from the list. (final)
Queued -> Sending: online report or launch
Queued -> Cancelled: opposite change on the same article
Sending -> Sent: server accepts
Sending -> Dropped: server answers with an error
Sending -> Queued: no response, change stays waiting
grid:
Queued | Sending | Sent
.      | Cancelled | Dropped
```
note: logout removes every waiting change from any state, and a reload keeps them as they are.

## Screens

```screen header Header
row:
  text: Conduit
  list: Home | New Article | Settings | Profile
  chip: Waiting changes count (new) (1)
```
1: **Plain number.** Shown only for a signed-in reader and hidden when the count is zero.

## Constitution Check

`.specify/memory/constitution.md` is still the unfilled template, so the gate uses the project rules in `CLAUDE.md`.

| Rule | Assessment |
| --- | --- |
| Layers import only downward | PASS: `app` → `features` → `entities` → `shared`; `pages` → `entities` |
| No sibling slice imports | PASS: both mutations share the queue through `entities` |
| New client state is an injected slice, no second store | PASS: `favorite-queue.model.ts` follows `session.model.ts` |
| All network through `~shared/api` | PASS: replay calls `api.service.ts` |
| No barrels, `<slice>.<segment>.<ext>` names | PASS |
| Tests beside code via `renderWithQueryClient` | PASS |

## Open concerns

- Logout needs the network, so an offline logout never clears the queue (FR-012). Left as specified.
- A 401 during catch-up counts as a server rejection and drops the change (FR-009).
