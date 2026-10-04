// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import { mkdir, writeFile } from 'node:fs/promises';

// Retired URLs. The docs were regrouped by the spec journey, and every page
// that moved, merged or split keeps its old address pointing at the page that
// now holds its content, so a bookmark or a link in a published README never
// 404s. Targets are final pages, never another redirect.
//
// getting-started   became Your first spec; its command table is Commands.
// pick-a-pipeline   the two workflows are explained with the method itself.
// the two Pipeline Builder pages (anatomy and guide) are one page now.
// customize         custom commands stayed with Your own workflow; hooks got
//                   their own page, which that one links to first.
//
// The sidebar was then regrouped by where you work, and the Other processes
// folder went away.
//
// fix-a-bug, assess-an-idea   moved in with the IDE pages.
// copilot-app, claude-code    each split into three pages; the old address
//                             lands on Install, the first of them.
const MOVED = {
  '/docs/start/getting-started': '/docs/start/your-first-spec',
  '/docs/anatomy/the-sidebar': '/docs/navigate/the-sidebar',
  '/docs/anatomy/sidebar-and-steering': '/docs/navigate/the-sidebar',
  '/docs/anatomy/anatomy-of-the-spec-viewer': '/docs/navigate/inside-the-viewer',
  '/docs/anatomy/anatomy-of-the-overview': '/docs/results/the-overview',
  '/docs/guides/reading-the-overview': '/docs/results/the-overview',
  '/docs/anatomy/anatomy-of-the-pipeline-builder': '/docs/customize/pipeline-builder',
  '/docs/guides/pipeline-builder': '/docs/customize/pipeline-builder',
  '/docs/guides/customize': '/docs/customize/your-own-workflow',
  '/docs/guides/steering': '/docs/customize/steering',
  '/docs/guides/review-and-refine': '/docs/steps/review-with-comments',
  '/docs/guides/check-a-run': '/docs/results/track-progress',
  '/docs/guides/copilot-app': '/docs/copilot-app/install',
  '/docs/guides/claude-code': '/docs/claude-code/install',
  '/docs/guides/living-specs': '/docs/results/living-specs',
  '/docs/discussions/living-specs': '/docs/results/living-specs',
  '/docs/guides/pick-a-pipeline': '/docs/start/spec-driven-development',
  '/docs/discussions/pick-a-pipeline': '/docs/start/spec-driven-development',
  '/docs/processes/fix-a-bug': '/docs/ide/fix-a-bug',
  '/docs/processes/assess-an-idea': '/docs/ide/assess-an-idea',
  '/docs/processes/copilot-app': '/docs/copilot-app/install',
  '/docs/processes/claude-code': '/docs/claude-code/install',
};

// The adapter turns each redirect into a Vercel route that matches the path
// exactly, so `/docs/guides/steering/` with its trailing slash fell through to
// the 404 page, and published READMEs link with the slash. A second route for
// the slash form is a route collision in Astro, so the slash form is covered by
// a static page at that address which forwards to the same place.
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
      },
      customCss: ['./src/styles/docs.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/alfredoperez/speckit-companion',
        },
      ],
      // Six groups, by where you work: get set up, the VS Code extension, the
      // Copilot app, Claude Code, make it yours, then the dictionaries. Every
      // entry is named here by slug, because the order is the reading order
      // and the footer's previous and next buttons walk it. A new page is
      // added to its group below.
      //
      // A group is not a folder. The IDE group gathers pages from start/,
      // navigate/, steps/, results/ and ide/, which kept their addresses when
      // the sidebar was regrouped.
      //
      // Introduction and Install are /docs/ and /docs/install: the first is the
      // section root, and the second is linked from two published READMEs.
      sidebar: [
        {
          label: 'Start',
          items: [
            { label: 'Introduction', slug: 'docs' },
            { label: 'What is spec-driven development?', slug: 'docs/start/spec-driven-development' },
            { label: 'Install', slug: 'docs/install' },
          ],
        },
        {
          label: 'In your IDE',
          items: [
            { label: 'Choose an AI provider', slug: 'docs/ide/choose-a-provider' },
            { label: 'Your first spec', slug: 'docs/start/your-first-spec' },
            { label: 'The sidebar', slug: 'docs/navigate/the-sidebar' },
            { label: 'Inside the viewer', slug: 'docs/navigate/inside-the-viewer' },
            {
              label: 'Each step',
              collapsed: true,
              items: [
                { label: 'Constitution', slug: 'docs/steps/constitution' },
                { label: 'Specify', slug: 'docs/steps/specify' },
                { label: 'Plan', slug: 'docs/steps/plan' },
                { label: 'Tasks', slug: 'docs/steps/tasks' },
                { label: 'Implement', slug: 'docs/steps/implement' },
                { label: 'Converge', slug: 'docs/steps/converge' },
                { label: 'Review with comments', slug: 'docs/steps/review-with-comments' },
                { label: 'Run it all with Auto', slug: 'docs/steps/auto' },
              ],
            },
            {
              label: 'Read the results',
              collapsed: true,
              items: [
                { label: 'Reading a spec', slug: 'docs/results/reading-a-spec' },
                { label: 'The Overview', slug: 'docs/results/the-overview' },
                { label: 'Track progress', slug: 'docs/results/track-progress' },
                { label: 'Living specs', slug: 'docs/results/living-specs' },
              ],
            },
            { label: 'Fix a bug', slug: 'docs/ide/fix-a-bug', badge: { text: 'New', variant: 'tip' } },
            { label: 'Assess an idea', slug: 'docs/ide/assess-an-idea', badge: { text: 'New', variant: 'tip' } },
          ],
        },
        {
          label: 'In the Copilot app',
          items: [
            { label: 'Install', slug: 'docs/copilot-app/install' },
            { label: 'Navigate the board', slug: 'docs/copilot-app/navigate-the-board' },
            { label: 'Run the steps', slug: 'docs/copilot-app/run-the-steps' },
          ],
        },
        {
          label: 'In Claude Code',
          badge: { text: 'New', variant: 'tip' },
          items: [
            { label: 'Install', slug: 'docs/claude-code/install' },
            { label: 'What it shows', slug: 'docs/claude-code/what-it-shows' },
            { label: 'Switch specs with /spec', slug: 'docs/claude-code/switch-specs' },
          ],
        },
        {
          label: 'Customize',
          items: [
            { label: 'Pipeline Builder', slug: 'docs/customize/pipeline-builder' },
            { label: 'Hooks', slug: 'docs/customize/hooks' },
            { label: 'Your own workflow', slug: 'docs/customize/your-own-workflow' },
            { label: 'Steering', slug: 'docs/customize/steering' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Commands', slug: 'docs/reference/commands' },
            { label: 'Configuration', slug: 'docs/reference/configuration' },
            { label: 'Providers', slug: 'docs/reference/providers' },
            { label: 'Telemetry', slug: 'docs/reference/telemetry' },
          ],
        },
      ],
    }),
  ],
});
