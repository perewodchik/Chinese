/**
 * What a browser said it was, in the words a learner uses for their devices:
 * "Safari on an iPad", "Chrome on a Mac". Read from the user agent, which is
 * only what the browser claims, and is shown as a reminder, not as proof.
 *
 * An iPad in its desktop mode says it is a Mac; it is shown as one, because
 * nothing in the string says otherwise.
 */
export function deviceName(ua: string | null): string {
  if (!ua) return 'A browser that did not say what it was';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\/|FxiOS\//.test(ua)
      ? 'Firefox'
      : /Chrome\/|CriOS\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const device = /iPad/.test(ua)
    ? 'an iPad'
    : /iPhone/.test(ua)
      ? 'an iPhone'
      : /Android/.test(ua)
        ? 'an Android phone'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'a Mac'
          : /Windows/.test(ua)
            ? 'a Windows computer'
            : /Linux/.test(ua)
              ? 'a Linux computer'
              : null;
  if (browser && device) return `${browser} on ${device}`;
  if (device) return `A browser on ${device}`;
  if (browser) return browser;
  return 'A browser';
}
