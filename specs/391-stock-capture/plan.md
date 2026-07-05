# Implementation Plan: Stock-mode capture — bundled writer + enriched prompts

**Feature**: 391-stock-capture · [spec.md](./spec.md) · size: normal

## Summary

Stock-mode GUI dispatches get a writer that always exists and instructions that capture the full reasoning trail. The writer needs no copy step at all: `write-context.py` is a self-contained, stdlib-only script, so un-ignoring that one file in the package manifest ships the actual source inside the extension — byte-identical by construction, and the development host already sees it at the same relative path. The prompt builders learn the extension's own install path (quoted, via the extensions API with a workspace-path fallback) and the stock preamble gains a compact per-step capture block: intent/expectations/context and requirement titles at specify, approach/decisions/step summary at plan and tasks, checks/coverage tests alongside the existing per-task journaling at implement. Companion-mode (slim) preambles are untouched. A committed sandbox eval drives a real headless AI run in a companion-free workspace with the exact forced preamble and asserts the produced context file.

## Project Structure

```
.vscodeignore                          # negate speckit-extension/scripts/write-context.py
src/ai-providers/
├── promptPreamble.ts                  # writerPath param; stock capture block per step; corrected prose
├── promptBuilder.ts                   # bundledWriterPath() via vscode.extensions + fallback; threads it
└── __tests__/promptBuilder.test.ts    # path injection, quoting, ICE lines, slim-unchanged, no workspace path
tests/eval/stock-capture/
├── run.mjs                            # scaffolds sandbox, forces the GUI preamble, drives headless AI
├── assert_capture.py                  # asserts status/ICE/titles/journaling/checks on the produced context
└── README.md                          # what it proves, how to run it
docs/capture-and-timing.md             # stock-mode section: bundled writer + enriched capture
CHANGELOG.md                           # root entry (#408)
```

**Structure Decision**: no new runtime modules — the change parameterizes the existing pure preamble module and its one impure caller; the eval lives outside jest (it shells out to a real AI CLI).

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no new settings; `speckit.aiContextInstructions` still gates everything. |
| II. Spec-Driven Workflow | PASS — run as a Companion pipeline spec with full capture. |
| III. Visual and Interactive | PASS — no UI change; the Activity panel simply receives data it already renders. |
| IV. Modular Architecture | PASS — preamble stays a pure text module; the impure path lookup stays in the builder. |
| AI Provider Integration | PASS — provider-agnostic: the preamble rides every provider's dispatch unchanged. |
| User Interface | PASS — untouched. |

No violations. Re-checked after Phase 1 design: still PASS — the design adds one parameter and one manifest negation; extension isolation is respected (the extension references its own shipped file, never the workspace's).
