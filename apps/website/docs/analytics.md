# Site analytics (maintainer notes)

The marketing site at [speckit-companion.dev](https://speckit-companion.dev) reports into the **same PostHog project** as the extension (its events are in `apps/vscode/docs/telemetry.md`), because the free plan allows one project per organisation. Every event the site sends carries the super property `source: 'site'`, and **every site insight must filter on it** — without that filter a funnel over "did they install" silently mixes visitors who clicked a button on the page with people already running the extension.

| Event | When | Properties |
| --- | --- | --- |
| `$pageview`, `$pageleave` | Automatic | `$current_url` |
| `install_click_vscode` | The VS Code install button | `placement` |
| `install_click_speckit_copy` | The Spec Kit install command is copied | `placement` |
| `install_path_click` | A tab in the install section | `path` |
| `demo_tab_click` | A tab in the demo section | `tab` |
| `waitlist_submit` | The waitlist form is submitted | `list` |
| `course_signup` | A course signup is stored, sent from the server without the address | `placement`, `provider` |
| `survey sent` | The same submission, recorded as a survey response | `$survey_id`, `$survey_response`, `list` |

`placement` distinguishes the same button in different sections (`hero`, `quick-start`, `install`, `getting-started`, `footer`), so a low-converting placement is visible rather than averaged away.

## The waitlist

Addresses are stored as PostHog survey responses, in `$survey_response` on the `survey sent` event. Both lists post to one survey, so `list` (`course` or `workflow-builder`) is what tells them apart. The survey's own Results tab may read empty: the site renders its own form and the PostHog widget is disabled, so responses arrive without PostHog ever having "shown" the survey. Read them with SQL instead:

```sql
SELECT properties.$survey_response AS email, properties.list AS list, timestamp
FROM events
WHERE event = 'survey sent'
ORDER BY timestamp DESC
```

## Why the site proxies PostHog

Site requests go to `/ingest/*` on our own origin, forwarded by `apps/website/src/pages/ingest/[...path].ts`. This is not a preference. Pointed at `us.i.posthog.com` directly, content blockers answer **204 with an empty body** for the library itself, so `posthog.init` never runs and nothing at all is recorded — not one pageview. The audience is developers, so that is most of them.

The proxy is a serverless endpoint rather than a `vercel.json` rewrite because it cannot be a rewrite: PostHog's capture endpoints all end in a slash (`/e/`, `/flags/`, `/decide/`), and Vercel resolves a trailing-slash path against the filesystem and serves the static 404 before any rewrite is consulted. Measured against production, `/ingest/e` answered 400 from PostHog while `/ingest/e/` answered 404 from our own 404 page.

Two things follow. Nothing may assign `window.posthog` before `array.js` loads — a stub there makes the library decline to initialise, which is a silent total failure. And the site's `package-lock.json` must carry sharp's Linux-only optional dependencies, or `npm ci` fails on the builder while passing on macOS.

## Where the script is mounted

`src/components/Analytics.astro` is mounted in three places, because three kinds of page build their own document: `BaseLayout.astro` for the landing page, the soon pages and the course signup page, `src/components/DocsHead.astro` for the whole Starlight `/docs/` tree, and `src/pages/changelog.astro`, which is a standalone route. A new page that does not go through `BaseLayout` has to mount it too.

Two things about PostHog worth knowing before you debug it. Ingestion answers `200 Ok` for any key, valid or not, so a wrong key fails silently and looks exactly like success: confirm events in the Activity feed rather than by reading a response code. And the loader runs cookieless through `persistence: 'memory'`, which is why the site owes no consent banner, so changing that setting changes the site's obligations.

## Tagging something for the funnel

The analytics script delegates from the document, so any element can report by carrying a `data-analytics` attribute. Extra `data-analytics-*` attributes become event properties. `Button.astro` spreads unknown props onto its root element and `CodeLine.astro` spreads them onto its copy button, so this works without touching either component:

```astro
<Button href={MARKETPLACE} data-analytics="install_click_vscode" data-analytics-placement="hero">
  Install for VS Code
</Button>
```

`CodeLine.astro` puts them on the button rather than the row on purpose. The listener walks up from whatever was clicked, so a tag on the row would also fire when someone clicks the command text, and only the copy is worth counting.

For something that is not a click, dispatch the event on the document instead. The page stays ignorant of PostHog, which is what keeps a no-key build free of any reference to it:

```js
document.dispatchEvent(
  new CustomEvent('site-analytics', { detail: { name: 'waitlist_submit', props: { list: 'course' } } }),
);
```

The funnel this feeds is landing view to install click to getting-started view. Where each event in the table above is tagged, and the values its properties take:

| Event | Where | Values |
| --- | --- | --- |
| `install_click_vscode` | Landing hero Install for VS Code; landing quick-start Open in VS Code; landing footer CTA; the Marketplace button on the Install page | `placement`: `hero`, `quick-start`, `footer`, `install` |
| `install_click_speckit_copy` | The copy button on the `specify extension add companion` row, on the landing quick start and on the Install page | `placement`: `quick-start`, `install` |
| `demo_tab_click` | Each of the six demo tabs on the landing page | `tab`: `understand`, `customize`, `living`, `review`, `bugs`, `ideas` |
| `install_path_click` | The three choices in the landing quick start | `path`: `vscode`, `copilot`, `claude` |
| `course_signup` | `src/pages/api/course-signup.ts`, on the server | `placement`: `landing`, `course`, `signup`; `provider`: `webhook`, `posthog` |

The `code --install-extension` fallback on the Install page is deliberately untagged. It is a copy, not a click through to the Marketplace, and giving it `install_click_vscode` would make it indistinguishable from the Marketplace button one line above it.

There is no `guide_view` event. `capture_pageview` is on and the docs pages now load the same script the rest of the site does, so every guide view already sends `$pageview` carrying its URL, and a guide view is a path under `/docs/`. A hand-rolled second event would double count the same view and add nothing a URL filter does not already give.
