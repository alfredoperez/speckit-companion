# matt-skills sandbox

Tests Matt Pocock's skills (github.com/mattpocock/skills, MIT) running as a
**custom workflow inside SpecKit Companion** — proof that the Companion sidebar,
spec viewer, and step buttons work with workflows that aren't spec-kit.

The app is speckit-companion's `todo-claude` example (React + vite + vitest),
so we only spend tokens on ONE small feature, not a greenfield build.

## What's wired up

- **Skills** — the relevant engineering + productivity skills are vendored in
  `.claude/skills/` (to-spec, to-tickets, implement, tdd, code-review,
  grill-with-docs, grilling, grill-me, handoff, ask-matt, diagnosing-bugs, setup).
- **Repo config** — `docs/agents/issue-tracker.md` is set to the **local markdown
  tracker**, so specs land in `.scratch/<feature>/spec.md` and tickets in
  `.scratch/<feature>/issues/NN-slug.md`. No GitHub needed.
- **Companion** — `.vscode/settings.json` registers the `matt-skills` custom
  workflow with `speckit.specDirectories: [".scratch"]`, so every feature folder
  shows up in the sidebar with Spec → Tickets → Implement steps, plus Grill and
  Code Review buttons.

## Test drive

1. `npm install`, then open this folder in VS Code (SpecKit Companion installed,
   provider: Claude).
2. New Spec → workflow `Matt Pocock Skills` → paste the feature prompt (small,
   e.g. priority levels on todos).
3. Optionally hit **Grill** first (`/grill-with-docs`) to sharpen the idea.
4. **Spec** runs `/to-spec` → `.scratch/<feature>/spec.md` appears in the viewer.
5. **Tickets** runs `/to-tickets` → numbered tickets appear under `issues/`.
6. **Implement** runs `/implement` per ticket — TDD red/green/refactor, then
   code review, then commit. Clear context between tickets.

## Things to verify on first run

- Does the sidebar pick up `.scratch/<feature>/` folders as specs? (discovery is
  folder-based, so it should)
- Does the Tickets step render the `issues/` subDir files in the doc tree?
- `npm install` before implementing (vitest/tsx needed for TDD).
