/**
 * The server, as far as the game's save goes: GET and PUT /api/world.
 */

import { ApiError, send } from '../../api/http';
import { WORLD_API, type PutWorldSaveResponse, type WorldConflictBody, type WorldSaveDto } from '../../../shared/world';

export type PutOutcome =
  | { kind: 'saved'; revision: number }
  | { kind: 'conflict'; current: WorldSaveDto }
  /** the server holds a save from a newer build of the app */
  | { kind: 'outdated' };

export interface WorldGateway {
  load(): Promise<WorldSaveDto>;
  save(baseRevision: number, save: unknown): Promise<PutOutcome>;
}

export const worldApi: WorldGateway = {
  async load() {
    return (await send<WorldSaveDto>('GET', WORLD_API)).data;
  },
  async save(baseRevision, save) {
    try {
      const { data } = await send<PutWorldSaveResponse>('PUT', WORLD_API, { body: { baseRevision, save } });
      return { kind: 'saved', revision: data.revision };
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') return { kind: 'conflict', current: (err.body as WorldConflictBody).current };
      if (err instanceof ApiError && err.code === 'outdated_app') return { kind: 'outdated' };
      throw err;
    }
  },
};
