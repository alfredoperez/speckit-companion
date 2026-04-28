# Spec: Contributing Guide

**Slug**: 091-contributing-guide | **Date**: 2026-04-28

## Summary

Flesh out the contributor onboarding surface so an outside developer can clone, run, and submit a PR without asking. The current `CONTRIBUTING.md` is a thin stub and the PR template is generic — this spec rewrites both to match the project's real conventions (Conventional Commits with scopes, the "update README per the docs map" rule, the F5 dev-host loop) and points at the existing `docs/` references.

## Requirements

- **R001** (MUST): `CONTRIBUTING.md` covers prerequisites (Node, VS Code, an AI CLI), local setup (`npm install`), the `F5` Extension Development Host loop, and `npm run watch` for auto-recompile.
- **R002** (MUST): `CONTRIBUTING.md` documents the Conventional Commits style with scopes used in this repo (e.g., `feat(spec-viewer):`, `fix(workflow-editor):`, `docs(readme):`, `chore:`) with at least three real-shape examples.
- **R003** (MUST): `CONTRIBUTING.md` links to `docs/architecture.md`, `docs/sidebar.md`, `docs/viewer-states.md`, and `CLAUDE.md` so contributors find the deep references without searching.
- **R004** (MUST): `CONTRIBUTING.md` calls out the README docs-map rule from `CLAUDE.md` — user-facing changes must update `README.md` in the section the map points to — and tells contributors to skim the map before opening a PR.
- **R005** (MUST): `.github/pull_request_template.md` includes a checkbox for "Updated `README.md` per the docs map (or N/A — internal change)" and a checkbox for tests passing (`npm test`).
- **R006** (SHOULD): `CONTRIBUTING.md` documents how to run the test suite (`npm test`, `npm run test:watch`) and notes the BDD `describe`/`it` style and the VS Code mock at `tests/__mocks__/vscode.ts`.
- **R007** (SHOULD): `CONTRIBUTING.md` mentions the `npm run install-local` shortcut for testing the packaged extension end-to-end.
- **R008** (SHOULD): `CONTRIBUTING.md` notes the project uses spec-driven development under `specs/` and points at one or two example specs as a template for new feature work.
- **R009** (MAY): PR template adds a one-line "Screenshots / GIFs" section for UI changes, since the project has visual-heavy webview features.

## Scenarios

### First-time contributor opens the repo

**When** a developer who has never touched the codebase reads `CONTRIBUTING.md` top-to-bottom
**Then** they can install dependencies, launch the Extension Development Host with `F5`, run the test suite, and identify which doc to update for their change — without opening a second tab to ask.

### Contributor opens a pull request

**When** a contributor opens a PR in GitHub
**Then** the template renders with checkboxes for the README docs-map update, tests passing, a link to the related issue, and (for UI changes) a screenshots slot.

### Contributor writes a commit message

**When** a contributor stages a commit for a fix in the spec viewer
**Then** the guide gives them the exact shape (`fix(spec-viewer): <description>`) and at least one real example they can mimic.

## Out of Scope

- Code of Conduct rewrite (existing `CODE_OF_CONDUCT.md` link is sufficient).
- New CI workflows, lint configs, or commitlint enforcement — guidance is documentary, not enforced via tooling.
- Issue templates (`.github/ISSUE_TEMPLATE/` already exists and is not part of this issue).
