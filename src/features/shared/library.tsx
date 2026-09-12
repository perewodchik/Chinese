import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadExtendedStrokes, loadLibrary } from '../../data/load';
import type { Library } from '../../data/types';
import { Splash } from '../../ui/Splash';

interface LibraryState {
  lib: Library | null;
  error: string | null;
}

const LibraryContext = createContext<LibraryState>({ lib: null, error: null });

/**
 * The character data, loaded once for the whole app.
 *
 * It starts downloading with the page — while the sign-in check is still
 * running — so by the time an account is open the characters are usually here.
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>({ lib: null, error: null });

  useEffect(() => {
    let live = true;
    loadLibrary()
      .then((lib) => {
        if (!live) return;
        setState({ lib, error: null });
        // Outlines for HSK 4-9 are a separate few megabytes. Fetch them in the
        // background so browsing to a higher band is instant.
        void loadExtendedStrokes(lib).then(() => {
          if (live) setState({ lib: { ...lib }, error: null });
        });
      })
      .catch((err: unknown) => {
        if (live) setState({ lib: null, error: String(err) });
      });
    return () => {
      live = false;
    };
  }, []);

  return <LibraryContext.Provider value={state}>{children}</LibraryContext.Provider>;
}

/** Holds back what it wraps until the characters are here, and says so if they never arrive. */
export function LibraryGate({ children }: { children: ReactNode }) {
  const { lib, error } = useContext(LibraryContext);
  if (error) {
    return (
      <Splash mark="误">
        <p>Could not load the character data.</p>
        <p className="small">{error}</p>
        <p className="small">
          Run <code>npm run data</code> to rebuild <code>public/data</code>.
        </p>
      </Splash>
    );
  }
  if (!lib) return <Splash mark="写">Loading characters…</Splash>;
  return <>{children}</>;
}

/** The library, for screens inside a `LibraryGate`. */
export function useLibrary(): Library {
  const { lib } = useContext(LibraryContext);
  if (!lib) throw new Error('useLibrary() is only for screens inside <LibraryGate>.');
  return lib;
}
