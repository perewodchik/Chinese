import type { FeedbackItem, FeedbackKind, FeedbackStatus } from '../../shared/feedback';
import { request } from './http';

/** A12: feedback sent from the site itself. */
export const sendFeedback = (body: { kind: FeedbackKind; message: string; page: string }) => request<void>('POST', '/api/feedback', { body });
export const adminFeedback = (status?: FeedbackStatus) => request<{ items: FeedbackItem[] }>('GET', `/api/admin/feedback${status ? `?status=${status}` : ''}`);
export const setFeedbackStatus = (id: string, status: FeedbackStatus) => request<void>('PATCH', `/api/admin/feedback/${encodeURIComponent(id)}`, { body: { status } });
