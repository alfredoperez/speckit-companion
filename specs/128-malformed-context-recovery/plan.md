# Plan: Malformed Spec-Context Recovery

**Spec**: [spec.md](./spec.md)

## Approach

Surface JSON parse failures at the viewer's single load chokepoint (`ensureSpecContext` in `specViewerProvider.ts`) instead of swallowing them into a silent backfill, and add a **Reset context** recovery that moves the broken file aside before writing a fresh skeleton. The reader already throws a descriptive error on bad JSON; we make that error *typed* (a `SpecContextParseError` carrying the file path + reason) so the provider can reliably distinguish "file is corrupt" from "file is missing" without string-sniffing. On parse failure the viewer still renders today's read-only backfill (non-blocking) and fires a `showErrorMessage(reason, 'Reset context')` toast; choosing Reset moves the bad bytes to `.spec-context.json.bak-<timestamp>` and writes a skeleton via the existing `backfillMinimalContext` + `writeSpecContext` path, then reloads the panel.

The move-aside ordering is forced by an existing invariant: `writeSpecContext` *refuses* to overwrite a file that is present-but-unparseable (the wipe guard). Renaming the broken file to the `.bak` path both satisfies R003 (original bytes survive in the backup) and turns the skeleton write into a clean ENOENT first-write the guard allows.

## Files

### Create

- `src/features/specs/specContextReset.ts` — `resetMalformedContext(specDir, { workflow, specName, branch }, outputChannel?)`: pick a collision-safe `.spec-context.json.bak-<timestamp>` name, `fs.rename` the broken file to it, then write a skeleton via `backfillMinimalContext` + `writeSpecContext`. Returns the backup path. Logs the backup path to the output channel.
- `src/features/specs/__tests__/specContextReset.test.ts` — BDD tests: backup file contains the original (broken) bytes; original path holds a valid skeleton afterward; backup filename does not collide with an existing `.bak-<timestamp>`; a missing source file is a no-op error (does not fabricate a backup).

### Modify

- `src/features/specs/specContextReader.ts` — introduce an exported `SpecContextParseError extends Error` (fields: `filePath`, `reason`) and throw it from `parseAndNormalize` instead of a plain `Error`, so callers can `instanceof`-detect parse failures vs. other read errors. Message text stays equivalent.
- `src/features/spec-viewer/specViewerProvider.ts` — in `ensureSpecContext`, when the caught error is a `SpecContextParseError`, signal it to the render caller (via callback/return discriminator) so the provider can show the `showErrorMessage(..., 'Reset context')` toast; on Reset, call `resetMalformedContext(...)` then `refreshContextIfDisplaying(...)` to reload. Missing-file (ENOENT) and healthy paths keep their current behavior. Keep the existing output-channel log line.

## Testing Strategy

- **Unit**: `specContextReset.test.ts` covers backup/skeleton/collision/no-op-on-missing using a temp dir (Node `fs`, no VS Code mock needed for the reset module itself).
- **Edge cases**: broken file with merge-conflict markers (parse throws); a pre-existing `.bak-<timestamp>` for the same timestamp must not be clobbered (R007); dismissing the toast leaves the broken file on disk (R006 — assert no rename happens without the Reset action).

## Risks

- `writeSpecContext` wipe-guard refuses to overwrite bad JSON: mitigated by moving the broken file to `.bak` *first* so the skeleton write is a fresh ENOENT write, not an overwrite.
- File-watcher re-entrancy: a reset rewrites `.spec-context.json`, which the watcher observes and triggers `refreshContextIfDisplaying`; reload is idempotent, so a double-refresh is harmless.
