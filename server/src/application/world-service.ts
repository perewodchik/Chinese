import type { PutWorldSaveResponse, WorldSaveDto } from '../../../shared/world';
import type { WorldSaveRecord } from '../domain/entities';
import { OutdatedAppError, ValidationError, WorldConflictError } from '../domain/errors';
import type { Clock, WorldSaveRepository } from './ports';

const toDto = (w: WorldSaveRecord | null): WorldSaveDto =>
  w ? { revision: w.revision, save: w.save, updatedAt: w.updatedAt } : { revision: 0, save: null, updatedAt: null };

/**
 * 走走's one save per account, under the workspace's rule: a save names the
 * revision it was built on and is refused if the server has moved past it,
 * with the newer save attached. The game merges the two (core/merge.ts) and
 * tries again. A build older than the stored save's format is refused as an
 * outdated app. The server looks no further into a save than its `version`.
 */
export class WorldService {
  constructor(private readonly deps: { saves: WorldSaveRepository; clock: Clock }) {}

  async get(userId: string): Promise<WorldSaveDto> {
    return toDto(await this.deps.saves.find(userId));
  }

  revision(userId: string): Promise<number> {
    return this.deps.saves.revisionOf(userId);
  }

  async save(userId: string, baseRevision: number, save: unknown): Promise<PutWorldSaveResponse> {
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new ValidationError('The base revision has to be a whole number, 0 or more.', { baseRevision: 'Not a revision.' });
    }
    if (!isSave(save)) {
      throw new ValidationError('A game save is a JSON object carrying its format version.', { save: 'Not a game save.' });
    }
    const write = await this.deps.saves.save(userId, baseRevision, save, this.deps.clock.now());
    if (write.saved) return { revision: write.revision, updatedAt: write.updatedAt };
    const current = write.current;
    if (current && current.revision === baseRevision && versionOf(current.save) > save.version) {
      throw new OutdatedAppError();
    }
    throw new WorldConflictError(toDto(current));
  }
}

function isSave(v: unknown): v is { version: number } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const version = (v as { version?: unknown }).version;
  return typeof version === 'number' && Number.isInteger(version) && version > 0;
}

function versionOf(save: unknown): number {
  const version = (save as { version?: unknown } | null)?.version;
  return typeof version === 'number' ? version : 0;
}
