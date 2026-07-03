# Implementation Plan: Activity panel redesign

**Feature**: 387-activity-redesign · **Spec**: [spec.md](./spec.md) · **Source issue**: [#400](https://github.com/alfredoperez/speckit-companion/issues/400)

## Summary

Recompose the Activity panel as a brief: a hero strip (status/size/trusted active time + tab-jumping stat chips), an always-visible Plan section (ICE triad + approach), and an accessible tab bar (Decisions/Work/Proof/Notes) hosting the existing cards. Signature elements — coverage donut, big-numeral chips, check pills, tinted requirement chips, circled ordinals, trusted-span duration bars — are CSS/SVG on tokens. Verification is visual: Storybook screenshots iterated, impeccable detect (rendered + source) at zero findings, design-taste critique, shots on the PR.

## Project Structure

```
webview/src/spec-viewer/
├── signals.ts                        # + activityTab signal
├── components/
│   ├── ActivityPanel.tsx             # recomposition: Hero + Plan + Tabs
│   ├── ActivityHero.tsx (new)        # status line + stat chips (+ donut mini)
│   ├── PlanSection.tsx (new)         # intent lede · context · fence · approach/sizing
│   ├── ActivityTabs.tsx (new)        # tablist semantics, badges, default-tab rule
│   ├── ActivityPanel.stories.tsx     # rich / sparse / mid-pipeline payloads
│   └── cards/                        # Decisions ordinals; Verified pills; Coverage donut+chips; Phases bars
webview/styles/spec-viewer/_activity.css   # hero/chips/tabs/donut/pills/bars sections
src/features/spec-viewer/…                 # (no derivation change needed — all fields ship)
README.md · CHANGELOG.md
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility | **PASS** — pure presentation over existing derived state. |
| II. Spec-Driven Workflow | **PASS** — surfaces pipeline data; no lifecycle change. |
| III. Visual & Interactive | **PASS** — the point of the feature. |
| IV. Modular Architecture | **PASS** — three new focused components; cards reused; CSS partial sections. |

No violations (re-checked after design).

## Key Decisions

- **Tab signal in signals.ts** (`activityTab`) — matches the existing reactive idiom; chips write it, tabs read it.
- **Donut = inline SVG circle with stroke-dasharray** — no dependency, token-colored, ~15 lines.
- **Duration bars derive from `stepHistory[].durationTrusted` spans only**; untrusted steps show time text absent and no bar (honesty rule holds visually).
- **Default-tab rule computed, not persisted**: uncovered>0 || concerns>0 → proof; else decisions; else first non-empty.
- **hasAnyData & empty state unchanged** — the redesign starts above it.
