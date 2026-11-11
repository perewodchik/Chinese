import type { Role } from '../../../shared/api';
import type { UserFlags } from '../domain/entities';

/** A role as stored: anything that is not a role the code knows reads as a learner's. */
export const roleOf = (raw: string): Role => (raw === 'admin' ? 'admin' : 'learner');

/** The flags as stored, as JSON: only the known switches, only when true. */
export function parseFlags(raw: string): UserFlags {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const flags: UserFlags = {};
  for (const key of ['tutor', 'unlimited', 'photoInbox'] as const) {
    if ((parsed as Record<string, unknown>)[key] === true) flags[key] = true;
  }
  return flags;
}
