# 02 — Sort the list by priority

**What to build:** The list now always shows the most important todos first — high priority, then medium, then low — without the user doing anything. Todos at the same priority stay in the order they were added, so the list feels stable rather than shuffling around. Sorting is purely how the list is displayed: todos are still stored and persisted in the order they were typed, so adding, completing, deleting, and "Clear completed" all keep working unchanged and the on-disk order stays predictable. After any of those actions the visible list stays correctly ordered.

**Blocked by:** 01 — Set and show a todo's priority.

**Status:** done

- [x] A pure, standalone sort helper takes a list of todos and returns a high→medium→low ordering. It uses a stable sort so same-priority todos keep their relative insertion order.
- [x] The helper is applied once where the list is rendered (in the todos page, right before handing todos to the list), not inside the reducer — stored/persisted order stays insertion order.
- [x] Add / toggle / delete / clear-completed leave the reducer logic unchanged; the displayed list is re-sorted from the derived view each render.
- [x] App-level tests (RTL) cover: adding todos with each priority renders them in high→medium→low order; two todos added at the same priority keep their add order relative to each other; correct sort order survives an unmount/remount; the list stays correctly ordered after deleting and after "Clear completed".
