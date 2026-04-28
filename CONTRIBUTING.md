# Contributing to SpecKit Companion

Thanks for considering a contribution. This guide tells you how to get the
extension running locally, what conventions the codebase expects, and how to
land a PR cleanly.

If you only have five minutes, skim **Quick Start** and the **README docs
map** sections — those two cover 80% of what reviewers care about.

---

## Quick Start

```bash
git clone https://github.com/alfredoperez/speckit-companion.git
cd speckit-companion
npm install
code .
# then press F5 in VS Code → "Run Extension" launches the Extension Development Host
```

The Extension Development Host is a second VS Code window with the local
build of SpecKit Companion loaded. Open any folder in it — that's where the
extension is active.

## Prerequisites

- **Node.js 18+**
- **VS Code 1.84+** (matches `engines.vscode` in `package.json`)
- **An AI CLI** for testing the SpecKit features end-to-end: Claude Code,
  Gemini CLI, GitHub Copilot CLI, Codex CLI, or Qwen CLI. You don't need all
  of them — pick whichever you use.

## Development Loop

Most contributors keep two things running:

```bash
npm run watch   # incremental TypeScript compile
```

Then **F5** in VS Code to launch the Extension Development Host. After a
code change, run **Developer: Reload Window** (`Cmd+R` / `Ctrl+R`) inside
the dev host to pick up the new build.

Other build commands:

```bash
npm run compile         # one-shot TypeScript compile (src/)
npm run package-web     # webpack production bundle (webview/)
npm run watch-web       # webpack development watch (webview/)
npm run package         # produce a .vsix
npm run install-local   # bump patch, package, install the .vsix in your VS Code
```

`npm run install-local` is the fastest way to dogfood a packaged build of
your change.

## Tests

```bash
npm test                # full suite
npm run test:watch      # watch mode
npm run test:coverage   # coverage report
```

- **Style**: BDD — `describe()` / `it()` blocks describe behaviour, not
  implementation. Read a few existing test files in `src/**/*.test.ts`
  before adding new ones.
- **VS Code mock**: extension-side tests use `tests/__mocks__/vscode.ts`
  (mapped via `jest.config.js#moduleNameMapper`). When you need a VS Code
  API that isn't mocked yet, add it there rather than stubbing inline.
- **Config**: Jest runs through `ts-jest` against `tsconfig.test.json`.

## Project Layout (5-second tour)

```
src/         — extension entry, providers, managers, AI provider integrations
webview/     — webview UIs (spec viewer, spec editor, workflow editor)
docs/        — long-form references (linked below)
specs/       — spec-driven development specs (one folder per feature)
.specify/    — SpecKit CLI config / templates (NOT shipped with the extension)
.claude/     — workspace AI setup (NOT shipped with the extension)
```

Two things to internalise before editing:

1. **Extension isolation** (`CLAUDE.md` → "Extension Isolation"): the
   packaged extension only ships code under `src/` plus the bundled
   webview. Anything under `.claude/**` or `.specify/**` is the user's
   environment, not the extension's. Don't implement extension features by
   editing those — use `src/` code or prompt text instead.
2. **Spec-driven development**: this project uses SDD. Non-trivial
   features live as a folder under `specs/NNN-slug/` with `spec.md`,
   `plan.md`, and `tasks.md`. See `specs/058-floating-toast/` or any
   recent spec for the shape.

## Commit Style

This repo uses **Conventional Commits** with a scope. The scope is the
primary directory or feature area touched. Skim `git log --oneline` for
the prevailing patterns — examples from real history:

```
feat(spec-viewer): pin header and add responsive TOC sidebar
fix(workflow-editor): remove custom editor that hijacked diff view
feat(specs): copy spec path or name from right-click menu
docs(readme): refresh top-of-page positioning, add latest features
chore: bump version to 0.13.0
```

Types in use: `feat`, `fix`, `docs`, `refactor`, `chore`. The subject is
imperative, lowercase, and ends without a period. Keep titles ≤ 72 chars.

For `chore` commits (version bumps, release prep) the scope is usually
omitted.

## The README is the source of truth — keep it that way

`CLAUDE.md` contains a **"Feature → README section map"** that lists, for
every kind of change, which README section must be updated. **Read it
before opening a PR.** Examples from that map:

| You added… | Update in README… |
|---|---|
| A new AI provider | "Supported AI Providers" matrix + provider count + `package.json` enum |
| A new configuration setting | "Configuration" section (JSON example + value table) |
| A new sidebar action | `docs/sidebar.md` + the "Sidebar at a Glance" summary in README |
| A new webview UI element | "Reading Specs" subsection + retake the screenshot |

If your change is documented in `CLAUDE.md`'s map but not in the README
after your PR, reviewers will ask. Save the round trip.

## Pull Request Process

1. Branch from `main` (don't stack new work on a previously-merged feature
   branch — this repo squash-merges, so the old commits won't be in the
   history of your new branch).
2. Make your changes.
3. Run `npm test` and `npm run compile`.
4. Update `README.md` per the docs map in `CLAUDE.md`. If your change is
   internal-only (refactor, test-only, build), say so in the PR.
5. Open a PR using the template in `.github/pull_request_template.md`. Fill
   in the related issue, description, screenshots (for UI changes), and
   the checklist.
6. Reviewers merge by squashing — keep your commits readable but don't
   stress over rebase noise.

## References

Long-form docs live under `docs/` and are linked from the README:

- [docs/architecture.md](docs/architecture.md) — module structure,
  extension/webview boundaries, build pipeline
- [docs/sidebar.md](docs/sidebar.md) — sidebar tree-view behaviour:
  filters, sorts, lifecycle groups, badges, transitions
- [docs/viewer-states.md](docs/viewer-states.md) — spec viewer state
  machine: status lifecycle, footer buttons, badge text, step tabs
- [docs/how-it-works.md](docs/how-it-works.md) — end-to-end walkthrough
- [docs/spec-context-schema.md](docs/spec-context-schema.md) —
  `.spec-context.json` schema reference
- [CLAUDE.md](CLAUDE.md) — instructions for AI assistants editing this
  repo, plus the README docs map and per-release checklist

Look at a recent spec under `specs/` (for example,
[specs/058-floating-toast/](specs/058-floating-toast/)) for an example of
the SDD format used here.

## Reporting Issues

Use GitHub Issues with the templates under `.github/ISSUE_TEMPLATE/`:

- **Bug Report** — for unexpected behaviour
- **Feature Request** — for new functionality

## Code of Conduct

Please read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing you agree that your contributions are licensed under the
MIT License (see [LICENSE](LICENSE)).
