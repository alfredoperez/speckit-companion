# UI Contract: Activity panel polish

The identifiers tests and consumers code against. Selectors carried over from the shipped panel keep their names; this change adds no new components.

## Selectors / classes

| Identifier | Contract |
|---|---|
| `.activity-tabs__tab` | Gets an explicit `:focus-visible` outline; `:focus:not(:focus-visible)` renders no outline. Active state remains `.is-active` with the accent `border-bottom`. |
| `.activity-tabs__count` | Count badge. New modifier `.activity-tabs__count--warning` for attention badges (Proof/Notes). |
| `.activity-pill-grid` | Becomes a wrapping flex row; pills are content-width. Class name unchanged (stories/CSS hooks keep working). |
| `.activity-pill`, `.activity-pill--pass`, `.activity-pill--warning` | Unchanged names; sizing becomes content-width with an internal max-width for wrapping text. |
| `.activity-card__title` | No longer uppercase-transformed; visible text is Title Case ("Checks", "Coverage", card titles). |
| `.activity-plan__heading` | Visible text "Plan"; no uppercase transform. |
| `.activity-inline-label`, `.activity-detail-label` | Keep uppercase micro-label treatment; color moves to `--text-label`. |
| `.activity-card--coverage .activity-list` | Renders without list bullets (`list-style: none`). |
| `.spec-header-title` | `text-transform: capitalize`. |

## Tokens

| Token | Contract |
|---|---|
| `--text-label` | New in `webview/styles/tokens.css`: metadata-label color derived from the theme foreground via `color-mix` (not `descriptionForeground`). Documented by contrast intent, not an effective hex. |

## Model (webview/src/spec-viewer/activityTabsModel.ts)

| Export | Contract |
|---|---|
| `ActivityTab` | Gains optional `warning?: boolean`. `count` on `proof` = uncovered requirements (only > 0); on `notes` = open concerns (only > 0); on `decisions`/`work` unchanged. |
| `activityTabs(state)` | Tab presence rules unchanged; only badge values change as above. |
| `defaultActivityTab(state)` | Unchanged. |
