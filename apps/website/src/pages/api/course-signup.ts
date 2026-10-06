/*
  The course list's one endpoint. The form on the landing page and on /course/
  posts here, with or without JavaScript.

  It validates the address, drops anything that filled the honeypot, hands the
  address to the provider the environment names (src/data/courseSignup.ts) and
  answers one of four statuses. A script gets the status as JSON. A plain form
  post is redirected to /course/signup/#<status>, a static page that shows the
  matching sentence.

  A `course_signup` event goes to PostHog on success, WITHOUT the address: it
  says a signup happened and where the form sat, nothing about who.
*/
import { posthogHost, posthogKey, signupProvider, type SignupStatus } from '../../data/courseSignup';

export const prerender = false;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLACEMENTS = new Set(['landing', 'course', 'signup']);
const HTTP: Record<SignupStatus, number> = { ok: 200, invalid: 400, closed: 503, error: 502 };

async function send(url: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function signUp(email: string, placement: string): Promise<SignupStatus> {
  const provider = signupProvider();
  if (!provider) return 'closed';

  const stored =
    provider.kind === 'webhook'
      ? await send(provider.url, { list: 'course', email, placement, at: new Date().toISOString() })
      : await send(`${provider.host}/i/v0/e/`, {
          api_key: provider.key,
          event: 'survey sent',
          distinct_id: crypto.randomUUID(),
          properties: {
            $survey_id: provider.survey,
            $survey_response: email,
            $process_person_profile: false,
            source: 'site',
            list: 'course',
          },
        });
  if (!stored) return 'error';

  const key = posthogKey();
  if (key) {
    await send(`${posthogHost()}/i/v0/e/`, {
      api_key: key,
      event: 'course_signup',
      distinct_id: crypto.randomUUID(),
      properties: { $process_person_profile: false, source: 'site', placement, provider: provider.kind },
    });
  }
  return 'ok';
}

export const POST = async ({ request }: { request: Request }) => {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

  let status: SignupStatus;
  try {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim();
    const placement = String(form.get('placement') ?? '');
    const trap = String(form.get('company') ?? '');

    if (trap) {
      // A person never sees this field. Whatever filled it is told it worked
      // and nothing is stored.
      status = 'ok';
    } else if (email.length > 254 || !EMAIL.test(email)) {
      status = 'invalid';
    } else {
      status = await signUp(email, PLACEMENTS.has(placement) ? placement : 'unknown');
    }
  } catch {
    status = 'invalid';
  }

  if (wantsJson) {
    return new Response(JSON.stringify({ status }), {
      status: HTTP[status],
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  return new Response(null, { status: 303, headers: { location: `/course/signup/#${status}` } });
};
