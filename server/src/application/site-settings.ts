import { ANNOUNCEMENT_MAX, type Registration, type SiteSettings, type SiteSettingsView } from '../../../shared/site';
import { ValidationError } from '../domain/errors';
import type { Actor, AdminLogRepository, Clock, SiteSettingsRepository } from './ports';

const MINUTE = 60_000;
const REGISTRATIONS: Registration[] = ['open', 'invite', 'closed'];

/**
 * The site's own settings (A11): read from the database, kept for a minute
 * (every instance on Vercel sees a change within one), falling back to what
 * the environment says. Each change goes in the admins' log.
 */
export class SiteSettingsService {
  private cache: { at: number; view: SiteSettingsView } | null = null;

  constructor(private readonly deps: { settings: SiteSettingsRepository; adminLog: AdminLogRepository; clock: Clock; defaults: SiteSettings }) {}

  async view(): Promise<SiteSettingsView> {
    const now = this.deps.clock.now();
    if (this.cache && now - this.cache.at < MINUTE) return this.cache.view;
    const rows = await this.deps.settings.all();
    const settings: SiteSettings = { ...this.deps.defaults };
    const changed: SiteSettingsView['changed'] = {};
    for (const r of rows) {
      let value: unknown;
      try {
        value = JSON.parse(r.value);
      } catch {
        continue;
      }
      if (r.key === 'registration' && REGISTRATIONS.includes(value as Registration)) settings.registration = value as Registration;
      else if (r.key === 'storageLimitMb' && (value === null || (typeof value === 'number' && value > 0))) settings.storageLimitMb = value as number | null;
      else if (r.key === 'announcement' && typeof value === 'string') settings.announcement = value.slice(0, ANNOUNCEMENT_MAX);
      else continue;
      changed[r.key as keyof SiteSettings] = { at: r.updatedAt, by: r.updatedBy };
    }
    const view = { settings, defaults: this.deps.defaults, changed };
    this.cache = { at: now, view };
    return view;
  }

  async get(): Promise<SiteSettings> {
    return (await this.view()).settings;
  }

  async change(patch: Partial<SiteSettings>, actor: Actor): Promise<SiteSettingsView> {
    const before = await this.get();
    const now = this.deps.clock.now();
    const next: Partial<SiteSettings> = {};
    if (patch.registration !== undefined) {
      if (!REGISTRATIONS.includes(patch.registration)) throw new ValidationError('Open, by invitation, or closed.');
      next.registration = patch.registration;
    }
    if (patch.storageLimitMb !== undefined) {
      const mb = patch.storageLimitMb;
      if (mb !== null && !(Number.isInteger(mb) && mb >= 10 && mb <= 100_000)) throw new ValidationError('Room for each account: between 10 MB and 100,000 MB, or no ceiling.');
      next.storageLimitMb = mb;
    }
    if (patch.announcement !== undefined) {
      const line = patch.announcement.replace(/\s+/g, ' ').trim();
      if ([...line].length > ANNOUNCEMENT_MAX) throw new ValidationError(`An announcement is one line, at most ${ANNOUNCEMENT_MAX} characters.`);
      next.announcement = line;
    }
    for (const [key, value] of Object.entries(next) as Array<[keyof SiteSettings, unknown]>) {
      if (JSON.stringify(before[key]) === JSON.stringify(value)) continue;
      await this.deps.settings.set(key, JSON.stringify(value), now, actor.name);
      await this.deps.adminLog.add({
        at: now,
        actorId: actor.id,
        actorName: actor.name,
        action: 'setting-changed',
        targetId: null,
        targetName: key,
        details: { from: before[key] ?? null, to: (value as string | number | null) ?? null },
        ip: actor.ip,
      });
    }
    this.cache = null;
    return this.view();
  }
}
