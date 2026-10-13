# SpecKit Companion website

The marketing site and documentation for SpecKit Companion, served at [speckit-companion.dev](https://speckit-companion.dev). It lives in this repo but is not part of any extension: it has its own `package.json`, lockfile, build and deploy.

## Stack

Astro with the Starlight docs integration, static output.

- `src/pages/index.astro` is the landing page, a plain Astro route with its own dark styles. It does not use the Starlight layout.
- `src/content/docs/docs/` holds the Starlight pages, so they serve under `/docs/`. The nesting is what keeps Starlight off the `/` route.
- `src/content.config.ts` wires the `docs` collection to Starlight's loader and schema.

The docs sidebar is the `sidebar` list in `astro.config.mjs`. A new page is added there as well as saved in its folder, and a page that moves gets a line under `redirects` in the same file.

## Commands

Run these from `apps/website/`, not from the repo root.

```
npm install    # first time
npm run dev    # local dev server
npm run build  # writes ./dist
npm run preview
```

## Deploy

Vercel builds and deploys `main` when a commit changes this folder or the media it reads. The settings and environment variables are in [docs/deploy.md](./docs/deploy.md).

## Deeper notes

- [docs/deploy.md](./docs/deploy.md): the Vercel settings, the ignored build step and the environment variables.
- [docs/analytics.md](./docs/analytics.md): the events the site sends, how to tag an element, and why the site proxies PostHog.
- [docs/notes.md](./docs/notes.md): the docs page building blocks, the course signup list, and how this folder stays out of the `.vsix`.
