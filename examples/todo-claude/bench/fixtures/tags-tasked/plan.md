# Implementation Plan: Tags

## Summary

Add a small, reusable vocabulary of labels ("tags") that a person can create in a dedicated Tags area, assign on or off per todo, and use to filter the todo list down to a single label. Tags live in their own store slice that follows the existing todos store (reducer + context + `useTags()` hook) and persists to `localStorage`; assignments are stored as a `tagIds` list directly on each todo so the relationship is owned per-todo and survives reload. Tag removal cascades — the assignment is stripped from every todo and any active filter on the removed tag falls back to the default "All" view.

## Project Structure

```
src/
├── types.ts                    # add Tag; add tagIds to Todo
├── App.tsx                     # wrap tree in <TagsProvider>; add /tags <Route>
├── store/
│   ├── todos.tsx               # extend: toggle-tag + remove-tag-from-todos actions; normalize loaded tagIds
│   └── tags.tsx                # NEW — TagsProvider + useTags(); persists key "tags"
├── components/
│   ├── Header.tsx              # add nav <Link to="/tags">Tags</Link>
│   ├── AddTag.tsx              # NEW — name input + create (mirrors AddTodo)
│   ├── TagList.tsx             # NEW — list of tags with remove control
│   ├── TagFilter.tsx           # NEW — "All" + one control per tag
│   ├── TodoItem.tsx            # add per-tag on/off assignment controls
│   └── TodoList.tsx            # thread tags + assignment/toggle props through
└── pages/
    ├── TagsPage.tsx            # NEW — wires useTags + useTodos (cascade on remove)
    └── TodosPage.tsx           # owns active-filter state; filters todos; passes tags down
```

**Structure Decision**: Follow the app's established layering unchanged — shared state in a `src/store/` slice, persistence through `src/lib/storage.ts`, presentational prop-driven components, and pages wiring components to stores. Tags add one new store slice, one new route/page, and three new presentational components; existing files are extended rather than restructured.

## Constitution Check

| Principle | Assessment |
|-----------|------------|
| I. Type Safety First | PASS — `Tag` and the extended `Todo` are explicitly typed; new store actions, props interfaces, and the `useTags()` value are fully typed; no `any`. |
| II. Component-First Architecture | PASS — new components (`AddTag`, `TagList`, `TagFilter`) are presentational and prop-driven; shared tag state is lifted to a store; pages do the wiring. |
| III. Test-First Development | PASS — acceptance scenarios become failing tests first (tag CRUD, assignment independence, filtering, removal cascade, persistence across remount), then implementation. |
| IV. Simplicity (YAGNI) | PASS — one additive `tagIds` field instead of a separate assignment store; filter kept as validated local state instead of a persisted slice; cascade is two explicit store calls, no event bus. |
| V. Code Quality Standards | PASS — small focused functions/components, no magic strings (storage key as a named constant like the existing `STORAGE_KEY`), explicit handling of empty/whitespace tag names. |

No violations — Complexity Tracking omitted.

## Phase 0 — Research

See [`research.md`](./research.md). Key decisions: store assignments as `tagIds` on the `Todo`; give tags their own store slice persisted under the `tags` key; keep the active filter as validated local page state; cascade tag removal from the page handler; normalize todos loaded without `tagIds`.

## Phase 1 — Design & Contracts

- [`data-model.md`](./data-model.md) — the `Tag` entity, the `Todo` extension, validation rules, and the removal cascade / filter-fallback transitions.
- [`contracts/ui-contract.md`](./contracts/ui-contract.md) — the route, navigation, filter, and persistence identifiers a consumer or test codes against, copied verbatim from the spec's Verbatim Constraints.

Post-design constitution re-check: the design introduces no new dependency and no new abstraction beyond one store slice — all principles remain PASS.
