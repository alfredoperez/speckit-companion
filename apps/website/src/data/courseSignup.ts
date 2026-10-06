/*
  The course list: where an address goes, and the words for every outcome.

  Two providers, chosen by environment, and nothing is stored without one:

    COURSE_SIGNUP_WEBHOOK_URL       a webhook that takes a JSON POST. Most list
                                    tools have one. Used first when it is set.
    PUBLIC_POSTHOG_KEY and
    PUBLIC_POSTHOG_SURVEY_COURSE    the PostHog survey the waitlist already
                                    used. The address is its one response.

  With neither set the list is closed: the form says so before you type, and a
  submit answers `closed` instead of pretending to succeed.
*/
export type SignupStatus = 'ok' | 'invalid' | 'closed' | 'error';

export const SIGNUP_BUTTON = 'Tell me when it opens';

export const SIGNUP_MESSAGES: Record<SignupStatus, string> = {
  ok: 'You’re on the list. One message, on the day it opens.',
  invalid: 'That does not look like an email address. Check it and try again.',
  closed: 'The list is not open yet, so nothing was stored. Check back soon.',
  error: 'That did not go through, so nothing was stored. Try again in a minute.',
};

const env = (name: string): string | undefined =>
  (typeof process !== 'undefined' ? process.env[name] : undefined) || import.meta.env[name] || undefined;

export function signupProvider():
  | { kind: 'webhook'; url: string }
  | { kind: 'posthog'; key: string; survey: string; host: string }
  | null {
  const url = env('COURSE_SIGNUP_WEBHOOK_URL');
  if (url) return { kind: 'webhook', url };

  const key = env('PUBLIC_POSTHOG_KEY');
  const survey = env('PUBLIC_POSTHOG_SURVEY_COURSE');
  if (key && survey) return { kind: 'posthog', key, survey, host: posthogHost() };

  return null;
}

// The browser talks to PostHog through /ingest on this origin. A server has no
// origin of its own to resolve that against, so it goes to PostHog directly.
export function posthogHost(): string {
  const host = env('PUBLIC_POSTHOG_HOST');
  return host && /^https?:\/\//.test(host) ? host.replace(/\/+$/, '') : 'https://us.i.posthog.com';
}

export const posthogKey = (): string | undefined => env('PUBLIC_POSTHOG_KEY');
