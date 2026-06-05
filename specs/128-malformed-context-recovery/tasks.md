# Tasks: Malformed Spec-Context Recovery

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** [P] Add typed `SpecContextParseError` — `src/features/specs/specContextReader.ts` | R001, R005
  - **Do**: Export a `class SpecContextParseError extends Error` with `filePath: string` and `reason: string` fields. In `parseAndNormalize`, throw it (instead of the plain `Error`) on `JSON.parse` failure; keep the message text equivalent (`spec-context.json exists but is invalid JSON (<path>): <reason>`). ENOENT still returns `null` in the readers — only the parse path throws the typed error.
  - **Verify**: `npm run compile` passes; `instanceof SpecContextParseError` is true for a bad-JSON read and the error carries `filePath` + `reason`.
  - **Leverage**: existing throw site at `specContextReader.ts:77-80`.

- [x] **T002** [P] Create reset module — `src/features/specs/specContextReset.ts` | R002, R003, R004, R007, NFR001, NFR002
  - **Do**: Add `resetMalformedContext(specDir, { workflow, specName, branch }, outputChannel?)`. Compute a collision-safe backup name `.spec-context.json.bak-<timestamp>` (if it exists, suffix `-1`, `-2`, … — R007). `fs.rename` the broken `.spec-context.json` to that path (preserves original bytes — R003; backup created before skeleton write — NFR001). Then build a skeleton via `backfillMinimalContext({ workflow, specName, branch })` and persist with `writeSpecContext(specDir, skeleton)` (now a clean ENOENT first-write the wipe-guard allows — R004). Append the output-channel line `[SpecViewer] Reset malformed context — backed up to <bak path>` (NFR002). Return the backup path.
  - **Verify**: `npm run compile` passes; calling it against a dir with broken JSON yields a `.bak-<timestamp>` holding the original bytes and a fresh valid skeleton at the original path.
  - **Leverage**: `src/features/specs/specContextBackfill.ts` (`backfillMinimalContext`), `src/features/specs/specContextWriter.ts` (`writeSpecContext`).

- [x] **T003** [P] Reset-module tests — `src/features/specs/__tests__/specContextReset.test.ts` *(depends on T002)* | R003, R004, R007
  - **Do**: BDD tests over a temp dir: (a) backup file contains the original broken bytes; (b) original path holds a valid, re-parseable skeleton afterward; (c) a pre-existing `.bak-<timestamp>` is not clobbered — a distinct backup name is chosen (R007); (d) a missing source file is a no-op error and fabricates no backup.
  - **Verify**: `npm test` green for the new file.
  - **Leverage**: existing temp-dir test style in `src/features/specs/__tests__/` (e.g. `specContextWipeGuard.test.ts`).

- [x] **T004** [P] Surface error + wire Reset into viewer — `src/features/spec-viewer/specViewerProvider.ts` *(depends on T001, T002)* | R001, R002, R005, R006, NFR002
  - **Do**: In `ensureSpecContext`, detect `err instanceof SpecContextParseError`; keep the existing read-only backfill render (R006) and existing output-channel log, but signal the parse failure to the render caller (around line 486) so the provider shows `vscode.window.showErrorMessage(<reason incl. file path>, 'Reset context')`. On the `Reset context` choice, call `resetMalformedContext(specDirectory, { workflow, specName, branch })` then `refreshContextIfDisplaying(<contextPath>)` to reload the panel. Missing-file (ENOENT) and healthy loads stay silent (R005); dismissing the toast leaves the broken file untouched (R006).
  - **Verify**: `npm run compile` passes; opening a spec with corrupt `.spec-context.json` shows the toast with a working **Reset context** button that repairs + reloads; healthy/missing specs show no toast.
  - **Leverage**: existing `showErrorMessage` usage in `messageHandlers.ts`, `refreshContextIfDisplaying` at `specViewerProvider.ts:293`.
