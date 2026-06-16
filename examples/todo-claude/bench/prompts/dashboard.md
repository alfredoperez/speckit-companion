# Bench prompt — DASHBOARD ("Stats dashboard — many independent widgets")

A **new page made of several independent widgets** — chosen so the task list has many genuinely parallel (`[P]`) tasks: each widget is its own file, reads the existing todos store, and depends on none of the others. Use it to test whether implement actually fans out subagents. Paste everything between the rules into the specify step. Follow the app's conventions (a `pages/` component + a `<Route>` in `App.tsx` + a nav `<Link>` in `Header.tsx`; read state through the existing todos store; presentational components under `src/components/`).

---

Add a "Dashboard" page that shows several at-a-glance stats about the todos.

**Behavior**

- A new "Dashboard" page at the `/dashboard` route, reachable from a "Dashboard" link in the header nav.
- The page shows a row of independent stat cards, each reading the existing todos:
  - **Total** — the total number of todos.
  - **Completed** — how many are done.
  - **Active** — how many are not done.
  - **Completion rate** — the percent of todos that are done (shows 0% when there are no todos).
  - **Oldest active** — the text of the oldest still-active todo (or a friendly "nothing active" message when there are none).
- Each card stands on its own — it shows its label and its value, and updates when the todos change.
- With no todos, every card still renders with a sensible empty value (0, 0%, or the empty message); nothing crashes.

Keep the existing add / toggle / delete behavior unchanged, and don't change the todos data model.

---
