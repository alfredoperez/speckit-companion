# Research: Tags

Phase 0 decisions for the Tags feature. The stack is already settled by the app (React 18 + TypeScript + Vite + react-router, Vitest for tests), so the open questions here are all about *where* tag state lives and how it attaches to the existing todo model — not about new dependencies. No new packages are needed.

## Decision 1 — Store tag assignments on the Todo, not in a separate map

**Decision**: Add a `tagIds: string[]` field to the existing `Todo` type and manage assignment through the todos store.

**Rationale**: The spec's Key Entities section says the assignment relationship is "owned per-todo" and an assumption states tags "attach to the current todo model." Embedding `tagIds` on each todo matches that ownership exactly, rides the existing `todos` localStorage key for free (satisfying persistence FR-011), and keeps assignment a single reducer action on the store that already owns todos.

**Alternatives considered**: A separate `assignments` store keyed by todo id — rejected. It introduces a second source of truth that must stay in sync with todo creation/deletion and duplicates persistence wiring, violating the constitution's Simplicity (YAGNI) principle for no benefit.

## Decision 2 — Tags get their own store slice

**Decision**: Create `src/store/tags.tsx` with a `TagsProvider` (reducer + context) and a `useTags()` hook, mirroring the shape of `src/store/todos.tsx`. Persist under the localStorage key `tags`.

**Rationale**: Tags are cross-component shared state — the Tags area creates/removes them, the todo rows read them for assignment toggles, and the filter row reads them too. The project convention is explicit: shared cross-component state goes in a store slice under `src/store/`, not scattered `useState`. Following `todos.tsx` keeps the two slices consistent.

**Alternatives considered**: Holding tags in `useState` on the Tags page — rejected, the list is needed on the todos page as well, so lifting it to a store is required by the conventions.

## Decision 3 — The active filter is local page state, validated against live tags

**Decision**: The todo list's active tag filter is a `useState` value in `TodosPage` (its default is the "All" view, i.e. no tag selected). On each render the page validates the active filter against the current tag list and falls back to "All" when the selected tag no longer exists.

**Rationale**: The filter is view-only state; the spec does not require it to persist across reloads, so a store slice would be over-engineering. Validating the active filter against live tags is what cleanly satisfies FR-010's requirement that removing the filtered tag reverts the view to "All" — no cross-area messaging is needed, the stale selection simply resolves to "All".

**Alternatives considered**: Persisting the filter or putting it in a store — rejected (not required, adds complexity). An explicit "reset filter on tag removal" signal across pages — rejected in favor of render-time validation, which is simpler and self-healing.

## Decision 4 — Tag removal cascades from the page handler

**Decision**: The Tags page's remove handler calls both `removeTag(id)` (tags store) and `removeTagFromTodos(id)` (todos store) so no todo keeps a dangling reference.

**Rationale**: The removal originates in one place (the Tags area), and pages are the layer that wires stores together. Two explicit store calls in one handler is clear and testable, with no hidden coupling between the two stores.

**Alternatives considered**: A cross-store subscription/effect that watches tag deletions and strips ids — rejected as an abstraction the requirements don't justify (YAGNI).

## Decision 5 — Migrate todos persisted before tags existed

**Decision**: When the todos store seeds its reducer from storage, normalize each loaded todo so a missing `tagIds` becomes `[]`.

**Rationale**: Todos saved before this feature have no `tagIds`. Without normalization the assignment toggle would operate on `undefined`. Defaulting on load keeps old data valid and preserves the FR-011 guarantee that reload/remount restores state cleanly.

**Alternatives considered**: A versioned migration step — rejected as overkill for a single additive field.
