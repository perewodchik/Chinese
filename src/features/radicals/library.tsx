import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadRadicals, type RadicalLibrary } from '../../data/radicals';
import { Splash } from '../../ui/Splash';

interface State {
  rlib: RadicalLibrary | null;
  error: string | null;
}

const RadicalContext = createContext<State>({ rlib: null, error: null });

/**
 * The radical data, fetched the first time this section is opened.
 *
 * Half a megabyte of outlines — every way every radical is written — that no
 * other page reads, so it is not part of the wait to get to Review.
 */
export function RadicalGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ rlib: null, error: null });

  useEffect(() => {
    let live = true;
    loadRadicals()
      .then((rlib) => live && setState({ rlib, error: null }))
      .catch((err: unknown) => live && setState({ rlib: null, error: String(err) }));
    return () => {
      live = false;
    };
  }, []);

  if (state.error) {
    return (
      <Splash mark="误">
        <p>Could not load the radical data.</p>
        <p className="small">{state.error}</p>
        <p className="small">
          Run <code>npm run data</code> to rebuild <code>public/data</code>.
        </p>
      </Splash>
    );
  }
  if (!state.rlib) return <Splash mark="部">Loading radicals…</Splash>;
  return <RadicalContext.Provider value={state}>{children}</RadicalContext.Provider>;
}

/** The radical data, for screens inside a `RadicalGate`. */
export function useRadicalLibrary(): RadicalLibrary {
  const { rlib } = useContext(RadicalContext);
  if (!rlib) throw new Error('useRadicalLibrary() is only for screens inside <RadicalGate>.');
  return rlib;
}
