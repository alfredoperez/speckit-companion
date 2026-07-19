# Todos — Coverage

| Requirement | Covered by | Status |
|---|---|---|
| Todo state changes through a single reducer | src/store/todos.test.tsx (reducer actions) | ✅ |
| Todos survive a reload | src/lib/storage.test.ts | ✅ |
| Consumers read todos through the hook | src/App.test.tsx (renders via provider) | ✅ |
| Users can add a todo | — | ❌ |
| Users can clear completed todos | specs/001-clear-completed tasks T001-T006 | ❌ |

> A mapping is a claim that a test exists, not proof that it is any good.
> The last row points at tasks rather than a test file, so it does not count as
> coverage — which is the report doing its job.
