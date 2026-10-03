# Implementation Plan: Assistant name and Show terminal on a spec

**Branch**: `625-spec-assistant-label` | **Spec**: [spec-assistant-label.spec.md](./spec-assistant-label.spec.md)

## Summary

When Companion dispatches a step it records the provider id on the spec as one additive field, and remembers the terminal the provider returned. One resolver turns the recorded id into a display name through an allow-list, and both the sidebar row and the viewer header read that resolver. A small in-memory registry maps a spec to its newest live terminal, drives a Show terminal command, and tells the sidebar and open viewers to refresh when that terminal closes.

## Project Structure

```text
apps/vscode/src/
├── ai-providers/aiProvider.ts                 # coerceProviderType (allow-list over AIProviders)
├── core/types/specContext.ts                  # SpecContext.assistant?: string
├── core/types/spec-context.schema.json        # assistant property
├── core/constants.ts                          # command id
├── features/specs/
│   ├── specAssistant.ts                       # NEW: resolveSpecAssistant, recordSpecAssistant
│   ├── specTerminals.ts                       # NEW: spec → newest live terminal, close listener, onChange
│   ├── dispatchStep.ts                        # notes the dispatch after run resolves
│   ├── specCommands.ts                        # clarify/analyze path notes too; showTerminal command
│   ├── specExplorerProvider.ts                # name in row description; +terminal contextValue suffix
│   └── selectionContextKeys.ts                # tolerate the suffix
├── features/spec-viewer/
│   ├── specViewerProvider.ts                  # navState.assistantName / hasTerminal
│   ├── html/generator.ts                      # same two fields on first paint
│   └── messageHandlers.ts                     # showTerminal adapter
├── protocol/viewer.ts                         # NavState fields, showTerminal message
└── extension.ts                               # register specTerminals, wire refresh
apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx   # label + button
apps/vscode/webview/styles/spec-viewer/_content.css             # label style
package.json                                   # command, row menus, suffix-tolerant when clauses
README.md, CHANGELOG.md, apps/website/src/content/docs/…        # docs
```

**Structure Decision**: Two new single-purpose modules beside the dispatch seam. The terminal registry stays separate from `terminalStepTracker`, because that one completes a step when its terminal closes and this one must never write lifecycle.

## Identifiers

- Context field: `assistant` (a provider id from `AIProviders`).
- Command: `speckit.specs.showTerminal`, title "Show Terminal", argument a spec row or an absolute spec directory.
- Row `contextValue`: the lifecycle value, or the lifecycle value followed by `+terminal`.
- `NavState` fields: `assistantName?: string`, `hasTerminal?: boolean`.
- Viewer message: `{ type: 'showTerminal' }`.
- Header classes: `spec-header-assistant`, `spec-header-terminal-btn`.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No provider-specific branch: the name comes from the provider registry. |
| II. Spec-Driven Workflow | PASS. Read and dispatch paths only; no workflow step changes. |
| III. Visual and Interactive | PASS. The feature is a label and one action on existing surfaces. |
| IV. Modular Architecture for Complex Features | PASS. New modules live in `features/specs`; `core/` gains only a type field. |
