/*
  The proposed docs tree, ordered by the spec journey. Only the "Your first
  spec" mockup reads it today: the route middleware swaps that page's sidebar
  for this one, so the new navigation can be judged on a real page before any
  other page moves.

  `from` names the page a planned entry is built out of. A planned entry links
  to that page for now, so every link in the preview sidebar goes somewhere.
*/

export const MOCKUP_ID = 'docs/start/your-first-spec';

export interface JourneyPage {
  label: string;
  href: string;
  /** Not built yet: the sidebar marks it, and the link goes to its source. */
  planned?: boolean;
}

export interface JourneyGroup {
  label: string;
  pages: JourneyPage[];
}

export const JOURNEY_TREE: JourneyGroup[] = [
  {
    label: 'Start',
    pages: [
      { label: 'Introduction', href: '/docs/' },
      { label: 'Spec-driven development', href: '/docs/discussions/pick-a-pipeline/', planned: true },
      { label: 'Install', href: '/docs/install/' },
      { label: 'Your first spec', href: '/docs/start/your-first-spec/' },
    ],
  },
  {
    label: 'Navigate',
    pages: [
      { label: 'The sidebar', href: '/docs/anatomy/the-sidebar/' },
      { label: 'Inside the viewer', href: '/docs/anatomy/anatomy-of-the-spec-viewer/' },
    ],
  },
  {
    label: 'Each step',
    pages: [
      { label: 'Constitution', href: '/docs/guides/steering/', planned: true },
      { label: 'Specify', href: '/docs/start/getting-started/', planned: true },
      { label: 'Plan', href: '/docs/start/getting-started/', planned: true },
      { label: 'Tasks', href: '/docs/start/getting-started/', planned: true },
      { label: 'Implement', href: '/docs/guides/check-a-run/', planned: true },
      { label: 'Converge', href: '/changelog/', planned: true },
      { label: 'Review with comments', href: '/docs/guides/review-and-refine/' },
      { label: 'Run it all with Auto', href: '/docs/discussions/pick-a-pipeline/', planned: true },
    ],
  },
  {
    label: 'Read the results',
    pages: [
      { label: 'Reading a spec', href: '/docs/anatomy/anatomy-of-the-spec-viewer/', planned: true },
      { label: 'The Overview', href: '/docs/anatomy/anatomy-of-the-overview/' },
      { label: 'Track progress', href: '/docs/guides/check-a-run/', planned: true },
      { label: 'Living specs', href: '/docs/discussions/living-specs/' },
    ],
  },
  {
    label: 'Other processes',
    pages: [
      { label: 'Fix a bug', href: '/changelog/', planned: true },
      { label: 'Assess an idea', href: '/docs/discussions/pick-a-pipeline/', planned: true },
      { label: 'From the Copilot app', href: '/docs/guides/copilot-app/' },
    ],
  },
  {
    label: 'Customize',
    pages: [
      { label: 'Pipeline Builder', href: '/docs/guides/pipeline-builder/' },
      { label: 'Hooks', href: '/docs/guides/pipeline-builder/', planned: true },
      { label: 'Your own workflow', href: '/docs/guides/customize/' },
      { label: 'Steering', href: '/docs/guides/steering/' },
    ],
  },
  {
    label: 'Reference',
    pages: [
      { label: 'Commands', href: '/docs/start/getting-started/', planned: true },
      { label: 'Configuration', href: '/docs/reference/configuration/' },
      { label: 'Providers', href: '/docs/reference/providers/' },
      { label: 'Telemetry', href: '/docs/reference/telemetry/' },
    ],
  },
];
