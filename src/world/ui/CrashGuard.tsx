import { Component, type ReactNode } from 'react';

/** Where the player was, for the console when something breaks: read from the device's copy of the save. */
function whereAmI(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('zouzou:save:')) continue;
      const v = JSON.parse(localStorage.getItem(k) ?? 'null') as { save?: { place?: { map?: string }; quests?: Record<string, { step: string; done: boolean }> } } | null;
      const q = Object.entries(v?.save?.quests ?? {}).filter(([, x]) => !x.done).map(([id, x]) => `${id}/${x.step}`);
      return `map ${v?.save?.place?.map ?? '?'}, quests ${q.join(' ') || 'none'}`;
    }
  } catch {
    /* storage blocked */
  }
  return 'unknown place';
}

interface State {
  crashed: boolean;
  /** remounts the game on "Back to where you were" */
  round: number;
}

/**
 * The game's crash guard (prompt X0): anything that throws while drawing
 * the overlay, or an error from the engine the page reports here, shows a
 * calm screen instead of a white one. The save is never touched — it lives
 * on the device and the server — so "Back to where you were" simply starts
 * the game again from it. The error goes to the console with the map and
 * the quests under way.
 */
export class CrashGuard extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false, round: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`走走 crashed (${whereAmI()}):`, error);
  }

  componentDidMount() {
    window.addEventListener('zouzou:crash', this.onEngineCrash);
  }

  componentWillUnmount() {
    window.removeEventListener('zouzou:crash', this.onEngineCrash);
  }

  private onEngineCrash = (e: Event) => {
    console.error(`走走's engine stopped (${whereAmI()}):`, (e as CustomEvent).detail);
    this.setState({ crashed: true });
  };

  render() {
    if (this.state.crashed) {
      return (
        <div className="world-shell">
          <div className="world-crash">
            <div className="han world-crash-mark">停</div>
            <p>Something went wrong and the game stopped. Your progress is saved.</p>
            <button type="button" className="btn primary" onClick={() => this.setState((s) => ({ crashed: false, round: s.round + 1 }))}>
              Back to where you were
            </button>
          </div>
        </div>
      );
    }
    return <div key={this.state.round} style={{ display: 'contents' }}>{this.props.children}</div>;
  }
}

/** For the engine: report an error the React tree cannot see (inside Phaser's loop). */
export const reportCrash = (detail: unknown) => window.dispatchEvent(new CustomEvent('zouzou:crash', { detail }));
