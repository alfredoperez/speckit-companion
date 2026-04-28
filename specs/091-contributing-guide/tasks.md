# Tasks: Contributing Guide

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-28

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** [P] Rewrite CONTRIBUTING.md — `CONTRIBUTING.md` | R001, R002, R003, R004, R006, R007, R008
  - **Do**: Replace the existing stub with a fuller guide. Sections: Prerequisites (Node 18+, VS Code 1.84+, an AI CLI), Setup (`npm install`, open in VS Code, **press `F5` to launch the Extension Development Host**), Development Loop (`npm run watch` for auto-recompile while the dev host runs; reload the dev-host window to pick up changes), Tests (`npm test`, `npm run test:watch`, BDD `describe`/`it` style, mock at `tests/__mocks__/vscode.ts`), Packaging (`npm run package`, `npm run install-local` for end-to-end testing of the packaged `.vsix`), Commit Style (Conventional Commits with scopes — give real examples like `feat(spec-viewer): pin header and add responsive TOC sidebar`, `fix(workflow-editor): remove custom editor that hijacked diff view`, `docs(readme): refresh top-of-page positioning`, `chore: bump version to 0.13.0`), PR Process (link to PR template, mention the README docs map in `CLAUDE.md` is the source of truth for which README section to update), References (link `docs/architecture.md`, `docs/sidebar.md`, `docs/viewer-states.md`, `CLAUDE.md`, and call out `specs/` as the SDD spec directory with a pointer to a recent example like `specs/058-floating-toast/`).
  - **Verify**: File reads cleanly top-to-bottom; every promised link resolves to an existing file; commit examples match real history (`git log --oneline | head -20`).
  - **Leverage**: Existing `CONTRIBUTING.md` for structure; `CLAUDE.md` "Feature → README section map" for the docs-map rule; recent commits for real-shape examples.

- [x] **T002** [P] Extend the PR template — `.github/pull_request_template.md` | R005, R009
  - **Do**: Keep the existing scaffolding (Related Issue / Description / Type of Change / Testing / Checklist). Add to the Checklist: `- [ ] Updated README.md per the docs map in CLAUDE.md (or N/A — internal-only change)` and `- [ ] Tests pass (npm test)`. Add a new top-level section `## Screenshots / GIFs` with a one-line note "Required for UI changes; remove if N/A." Tighten the Testing section so the placeholder reads `Steps to test: …` followed by `npm test` for the unit suite.
  - **Verify**: Template renders correctly when opening a new PR draft; no broken markdown.
  - **Leverage**: Existing template structure.

- [x] **T003** Cross-check README and per-release checklist *(depends on T001, T002)* — `README.md` | R004
  - **Do**: Skim README to confirm a Contributing section exists or add a one-liner pointing to `CONTRIBUTING.md` if missing. Do **not** restructure README — just ensure new contributors land on the guide.
  - **Verify**: From the README, a reader can reach `CONTRIBUTING.md` in one click.
  - **Leverage**: Existing README structure.
