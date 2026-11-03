# Data Model: Offline Favorites

## Entities

### WaitingChange (new)

One favorite or unfavorite made while the server was unreachable.

| Field | Type | Rules |
| --- | --- | --- |
| `slug` | string | Article it applies to. Unique in the list (FR-002, FR-007). |
| `favorite` | boolean | `true` = favorite, `false` = unfavorite. |

Order made is the array position, so there is no separate order field.

### FavoriteQueue (new slice state)

```ts
{ items: { slug: string; favorite: boolean }[] }
```

- Lives at `src/entities/favorite-queue/favorite-queue.model.ts` as an injected slice, persisted by the root `redux-persist` config (FR-008).
- Serializable plain array. No Map.
- Count shown in the header is `items.length` via `selectQueueCount` (FR-004).

## Relationships

- A WaitingChange refers to one article by `slug`. It holds no article data, only the key.
- The queue is separate from the session slice. Logout clears it from `logout.mutation.ts`, so the entity does not import the session model (FR-012).
- The favorite and unfavorite mutations write to it. The sync service reads the head and removes it.

## Validation rules

- **Enqueue, same direction already waiting**: no change, stored once.
- **Enqueue, opposite direction waiting for the slug**: remove the waiting item, add nothing (FR-007).
- **Enqueue, nothing waiting for the slug**: append to the end.
- Only network failures are enqueued, meaning an Axios error with no `response` (FR-001). Any error with a response rolls back and stores nothing (FR-003).
- Count of zero renders nothing in the header.

## State transitions

```
Queued -> Sending     online report, or launch with items waiting
Queued -> Cancelled   opposite change on the same slug
Sending -> Sent       server accepts, item removed (FR-006)
Sending -> Dropped    server answers with an error, item removed (FR-009)
Sending -> Queued     no response, item and the rest stay (FR-010)
any -> removed        logout clears all (FR-012)
```

Sent, Dropped and Cancelled are final. Sending is not stored: it is the head item during a run. A reload keeps items as Queued.
