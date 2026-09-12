import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Toast = (message: string) => void;

const ToastContext = createContext<Toast>(() => undefined);

/** One short message at a time at the foot of the screen, gone after a few seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  // Keyed, so the same message twice in a row still restarts the timer.
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const show = useCallback<Toast>((text) => setToast({ text, key: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.key} className="toast" role="status">
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
