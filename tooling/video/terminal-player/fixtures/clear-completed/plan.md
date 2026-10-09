# Plan: Clear completed todos

**Spec**: [spec.md](./spec.md)

## Approach

One pure function drops the ticked todos from the list.
The button calls it, and hides itself when nothing is ticked.

## Files

- `src/todos.js` — `clearCompleted(todos)` returns the open ones.
- `src/app.js` — the button, its hidden state, the remaining count.
- `test/todos.test.js` — the list keeps its order after a clear.
