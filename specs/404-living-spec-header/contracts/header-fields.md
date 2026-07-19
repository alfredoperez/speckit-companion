# UI Contract: Living Spec Header

The identifiers and exact wording a test or a reader can rely on.

## Layout

```
SpecKit Extension Capture                        ← title, author's wording
[LIVING]  12 requirements · 34 scenarios · 8/12 covered · drift
Covers  speckit-extension/** · src/features/specs/** · +2 more   capabilities/speckit-extension-capture/spec.md
```

## Wording (pinned)

| Fact | Exact text |
|---|---|
| Requirement count | `N requirements` (`1 requirement` when N is 1) |
| Scenario count | `N scenarios` (`1 scenario` when N is 1) |
| Coverage | `N/M covered` — identical to the Living Specs sidebar row |
| Drift | `drift` — identical to the sidebar row |
| Claimed patterns label | `Covers` |
| Pattern overflow | `+N more` |
| Title suffix stripped | `— Living Spec` |
| Draft body banner (unchanged) | `[DRAFT]` |

## Hover text

| Element | Hover text |
|---|---|
| Status badge, living spec (no created date) | none — the attribute is not set |
| Status badge, feature spec with a created date | `<badge> · <created date>` (unchanged) |
| Coverage | `N of M requirements have a mapped test` — identical to the sidebar tooltip |
| Drift marker | `Source files changed since the living spec's last commit` — identical to the sidebar tooltip |
| Pattern overflow chip | the remaining patterns, one per line |
| Spec location | `Lives in the central specs folder` or `Lives next to the code it describes` — identical to the sidebar tooltip |

## Class names

| Element | Class |
|---|---|
| Facts row | `spec-header-living` |
| A single fact | `spec-header-fact` |
| Drift marker | `spec-header-fact--drift` |
| Claimed-patterns row | `spec-header-covers` |
| A pattern chip | `spec-header-glob` |
| Spec location chip | `spec-header-path` |
| Authored (heading-derived) title | `spec-header-title--authored` |

## Accessibility

- The facts row is a list of plain text spans; separators are drawn with CSS pseudo-elements so they are not announced.
- The drift marker carries an accessible label naming what drifted, not just the word "drift".
- Every value is rendered as element content. No author-written string is interpolated into an attribute through raw markup.
