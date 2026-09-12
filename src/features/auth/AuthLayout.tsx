import type { ReactNode } from 'react';
import { useTitle } from '../../ui/useTitle';

/** The frame the sign-in and sign-up pages share: the mark, a title, a line of why, the form. */
export function AuthLayout({
  title,
  lede,
  footer,
  children,
}: {
  title: string;
  lede: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  useTitle(title);
  return (
    <main className="auth">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="mark">写</span>
          Hanzi Workshop
        </div>
        <h1>{title}</h1>
        <p className="small muted auth-lede">{lede}</p>
        {children}
        {footer && <p className="small auth-foot">{footer}</p>}
      </section>
    </main>
  );
}
