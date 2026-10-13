# Contributing to SpecKit Companion

Thanks for considering a contribution. This guide tells you how to get the extension running locally, what conventions the codebase expects, and how to land a PR cleanly.

If you only have five minutes, skim **Quick Start** and **Docs** — those two cover 80% of what reviewers care about.

> **Two extensions live in this repo.** This guide is for the **VS Code extension** (the GUI — `apps/vscode/src/`, `apps/vscode/webview/`, `package.json`). The **spec-kit extension** (`apps/speckit-extension/`, `id: companion`) is a separate, independently-versioned product with its own dev loop, changelog, and version — if you're working on it, follow **[apps/speckit-extension/docs/contributing.md](apps/speckit-extension/docs/contributing.md)** instead.

---

## Quick Start

```bash
git clone https://github.com/alfredoperez/speckit-companion.git
cd speckit-companion
npm install
code .
# then press F5 in VS Code → "Run Extension" launches the Extension Development Host
```

The Extension Development Host is a second VS Code window with the local build of SpecKit Companion loaded. Open any folder in it — that's where the extension is active.

## Prerequisites

- **Node.js 18+**
- **VS Code 1.84+** (matches `engines.vscode` in `package.json`)
- **An AI CLI** for testing the SpecKit features end-to-end: Claude Code, Gemini CLI, GitHub Copilot CLI, Codex CLI, or Qwen CLI. You don't need all of them — pick whichever you use.
- **Python 3.9+** on your PATH as `python3`, only if you touch `apps/speckit-extension/`. Its suite is stdlib `unittest`, so there is nothing to install. A change confined to `apps/vscode/src/` or `apps/vscode/webview/` needs `npm test` alone.

## Development Loop

Most contributors keep two things running:

```bash
npm run watch   # incremental TypeScript compile
```

Then **F5** in VS Code to launch the Extension Development Host. After a code change, run **Developer: Reload Window** (`Cmd+R` / `Ctrl+R`) inside the dev host to pick up the new build.

Other build commands:

```bash
npm run compile         # one-shot TypeScript compile (apps/vscode/src/)
npm run package-web     # webpack production bundle (apps/vscode/webview/)
npm run watch-web       # webpack development watch (apps/vscode/webview/)
npm run package         # produce a .vsix
npm run install-local   # bump patch, package, install the .vsix in your VS Code
```

`npm run install-local` is the fastest way to dogfood a packaged build of your change.

## Tests

```bash
npm test                # full suite
npm run test:watch      # watch mode
npm run test:coverage   # coverage report
```

`npm run test:all` runs the jest suite and the spec-kit extension's stdlib-unittest suite together, which is what CI runs. It needs `python3` on your PATH; without it, run `npm test` for a change that stays inside `apps/vscode/src/` or `apps/vscode/webview/`.

CI runs each suite only where it can say something. A `changes` job reads the diff once, and the three gates — `test`, `capture-suite`, `visual-gate` — each either run or report a one-line pass, so a docs-only change does not wait on a browser. All three still report, because a required check that never reports blocks the merge. When the diff cannot be worked out at all, every job runs.

- **Style**: BDD — `describe()` / `it()` blocks describe behaviour, not implementation. Read a few existing test files in `apps/vscode/src/**/*.test.ts` before adding new ones.
- **VS Code mock**: extension-side tests use `apps/vscode/tests/__mocks__/vscode.ts` (mapped via `jest.config.js#moduleNameMapper`). When you need a VS Code API that isn't mocked yet, add it there rather than stubbing inline.
- **Config**: Jest runs through `ts-jest` against `tsconfig.test.json`.

## Project Layout (5-second tour)

```
apps/vscode/src/       — extension entry, providers, managers, AI provider integrations
apps/vscode/webview/   — webview UIs (spec viewer, spec editor, workflow editor)
docs/        — images only: screenshots, the architecture diagram
specs/       — spec-driven development specs (one folder per feature)
.specify/    — SpecKit CLI config / templates (NOT shipped with the extension)
.claude/     — workspace AI setup (NOT shipped with the extension)
```

Two things to internalise before editing:

1. **Extension isolation** (`CLAUDE.md` → "Extension isolation"): the packaged extension only ships code under `apps/vscode/src/` plus the bundled webview. Anything under `.claude/**` or `.specify/**` is the user's environment, not the extension's. Don't implement extension features by editing those — use `apps/vscode/src/` code or prompt text instead.
2. **Spec-driven development**: this project uses SDD. Non-trivial features live as a folder under `specs/NNN-slug/` with `spec.md`, `plan.md`, and `tasks.md`. See any recent folder under `specs/` for the shape.

## Commit Style

This repo uses **Conventional Commits** with a scope. The scope is the primary directory or feature area touched. Skim `git log --oneline` for the prevailing patterns — examples from real history:

```
feat(spec-viewer): pin header and add responsive TOC sidebar
fix(workflow-editor): remove custom editor that hijacked diff view
feat(specs): copy spec path or name from right-click menu
docs(readme): refresh top-of-page positioning, add latest features
chore: bump version to 0.13.0
```

Types in use: `feat`, `fix`, `docs`, `refactor`, `chore`. The subject is imperative, lowercase, and ends without a period. Keep titles ≤ 72 chars.

For `chore` commits (version bumps, release prep) the scope is usually omitted.

## Docs

Each fact has one home, listed under "One fact, one owner" in `CLAUDE.md`. Settings and providers live on the docs site's reference pages, how a feature works lives on its one site page, and the README is only an intro, an install and a first run. Update the one home; do not add a second copy.

## Pull Request Process

1. Branch from `main` (don't stack new work on a previously-merged feature branch — this repo squash-merges, so the old commits won't be in the history of your new branch).
2. Make your changes.
3. Run `npm run test:all` and `npm run compile`. For a change that touches no Python, `npm test` and `npm run compile` are enough.
4. Update the doc that owns what you changed (see **Docs** above). If your change is internal-only (refactor, test-only, build), say so in the PR.
5. Open a PR using the template in `.github/pull_request_template.md`. Fill in the related issue, description, screenshots (for UI changes), and the checklist.
6. Reviewers merge by squashing — keep your commits readable but don't stress over rebase noise.

## References

- [CLAUDE.md](CLAUDE.md) — the repo map, the architecture rules the code cannot show, and which doc owns which fact
- [docs/architecture/diagram.html](docs/architecture/diagram.html) — how a command travels, as one page you open in a browser
- [The docs site](https://speckit-companion.dev/docs/) — how every feature behaves for a user
- `apps/vscode/src/core/types/specContext.ts` — the `.spec-context.json` contract

## Reporting Issues

Use GitHub Issues with the templates under `.github/ISSUE_TEMPLATE/`:

- **Bug Report** — for unexpected behaviour
- **Feature Request** — for new functionality

## Code of Conduct

Please read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing you agree that your contributions are licensed under the MIT License (see [LICENSE](LICENSE)).
