/**
 * Ids for things made in the browser.
 *
 * They have to be unique across devices now, not only across one browser's
 * history: the PC and the iPad make collections independently and the server
 * keeps them side by side. `crypto.randomUUID` would be the obvious call, and it
 * is missing exactly where it would be needed — it exists only in a secure
 * context, and the tablet reaches the server over plain http on the Wi-Fi.
 * `getRandomValues` has no such restriction.
 *
 * The time goes first so ids still sort roughly by when they were made.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let random = '';
  for (const b of bytes) random += b.toString(16).padStart(2, '0');
  return `${Date.now().toString(36)}${random}`;
}
