# Todo App — Matt Pocock Skills Sandbox

A small React + TypeScript todo app (copied from speckit-companion's todo-claude
example) used to test running Matt Pocock's skills (github.com/mattpocock/skills)
as a custom workflow inside the SpecKit Companion VS Code extension.

Existing code: React 18 + vite + vitest, components/pages/store under `src/`.
New features go through the workflow below — the workflow is the star.

## Agent skills

This repo uses Matt Pocock's engineering skills (vendored under `.claude/skills/`).
Per-repo configuration lives in `docs/agents/`:

- `docs/agents/issue-tracker.md` — issue tracker config (local markdown under `.scratch/`)
- `docs/agents/domain.md` — domain doc layout (single-context: root `CONTEXT.md` + `docs/adr/`)

Main flow: `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` per ticket
(clear context between tickets). `/implement` drives `/tdd` internally and closes
with `/code-review` before committing.

## Conventions

- Specs live at `.scratch/<feature-slug>/spec.md`
- Tickets live at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered in dependency order
- Run tests with `npm test`; dev server with `npm run dev`

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
