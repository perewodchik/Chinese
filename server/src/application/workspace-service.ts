import type { SaveWorkspaceResponse, WorkspaceDto } from '../../../shared/api';
import type { Workspace } from '../domain/entities';
import { RevisionConflictError, ValidationError } from '../domain/errors';
import type { Clock, WorkspaceRepository } from './ports';

const toDto = (w: Workspace | null): WorkspaceDto =>
  w
    ? { revision: w.revision, document: w.document, updatedAt: w.updatedAt }
    : { revision: 0, document: null, updatedAt: null };

/**
 * One saved document per account, and the rule that stops two devices from
 * overwriting each other.
 *
 * A save names the revision it was built on and is refused if the server has
 * moved past it. The refusal carries the newer document, and it is the app
 * that replays its own changes on top: it knows what those changes meant, and
 * the server only knows that they arrived second.
 */
export class WorkspaceService {
  constructor(private readonly deps: { workspaces: WorkspaceRepository; clock: Clock }) {}

  async get(userId: string): Promise<WorkspaceDto> {
    return toDto(await this.deps.workspaces.find(userId));
  }

  revision(userId: string): Promise<number> {
    return this.deps.workspaces.revisionOf(userId);
  }

  async save(userId: string, baseRevision: number, document: unknown): Promise<SaveWorkspaceResponse> {
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new ValidationError('The base revision has to be a whole number, 0 or more.', {
        baseRevision: 'Not a revision.',
      });
    }
    if (!isDocument(document)) {
      throw new ValidationError('A workspace is a JSON object carrying its format version.', {
        document: 'Not a workspace.',
      });
    }
    const write = await this.deps.workspaces.save(userId, baseRevision, document, this.deps.clock.now());
    if (write.saved) return { revision: write.revision, updatedAt: write.updatedAt };
    throw new RevisionConflictError(toDto(write.current));
  }
}

function isDocument(v: unknown): v is { version: number } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const version = (v as { version?: unknown }).version;
  return typeof version === 'number' && Number.isInteger(version) && version > 0;
}
