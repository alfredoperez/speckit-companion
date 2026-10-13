// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import { mkdir, writeFile } from 'node:fs/promises';

// Retired URLs. Every page that moved or merged keeps its old address pointing
// at the page that now holds its content, so a bookmark or a link in a
// published README never 404s. Targets are final pages, never another redirect.
//
// The docs went from 39 pages to 16: one Install page for every surface, one
// page for all the steps, one page each for the Copilot app and Claude Code,
// and one Settings page that holds the providers and telemetry.
const STEPS = '/docs/steps';
const INSTALL = '/docs/install';
const VIEWER = '/docs/navigate/viewer-and-sidebar';
const OVERVIEW = '/docs/results/the-overview';
const BUILDER = '/docs/customize/workflow-builder';
const BUGS = '/docs/ide/bugs-and-ideas';
const COPILOT = '/docs/copilot-app';
const CLAUDE = '/docs/claude-code';
const SETTINGS = '/docs/reference/configuration';

const MOVED = {
  '/docs/start/getting-started': '/docs/start/your-first-spec',
  '/docs/start/spec-driven-development': STEPS,
  '/docs/guides/pick-a-pipeline': STEPS,
  '/docs/discussions/pick-a-pipeline': STEPS,
  '/docs/steps/constitution': STEPS,
  '/docs/steps/specify': STEPS,
  '/docs/steps/plan': STEPS,
  '/docs/steps/tasks': STEPS,
  '/docs/steps/implement': STEPS,
  '/docs/steps/converge': STEPS,
  '/docs/steps/auto': STEPS,
  '/docs/guides/review-and-refine': '/docs/steps/review-with-comments',

  '/docs/ide/install': INSTALL,
  '/docs/ide/choose-a-provider': INSTALL,
  '/docs/copilot-app/install': INSTALL,
  '/docs/claude-code/install': INSTALL,

  '/docs/anatomy/the-sidebar': VIEWER,
  '/docs/anatomy/sidebar-and-steering': VIEWER,
  '/docs/anatomy/anatomy-of-the-spec-viewer': VIEWER,
  '/docs/navigate/the-sidebar': VIEWER,
  '/docs/navigate/inside-the-viewer': VIEWER,
  '/docs/results/reading-a-spec': VIEWER,
  '/docs/guides/steering': VIEWER,
  '/docs/customize/steering': VIEWER,

  '/docs/anatomy/anatomy-of-the-overview': OVERVIEW,
  '/docs/guides/reading-the-overview': OVERVIEW,
  '/docs/guides/check-a-run': OVERVIEW,
  '/docs/results/track-progress': OVERVIEW,
  '/docs/guides/living-specs': '/docs/results/living-specs',
  '/docs/discussions/living-specs': '/docs/results/living-specs',

  '/docs/processes/fix-a-bug': BUGS,
  '/docs/processes/assess-an-idea': BUGS,
  '/docs/ide/fix-a-bug': BUGS,
  '/docs/ide/assess-an-idea': BUGS,

  '/docs/guides/copilot-app': COPILOT,
  '/docs/processes/copilot-app': COPILOT,
  '/docs/copilot-app/navigate-the-board': COPILOT,
  '/docs/copilot-app/run-the-steps': COPILOT,
  '/docs/copilot-app/a-run-step-by-step': COPILOT,
  '/docs/guides/claude-code': CLAUDE,
  '/docs/processes/claude-code': CLAUDE,
  '/docs/claude-code/what-it-shows': CLAUDE,
  '/docs/claude-code/a-run-step-by-step': CLAUDE,
  '/docs/claude-code/switch-specs': CLAUDE,

  '/docs/anatomy/anatomy-of-the-pipeline-builder': BUILDER,
  '/docs/guides/pipeline-builder': BUILDER,
  '/docs/customize/pipeline-builder': BUILDER,
  '/docs/customize/hooks': BUILDER,
  '/workflow-builder': BUILDER,
  '/docs/guides/customize': '/docs/customize/your-own-workflow',

  '/docs/reference/providers': SETTINGS,
  '/docs/reference/telemetry': SETTINGS,
};

// The adapter turns each redirect into a Vercel route that matches the path
// exactly, so `/docs/guides/steering/` with its trailing slash fell through to
// the 404 page, and published READMEs link with the slash. A second route for
// the slash form is a route collision in Astro, so the slash form is covered by
// a static page at that address which forwards to the same place.
/** @param {string} to */
const forward = (to) =>
  `<!doctype html><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="https://speckit-companion.dev${to}"><meta http-equiv="refresh" content="0;url=${to}"><meta name="robots" content="noindex"><a href="${to}">This page moved to ${to}</a>`;

/** @type {import('astro').AstroIntegration} */
const trailingSlashRedirects = {
  name: 'trailing-slash-redirects',
  hooks: {
    'astro:build:generated': async ({ dir }) => {
      for (const [from, to] of Object.entries(MOVED)) {
        const folder = new URL(`.${from}/`, dir);
        await mkdir(folder, { recursive: true });
        await writeFile(new URL('index.html', folder), forward(to));
      }
    },
  },
};

/*
  Still a static site: every page prerenders, exactly as before. The adapter is
  here for ONE route, src/pages/ingest/[...path].ts, which opts out with
  `prerender = false` and ships as a single serverless function.

  It exists because analytics could not be made to work any other way. PostHog
  has to be proxied through our own origin or content blockers answer 204 for
  it and nothing is ever recorded. A vercel.json rewrite was the obvious way to
  proxy, and it cannot work here: PostHog's capture endpoints all end in a
  slash (/e/, /flags/, /decide/), and Vercel resolves a trailing-slash path
  against the filesystem and serves Starlight's 404.html before any rewrite is
  consulted. Measured: /ingest/e answered 400 from PostHog, /ingest/e/ answered
  404 from our own 404 page. Three rewrite shapes failed the same way.

  A function receives the path whatever its shape, so the slash stops mattering.
*/
export default defineConfig({
  adapter: vercel(),
  // The canonical origin. Three things are derived from it and none of them
  // work without it: the sitemap the integration builds, the rel=canonical on
  // every page, and the absolute og:image and og:url a share card needs. It was
  // unset while the domain was undecided, which is why every build warned.
  site: 'https://speckit-companion.dev',
  output: 'static',
  trailingSlash: 'ignore',
  redirects: MOVED,
  // A docs link starts loading on hover, so the page swap has it by the click.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    trailingSlashRedirects,
    starlight({
      title: 'SpecKit Companion',
      description:
        'Documentation for SpecKit Companion: install both halves, read the spec viewer and the Overview, and run a spec end to end.',
      // The site owns /404. Starlight ships its own and wins the route on
      // priority, so its version is turned off rather than shadowed.
      disable404Route: true,
      // Dark only. The first two overrides remove the theme picker and pin the
      // document to the dark palette before first paint.
      //
      // SocialIcons is the one header slot that renders in both the desktop bar
      // and the mobile menu, so the site nav rides in on it. DocsHeaderNav reads
      // the same src/components/navLinks.ts the landing page does and renders
      // Starlight's own social links after it, so both halves of the site show
      // the same bar in the same order.
      //
      // Head renders Starlight's own head and then the site's Analytics
      // component and favicon links, because docs pages do not go through
      // BaseLayout.astro and would otherwise carry no analytics at all.
      //
      // SiteTitle puts the LogoMark (the moss mascot) in the docs header, so it appears
      // on both halves of the site. It renders the component rather than the
      // `logo` config option, which would need a second copy of the mark as a
      // file on disk.
      components: {
        ThemeProvider: './src/components/DarkThemeProvider.astro',
        ThemeSelect: './src/components/NoThemeSelect.astro',
        SocialIcons: './src/components/DocsHeaderNav.astro',
        SiteTitle: './src/components/DocsSiteTitle.astro',
        Head: './src/components/DocsHead.astro',
        Header: './src/components/DocsHeader.astro',
      },
      customCss: ['./src/styles/docs.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/alfredoperez/speckit-companion',
        },
      ],
      // Sixteen pages in six groups, in reading order: the footer's previous
      // and next buttons walk it. A page is added to its group below, and a
      // new page needs a reason an existing page cannot hold.
      sidebar: [
        {
          label: 'Start',
          items: [
            { label: 'Introduction', slug: 'docs' },
            { label: 'Install', slug: 'docs/install' },
            { label: 'Quickstart', slug: 'docs/start/your-first-spec' },
          ],
        },
        {
          label: 'Run',
          items: [
            { label: 'The steps', slug: 'docs/steps' },
            { label: 'Review with comments', slug: 'docs/steps/review-with-comments' },
            { label: 'Plan blocks', slug: 'docs/steps/plan-blocks' },
            { label: 'Bugs and ideas', slug: 'docs/ide/bugs-and-ideas' },
          ],
        },
        {
          label: 'Read',
          items: [
            { label: 'Viewer and sidebar', slug: 'docs/navigate/viewer-and-sidebar' },
            { label: 'Overview and progress', slug: 'docs/results/the-overview' },
            { label: 'Living specs', slug: 'docs/results/living-specs' },
          ],
        },
        {
          label: 'Other surfaces',
          items: [
            { label: 'Copilot app', slug: 'docs/copilot-app' },
            { label: 'Claude Code', slug: 'docs/claude-code' },
          ],
        },
        {
          label: 'Customize',
          items: [
            { label: 'Workflow Builder and hooks', slug: 'docs/customize/workflow-builder' },
            { label: 'Custom workflows and commands', slug: 'docs/customize/your-own-workflow' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Commands', slug: 'docs/reference/commands' },
            { label: 'Settings', slug: 'docs/reference/configuration' },
          ],
        },
      ],
    }),
  ],
});
