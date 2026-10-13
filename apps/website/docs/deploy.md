# Deploy (maintainer notes)

## Vercel settings

Set these on the Vercel project. `vercel.json` in this folder carries the same values, so the dashboard and the file agree.

| Setting | Value |
| --- | --- |
| Root Directory | `apps/website/` |
| Framework preset | Astro |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | *(leave empty)* |
| Ignored Build Step | the `ignoreCommand` in `vercel.json` |

**Output Directory is deliberately empty.** The Vercel adapter writes the Build Output API tree to `.vercel/output`, not `dist`. A leftover `dist` in the dashboard overrides `vercel.json` and the deploy serves nothing useful.

**Only `main` deploys.** `git.deploymentEnabled` in `vercel.json` turns every other branch off, and the ignored build step skips any ref that is not `main`.

**The ignored build step watches four paths, not one.** It runs `git diff --quiet` from the previous deployed commit to `HEAD` over `.`, `../../content/media/web`, `../../content/media/manifest.json` and `../../assets/icons/moss.svg`. `public/media/` is gitignored and filled at build time from `../../content/media/web`, so the site's own videos live outside this folder. Watching `.` alone meant re-rendering every clip changed nothing here, Vercel skipped the build, and the site kept serving the previous encodes while the repo held the new ones. Anything the build *reads* belongs in that list.

Vercel runs the step with the working directory set to the Root Directory, so `.` means `apps/website/`. `git diff --quiet` exits 0 when nothing under those paths changed, and Vercel reads exit 0 as "skip this build". Extension commits and release tags therefore never trigger a site build. When there is no previous deployed commit to compare against, the step exits 1 and the build runs, which is the safe direction.

**`vercel.json` rejects unknown keys.** There is no comment syntax and no `_comment` escape hatch: a stray property fails the whole deploy with `should NOT have additional property`. Explanations go here instead.

`site` in `astro.config.mjs` is set to `https://speckit-companion.dev`, which is what the sitemap integration builds its URLs from.

## Environment variables

Both are optional. With no key, `src/components/Analytics.astro` renders nothing at all, which is the intended default locally and on preview deploys. Nothing else in the site names PostHog either, so a build without a key ships no reference to it rather than a disabled one.

| Variable | Value |
| --- | --- |
| `PUBLIC_POSTHOG_KEY` | The project key. It is the same PostHog project the extension reports into, and every site event carries `source: 'site'` to keep the two apart. See [analytics.md](./analytics.md). |
| `PUBLIC_POSTHOG_HOST` | Defaults to `https://us.i.posthog.com`. Only set it if the org moves region. |

Set them in the Vercel project's environment variables. Never commit a key.

The course signup list reads two more variables, `COURSE_SIGNUP_WEBHOOK_URL` and `PUBLIC_POSTHOG_SURVEY_COURSE`. They are described in [notes.md](./notes.md#the-course-list).
