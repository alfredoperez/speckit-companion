# Implementation Plan: Activity panel polish

**Feature**: 389-activity-polish · [spec.md](./spec.md) · size: normal

## Summary

Eight fit-and-finish fixes to the Activity panel, all presentation-layer: a deliberate focus treatment on the tab bar, one rendition of each number (single donut, no counts in section headings, attention-only tab badges), verified checks as content-width wrapping pills, Title Case section headings distinct from the uppercase micro-labels, no double markers on coverage rows, legible metadata-label color derived from the theme foreground, and a title-cased spec name in the viewer header. The tab badge change is the only model-level edit (the badge gains a warning tone and switches from content counts to attention counts on Proof/Notes); everything else is CSS and markup in the existing components.

## Project Structure

```
webview/
├── src/spec-viewer/
│   ├── activityTabsModel.ts            # badge semantics: warning tone, attention counts
│   ├── components/
│   │   ├── ActivityTabs.tsx            # render warning-tinted badge; :focus-visible target
│   │   ├── PlanSection.tsx             # heading "The Plan" → "Plan"
│   │   └── cards/
│   │       ├── VerifiedCard.tsx        # heading → "Checks", drop count span
│   │       ├── CoverageCard.tsx        # drop header donut + count span, drop list bullets
│   │       ├── VerifiedCard.stories.tsx
│   │       └── CoverageCard.stories.tsx
│   ├── components/ActivityPanel.stories.tsx  # badge states: clean vs uncovered/concerned
│   └── __tests__/activityModels.test.ts      # badge model cases
└── styles/
    ├── tokens.css                      # --text-label: foreground-derived label color
    └── spec-viewer/
        ├── _activity.css               # focus-visible, pill flex-wrap, heading case/size, label color
        └── _content.css                # .spec-header-title text-transform: capitalize
```

**Structure Decision**: no new modules — the redesign's composition (hero/plan/tabs + cards) stays; this change edits the existing pieces in place.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no new configuration; behavior identical across providers. |
| II. Spec-Driven Workflow | PASS — run as a Companion pipeline spec with full capture. |
| III. Visual and Interactive | PASS — the change is precisely about visual quality; token-driven, theme-safe. |
| IV. Modular Architecture | PASS — edits stay inside the existing spec-viewer component/CSS modules. |
| AI Provider Integration | PASS — untouched. |
| User Interface | PASS — VS Code theme variables via tokens; a11y improves (focus-visible ring). |

No violations; Complexity Tracking omitted.

Re-checked after Phase 1 design: still PASS — the design introduces one derived CSS token and no new surfaces.
