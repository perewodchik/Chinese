/**
 * Whole sections the app can be built without, as if they had never been
 * there: no tab, no pages, no settings, no links to them from anywhere else.
 *
 * Speak (/speaking: phrases, narrators, talking with Claude, the tones) is
 * off. Built with VITE_SPEAK=on it comes back, whole. Its addresses, while it
 * is off, land on Read.
 */
export const FEATURES = {
  speak: import.meta.env?.VITE_SPEAK === 'on',
} as const;
