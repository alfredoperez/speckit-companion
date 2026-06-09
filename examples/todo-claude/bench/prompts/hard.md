# Bench prompt — HARD ("Tags — a whole new feature")

A **new feature area**: its own route, its own data model + store slice, persistence, and a nav entry — plus a touch-point on todos. Paste everything between the rules into the specify step. The **Required affordances** pin the user-visible surface so the bench can grade turbo and standard on one yardstick. Implement them exactly, following the app's conventions (a `pages/` component + a `<Route>` in `App.tsx` + a nav `<Link>` in `Header.tsx`; a new store slice under `src/store/` wrapped in `App.tsx`; persistence through `src/lib/storage.ts`).

---

Add a Tags feature so todos can be labelled and filtered.

**Behavior**

- A new "Tags" page at the `/tags` route, reachable from a "Tags" link in the header nav. On it, the user can create a tag from a typed name and see the list of existing tags (and remove one).
- On the todos page, each todo row can be assigned to zero or more existing tags via a per-tag toggle in the row.
- The todos page has a row of tag filters — one per tag, plus an "All" control. Selecting a tag shows only todos assigned to it; "All" shows every todo.
- Tags **and** their assignments to todos persist to `localStorage` and are restored on reload, surviving an app re-mount.

**Required affordances (the bench grades these — match exactly)**

- Header nav: a link with the exact text `Tags` pointing at `/tags`.
- On `/tags`: the new-tag input is `data-testid="tag-name-input"` and the create button is `data-testid="add-tag"`. A created tag named `<name>` is shown as visible text `<name>`.
- On the todos page, for a tag named `<name>`: the per-todo assignment toggle (one inside each row) is `data-testid="assign-<name>"`, and the filter control is `data-testid="filter-tag-<name>"`. The "show everything" filter is `data-testid="filter-tag-all"`.
- Use exact, raw tag names in the test ids (e.g. a tag "Work" → `data-testid="filter-tag-Work"`).

Keep the existing add / toggle / delete behavior unchanged.

---
