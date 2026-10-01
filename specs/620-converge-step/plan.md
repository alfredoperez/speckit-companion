# Implementation Plan: Record and show Spec Kit's converge step

**Branch**: `feat/788-converge-step` | **Date**: 2026-10-01 | **Spec**: [converge-step.spec.md](./converge-step.spec.md)

> **Scale note**: the change is small per file but spans four areas: the step vocabulary shared by the editor and the Python scripts, the scripts that write and read the run record, the spec-kit extension's hook commands and their gated inventories, and the viewer's rail and Overview. The thing to watch is every place that reasons about step order or about `implement` being last: a converge recorded after implement must read as part of implement, never as a regression.

## Summary

Spec Kit's converge command fires `before_converge` and `after_converge`. The companion spec-kit extension registers two capture commands on those hooks that stamp converge's start and finish through the existing writer, with no status. `converge` joins the step vocabulary after `implement` as a sub-phase of implement that owns no status, mirrored in the schema and the Python scripts. Every reader that treats implement specially learns that converge belongs to implement: the editor's repair pass, the footer gates, reactivate, the status command, the doctor and the quality port. The viewer detects converge in flight from history, shows it on the rail entry that hosts implement's progress, lists it in the Overview timing and adds its measured span to the run's total.

## Project Structure

```text
apps/vscode/src/core/types/
├── specContext.ts                 # StepName, STEP_NAMES (+converge), STEP_STATUS made partial, lifecycleStepFor()
├── spec-context.schema.json       # both step enums gain converge
└── __tests__/specContextSchema.consistency.test.ts
apps/vscode/src/features/specs/
├── specContextReconciler.ts       # converge reads as implement for rollback and drift
├── stepHistoryDerivation.ts       # deriveTimingSummary: trailing converge span counts in the total
├── stepLifecycle.ts               # reactivate maps converge to implement's in-flight status
├── lastTransition.ts              # label
└── specsSortMode.ts               # converge ranks with implement
apps/vscode/src/features/spec-viewer/
├── footerActions.ts               # implement gates also cover converge; no Regenerate for converge
├── runRecovery.ts                 # quiet threshold
└── stepCompletionNotifier.ts      # label
apps/vscode/src/ai-providers/__tests__/promptPreambleSelfClose.test.ts  # iterate prompt steps only
apps/vscode/webview/src/spec-viewer/
├── stepInFlight.ts                # isConvergeInFlight (history-based)
└── components/StepTab.tsx (+ StepTab.stories.tsx, ActivityPanel.stories.tsx)
apps/speckit-extension/
├── extension.yml                  # two commands, two hooks
├── commands/speckit.companion.before-converge.md, speckit.companion.after-converge.md
├── scripts/spec_context.py        # CANONICAL_STEPS, STEP_ORDER, _is_more_advanced exemption
├── scripts/status-context.py      # converge position and next action
├── scripts/check_capture.py, check_quality.py, doctor_checks.py
├── README.md, docs/commands.md, docs/living-specs.md, CHANGELOG.md
└── tests/test_custom_steps.py (+ status, doctor, quality tests)
.specify/extensions/.registry, .specify/extensions.yml   # reinstall output, gated by check-command-emissions
capabilities/run-record/*.spec.md, capabilities/spec-viewer/*.spec.md   # folded requirements
CHANGELOG.md
```

**Structure Decision**: no new module. Each change lands in the file that already owns the behaviour, and the one new rule ("converge belongs to implement") lives once in `specContext.ts` as `lifecycleStepFor`, read by every TypeScript caller.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. A project that declares its own `converge` step keeps working; the name is not reserved. |
| II. Spec-Driven Workflow | PASS. The Specify → Plan → Tasks → Implement pipeline is unchanged; converge is optional and never sets a status, so lifecycle transitions stay explicit. |
| III. Visual and Interactive | PASS. Converge becomes visible on the rail and in the Overview. |
| IV. Modular Architecture | PASS. Changes stay in the modules that own each behaviour. |

Re-checked after design: still PASS.
