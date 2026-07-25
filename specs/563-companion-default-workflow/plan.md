# Implementation Plan: Default workflow to Companion when the companion extension is installed

**Feature branch**: `563-companion-default-workflow` | **Issue**: #567 | **Spec**: [spec.md](./spec.md)

## Summary

`speckit.defaultWorkflow` currently resolves through `config.get('defaultWorkflow', 'speckit')` at every read site, so an unset value always collapses to stock `speckit` even in a project that installed the companion spec-kit extension. We add one resolver, `resolveEffectiveDefaultWorkflow(root)`, that returns the explicitly-configured value when the user set one at any scope (detected via `config.inspect('defaultWorkflow')`), and otherwise returns `companion` when `isCompanionInstalled(root)` is true, else `speckit`. The two workflow-pick read sites (Create-Spec pre-selection in `specEditorProvider.handleReady`, and per-feature resolution in `workflowSelector.resolveDefaultWorkflow`) switch to the resolver; `workflowManager` validation and telemetry keep reading the raw configured value so the companion-adoption metric only counts explicit choices.

## Project Structure

```
src/
├── features/
│   ├── workflows/
│   │   ├── workflowManager.ts        # NEW resolver: resolveEffectiveDefaultWorkflow + pure pickEffectiveDefaultWorkflow
│   │   ├── workflowSelector.ts       # resolveDefaultWorkflow → use effective resolver
│   │   └── index.ts                  # re-export the new resolver
│   └── spec-editor/
│       └── specEditorProvider.ts     # handleReady → pre-select via effective resolver
├── core/
│   └── telemetry.ts                  # one-line comment: report RAW configured value, not effective
└── features/workflows/__tests__/
    └── resolveEffectiveDefaultWorkflow.test.ts   # NEW unit tests for the pure resolver
docs/
└── template-profiles.md              # document install-aware default in the selection model
```

**Structure Decision**: The resolver lives in `workflowManager.ts` alongside `isCompanionSelectable()` — the existing selection-model hub that already imports `isCompanionInstalled` and `vscode`. Both workflow-pick sites reach it through the `../workflows` barrel, so there is no new module and no circular import.

## Constitution Check

No project constitution (`.specify/memory/constitution.md`) defines binding principles for this change. Repo conventions honored instead: reuse the existing detector (no reimplementation), one-fact-one-derivation (a single resolver both sites read), keep telemetry honest, docs updated in the same change. PASS.

## Key Decisions

- **Decision**: Split the resolver into a pure core `pickEffectiveDefaultWorkflow(inspected, companionInstalled)` plus a thin vscode wrapper `resolveEffectiveDefaultWorkflow(root)`. **Why**: the pure core is unit-testable with a stubbed `inspect` result and a boolean, sidestepping the known config-mock coverage gap for webview/config paths (CLAUDE.md). Mirrors the existing `decideEnsureStandardOps` (pure) + `ensureStandardFamily` (wrapper) pattern. **Rejected**: one vscode-coupled function only — untestable at the branch level without a config-mock harness.
- **Decision**: Detect "explicit" as any non-empty string in `globalValue ?? workspaceValue ?? workspaceFolderValue` from `config.inspect`, most-specific scope winning. **Why**: distinguishes unset from an explicit `speckit`, which `config.get(key, 'speckit')` cannot. **Rejected**: comparing `get()` to `'speckit'` — cannot tell unset from explicit-speckit, the core bug.
- **Decision**: Telemetry `buildBetaSnapshot` keeps `config.get('defaultWorkflow', 'speckit')` (raw), not the effective resolver. **Why**: reporting an install-derived companion default the user never chose would inflate the companion-adoption denominator; only explicit companion choices count. A one-line comment records this at the call site.

## Data Model

No new persisted entities. The only value in play is the existing `speckit.defaultWorkflow` string setting; the resolver returns a `speckit` | `companion` | custom-name string. No `.spec-context.json` schema change.
