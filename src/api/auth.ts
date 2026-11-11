import {
  API,
  type AuthOptionsResponse,
  type ChangePasswordRequest,
  type CredentialsRequest,
  type CurrentSessionResponse,
  type SessionResponse,
  type TwoStepSetup,
  type TwoStepStatus,
} from '../../shared/api';
import { request } from './http';

export const authApi = {
  options: () => request<AuthOptionsResponse>('GET', API.authOptions),
  session: () => request<CurrentSessionResponse>('GET', API.session),
  register: (body: CredentialsRequest) =>
    request<SessionResponse>('POST', API.register, { body, expect401: true }),
  login: (body: CredentialsRequest) =>
    request<SessionResponse>('POST', API.login, { body, expect401: true }),
  logout: () => request<null>('POST', API.logout, { expect401: true }),
  changePassword: (body: ChangePasswordRequest) => request<null>('POST', API.password, { body }),
  /** A forgotten password replaced with a recovery code; signed in on the way. */
  recover: (body: { username: string; code: string; newPassword: string }) => request<SessionResponse>('POST', '/api/auth/recover', { body, expect401: true }),
  recoveryStatus: () => request<{ codes: { left: number; createdAt: number } | null }>('GET', '/api/auth/recovery-codes').then((r) => r.codes),
  /** New codes, shown this once; the old ones stop working. */
  /** Two-step sign-in: whether it is on (and required), a secret for the app, the first code, off with a code. */
  twoStep: () => request<TwoStepStatus>('GET', '/api/auth/two-step'),
  startTwoStep: () => request<TwoStepSetup>('POST', '/api/auth/two-step/start'),
  confirmTwoStep: (code: string) => request<null>('POST', '/api/auth/two-step/confirm', { body: { code } }),
  disableTwoStep: (code: string) => request<null>('POST', '/api/auth/two-step/disable', { body: { code } }),
  /** The password again, for an admin's action that asked for it (reauth_required). */
  reauth: (password: string) => request<null>('POST', '/api/auth/reauth', { body: { password } }),
  makeRecoveryCodes: (password: string) => request<{ codes: string[] }>('POST', '/api/auth/recovery-codes', { body: { password } }).then((r) => r.codes),
};
