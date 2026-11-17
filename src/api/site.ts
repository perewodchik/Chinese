import type { SiteInfo, SiteSettings, SiteSettingsView } from '../../shared/site';
import { request } from './http';

/** A11: what the site says to everyone signed in, and its settings for an admin. */
export const siteInfo = () => request<SiteInfo>('GET', '/api/site');
export const siteSettings = () => request<SiteSettingsView>('GET', '/api/admin/settings');
export const changeSiteSettings = (patch: Partial<SiteSettings>) => request<SiteSettingsView>('PUT', '/api/admin/settings', { body: patch });
