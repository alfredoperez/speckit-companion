/*
  The PostHog proxy.

  Every analytics request the site makes goes to /ingest/* on our own origin,
  and this forwards it to PostHog. It is the only reason anything is recorded
  at all: pointed straight at us.i.posthog.com, the library never even loaded
  for anyone running a content blocker — the request for array.js came back 204
  with an empty body, so `window.posthog.init` stayed undefined and not one
  event, not even a pageview, was ever sent. The audience here is developers, so
  that is most of them.

  WHY A FUNCTION AND NOT A vercel.json REWRITE. A rewrite is the obvious way to
  proxy and it cannot work on this site. PostHog's capture endpoints all end in
  a slash — /e/, /flags/, /decide/ — and Vercel resolves a trailing-slash path
  against the filesystem, finds nothing, and serves Starlight's 404.html before
  any rewrite is consulted. Measured against production:

      GET /ingest/e    -> 400   PostHog answering, proxy working
      GET /ingest/e/   -> 404   our own 404 page, rewrite never reached

  Three rewrite shapes (:path*, a (.*) capture, and each endpoint named
  explicitly) all failed identically. A function is handed the path whatever
  shape it is, so the slash stops mattering.

  TWO HOSTS. The library and its config are static assets on the assets host;
  everything else is ingestion. Sending assets to the ingestion host mostly
  works and is not what PostHog documents, so they are split here.
*/

export const prerender = false;

const ASSETS = 'https://us-assets.i.posthog.com';
const INGEST = 'https://us.i.posthog.com';

/*
  Hop-by-hop and identity headers must not be forwarded. `host` in particular:
  sent on, PostHog would see speckit-companion.dev and route nowhere. The rest
  describe a connection that ends at this function.
*/
const STRIP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  'te',
  'trailer',
  'x-forwarded-host',
]);

function upstreamFor(path: string): string {
  return path.startsWith('static/') ? `${ASSETS}/${path}` : `${INGEST}/${path}`;
}

export const ALL = async ({ request, params }: { request: Request; params: { path?: string } }) => {
  // Astro gives the matched segments without a leading slash, and drops the
  // trailing one. PostHog is strict about that slash on its capture endpoints,
  // so it is put back from the original URL rather than assumed either way.
  const incoming = new URL(request.url);
  const raw = params.path ?? '';
  const path = incoming.pathname.endsWith('/') && raw !== '' ? `${raw}/` : raw;

  const target = new URL(upstreamFor(path));
  target.search = incoming.search;

  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!STRIP.has(name.toLowerCase())) headers.set(name, value);
  });

  // The visitor's address, so PostHog still resolves geography. Without it
  // every event would appear to come from a Vercel edge node.
  const clientIp =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'follow',
    });
  } catch {
    // Analytics must never be able to break a page. A visitor whose events are
    // lost should still get the site.
    return new Response(null, { status: 502 });
  }

  // content-encoding and content-length describe the body fetch already
  // decoded. Passing them through makes the browser try to decode it twice.
  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');

  return new Response(upstream.body, { status: upstream.status, headers: out });
};
