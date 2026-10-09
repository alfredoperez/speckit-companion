/*
  One source for the top-bar links, read by the landing-page nav and by the docs
  header, so the two halves of the site cannot drift apart.

  The bar holds the two places you actually go, docs and changelog, next to the
  install button. Nothing unshipped sits in it: the course has one slim strip
  under the landing page's hero.
*/
export interface NavLink {
  label: string;
  href: string;
}

export const navLinks: NavLink[] = [
  { label: 'docs', href: '/docs/' },
  { label: 'changelog', href: '/changelog/' },
];

export const INSTALL_HREF = '/#quick-start';

/** True when `href` is the current page or one of its ancestors. */
export function isCurrentPath(pathname: string, href: string): boolean {
  const here = pathname.replace(/\/+$/, '') || '/';
  const target = href.replace(/\/+$/, '') || '/';
  return here === target || here.startsWith(`${target}/`);
}
