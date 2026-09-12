import { useSyncExternalStore } from 'react';
import type { Action } from './actions';
import { emptyState, type AppState } from './state';
import type { SyncStatus, WorkspaceSync } from './sync/engine';

/**
 * What every screen reads, and the one door every change goes through.
 *
 * The store does not decide where changes go. While an account is open its
 * workspace is attached, and each action is handed to it: the workspace applies
 * the action, queues it for the server and hands back the new state. With
 * nothing attached there is nowhere to keep a change, and the store says so
 * rather than holding on to work that would be gone on the next reload.
 *
 * Components subscribe with `useStore(select)`. `select` must return something
 * referentially stable — a slice of state, not a fresh object — because it runs
 * on every render.
 */

type Workspace = WorkspaceSync<AppState, Action>;

let state: AppState = emptyState();
let workspace: Workspace | null = null;
let unsubscribe: Array<() => void> = [];

const stateListeners = new Set<() => void>();
const statusListeners = new Set<() => void>();

const subscribeState = (listener: () => void) => {
  stateListeners.add(listener);
  return () => void stateListeners.delete(listener);
};

const subscribeStatus = (listener: () => void) => {
  statusListeners.add(listener);
  return () => void statusListeners.delete(listener);
};

function setState(next: AppState) {
  if (next === state) return;
  state = next;
  stateListeners.forEach((l) => l());
}

export const getState = () => state;

export function dispatch(action: Action): void {
  if (!workspace) {
    console.warn(`"${action.type}" was not kept: no account is open.`);
    return;
  }
  setState(workspace.dispatch(action));
}

/** Makes `next` the open workspace, so its state is what every screen shows. */
export function attachWorkspace(next: Workspace): void {
  unsubscribe.forEach((off) => off());
  workspace = next;
  unsubscribe = [
    next.onState(setState),
    next.onStatus(() => statusListeners.forEach((l) => l())),
  ];
  setState(next.getState());
  statusListeners.forEach((l) => l());
}

/** Takes `which` off the screen, leaving nothing of that account behind in memory. */
export function detachWorkspace(which: Workspace): void {
  if (workspace !== which) return;
  unsubscribe.forEach((off) => off());
  unsubscribe = [];
  workspace = null;
  setState(emptyState());
  statusListeners.forEach((l) => l());
}

/** Sends whatever is unsaved now, rather than after the usual pause — before signing out, say. */
export const flushWorkspace = (): Promise<void> => workspace?.flush() ?? Promise.resolve();

/** Whether what is on screen has reached the server, read once rather than subscribed to. */
export const getSyncStatus = (): SyncStatus | null => workspace?.getStatus() ?? null;

export function useStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribeState,
    () => select(state),
    () => select(state),
  );
}

/** Whether what is on screen has reached the server; null while no account is open. */
export function useSyncStatus(): SyncStatus | null {
  return useSyncExternalStore(
    subscribeStatus,
    () => workspace?.getStatus() ?? null,
    () => null,
  );
}
