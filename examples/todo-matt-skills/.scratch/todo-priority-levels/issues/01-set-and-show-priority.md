# 01 — Set and show a todo's priority

**What to build:** A todo now carries a priority — low, medium, or high. When adding a todo, the person can pick a priority right in the add form; it defaults to Medium so routine items need no thought. Each todo in the list shows a small colored badge for its level (high reads warm/urgent, low reads calm/cool), so urgency is obvious at a glance without reading the text. Priorities survive a page reload, and todos saved before this feature existed (which have no priority stored) load as Medium instead of crashing or showing a blank badge. This ticket covers everything except reordering the list — a user can set a priority, see its badge, toggle/delete/clear-completed, and reload without losing the value.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `Todo` gains a required `priority` field: `'low' | 'medium' | 'high'`.
- [ ] The add action accepts an optional priority and defaults to `'medium'` when omitted, so existing callers keep working.
- [ ] The add form has a priority selector (native `<select>`, matching the app's inline-style / plain-HTML approach) defaulting to Medium, and passes the chosen value through when adding.
- [ ] Each todo renders a small colored badge for its priority next to the text, using the existing inline-style pattern (no new CSS module/classes). Colors are visually distinct across the three levels (high warm, low cool).
- [ ] Priority persists across reloads (localStorage round-trip).
- [ ] Todos persisted before this feature (missing the `priority` key) load as `'medium'` and render a normal badge — no crash, no blank/unstyled badge. Normalization lives in the todos store, not in the generic storage helper.
- [ ] App-level tests (RTL, driving the real UI) cover: adding without touching the selector yields a Medium badge; adding each of the three priorities shows the right badge; toggling and deleting don't change a todo's badge; priority survives an unmount/remount; a pre-feature todo seeded into localStorage (no `priority` key) renders with a Medium badge.
