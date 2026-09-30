import { STAMPS } from './stamps.gen';

/**
 * A built game file's URL with its content hash (scripts/world/stamps.ts): `/world/art/menu.png`
 * → `/world/art/menu.png?v=…`. A file the build did not stamp keeps its plain URL.
 */
export function stamped(url: string): string {
  const v = STAMPS[url.replace(/^\//, '')];
  return v ? `${url}?v=${v}` : url;
}
