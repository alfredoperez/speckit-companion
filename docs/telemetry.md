# Telemetry

The extension sends **anonymous, PII-free** usage telemetry to help prioritize which AI providers and pipeline features to invest in. It is gated on two switches: if **either** is off, nothing is sent.

```json
{
  "speckit.telemetry": true
}
```

| Switch | Effect when off |
|--------|-----------------|
| `speckit.telemetry` (default `true`) | Disables all extension telemetry, regardless of the global setting |
| VS Code's global `telemetry.telemetryLevel` | Disables all extension telemetry, regardless of `speckit.telemetry` |

## What is collected

All anonymous:

| Signal | Example value |
|--------|---------------|
| Selected AI provider | `claude`, `copilot`, `gemini`, … |
| Default workflow | `speckit` / `companion` |
| Which workflow phase was dispatched | `specify` / `plan` / `tasks` / `implement` |
| Spec lifecycle counts | created / completed / archived |
| Feature-flag on/off states | a snapshot reported once per session |
| Extension / VS Code versions, spec count | for version distribution and scale |
| Chosen workflow | the built-in id, or the literal `custom` |
| Whether the companion spec-kit extension is installed | `true` / `false`, reported once per session |
| Whether an install prompt was shown or its Install button clicked | `shown` / `clicked`, per surface (Create Spec, Activity, sidebar, and the on-open `activation` prompt) |
| A spec was opened in the viewer | a bare event, once per spec per session |
| A living/capability spec was opened in the viewer | a bare event, once per capability per session |
| A living-spec drift report was run | a bare event, per run |
| A living-spec sync was run | a bare event, per run |
| A steering doc was opened | a bare event, per open |

**What is never collected**: prompt content, file paths, spec names, capability names, or custom workflow names. Only enum-like values, booleans, versions, counts, and a random per-spec id. The five engagement events above are **bare**: they carry no properties at all.

That per-spec id is a **random UUID, not the spec name or path**. It correlates a single spec's events into a funnel (created, dispatched, completed) without ever revealing which spec it is. It is stored in the spec's `.spec-context.json` so the same id rides every event for that spec.

## Reading these in App Insights

Query these from the Application Insights component's `customEvents` table. The event name is the `name` column and every property lives under the `customDimensions` dynamic column. Sample queries over the last 30 days:

```kusto
// Install rate: share of activations that already have the companion spec-kit extension
customEvents
| where timestamp > ago(30d)
| where name endswith "extension.activated"
| summarize installed = countif(tostring(customDimensions.companionInstalled) == "true"), total = count()
| extend installRate = 1.0 * installed / total
```

```kusto
// Prompt→install conversion: banner Install clicks vs. banner shows
customEvents
| where timestamp > ago(30d)
| where name endswith "companion.installPrompt"
| summarize shown = countif(tostring(customDimensions.action) == "shown"),
            clicked = countif(tostring(customDimensions.action) == "clicked")
    by surface = tostring(customDimensions.surface)
| extend conversion = 1.0 * clicked / shown
```

```kusto
// Engagement: how often each observable action fires (spec opens, living-spec runs, steering opens)
customEvents
| where timestamp > ago(30d)
| where name endswith "spec.opened"
    or name endswith "livingSpec.opened"
    or name endswith "livingSpec.drift"
    or name endswith "livingSpec.sync"
    or name endswith "steering.opened"
| summarize count() by name
| order by count_ desc
```

The Azure workbook lives at [telemetry-workbook.json](./telemetry-workbook.json). Paste it into the workbook's Advanced Editor.
