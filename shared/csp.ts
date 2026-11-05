/**
 * The page's security headers, written once: the Node server sends them
 * itself (server/src/http/app.ts), and Vercel sends them from vercel.json for
 * the files it serves. A test compares the two, so they cannot drift apart.
 */

export const CSP_DIRECTIVES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['default-src', ["'self'"]],
  ['script-src', ["'self'"]],
  ['style-src', ["'self'", "'unsafe-inline'"]],
  // Video thumbnails on the Videos shelf.
  ['img-src', ["'self'", 'data:', 'blob:', 'https://i.ytimg.com']],
  // Audio fetched and played from a blob: a sentence's recording, a narrator's reading of a text.
  ['media-src', ["'self'", 'data:', 'blob:']],
  ['font-src', ["'self'", 'data:']],
  ['connect-src', ["'self'"]],
  // The worksheet preview is the PDF itself, in a frame, from a blob; a video being studied is YouTube's own player.
  ['frame-src', ["'self'", 'blob:', 'https://www.youtube-nocookie.com']],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
  ['frame-ancestors', ["'self'"]],
];

export const CSP = CSP_DIRECTIVES.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');

/**
 * What the page may ask the device for: the microphone (saying things out
 * loud), from this site alone; never the camera, the location or payments,
 * which nothing here uses — so nothing injected could ask for them either.
 */
export const PERMISSIONS_POLICY = 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()';
