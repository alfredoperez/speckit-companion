# Implementation Plan: Activation Funnel

**Branch**: `597-activation-funnel` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/597-activation-funnel/spec.md` (GitHub issue #597, epic #520)

## Summary

Installs vastly outnumber activated users, so this feature makes the product's two loved capabilities — visualization and customization — reachable in a new user's first two minutes, and makes the install-to-completion funnel measurable end to end. In-product: the two stacked zero-spec welcome blocks collapse into one merged welcome whose "Open a live sample" seeds a bundled sample spec (copied into the workspace, never read in place) and opens it in the viewer, and the Create Spec form's bare workflow dropdown becomes a descriptive choice control fed by one shared workflow-list builder, with Companion carrying its proof line and a one-spec "Try Companion for this spec" trial. Telemetry gains the missing funnel rungs (`extension.installed` once-ever, `panel.opened` per-session, `spec.completed` from a single status-transition seam in the context-file watcher that all three completion paths flow through) plus honest `spec.created` attribution, with every event listed in `docs/telemetry.md`; the dashboard work itself happens in PostHog, with the repo contributing the events, the disclosure, and the recorded specify-vs-plan parity check. Launch content (run-in-flight clip, make-it-yours asset, benefit-led listing, Copilot carousel) is produced through the established visual-asset pipeline in `media/feature-clips/` and `docs/screenshots/generated/`.

No new stack: TypeScript extension host + imperative-DOM webview + Jest, PostHog capture via the existing `TelemetryService`, HyperFrames for clips — all already in the repo.

## Project Structure

### Documentation (this feature)

```
specs/597-activation-funnel/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities
└── contracts/
    ├── telemetry-events.md   # funnel event contract (names, props, de-dupe scopes)
    └── ui-contract.md        # pinned copy, command ids, message-protocol additions
```

### Source code (repository root)

```
package.json                                  # viewsWelcome merge, new command, description/keywords/galleryBanner, sample-asset packaging
.vscodeignore                                 # ship assets/sample-spec/**, exclude assets/social/**
assets/
├── sample-spec/                              # NEW: bundled curated sample (spec.md, plan.md, tasks.md, .spec-context.json)
└── social/carousel-copilot/                  # NEW: carousel slides + regeneration prompt (never packaged)
src/
├── extension.ts                              # extension.installed once-ever check; panel.opened via specsTreeView.onDidChangeVisibility
├── core/
│   ├── telemetry.ts                          # new events, shared workflowTelemetryId, panel/installed de-dupe, drop profile prop
│   ├── constants.ts                          # new GlobalStateKeys.installedEventSent, Commands entry
│   ├── fileWatchers.ts                       # completion-transition + watcher-created hooks into handleSpecContextChange
│   └── core.spec.md                          # living spec: new events + de-dupe rules
├── features/
│   ├── specs/
│   │   ├── sampleSpec.ts                     # NEW: speckit.openSampleSpec — seed-or-reopen, no-workspace error
│   │   ├── specCommands.ts                   # register sample command; remove direct spec.completed emit
│   │   ├── transitionLogger.ts               # TransitionCache gains status → "entered completed" detection
│   │   └── specs.spec.md                     # living spec: completion-observation seam
│   ├── workflows/
│   │   ├── workflowManager.ts                # buildWorkflowChoices() — the one shared builder + predicate
│   │   ├── workflowSelector.ts               # remove dead selectWorkflow/needsSelection; keep resolveDefaultWorkflow path
│   │   └── index.ts                          # exports updated
│   └── spec-editor/
│       ├── specEditorProvider.ts             # delegate list to shared builder; attribution fix; trial plumbing
│       ├── types.ts                          # WorkflowDefinition: description/proofline/chosenAs additions
│       └── spec-editor.spec.md               # living spec: one-predicate requirement now satisfied
├── ai-providers/
│   └── promptPreamble.ts                     # creation preamble also seeds telemetryInstanceId
webview/
├── src/spec-editor/
│   ├── index.ts                              # initWorkflows renders descriptive choice cards + trial affordance
│   ├── types.ts                              # mirrored workflow entry fields
│   ├── CreateSpecMock.tsx                    # mock parity: choice cards, Companion states
│   ├── __stories__/CreateSpec.stories.tsx    # new states: multi-workflow, Companion not-installed, trial
│   └── editor-ui.spec.md                     # living spec: choice-control requirement
└── styles/spec-editor.css                    # choice-card styles (watch 200-line partial rule)
media/feature-clips/
├── run-in-flight/                            # NEW: 30–60s live rail + per-phase timing clip
└── make-it-yours/                            # NEW: customization asset (workflow swap, commands, provider)
docs/
├── telemetry.md                              # disclosure rows, funnel reading, workflow.selected retirement, parity record
├── configuration.md                          # fix stale "no picker when not installed" claim
├── sidebar.md                                # merged welcome reference
└── screenshots/generated/                    # promoted GIFs: spec-viewer/inline-comments/specs-sidebar/run-in-flight (additive; stills stay)
README.md                                     # stat above the fold, three TODO placeholders resolved, telemetry section
tests/__mocks__/vscode.ts                     # add createTreeView with onDidChangeVisibility
```

**Structure Decision**: Everything lands in the existing module map — no new top-level feature directory except the two bundled/marketing asset roots (`assets/sample-spec/`, `assets/social/`). The one new source module is `src/features/specs/sampleSpec.ts` (seeding is a specs-feature command, not a viewer concern); telemetry additions stay in `src/core/telemetry.ts`, the single telemetry home.

## Constitution Check

*Gate before Phase 0; re-checked after Phase 1 design — both passes clean.*

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | **PASS** — the shared `buildWorkflowChoices` builder keeps custom workflows first-class (validation + provider filtering now apply to the Create Spec list too); the choice control derives affordances and descriptions from workflow declarations, so adding a workflow still requires no surface edits; the trial never writes `speckit.defaultWorkflow`, preserving the user's configuration. |
| II. Spec-Driven Workflow | **PASS** — funnel telemetry *observes* lifecycle transitions at the watcher seam and never writes status; the completion seam respects forward-only status and the sanctioned-writer rule (it adds no new `completed` writer); the sample spec is an ordinary spec directory following the managed lifecycle. |
| III. Visual and Interactive | **PASS** — the merged welcome, the sample-in-viewer first run, and the descriptive choice control are all GUI surfaces; the launch content markets exactly those visual surfaces. |
| IV. Modular Architecture for Complex Features | **PASS** — no new webview feature; changes extend existing focused modules (seeding gets its own module; webview edits stay inside the spec-editor module set; CSS additions go into the existing `spec-editor.css`, splitting into partials only if the 200-line threshold is crossed). |

No violations → no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md). All open choices are resolved there; the spec carried no `NEEDS CLARIFICATION` markers (FR-016's open choice is decided in R10).

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — sample spec asset/seed shapes, funnel-event catalog with de-dupe scopes, workflow-choice model, transition-cache extension.
- [contracts/telemetry-events.md](./contracts/telemetry-events.md) — the event contract (verbatim pinned names, properties, gating, de-dupe).
- [contracts/ui-contract.md](./contracts/ui-contract.md) — pinned UI copy, command ids, webview message-protocol additions.

**Post-design constitution re-check**: the design introduces one shared builder (reduces duplication), one new command, one new module, and no new webview feature — all four principles still PASS.
