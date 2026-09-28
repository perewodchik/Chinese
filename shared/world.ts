/**
 * 走走 Zǒuzou, the walk through Beijing: what the game and the server
 * exchange about a save.
 *
 * One save per account, kept apart from the workspace: the game saves often
 * (every map change and every conversation) and must not move the revision
 * of everything else. The server keeps the save as it is given, looking no
 * further into it than its size and its `version`; what a flag or a spirit
 * *is* stays the game's business.
 *
 * Types and constants only: nothing here may import from the app or the
 * server.
 */

export interface WorldSaveDto {
  /** 0 until the first save, and one more on every save after it */
  revision: number;
  /** null until the first save */
  save: unknown;
  updatedAt: number | null;
}

export interface PutWorldSaveRequest {
  /** the revision the save was built on; refused if the server has moved past it */
  baseRevision: number;
  save: unknown;
}

export interface PutWorldSaveResponse {
  revision: number;
  updatedAt: number;
}

/** A refused save carries the server's copy, so the game can merge and retry. */
export interface WorldConflictBody {
  error: { code: 'conflict'; message: string };
  current: WorldSaveDto;
}

export const WORLD_API = '/api/world';

/** The largest save the server accepts, in bytes of JSON. */
export const WORLD_SAVE_MAX_BYTES = 512 * 1024;
