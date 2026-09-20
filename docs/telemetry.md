# Telemetry (maintainer notes)

What the extension collects and how to opt out is user-facing and lives on the website: [Telemetry](https://speckit-companion.dev/docs/reference/telemetry). This page is the maintainer's side: the exact event catalog with its raw property names, and how to read them in PostHog.

## The event catalog

The event names and properties below are what the dashboards and queries in this page filter on. The website's telemetry page describes the same signals in plain language; this table has the wire names.

| Event | Key properties | Notes |
|--------|---------------|-------|
| `extension.installed` | — | Once **ever** per install, never per session; a wiped VS Code global state legitimately reads as a new install |
| `extension.activated` | `extensionVersion`, `vscodeVersion`, `platform` | Attached to every event, for version/platform breakdowns |
| `spec.created` | `chosenAs` (`default`/`picked`/`trial`), `source` (`form`/`watcher`) | `chosenAs` is how the workflow got picked in Create Spec; `source` is what observed the creation |
| `provider.selected` | provider id | Fires when the configured AI provider changes |
| `spec.archived` | — | Fires from the sidebar's Archive action |
| `phase.dispatched` | phase name | `specify`/`plan`/`tasks`/`implement` |
| `spec.completed` | — | Fires from every completion path — sidebar action, viewer action, Companion's terminal step — observed at one seam (status transition to `completed`), exactly once per completion. A completion while VS Code is closed goes unobserved. |
| `companion.installPrompt` | `action` (`shown`/`clicked`), `surface` | Surfaces: Create Spec, Activity, sidebar, `activation`. Out-of-date variants report separately as `createSpecUpdate`, `activityUpdate`, `statusBarUpdate`, `activationUpdate`, so update adoption reads apart from first install |
| `panel.opened` | — | Once per session; repeated visibility toggles don't re-count |
| `sample.opened` | — | Once per session; the seeded sample never counts as a created spec |
| `spec.opened`, `livingSpec.opened` | — | Once per spec/capability per session |
| `livingSpec.drift`, `livingSpec.sync` | — | Per run |
| `steering.opened` | — | Per open |

The per-spec id riding these events is a random UUID stored in the spec's `.spec-context.json`, never the spec name or path.

De-duplication never cheats the switches: an event that couldn't be sent (telemetry off) claims no once-ever or per-session slot, so the first send after telemetry turns on still happens.

**Retired**: the `profile` property (`standard`/`turbo`) is no longer attached to any event — the pipeline-profile dimension was retired with the workflow-choice collapse. The `workflow.selected` event is retired: its only emitter was an unreachable picker that has been removed; the name is not reused.

## Reading these in PostHog

Events land in the maintainer's PostHog project on **PostHog Cloud US** ([us.posthog.com](https://us.posthog.com)). Every event arrives under its exact catalog name (`extension.activated`, `companion.installPrompt`, `spec.opened`, …) with its properties attached verbatim, grouped per anonymous install by `distinct_id`.

### Browsing the catalog

- **Activity** (left sidebar) streams raw events as they arrive — the quickest way to confirm a fresh install is reporting: filter the event name to `extension.activated` and inspect the payload's `extensionVersion`, `vscodeVersion`, and `platform`.
- **Product analytics → Insights → Trends** counts any event over time. Pick the event by name, then *break down* by a property (`providerId`, `defaultWorkflow`, `platform`, `extensionVersion`) to slice adoption the way the old dashboard did.
- Distinct anonymous installs for any event: switch the Trends metric from *Total count* to *Unique users* — each `distinct_id` (one per install) counts once.

### The activation funnel

The five-stage activation funnel — installed → panel opened → spec created → phase dispatched → completed — is a native funnel. **Insights → New insight → Funnel**, then add the steps in this exact order:

1. Step 1: `extension.installed`
2. Step 2: `panel.opened`
3. Step 3: `spec.created`
4. Step 4: `phase.dispatched`
5. Step 5: `spec.completed`

Each adjacent-step drop-off reads directly as the leak at that rung. Useful variants: *break down* step 3 by `workflow` or `chosenAs` to see which choice converts, or filter step 3 to `source = watcher` to size the terminal-created population. Set the conversion window generously (30+ days) — installs often sit before the first spec.

`extension.installed` fires once ever per install, so the funnel's top only accumulates from the release that added it; earlier installs enter the funnel at their next rung instead.

### The install-prompt funnel

The shown → clicked conversion is a native funnel, no query needed. **Insights → New insight → Funnel**, then:

1. Step 1: `companion.installPrompt` with a filter `action = shown`
2. Step 2: `companion.installPrompt` with a filter `action = clicked`
3. *Break down by* `surface`

The result reads directly as the conversion rate per surface (Create Spec, Activity, sidebar, welcome, terminal, activation). `createSpecUpdate` and `activityUpdate` are the same two banner slots showing the out-of-date variant instead of the install pitch; `statusBarUpdate` and `activationUpdate` are the out-of-date status-bar item and the once-per-version notification. Read the four as their own funnel, not as part of first install — every one of them reports both `shown` and `clicked`.

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

## The website

The marketing site at [speckit-companion.dev](https://speckit-companion.dev) reports into the **same PostHog project** as the extension, because the free plan allows one project per organisation. Every event the site sends carries the super property `source: 'site'`, and **every site insight must filter on it** — without that filter a funnel over "did they install" silently mixes visitors who clicked a button on the page with people already running the extension.

| Event | When | Properties |
| --- | --- | --- |
| `$pageview`, `$pageleave` | Automatic | `$current_url` |
| `install_click_vscode` | The VS Code install button | `placement` |
| `install_click_speckit_copy` | The Spec Kit install command is copied | `placement` |
| `demo_tab_click` | A tab in the demo section | `tab` |
| `waitlist_submit` | The waitlist form is submitted | `list` |
| `survey sent` | The same submission, recorded as a survey response | `$survey_id`, `$survey_response`, `list` |

`placement` distinguishes the same button in different sections (`hero`, `quick-start`, `install`, `getting-started`, `footer`), so a low-converting placement is visible rather than averaged away.

### The waitlist

Addresses are stored as PostHog survey responses, in `$survey_response` on the `survey sent` event. Both lists post to one survey, so `list` (`course` or `workflow-builder`) is what tells them apart. The survey's own Results tab may read empty: the site renders its own form and the PostHog widget is disabled, so responses arrive without PostHog ever having "shown" the survey. Read them with SQL instead:

```sql
SELECT properties.$survey_response AS email, properties.list AS list, timestamp
FROM events
WHERE event = 'survey sent'
ORDER BY timestamp DESC
```

### Why the site proxies PostHog

Site requests go to `/ingest/*` on our own origin, forwarded by `apps/website/src/pages/ingest/[...path].ts`. This is not a preference. Pointed at `us.i.posthog.com` directly, content blockers answer **204 with an empty body** for the library itself, so `posthog.init` never runs and nothing at all is recorded — not one pageview. The audience is developers, so that is most of them.

The proxy is a serverless endpoint rather than a `vercel.json` rewrite because it cannot be a rewrite: PostHog's capture endpoints all end in a slash (`/e/`, `/flags/`, `/decide/`), and Vercel resolves a trailing-slash path against the filesystem and serves the static 404 before any rewrite is consulted. Measured against production, `/ingest/e` answered 400 from PostHog while `/ingest/e/` answered 404 from our own 404 page.

Two things follow. Nothing may assign `window.posthog` before `array.js` loads — a stub there makes the library decline to initialise, which is a silent total failure. And the site's `package-lock.json` must carry sharp's Linux-only optional dependencies, or `npm ci` fails on the builder while passing on macOS.
