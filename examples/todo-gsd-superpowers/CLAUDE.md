# Todo App — GSD × Superpowers Sandbox

A small React + TypeScript todo app (copied from speckit-companion's todo-claude
example) for testing Eric Tech's mixed workflow: GSD does phase planning,
Superpowers does TDD execution, GSD verifies.

Existing code: React 18 + vite + vitest, components/pages/store under `src/`.
New features go through the workflow below — the workflow is the star.

## Workflow rules

- Phase planning and verification belong to GSD (`/gsd-plan-phase`, `/gsd-verify-work`).
- Execution belongs to Superpowers (`writing-plans` → `subagent-driven-development`,
  strict TDD). **Never run `/gsd-execute-phase`** — Superpowers replaces it.
- Gap loop: `/gsd-plan-phase --gaps` → Superpowers executes the gap plans →
  `/gsd-verify-work` again.
- GSD artifacts live in `.planning/`. Don't edit them by hand.
- This is brownfield: run `/gsd-map-codebase` once before the first phase.

## Conventions

- Run tests with `npm test`; dev server with `npm run dev`
