import type { UsageResponse } from '../../shared/usage';
import { request } from './http';

/** What the learner's own keys have been spent on, today, this month and day by day. */
export const accountUsage = () => request<UsageResponse>('GET', '/api/account/usage');
