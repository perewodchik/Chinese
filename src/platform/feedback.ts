/**
 * The feedback form, when the site has one: a Google Form whose prefilled
 * link is set at build time as VITE_FEEDBACK_URL, with %PAGE% and %USER%
 * where the page and the name go, e.g.
 *
 *   https://docs.google.com/forms/d/e/…/viewform?usp=pp_url&entry.111=%PAGE%&entry.222=%USER%
 *
 * It opens in a tab of its own: a form in a frame is cramped on an iPhone and
 * would need the page's content policy loosened for Google.
 */
// Optional chaining: under node's own test runner there is no Vite to put `env` here.
const TEMPLATE = import.meta.env?.VITE_FEEDBACK_URL?.trim() || '';

export const hasFeedback = () => TEMPLATE.startsWith('https://');

/** The form's address for this page and this account, or null when the site has none. */
export function feedbackUrl(page: string, username: string, message?: string): string | null {
  return hasFeedback() ? fillFeedback(TEMPLATE, page, username, message) : null;
}

/** A form's prefilled link with this page, name and message put in; a field left without a value is taken out. */
export function fillFeedback(template: string, page: string, username: string, message?: string): string {
  const url = template.replace(/%PAGE%/g, encodeURIComponent(page)).replace(/%USER%/g, encodeURIComponent(username));
  return message ? url.replace(/%MESSAGE%/g, encodeURIComponent(message)) : url.replace(/[?&][^=&]+=%MESSAGE%/g, '');
}
