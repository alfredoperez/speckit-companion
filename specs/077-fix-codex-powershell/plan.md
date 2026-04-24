# Plan: Fix Codex Provider PowerShell Compatibility

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-24

## Approach

Replace Unix-only shell syntax in `codexCliProvider.ts` (`<` redirection, `sed` pipelines) with a uniform temp-file + shell-native stdin pipe, then branch the pipe shape on the workspace's `script` setting (`sh` vs `ps`). Do `$ARGUMENTS` substitution in Node before writing the temp file, eliminating the `sed` dependency entirely. Add a small shared helper under `src/ai-providers/` that reads and caches `.specify/init-options.json` so other providers can reuse it later.

## Technical Context

**Stack**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API, Jest (`ts-jest`)
**Key Dependencies**: none new — `fs`, `path`, existing `createTempFile` / `waitForShellReady` / `executeCommandInHiddenTerminal`
**Constraints**: Extension isolation — no changes to `.claude/**` or `.specify/**` tooling; helper must behave correctly when `init-options.json` is missing, unreadable, or malformed (fallback = `sh`, log only).

## Files

### Create

- `src/ai-providers/initOptions.ts` — exports `readInitOptions(outputChannel?)` returning `{ script: 'sh' | 'ps' }`. Reads workspace `.specify/init-options.json`, caches per-workspace result, logs one warning line on read/parse failure, returns default `{ script: 'sh' }` otherwise. Also exports `resetInitOptionsCache()` for tests.
- `src/ai-providers/codexCommandBuilder.ts` — pure helper `buildCodexExecCommand({ script, promptFilePath, permissionFlag })` returning the terminal command string. Branches on `script`: `sh` → `cat "<file>" | codex exec -`, `ps` → `Get-Content "<file>" -Raw | codex exec -`. Keeping command construction pure makes it unit-testable without terminal/FS side effects.
- `src/ai-providers/__tests__/initOptions.test.ts` — BDD tests: missing file returns default + no throw; valid `"script": "ps"` returns `ps`; invalid JSON logs warning and returns default; second call uses cache (fs.readFile called once).
- `src/ai-providers/__tests__/codexCommandBuilder.test.ts` — BDD tests: `sh` shape emits `cat "<file>" | codex exec -`; `ps` shape emits `Get-Content "<file>" -Raw | codex exec -`; no `<` redirection in either; permission flag is inserted before `codex exec` when non-empty.

### Modify

- `src/ai-providers/codexCliProvider.ts` — remove `escapeForSed` and both `sed | codex exec -` and `codex exec - < "$file"` branches. All three execute paths (`executeInTerminal`, `executeHeadless`, `executeSlashCommand`) now:
  1. Resolve the full prompt text (for known skills: read the prompt file, replace `$ARGUMENTS` in Node; for custom/fallback: use the passed-in prompt or the "Run the following SpecKit command: …" wrapper).
  2. Call `createPromptFile(resolvedPrompt, prefix)` to get a temp file.
  3. Call `readInitOptions(outputChannel)` to detect shell.
  4. Call `buildCodexExecCommand({ script, promptFilePath, permissionFlag })` to build the terminal line.
  5. Schedule cleanup as today via `Timing.tempFileCleanupDelay`. Log only provider type + detected `script` (never the prompt content).

## Data Model

<!-- No persisted data changes. `.specify/init-options.json` is read as-is. -->

- `InitOptions` (in-memory) — `{ script: 'sh' | 'ps' }`. Derived from `.specify/init-options.json`'s `script` field; any other value (missing, null, `"sh"`, `"bash"`, unrecognized) normalizes to `sh`.

## Testing Strategy

- **Unit**: BDD-style `describe`/`it` under `src/ai-providers/__tests__/`. Two suites cover the command-string construction (one `sh` case, one `ps` case — fulfills NFR003) and the init-options reader (cache, missing file, malformed JSON).
- **Edge cases**: missing `init-options.json`, invalid JSON, `script` value other than `sh`/`ps` (treat as `sh`), known-skill path with empty `$ARGUMENTS`, arguments containing `'`, `"`, `/`, `\`, and `$` (handled via Node string replace — no shell-escape hazards because content never hits the shell).

## Risks

- **PowerShell quoting of `Get-Content … | codex exec -`**: `codex exec -` must accept stdin identically under PowerShell's pipeline. Mitigation: use `-Raw` so the entire file is passed as one string (matches bash `cat` semantics); if Codex CLI ever rejects CRLF-terminated stdin on Windows, the temp-file writer can be switched to LF-only by passing the content through a normalization step in `createTempFile`.
- **`Get-Content` absent in non-PowerShell Windows shells (`cmd.exe`)**: Out of scope per spec ("Out of Scope: shells other than bash-family and PowerShell"). Document the `sh` vs `ps` contract in the helper's doc comment so a future `cmd` branch is easy to add.

## Summary (plain English)

**Problem**: On Windows PowerShell, SpecKit commands through the Codex provider crash because the extension emits `<` redirection and `sed` pipes — syntax only bash understands.

**Solution**: Move the prompt-prep work into Node (read the skill file, swap in `$ARGUMENTS`, save to a temp file) so nothing shell-specific happens before the command runs. Then read the user's `script` choice from `init-options.json` and build a pipe that matches their shell — `cat | codex exec -` for bash, `Get-Content -Raw | codex exec -` for PowerShell. A small shared helper for reading that setting is added alongside the providers so future provider fixes can reuse it.
