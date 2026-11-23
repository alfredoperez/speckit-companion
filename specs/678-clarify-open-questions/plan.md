# Plan: Open questions and a Clarify action

## Summary

The shared `clarificationsIn` counter feeds an `openQuestions` number into the viewer state (VS Code) and into each spec the board sends (canvas, through the bundled viewer core). The VS Code spec header shows a pressable count that sends the existing clarify action; the board adds a Clarify chip with the count, sending the stock clarify command.

## Project Structure

```text
packages/viewer/src/contract (ViewerState.openQuestions), core/stateDerivation.ts, view/components/SpecHeader.tsx
apps/vscode/src/features/spec-viewer (host passes spec.md content or count into the derivation)
apps/vscode/webview stories and tests for the header
apps/copilot-canvas/build.mjs (export clarificationsIn), extension files prompts.mjs, specs-core.mjs, public/app.js, vendor/, tests
.changeset/, CHANGELOG.md, apps/copilot-canvas/CHANGELOG.md, docs pages
```

**Structure Decision**: one shared counter, two hosts; each host computes the count from the spec.md it already reads.

## Constitution Check

| Principle | Assessment |
|---|---|
| I–IV | PASS: a read-only count and an existing action. |

## Key Decisions

- **Reuse the existing clarify action** in VS Code. Rejected: a new message.
- **Stock clarify on the board** in both command sets. Rejected: a Companion clarify command that does not exist.
