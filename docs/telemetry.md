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
| Extension / VS Code versions, platform | attached to **every** event, for version and platform breakdowns |
| Spec count | for scale |
| VS Code's anonymized machine id | the per-install identity events group under — random, editor-generated, never derived from the user |
| Chosen workflow | the built-in id, or the literal `custom` |
| Whether the companion spec-kit extension is installed | `true` / `false`, reported once per session |
| Whether an install prompt was shown or its Install button clicked | `shown` / `clicked`, per surface (Create Spec, Activity, sidebar, and the on-open `activation` prompt) |
| A spec was opened in the viewer | a bare event, once per spec per session |
| A living/capability spec was opened in the viewer | a bare event, once per capability per session |
| A living-spec drift report was run | a bare event, per run |
| A living-spec sync was run | a bare event, per run |
| A steering doc was opened | a bare event, per open |

**What is never collected**: prompt content, file paths, spec names, capability names, or custom workflow names. Only enum-like values, booleans, versions, counts, and a random per-spec id. The five engagement events above are **bare**: they carry nothing event-specific — only the common facts (versions, platform) that ride on every event.

That per-spec id is a **random UUID, not the spec name or path**. It correlates a single spec's events into a funnel (created, dispatched, completed) without ever revealing which spec it is. It is stored in the spec's `.spec-context.json` so the same id rides every event for that spec.

## Reading these in PostHog

Events land in the maintainer's PostHog project on **PostHog Cloud US** ([us.posthog.com](https://us.posthog.com)). Every event arrives under its exact catalog name (`extension.activated`, `companion.installPrompt`, `spec.opened`, …) with its properties attached verbatim, grouped per anonymous install by `distinct_id`.

### Browsing the catalog

- **Activity** (left sidebar) streams raw events as they arrive — the quickest way to confirm a fresh install is reporting: filter the event name to `extension.activated` and inspect the payload's `extensionVersion`, `vscodeVersion`, and `platform`.
- **Product analytics → Insights → Trends** counts any event over time. Pick the event by name, then *break down* by a property (`providerId`, `defaultWorkflow`, `platform`, `extensionVersion`) to slice adoption the way the old dashboard did.
- Distinct anonymous installs for any event: switch the Trends metric from *Total count* to *Unique users* — each `distinct_id` (one per install) counts once.

### The install-prompt funnel

The shown → clicked conversion is a native funnel, no query needed. **Insights → New insight → Funnel**, then:

1. Step 1: `companion.installPrompt` with a filter `action = shown`
2. Step 2: `companion.installPrompt` with a filter `action = clicked`
3. *Break down by* `surface`

The result reads directly as the conversion rate per surface (Create Spec, Activity, sidebar, welcome, terminal, activation).

### HogQL samples

For anything the insight builder doesn't cover, **Product analytics → SQL** runs HogQL against the `events` table. The same three questions the old queries answered, over the last 30 days:

```sql
-- Install rate: share of activations that already have the companion spec-kit extension
SELECT countIf(properties.companionInstalled = 'true') AS installed,
       count() AS total,
       installed / total AS install_rate
FROM events
WHERE event = 'extension.activated'
  AND timestamp > now() - INTERVAL 30 DAY
```

```sql
-- Prompt→install conversion: banner Install clicks vs. banner shows, per surface
SELECT properties.surface AS surface,
       countIf(properties.action = 'shown') AS shown,
       countIf(properties.action = 'clicked') AS clicked,
       clicked / shown AS conversion
FROM events
WHERE event = 'companion.installPrompt'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY surface
ORDER BY conversion DESC
```

```sql
-- Engagement: how often each observable action fires (spec opens, living-spec runs, steering opens)
SELECT event, count() AS fires
FROM events
WHERE event IN ('spec.opened', 'livingSpec.opened', 'livingSpec.drift', 'livingSpec.sync', 'steering.opened')
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY event
ORDER BY fires DESC
```
