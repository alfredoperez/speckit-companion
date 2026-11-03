# Data Model: Article Drafts and Review

The RealWorld API is unchanged. All new data is client state: a persisted slice overlaying API articles, plus one optional session flag (research.md, decisions 1-3).

## Entities

### ArticleStatus (enum)

`draft` | `in-review` | `changes-requested` | `approved` | `published`

Labels shown to users: Draft, In review, Changes requested, Approved, Published. Defined in `article.contracts.ts` as `ArticleStatusSchema`, inferred in `article.types.ts`. `ArticleSchema` itself gets no required status field (research 2).

### ArticleStatusEntry (per slug)

| Field | Type | Notes |
|---|---|---|
| `status` | `ArticleStatus` | Current status |
| `reviewNote` | `string \| null` | Latest reviewer note only; set on request-changes, cleared on send for review |

### Article status slice (`article.status.model.ts`)

- State: `Record<slug, ArticleStatusEntry>`, injected lazily like `session.model.ts`, persisted with redux-persist.
- Key: article `slug`. The author is not stored here; it comes from the API article (`author`).
- Absent entry means Published (FR-018). No migration is needed.
- Actions: `set({ slug, status, reviewNote? })`. Writes happen only after `canMoveStatus` passes.

### Session user (extended)

| Field | Type | Notes |
|---|---|---|
| `reviewer` | `boolean` (optional, default false) | Added to `session.contracts.ts`; how it is granted is out of scope |

### Permission context (extended)

Adds `articleStatus` and `articleAuthorId`. New actions: `send`, `approve`, `requestChanges`, `publish`, `unpublish`. `read` becomes status-aware for non-Published articles. A reviewer right is the session flag AND not the article's author.

## Relationships

- Article (API) 1 : 0..1 ArticleStatusEntry, joined by slug. No entry means Published.
- ArticleStatusEntry holds at most one review note (latest only).
- Reviewer is a flag on the session user, not a separate record. The reviewer is not stored on the entry.
- The comments and favorites of an article are untouched and are hidden or shown with the article's visibility.

## State transitions

| From | To | Action | Who |
|---|---|---|---|
| Draft | In review | send for review | author |
| Changes requested | In review | send for review | author |
| In review | Approved | approve | reviewer, not the author |
| In review | Changes requested | request changes (non-empty note) | reviewer, not the author |
| Approved | Published | publish | author |
| Published | Draft | unpublish | author |

Initial state: Draft (on create). Every other move is refused and leaves the entry unchanged (FR-010). `canMoveStatus(current, action)` in `article.status.lib.ts` is the single check, and each mutation calls it against the current stored status, so a stale action from a concurrent edit is refused.

Side effects:
- send for review: clears `reviewNote`.
- request changes: stores the trimmed note.
- unpublish: keeps content, comments and favorites. They are hidden with the article and return on republish.

## Validation rules

- Status must be one of the five values (FR-001).
- New article: status Draft (FR-002).
- Review note: trimmed length greater than 0. Whitespace-only counts as empty and is refused with no status change (FR-007, SC-004).
- Approve and request changes: the actor has the reviewer flag and is not the article's author (FR-006, FR-007).
- Send, publish, unpublish: the actor is the article's author (FR-005, FR-008, FR-009).
- Publish requires current status Approved (US5 scenario 4).
- Missing status resolves to Published (FR-018).

## Visibility (`isArticleVisible`)

| Viewer | Published | In review | Draft, Changes requested, Approved |
|---|---|---|---|
| Author | yes | yes | yes |
| Reviewer (not author) | yes | yes, read-only | no |
| Others, guests | yes | no | no |

A hidden article is filtered out of every list, and its direct link behaves as not found (FR-003, FR-004). This is enforced in the client only (research 1).

## Editor and label mapping

| Status | Editor | Controls |
|---|---|---|
| Draft | editable | Save, Send for review |
| In review | read-only, banner | none for author; Approve and Request changes for reviewer |
| Changes requested | editable, note above form | Save, Send for review |
| Approved | read-only | Publish |
| Published | public article | Unpublish |

List label: shown only on the signed-in author's own articles that are not Published (FR-016).
