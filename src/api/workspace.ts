import {
  API,
  workspaceTag,
  type SaveWorkspaceResponse,
  type WorkspaceConflictBody,
  type WorkspaceDto,
} from '../../shared/api';
import type { WorkspaceGateway } from '../store/sync/engine';
import { ApiError, send } from './http';

/** The workspace endpoints, in the shape the sync engine asks for. */
export const workspaceApi: WorkspaceGateway = {
  async load() {
    return (await send<WorkspaceDto>('GET', API.workspace)).data;
  },

  async check(revision) {
    const answer = await send<WorkspaceDto>('GET', API.workspace, {
      headers: { 'if-none-match': workspaceTag(revision) },
    });
    return answer.status === 304 ? null : answer.data;
  },

  async save(baseRevision, document) {
    try {
      const { data } = await send<SaveWorkspaceResponse>('PUT', API.workspace, {
        body: { baseRevision, document },
      });
      return { kind: 'saved', revision: data.revision };
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        return { kind: 'conflict', current: (err.body as WorkspaceConflictBody).current };
      }
      throw err;
    }
  },
};
