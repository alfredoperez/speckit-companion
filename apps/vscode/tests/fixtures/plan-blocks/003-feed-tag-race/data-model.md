# Data Model: Feed always matches the selected tag

No new entities and no schema changes. The feature only changes which cached entry the list renders.

## Selection (existing `FilterQuery`)

Defined by `FilterQuerySchema` in `src/entities/article/article.contracts.ts`; type in `article.types.ts`.

| Field | Type | Rule |
| --- | --- | --- |
| `source` | `'user' \| 'global'` | Your Feed or Global Feed |
| `tag` | `string?` | Selected tag, if any |
| `page` | string, positive number | Coerced; rejects non-numeric and values <= 0 |
| `author` | `string?` | Profile page lists |
| `favorited` | `string?` | Profile page lists |

Identity: the query key `['articles', filter]`. Two selections are the same only if every field matches.

## Article list (existing `Articles`)

`{ articles: Record<string, Article>, articlesCount: number }`, stored in TanStack Query under the Selection's key. Unchanged.

Relationship: one Selection key maps to one Article list entry.

## Validation rules

- FR-001/FR-002: render only the entry stored under the current Selection key. No `placeholderData` from another key.
- FR-003/FR-006: each key's fetch receives TanStack's `signal`. It is aborted when the key loses its last observer.
- FR-004/FR-005: an aborted fetch leaves no error state. A failure for the current key surfaces as today.

## State transitions (per query key)

- `pending -> success`: response arrives and is stored under its own key.
- `pending -> cancelled (reverts)`: selection changed, no error shown, late response cannot touch another key.
- `pending -> error`: shown only if that key is still the current Selection.
- Selection change: the widget suspends on the new key (existing `ArticlesFeedSkeleton`) until it resolves. A cached entry for the new key renders immediately.
