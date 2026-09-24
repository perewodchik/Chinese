import type { FamilyData } from '../domain/families';

/**
 * public/data/families.json, from scripts/build_families.py: for each radical,
 * the steps by which it grows into syllabus characters.
 *
 * Fetched the first time the families page opens, like the radicals — nothing
 * else in the app reads it.
 */

let cached: Promise<FamilyData> | null = null;

export function loadFamilies(): Promise<FamilyData> {
  if (cached) return cached;
  const loading = fetch('/data/families.json').then((r) => {
    if (!r.ok) throw new Error(`/data/families.json failed to load (${r.status})`);
    return r.json() as Promise<FamilyData>;
  });
  cached = loading;
  // A failed fetch is not cached: opening the page again should try again.
  loading.catch(() => {
    if (cached === loading) cached = null;
  });
  return loading;
}
