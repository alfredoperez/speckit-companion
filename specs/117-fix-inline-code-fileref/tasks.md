# Tasks: Fix Inline-Code Misdetected as File-Ref

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Replace filename heuristic with extension allow-list — `webview/src/spec-viewer/markdown/inline.ts` | R001, R002, R003, R004
  - **Do**: Add a module-level `KNOWN_EXTENSIONS` `Set<string>` with the R002 list (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.md`, `.json`, `.jsonc`, `.css`, `.scss`, `.html`, `.htm`, `.yml`, `.yaml`, `.py`, `.sh`, `.bash`, `.zsh`, `.toml`, `.lock`, `.txt`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.vsix`). In the `.replace(/`([^`]+)`/g, …)` callback, derive the basename (split on `/` and `\`), grab its last `.<ext>` segment via a single regex, and dispatch to the `.file-ref` branch only when `KNOWN_EXTENSIONS.has('.' + ext.toLowerCase())`. Keep the existing `data-filename` / `title` / basename emission byte-identical — only the gate changes.
  - **Verify**: `npm test -- inline.test` passes; `npm run compile` clean.

- [x] **T002** [P] Add negative-case tests for dotted identifiers and unknown extensions — `webview/src/spec-viewer/markdown/inline.test.ts` | R005
  - **Do**: Inside the existing `describe('non-filename code span → plain <code>', …)` block, add four `it` cases asserting `parseInline` output contains `<code>…</code>` and does NOT contain `file-ref` or `<button` for inputs `` `ctx.currentStep` ``, `` `process.env` ``, `` `instance.panel.visible` ``, and `` `weird.xyz` ``. Leave all existing positive and negative cases untouched.
  - **Verify**: `npm test -- inline.test` — all old cases still green, four new cases green.
  - **Leverage**: existing `'renders a shell command as plain <code>, not a button'` test in the same file as the assertion shape.
