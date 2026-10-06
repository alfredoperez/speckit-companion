# SpecKit Companion website

The marketing site and documentation for SpecKit Companion. It lives in this repo but is not part of either extension: separate `package.json`, separate lockfile, separate build, separate deploy.

## Stack

Astro with the Starlight docs integration, static output.

- `src/pages/index.astro` is the landing page, a plain Astro route with its own dark styles. It does not use the Starlight layout.
- `src/content/docs/docs/` holds the Starlight pages, so they serve under `/docs/`. The nesting is what keeps Starlight off the `/` route.
- `src/content.config.ts` wires the `docs` collection to Starlight's loader and schema.

## Docs

The docs sidebar is organized by where you work. A group is a list in the sidebar, not a folder: the IDE group gathers pages from five folders, which kept their addresses when the sidebar was regrouped.

| Group | Folder under `src/content/docs/docs/` | What its pages are |
| --- | --- | --- |
| Start | `index.mdx`, `start/spec-driven-development.mdx`, `install.mdx` | What it is, the method with its glossary and the two other processes, then the install launchpad |
| In your IDE | `ide/`, `start/your-first-spec.mdx`, `navigate/`, `steps/`, `results/` | Install, choosing a provider, the first spec, the sidebar and the viewer, then two collapsed sub-groups (Each step, Read the results), then fixing a bug and assessing an idea |
| In the Copilot app | `copilot-app/` | Install, Navigate the board, Run the steps |
| In Claude Code | `claude-code/` | Install, What it shows, Switch specs with /spec |
| Customize | `customize/` | Pipeline Builder, hooks, your own workflow, steering |
| Reference | `reference/` | Commands, configuration, providers, telemetry |

The regroup retired the `processes/` folder. Fix a bug and Assess an idea moved to `ide/`, the Copilot app page and the Claude Code page each split into three, and Choose an AI provider is new. The four old `/docs/processes/` addresses redirect, and the two split pages land on their Install page.

`/docs/install` is a launchpad, not a path: three cards, one per place you work, and the parts every path shares (what each piece is, updating, troubleshooting). Each group's own Install page (`ide/install.mdx`, `copilot-app/install.mdx`, `claude-code/install.mdx`) holds that tool's full numbered path. The three pages keep the same order and wording, read their commands from `src/data/installCommands.ts`, and the landing quick start follows them. The launchpad's cards carry the ids the page had when it held every path (`#in-vs-code`, `#in-the-github-copilot-app`, `#in-claude-code` and the step ids), so an old hash link lands on the card that leads to those steps.

The top bar is `src/components/navLinks.ts`, read by the landing nav and the docs header: docs, changelog, install. Nothing unshipped sits in it. In the docs header every link that leaves `/docs/` is a plain navigation, because the docs' page router can only swap docs pages.

The sidebar in `astro.config.mjs` names every page by slug, in reading order, so a new page is added there as well as saved in its folder. A page that moves gets a line under `redirects` in the same file, pointing at its final address.

Pages are reference, not tutorials: they say what you do and what you see. The building blocks are in `src/components/journey/`.

- `Actions` holds the command or button of a section, above the prose. Commands go in `CodeLine`, which has the copy button.
- `YouSee` is the short "What you see" note after an action.
- `DocFigure` puts every screenshot in the same 16:9 light frame. It takes a file name from `docs/screenshots/generated/`, `content/media/web/`, `docs/screenshots/` or `public/canvas/`, and fails the build on a missing file or missing alt text. `recapture` marks a dark capture that is standing in until a light one exists; `grep -rn recapture src/content` lists them.
- A screenshot that does not exist yet is left out of the page. There is no placeholder frame.

Choices between options go in a table, not in a paragraph of conditions. Paragraphs are never hard-wrapped.

Dark only. Starlight's `ThemeProvider` and `ThemeSelect` are overridden by `src/components/DarkThemeProvider.astro` and `src/components/NoThemeSelect.astro`, which pin `data-theme="dark"` and remove the theme picker. `src/styles/docs.css` forces `color-scheme: dark` so an OS light preference does not leak through.

## Commands

Run these from `apps/website/`, not from the repo root.

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
| Root Directory | `apps/website/` |
| Framework preset | Astro |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | *(leave empty)* |
| Ignored Build Step | `git diff --quiet HEAD^ HEAD -- . ../../content/media/web ../../content/media/manifest.json` |

**Output Directory is deliberately empty.** The Vercel adapter writes the Build Output API tree to `.vercel/output`, not `dist`. A leftover `dist` in the dashboard overrides `vercel.json` and the deploy serves nothing useful.

**The ignored-build-step watches three paths, not one.** `public/media/` is gitignored and filled at build time from `../../content/media/web`, so the site's own videos live outside this folder. Watching `.` alone meant re-rendering every clip changed nothing here, Vercel skipped the build, and the site kept serving the previous encodes while the repo held the new ones. Anything the build *reads* belongs in that list.

**`vercel.json` rejects unknown keys.** There is no comment syntax and no `_comment` escape hatch — a stray property fails the whole deploy with `should NOT have additional property`. Explanations go here instead.

The Ignored Build Step is the important one. Vercel runs it with the working directory set to the Root Directory, so `.` means `apps/website/`. `git diff --quiet` exits 0 when the last commit touched nothing under `apps/website/`, and Vercel reads exit 0 as "skip this build". Extension commits and release tags therefore never trigger a site build. If `HEAD^` cannot be resolved, git exits non-zero and the build runs, which is the safe direction.

`site` is deliberately unset in `astro.config.mjs` because the domain has not been chosen yet. That makes the sitemap integration log a skip warning on every build. Set `site` once the domain is registered and the warning goes away.

### Environment variables

Both are optional. With no key, `src/components/Analytics.astro` renders nothing at all, which is the intended default locally and on preview deploys. Nothing else in the site names PostHog either, so a build without a key ships no reference to it rather than a disabled one.

`Analytics.astro` is mounted in three places, because three kinds of page build their own document: `BaseLayout.astro` for the landing page, the soon pages and the course signup page, `src/components/DocsHead.astro` for the whole Starlight `/docs/` tree, and `src/pages/changelog.astro`, which is a standalone route. A new page that does not go through `BaseLayout` has to mount it too.

| Variable | Value |
| --- | --- |
| `PUBLIC_POSTHOG_KEY` | The project key. Belongs to a new PostHog project inside the org that already carries the extension's telemetry, so site traffic and product telemetry stay separate streams. |
| `PUBLIC_POSTHOG_HOST` | Defaults to `https://us.i.posthog.com`. Only set it if the org moves region. |

Set them in the Vercel project's environment variables. Never commit a key.

### The course list

The course signup form is on the landing page, on `/course/` and on `/course/signup/`. It posts to `src/pages/api/course-signup.ts`, the site's second serverless function, which checks the address, drops anything that filled the hidden `company` field, and hands the address to one provider. `src/data/courseSignup.ts` picks the provider and holds the words for every outcome.

| Variable | What it does |
| --- | --- |
| `COURSE_SIGNUP_WEBHOOK_URL` | A URL that accepts a JSON `POST` of `{ list, email, placement, at }`. Most list tools offer one. Used first when it is set. Not `PUBLIC_`: it is read on the server only. |
| `PUBLIC_POSTHOG_SURVEY_COURSE` | The id of a PostHog survey. With `PUBLIC_POSTHOG_KEY` also set and no webhook, the address is stored as that survey's response. |

With neither set the list is closed. The form says so before anyone types, and a submit answers "not open yet" instead of pretending to succeed. The form reads these when the site is built and the function reads them when it runs, so redeploy after changing one.

A webhook is the safer choice. PostHog answers `200` for any key, so a wrong key or survey id looks like success and the address is lost.

Without JavaScript the form is a plain `POST`, and the function redirects to `/course/signup/#ok` (or `#invalid`, `#closed`, `#error`), a static page that shows the matching sentence with `:target`.

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
| `install_click_vscode` | Landing hero Install for VS Code; landing quick-start Open in VS Code; landing footer CTA; the Marketplace button on the VS Code Install page | `placement`: `hero`, `quick-start`, `footer`, `install` |
| `install_click_speckit_copy` | The copy button on the `specify extension add companion` row, on the landing quick start and on the three Install pages | `placement`: `quick-start`, `install` |
| `demo_tab_click` | Each of the six demo tabs on the landing page | `tab`: `understand`, `customize`, `living`, `review`, `bugs`, `ideas` |
| `install_path_click` | The three choices in the landing quick start | `path`: `vscode`, `copilot`, `claude` |
| `waitlist_submit` | Submit on the workflow builder page's waitlist form, fired from the handler | `list`: `workflow-builder` |
| `course_signup` | A stored signup on the course list, sent by the server from `src/pages/api/course-signup.ts`. It never carries the address | `placement`: `landing`, `course`, `signup`; `provider`: `webhook`, `posthog` |

The `code --install-extension` fallback on the VS Code Install page is deliberately untagged. It is a copy, not a click through to the Marketplace, and giving it `install_click_vscode` would make it indistinguishable from the Marketplace button one line above it.

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
