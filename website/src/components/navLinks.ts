/*
  One source for the top-bar links, read by the landing-page nav and by the docs
  header, so the two halves of the site cannot drift apart.

  The groups are the layout, not decoration. Two pairs sit across the bar.

  The workflow builder and the course are both unshipped, so they lead as a
  pair, and both carry a SOON chip. The chip is never dropped from either one:
  it is the site's only mechanism for saying a thing is not built.

  Docs and changelog are the two places you actually go, so they pair up at the
  right, next to the install button, rather than sitting at opposite ends of the
  bar with the unshipped things between them.
*/
export interface NavLink {
  label: string;
  href: string;
  soon: boolean;
}

export const navGroups: NavLink[][] = [
  [
    { label: 'workflow builder', href: '/workflow-builder/', soon: true },
    { label: 'course', href: '/course/', soon: true },
  ],
  [
    { label: 'docs', href: '/docs/', soon: false },
    { label: 'changelog', href: '/changelog/', soon: false },
  ],
];

export const INSTALL_HREF = '/#quick-start';

/** True when `href` is the current page or one of its ancestors. */
export function isCurrentPath(pathname: string, href: string): boolean {
  const here = pathname.replace(/\/+$/, '') || '/';
  const target = href.replace(/\/+$/, '') || '/';
  return here === target || here.startsWith(`${target}/`);
}
