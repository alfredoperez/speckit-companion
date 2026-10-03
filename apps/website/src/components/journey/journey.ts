/*
  The proposed docs tree, ordered by the spec journey, and the step list of the
  "Your first spec" mockup. Only the mockup page reads this today: the route
  middleware swaps its sidebar and its "On this page" rail for these, so the
  new navigation can be judged on a real page before any other page moves.

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
    label: 'Each step',
    pages: [
      { label: 'Constitution', href: '/docs/guides/steering/', planned: true },
      { label: 'Specify', href: '/docs/start/getting-started/', planned: true },
      { label: 'Plan', href: '/docs/start/getting-started/', planned: true },
      { label: 'Tasks', href: '/docs/start/getting-started/', planned: true },
      { label: 'Implement', href: '/docs/guides/check-a-run/', planned: true },
      { label: 'Converge', href: '/changelog/', planned: true },
      { label: 'Review between steps', href: '/docs/guides/review-and-refine/' },
      { label: 'Run it all with Auto', href: '/docs/discussions/pick-a-pipeline/', planned: true },
    ],
  },
  {
    label: 'Read the results',
    pages: [
      { label: 'The spec viewer', href: '/docs/anatomy/anatomy-of-the-spec-viewer/' },
      { label: 'The Overview', href: '/docs/anatomy/anatomy-of-the-overview/' },
      { label: 'The sidebar', href: '/docs/anatomy/the-sidebar/' },
      { label: 'Check a run', href: '/docs/guides/check-a-run/' },
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

export interface FirstSpecStep {
  id: string;
  title: string;
}

/* The page renders these in order and the "On this page" rail lists them, so a
   step renamed here is renamed in both places. */
export const FIRST_SPEC_STEPS: FirstSpecStep[] = [
  { id: 'install', title: 'Install both halves' },
  { id: 'open-a-project', title: 'Open a project' },
  { id: 'create-a-spec', title: 'Create a spec' },
  { id: 'watch-specify-run', title: 'Watch specify run' },
  { id: 'read-the-spec', title: 'Read the spec' },
  { id: 'open-the-overview', title: 'Open the Overview' },
  { id: 'find-it-in-the-sidebar', title: 'Find it in the sidebar' },
];

export const FIRST_SPEC_TAIL = [
  { id: 'its-working-if', title: "It's working if" },
  { id: 'where-it-goes-next', title: 'Where it goes next' },
];

export function stepNumber(id: string): number {
  const index = FIRST_SPEC_STEPS.findIndex((step) => step.id === id);
  if (index < 0) throw new Error(`journey: no first-spec step with id "${id}".`);
  return index + 1;
}

export function stepTitle(id: string): string {
  return FIRST_SPEC_STEPS[stepNumber(id) - 1].title;
}
