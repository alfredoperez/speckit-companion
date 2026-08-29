# SpecKit Companion website

The marketing site and documentation for SpecKit Companion. It lives in this repo but is not part of either extension: separate `package.json`, separate lockfile, separate build, separate deploy.

Scaffold only right now. The landing page and the two docs pages are placeholders, and they say so on the page. Real content lands in a later ticket, from a claim ledger that cites the source file behind every sentence.

## Stack

Astro with the Starlight docs integration, static output.

- `src/pages/index.astro` is the landing page, a plain Astro route with its own dark styles. It does not use the Starlight layout.
- `src/content/docs/docs/` holds the Starlight pages, so they serve under `/docs/`. The nesting is what keeps Starlight off the `/` route.
- `src/content.config.ts` wires the `docs` collection to Starlight's loader and schema.

Dark only. Starlight's `ThemeProvider` and `ThemeSelect` are overridden by `src/components/DarkThemeProvider.astro` and `src/components/NoThemeSelect.astro`, which pin `data-theme="dark"` and remove the theme picker. `src/styles/docs.css` forces `color-scheme: dark` so an OS light preference does not leak through.

## Commands

Run these from `website/`, not from the repo root.

```
npm install    # first time
npm run dev    # local dev server
npm run build  # writes ./dist
npm run preview
```

## Vercel settings

Set these on the Vercel project. `vercel.json` in this folder carries the same values, so the dashboard and the file agree.

| Setting | Value |
| --- | --- |
| Root Directory | `website/` |
| Framework preset | Astro |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Ignored Build Step | `git diff --quiet HEAD^ HEAD -- .` |

The Ignored Build Step is the important one. Vercel runs it with the working directory set to the Root Directory, so `.` means `website/`. `git diff --quiet` exits 0 when the last commit touched nothing under `website/`, and Vercel reads exit 0 as "skip this build". Extension commits and release tags therefore never trigger a site build. If `HEAD^` cannot be resolved, git exits non-zero and the build runs, which is the safe direction.

`site` is deliberately unset in `astro.config.mjs` because the domain has not been chosen yet. That makes the sitemap integration log a skip warning on every build. Set `site` once the domain is registered and the warning goes away.

### Environment variables

Both are optional. With no key, `src/components/Analytics.astro` renders nothing at all, which is the intended default locally and on preview deploys. Nothing else in the site names PostHog either, so a build without a key ships no reference to it rather than a disabled one.

`Analytics.astro` is mounted in three places, because three kinds of page build their own document: `BaseLayout.astro` for the landing page and the soon pages, `src/components/DocsHead.astro` for the whole Starlight `/docs/` tree, and `src/pages/changelog.astro`, which is a standalone route. A new page that does not go through `BaseLayout` has to mount it too.

| Variable | Value |
| --- | --- |
| `PUBLIC_POSTHOG_KEY` | The project key. Belongs to a new PostHog project inside the org that already carries the extension's telemetry, so site traffic and product telemetry stay separate streams. |
| `PUBLIC_POSTHOG_HOST` | Defaults to `https://us.i.posthog.com`. Only set it if the org moves region. |

Set them in the Vercel project's environment variables. Never commit a key.

Two things about PostHog worth knowing before you debug it. Ingestion answers `200 Ok` for any key, valid or not, so a wrong key fails silently and looks exactly like success: confirm events in the Activity feed rather than by reading a response code. And the loader runs cookieless through `persistence: 'memory'`, which is why the site owes no consent banner, so changing that setting changes the site's obligations.

### Tagging something for the funnel

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

The funnel this feeds is landing view to install click to getting-started view. What is tagged today:

| Event | Where | Properties |
| --- | --- | --- |
| `install_click_vscode` | Landing hero Install for VS Code; landing quick-start Open in VS Code; landing footer CTA; the Marketplace button on the getting-started guide | `placement`: `hero`, `quick-start`, `footer`, `getting-started` |
| `install_click_speckit_copy` | The copy button on the `specify extension add companion` row, on the landing quick start and on the getting-started guide | `placement`: `quick-start`, `getting-started` |
| `demo_tab_click` | Each of the four demo tabs on the landing page | `tab`: `understand`, `customize`, `living`, `review` |
| `waitlist_submit` | Submit on either soon page's waitlist form, fired from the handler | `list`: `workflow-builder`, `course` |

The `code --install-extension` fallback on the getting-started guide is deliberately untagged. It is a copy, not a click through to the Marketplace, and giving it `install_click_vscode` would make it indistinguishable from the Marketplace button one line above it.

There is no `guide_view` event. `capture_pageview` is on and the docs pages now load the same script the rest of the site does, so every guide view already sends `$pageview` carrying its URL, and a guide view is a path under `/docs/`. A hand-rolled second event would double count the same view and add nothing a URL filter does not already give.

## Isolation from the extension package

This folder must never end up inside the `.vsix`. `vsce` ignores `.gitignore` when a `.vscodeignore` exists, so an unlisted `website/node_modules` would ship. Two guards:

- `.vscodeignore` at the repo root lists `website/**`.
- `.gitignore` at the repo root lists `website/node_modules/`, `website/dist/`, `website/.astro/`, and `website/.vercel/`. The lockfile stays tracked so Vercel can run `npm ci`.

Proof, run from the repo root on 2026-08-27 after the scaffold and the ignore entries were in place:

```
$ npx vsce ls | grep -i website
$ echo $?
1
```

No output and exit code 1, meaning `grep` matched nothing: no path under `website/` appears in the packaged file list.

The rest of the packaged list was compared line by line against a listing captured before this folder existed. Every difference was an addition under `media/` from other work landing in the repo at the same time: six `STORYBOARD.md` files and `media/manifest.json`. Nothing in the diff came from this folder, and no file was removed.

If you add anything to this folder that generates a new cache or output directory, add it to both ignore files and re-run the check above.
