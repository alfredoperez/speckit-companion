# Plan: A project health view

## Summary

A small health module per host gathers four checks (CLI version, Companion installed, constitution, AI agent) from helpers that already exist; VS Code shows them as a collapsible tree item in the overview, and the board adds them, plus the worktree traps, to its snapshot and shows a foldable panel. Nothing is written; every fix is an existing command.

## Project Structure

```text
apps/vscode/src/features/settings/overviewProvider.ts (+ a health module and tests)
apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/{server.mjs, specs-core.mjs or a new health.mjs, public/app.js}, tests, vendor/
CHANGELOG.md, apps/copilot-canvas/CHANGELOG.md, docs
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I–IV | PASS: read-only checks from existing helpers. |
