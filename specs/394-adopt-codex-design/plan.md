# Implementation Plan: Adopt the Codex Redesign in the Spec Viewer

**Branch**: `394-adopt-codex-design` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)
**Input**: Winning Codex proposal at `webview/src/spec-viewer/__redesign__/codex/` (stories + RATIONALE.md + codex.css)

## Summary

Ship the Codex redesign in the production spec viewer as a reskin-and-relayout over the viewer's existing state seams: the owned light/dark palette lands by re-valuing the existing token layer, the shell recomposes into the Codex regions (title header with an Overview/Documents switch, a grouped document rail, a capped reading column with a contextual run-facts aside, and a footer carrying the workflow-derived CTA plus an "Other actions" menu), and the data-display skin restyles the markdown pipeline's existing emitted classes. Behavior is fenced: signals, message handlers, state derivation, and the lifecycle state machine are untouched, so every status, custom workflow, living-spec mode, and review-comment capability keeps working. Full decisions in [research.md](./research.md).

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility & Configuration | **PASS** — the rail, CTA label, and extra commands render from workflow data (`getApproveLabel`, `enhancementButtons`); no provider or workflow behavior is hard-coded to the stock steps (FR-007/008). |
| II. Spec-Driven Workflow | **PASS** — the Specify→Plan→Tasks→Implement pipeline and the Active→Completed→Archived lifecycle render exactly per `docs/viewer-states.md`; transitions remain explicit user actions (FR-009). |
| III. Visual & Interactive | **PASS** — the feature is precisely a visual/interactive upgrade of the primary GUI surface. |
| IV. Modular Architecture | **PASS** — work stays in the established modular layout (component modules, CSS partials via `index.css`, extension/webview separation); no module merges. |

*Re-checked after Phase 1 design: still PASS on all four; no Complexity Tracking entries needed.*

## Project Structure

```
webview/
├── styles/
│   ├── tokens.css                     # palette re-valued to Codex roles (+ light block), radius/geometry
│   └── spec-viewer/
│       ├── _base.css                  # shell grid (rail | 72ch main | aside), responsive 980/700
│       ├── _navigation.css            # document rail, rail groups, workflow map, rail marks
│       ├── _content.css               # shell top, reading column, headings, meta cleanup
│       ├── _toc.css                   # heading TOC restyled inside the reading column
│       ├── _activity.css              # Overview arrangement: progress hero, metrics, feed, disclosure
│       ├── _callouts.css / _code.css / _tables.css / _requirements.css /
│       │   _task-phases.css / _tasks.css / _artifacts.css   # data-display skin on emitted classes
│       └── _line-actions.css / _refinements.css             # comment + refinement-queue treatment
├── src/spec-viewer/
│   ├── App.tsx                        # shell regions; view state (overview|document) replaces toggle
│   ├── signals.ts                     # activityVisible → view signal semantics (default by data)
│   └── components/
│       ├── SpecHeader.tsx             # shell top: title, subtitle, badge, view switch
│       ├── NavigationBar.tsx          # rail: Pipeline/Artifacts groups, workflow map, living mode
│       ├── StepTab.tsx                # rail button + separate completion mark
│       ├── FooterActions.tsx          # footer: context line, Other actions menu, primary CTA
│       ├── RunAside.tsx               # NEW — contextual run facts column (status/phase/task/progress)
│       └── ActivityPanel.tsx (+cards) # Overview presentation (content/cards preserved)
├── src/spec-viewer/**/*.stories.tsx   # updated alongside each component (visual baseline)
src/features/spec-viewer/html/generator.ts   # drop Geist lead/injection (host fonts)
docs/viewer-states.md · docs/DESIGN.md · README.md   # state-machine visuals, geometry direction, screenshots
```

**Structure Decision**: All work rides the existing modular structure — token file, CSS partials, and component modules keep their names and responsibilities; the only new file is the small `RunAside` component (and its story). The `__redesign__/codex/` folder stays as the pixel reference until the final story-reconciliation task retires the duplicates.

## Phase 0 — Research

Complete — see [research.md](./research.md): (1) palette via existing token layer; (2) shell maps 1:1 onto existing components; (3) Overview defaults by data presence, living mode exempt; (4) code keeps hljs on an owned always-dark surface; (5) host typography, Geist retired; (6) 6px geometry supersedes the 2px direction (docs updated); (7) inline comments keep their machinery, queue becomes visible; (8) stories reconcile with the work, codex reference retired last.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the webview view-model shapes the shell renders from (rail items, view state, run facts) and their derivation from the frozen `NavState`/`ViewerState`.
- [contracts/ui-contract.md](./contracts/ui-contract.md) — the frozen interfaces this adoption must not move (message protocol, emitted markdown classes, state matrix) and the new shell class contract stories/tests code against.
