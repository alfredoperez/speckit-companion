# Research: Offline Favorites

## Detect "no response"
- **Decision**: `isNetworkError(e)` is `axios.isAxiosError(e) && !e.response`, in `src/shared/api/network-error.lib.ts`.
- **Rationale**: the response interceptor rebuilds validation errors as `AxiosError`s that keep `response`, so they count as server answers. Matches the spec's assumption.
- **Alternatives considered**: `navigator.onLine` alone. It reports true on a dead connection and cannot see a failed request.

## Let mutations fail while offline
- **Decision**: set `networkMode: 'always'` on both favorite mutations.
- **Rationale**: the default `'online'` pauses mutations while the browser is offline, so `onError` never runs and nothing is queued.
- **Alternatives considered**: enqueue from `onMutate` when `navigator.onLine` is false. It skips the real request and misses a dead connection with `onLine` true.

## Keep the change on screen
- **Decision**: in `onError`, enqueue and return when `isNetworkError`; in `onSettled`, skip the invalidate for that case.
- **Rationale**: today's rollback and the always-on invalidate would snap the change back (FR-001).
- **Alternatives considered**: extract the cache patch into a shared lib. Not needed, the patch is untouched.

## Where the queue lives
- **Decision**: injected slice at `src/entities/favorite-queue/favorite-queue.model.ts`, state `{ items: { slug, favorite }[] }`, array order is the order made, at most one per slug.
- **Rationale**: the root `redux-persist` config has no whitelist, so an injected slice persists with no extra work (FR-008). Features cannot share state sideways, so it sits one layer down.
- **Alternatives considered**: a Map keyed by slug (not serializable); a slice per feature (cannot cancel opposites).

## Replay and launch
- **Decision**: `startFavoriteSync()` in a feature service, called from `BootstrappedRouter` after rehydration. It adds one `online` listener and runs once if `navigator.onLine`. A module flag stops two runs overlapping.
- **Rationale**: launch catch-up must wait for rehydration or the queue reads empty. Replay calls `api.service` directly, handles the head item: accepted or server error removes it, no response stops the run. After the run it invalidates `ARTICLES_ROOT_QUERY_KEY` (FR-013).
- **Alternatives considered**: a layout loader (runs on every navigation); mutation hooks for replay (need a component).

## Logout
- **Decision**: dispatch the queue's clear action in `logout.mutation.ts` `onSuccess`, beside `resetSession()`.
- **Rationale**: the queue slice stays free of any session import.
- **Alternatives considered**: `extraReducers` on `resetSession`. It makes the entity import the session model.

## Header count
- **Decision**: a small component in `layout.ui.tsx` inside `UserLayout`, outside the session Suspense, reading `selectQueueCount`.
- **Rationale**: inside `BaseUserNavigation` it would wait on the session query. Signed-in only comes from `UserLayout`.
- **Alternatives considered**: a new widget. One number does not need one.
