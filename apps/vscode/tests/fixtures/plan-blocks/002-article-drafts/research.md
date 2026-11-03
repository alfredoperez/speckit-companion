# Research: Article Drafts and Review

## 1. Where status lives
- **Decision**: a persisted client slice keyed by article slug, `{ status, reviewNote }`, overlaying API articles.
- **Rationale**: the RealWorld API has no status, note, reviewer or filtering. Extending the backend is out of the repo. A slice matches the project's client-state pattern.
- **Alternatives considered**: extend the API contract and wait for a server (nothing to call); a second store (`CLAUDE.md` forbids it).
- **Limit**: visibility is enforced in the client only. Another browser or a direct API call still sees the article. Recorded as a concern.

## 2. Missing status means Published (FR-018)
- **Decision**: absence of a slice entry means Published. `ArticleSchema` itself gets no required status.
- **Rationale**: the cache code uses `ArticleSchema.safeParse` on cached data, so a required field would silently drop older entries.
- **Alternatives considered**: `.default('published')` in the contract (changes every parse site); defaulting in `article.lib.ts` (the entity would then claim a status the server never sent).

## 3. Reviewer role
- **Decision**: an optional `reviewer` boolean on the session user, default false. How it gets set stays out of scope.
- **Rationale**: the session has no role field and roles in `permission.service.ts` are mutually exclusive.
- **Alternatives considered**: a new `reviewer` role in the table (cannot combine with author, and an author-reviewer must not review their own article).

## 4. Permission shape
- **Decision**: extend the context with `articleStatus` and `articleAuthorId`, add actions `send`, `approve`, `requestChanges`, `publish`, `unpublish`, and compute reviewer rights from the session flag plus a not-the-author check.
- **Rationale**: FR-017 requires one source. `read` becomes status-aware for non-Published articles.
- **Alternatives considered**: a separate review-permission module (two sources of rights).

## 5. Status actions are separate slices
- **Decision**: five slices under `features/article/`, each a mutation that checks `canMoveStatus` then writes the slice.
- **Rationale**: slices cannot import siblings, and each action has its own button and test.
- **Alternatives considered**: one `change-status` slice (a single mutation with a switch; less to write but hides five distinct rules).

## 6. Save stays in the editor
- **Decision**: `update-article` no longer navigates away on success, and `create-article` saves as Draft.
- **Rationale**: stories 1 and 4 say Save keeps the article in its state.
- **Alternatives considered**: keep navigating (contradicts the stories).
