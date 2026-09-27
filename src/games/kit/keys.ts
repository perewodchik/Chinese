import { useEffect } from 'react';

/** Digits pick the n-th option, Enter/Space presses Next — on a keyboard only. */
export function useGameKeys(onDigit: (n: number) => void, onNext: (() => void) | null) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (/^[1-9]$/.test(e.key)) {
        onDigit(Number(e.key) - 1);
        e.preventDefault();
      } else if ((e.key === 'Enter' || e.key === ' ') && onNext) {
        onNext();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDigit, onNext]);
}
