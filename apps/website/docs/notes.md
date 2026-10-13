# Site notes (maintainer notes)

## Docs pages

The docs sidebar is the `sidebar` list in `apps/website/astro.config.mjs`. It names every page by slug, in reading order, so a new page is added there as well as saved in its folder. A page that moves gets a line under `redirects` in the same file, pointing at its final address.

The top bar is `src/components/navLinks.ts`, read by the landing nav and the docs header: docs, changelog, install. Nothing unshipped sits in it. In the docs header every link that leaves `/docs/` is a plain navigation, because the docs' page router can only swap docs pages.

Pages are reference, not tutorials: they say what you do and what you see. The building blocks are in `src/components/journey/`.

- `Actions` holds the command or button of a section, above the prose. Commands go in `CodeLine`, which has the copy button.
- `YouSee` is the short "What you see" note after an action.
- `DocFigure` puts every screenshot in the same 16:9 light frame. It takes a file name from `docs/screenshots/generated/`, `content/media/web/`, `docs/screenshots/` or `public/canvas/`, and fails the build on a missing file or missing alt text. `recapture` marks a dark capture that is standing in until a light one exists; `grep -rn recapture src/content` lists them.
- A screenshot that does not exist yet is left out of the page. There is no placeholder frame.

Choices between options go in a table, not in a paragraph of conditions. Paragraphs are never hard-wrapped.

Dark only. Starlight's `ThemeProvider` and `ThemeSelect` are overridden by `src/components/DarkThemeProvider.astro` and `src/components/NoThemeSelect.astro`, which pin `data-theme="dark"` and remove the theme picker. `src/styles/docs.css` forces `color-scheme: dark` so an OS light preference does not leak through.

## The course list

The course signup form is the slim strip under the landing page's hero, and it is on `/course/` and `/course/signup/` too. It posts to `src/pages/api/course-signup.ts`, the site's second serverless function, which checks the address, drops anything that filled the hidden `company` field, and hands the address to one provider. `src/data/courseSignup.ts` picks the provider and holds the words for every outcome.

| Variable | What it does |
| --- | --- |
| `COURSE_SIGNUP_WEBHOOK_URL` | A URL that accepts a JSON `POST` of `{ list, email, placement, at }`. Most list tools offer one. Used first when it is set. Not `PUBLIC_`: it is read on the server only. |
| `PUBLIC_POSTHOG_SURVEY_COURSE` | The id of a PostHog survey. With `PUBLIC_POSTHOG_KEY` also set and no webhook, the address is stored as that survey's response. |

With neither set the list is closed. The form says so before anyone types, and a submit answers "not open yet" instead of pretending to succeed. The form reads these when the site is built and the function reads them when it runs, so redeploy after changing one.

A webhook is the safer choice. PostHog answers `200` for any key, so a wrong key or survey id looks like success and the address is lost.

Without JavaScript the form is a plain `POST`, and the function redirects to `/course/signup/#ok` (or `#invalid`, `#closed`, `#error`), a static page that shows the matching sentence with `:target`.

## Isolation from the extension package

This folder must never end up inside the `.vsix`. `vsce` ignores `.gitignore` when a `.vscodeignore` exists, so an unlisted `apps/website/node_modules` would ship. Two guards:

- `.vscodeignore` at the repo root lists `apps/website/**`.
- `.gitignore` at the repo root lists `apps/website/node_modules/`, `apps/website/dist/`, `apps/website/.astro/`, and `apps/website/.vercel/`. The lockfile stays tracked so Vercel can run `npm ci`.

To check, run `npx vsce ls | grep -i website` from the repo root. No output means no path under `apps/website/` is in the packaged file list.

If you add anything to this folder that generates a new cache or output directory, add it to both ignore files and re-run the check above.
