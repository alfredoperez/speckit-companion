import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import { JOURNEY_TREE, MOCKUP_ID } from './components/journey/journey';

type Link = Extract<StarlightRouteData['sidebar'][number], { type: 'link' }>;

const trim = (href: string) => href.replace(/\/$/, '');

// Only the "Your first spec" mockup gets the journey sidebar; every other page keeps today's.
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  if (route.id !== MOCKUP_ID) return;

  const here = trim(context.url.pathname);
  const links: Link[] = [];

  route.sidebar = JOURNEY_TREE.map((group) => ({
    type: 'group' as const,
    label: group.label,
    collapsed: false,
    badge: undefined,
    entries: group.pages.map((page) => {
      const link: Link = {
        type: 'link',
        label: page.label,
        href: page.href,
        isCurrent: trim(page.href) === here,
        badge: page.planned ? { text: 'planned', variant: 'note' } : undefined,
        attrs: page.planned ? { 'data-planned': '' } : {},
      };
      links.push(link);
      return link;
    }),
  }));

  const at = links.findIndex((link) => link.isCurrent);
  route.pagination = { prev: links[at - 1], next: links[at + 1] };
});
