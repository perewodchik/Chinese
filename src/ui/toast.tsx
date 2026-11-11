import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/** Something to take back what was just done, offered in the message for as long as it shows. */
export interface ToastAction {
  label: string;
  run: () => void;
}

type Toast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<Toast>(() => undefined);

/**
 * One short message at a time at the foot of the screen, gone after a few
 * seconds — longer when it offers to undo something, so there is time to.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  // Keyed, so the same message twice in a row still restarts the timer.
  const [toast, setToast] = useState<{ text: string; key: number; action?: ToastAction } | null>(null);
  const show = useCallback<Toast>((text, action) => setToast({ text, key: Date.now(), action }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.action ? 8000 : 3600);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.key} className="toast" role="status" data-action={toast.action ? '' : undefined}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
