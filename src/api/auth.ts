import {
  API,
  type AuthOptionsResponse,
  type ChangePasswordRequest,
  type CredentialsRequest,
  type CurrentSessionResponse,
  type SessionResponse,
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
};
