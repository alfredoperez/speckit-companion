# Plan: Rebuild the pipeline after a Companion reinstall

## Summary

The build already has a dry-run preview that says, per command, whether the installed body differs from what `companion.yml` builds. VS Code runs that preview when it opens a configured project and whenever the extension's files change, and rebuilds on a difference. The copy step learns Copilot's `.github/skills/` folder.

## Project Structure

```text
apps/speckit-extension/scripts/emission_sync.py     KNOWN_AREAS gains .github/skills
apps/speckit-extension/tests/test_emission_sync.py   a Copilot skill case
apps/vscode/src/features/specs/pipelineBuildCommands.ts   rebuildIfLost
apps/vscode/src/extension.ts                        calls it from onCompanionFilesChanged
apps/vscode/src/features/specs/__tests__/rebuildIfLost.test.ts   new
CHANGELOG.md, apps/speckit-extension/CHANGELOG.md
```

**Structure Decision**: one signal, the build's own preview; the doctor cannot use it because the build is not shipped with the spec-kit extension.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. Keeps the project's configuration in force. |
| II. Spec-Driven Workflow | PASS. |
| III. Visual and Interactive | PASS. No UI change. |
| IV. Modular Architecture | PASS. The host runs the build; the spec-kit half owns it. |
