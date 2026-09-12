import { coalesce, reduce, type Action } from './actions';
import { hydrate, serialise } from './migrations';
import { emptyState, type AppState } from './state';
import type { Model } from './sync/engine';

/** What the sync engine needs to know about this app's workspace, and no more. */
export const workspaceModel: Model<AppState, Action> = {
  empty: emptyState,
  hydrate,
  serialise,
  reduce,
  coalesce,
};
