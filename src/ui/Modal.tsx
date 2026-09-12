import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Enter confirms, when there is something to confirm */
  onConfirm?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** A dialog that closes on Escape and on a click outside it. */
export function Modal({
  title,
  subtitle,
  onClose,
  onConfirm,
  children,
  footer,
  wide,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Enter in a textarea is a newline, not a confirmation.
      if (e.key === 'Enter' && onConfirm) {
        const el = document.activeElement;
        if (!(el instanceof HTMLTextAreaElement)) onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onConfirm]);

  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div
        className={`modal${wide ? ' wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div className="grow" style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && (
              <p className="small muted" style={{ margin: '2px 0 0' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
