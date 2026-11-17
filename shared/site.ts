/**
 * The site's own settings (A11): changed by an admin on the admin page, with
 * no new deploy; until one is set, the server's environment decides.
 *
 *   GET /api/site                   { announcement } — anyone signed in
 *   GET /api/admin/settings         SiteSettingsView
 *   PUT /api/admin/settings         Partial<SiteSettings> → SiteSettingsView
 */
export type Registration = 'open' | 'invite' | 'closed';

export interface SiteSettings {
  registration: Registration;
  /** each account's room, in MB; null for no ceiling */
  storageLimitMb: number | null;
  /** one line shown over Read to everyone signed in (works, news); empty for none */
  announcement: string;
}

export const ANNOUNCEMENT_MAX = 200;

export interface SiteSettingsView {
  settings: SiteSettings;
  /** what the environment says, for the ones not set here */
  defaults: SiteSettings;
  /** when each was last changed here, and by whom */
  changed: Partial<Record<keyof SiteSettings, { at: number; by: string }>>;
}

export interface SiteInfo {
  announcement: string;
}
