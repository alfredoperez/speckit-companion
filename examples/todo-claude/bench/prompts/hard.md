# Bench prompt — HARD ("Tags — a whole new feature")

A **new feature area**: its own route, its own data model + store slice, persistence, and a nav entry — plus a touch-point on todos. Paste everything between the rules into the specify step. Follow the app's conventions (a `pages/` component + a `<Route>` in `App.tsx` + a nav `<Link>` in `Header.tsx`; a new store slice under `src/store/` wrapped in `App.tsx`; persistence through `src/lib/storage.ts`).

---

Add a Tags feature so todos can be labelled and filtered.

**Behavior**

- A new "Tags" page at the `/tags` route, reachable from a "Tags" link in the header nav. On it, the user can type a name and create a tag, see the list of existing tags, and remove one. A created tag named `<name>` appears in the list as the text `<name>`.
- On the todos page, each todo row offers a per-tag toggle for every existing tag, so a todo can be assigned to zero or more tags. Toggling one on assigns it; toggling it off unassigns it.
- The todos page has a row of tag filters — one per tag, plus an "All" control. Selecting a tag shows only todos assigned to it; "All" shows every todo.
- Tags **and** their assignments to todos persist to `localStorage` and are restored on reload, surviving an app re-mount.

Keep the existing add / toggle / delete behavior unchanged.

---
