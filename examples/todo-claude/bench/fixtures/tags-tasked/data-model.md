# Data Model: Tags

## Entities

### Tag (new)

A reusable label a person creates. Independent of any todo; forms the shared vocabulary used for assignment and filtering.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Unique identity, generated with `crypto.randomUUID()` (same as todos). |
| `name` | `string` | Display name — the exact, trimmed text entered. Shown verbatim. |

```ts
export interface Tag {
  id: string;
  name: string;
}
```

**Validation**
- `name` MUST be non-empty after trimming. An empty or whitespace-only submission creates no tag (FR-005).
- Uniqueness is **not** required — duplicate names are permitted; each created tag is its own entry keyed by `id` (per Assumptions).

### Todo (extended)

The existing todo gains the assignment relationship: a list of the tag ids applied to it.

| Field | Type | Notes |
|-------|------|-------|
| `id`, `text`, `completed`, `createdAt` | unchanged | Existing fields are untouched. |
| `tagIds` | `string[]` | Ids of assigned tags; empty when none. Many-to-many, owned per-todo. |

```ts
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  tagIds: string[];
}
```

**Validation / migration**
- A newly created todo starts with `tagIds: []`.
- Todos loaded from storage that predate this feature have no `tagIds`; they are normalized to `[]` on load (FR-011 — survive reload/remount).
- A `tagId` present in `tagIds` always references a tag that exists; the removal cascade below guarantees no dangling ids.

## Relationships

- **Tag ↔ Todo**: many-to-many. A tag may apply to many todos; a todo may carry many tags. The relationship is represented solely by `Todo.tagIds` (a tag holds no back-reference).

## State & transitions

| Action | Effect |
|--------|--------|
| Create tag | Append `{ id, name: trimmed }` to the tag list. No-op if the trimmed name is empty. |
| Remove tag | Remove it from the tag list **and** strip its id from every todo's `tagIds` (no dangling reference). If that tag was the active filter, the view reverts to "All". |
| Toggle tag on a todo | Add the tag id to that todo's `tagIds` if absent, remove it if present — affecting only that todo. Toggling twice returns to the original state. |
| Select tag filter | View shows only todos whose `tagIds` contains the selected tag id. |
| Select "All" | View shows every todo regardless of tags (default view). |

**Filter fallback rule**: the active filter is validated against the live tag list on every render — if the selected tag id is no longer present, it resolves to "All". This is what makes removal of the filtered tag revert the view (FR-010) without explicit cross-page signaling.

## Persistence

| Store | localStorage key | Restored on load |
|-------|------------------|------------------|
| Tags | `tags` | Full tag list. |
| Todos (incl. `tagIds`) | `todos` (existing) | Todos with their assignments. |

The active filter is **not** persisted (view-only state; defaults to "All").
