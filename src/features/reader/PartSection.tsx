import { type ReactNode } from 'react';

/** A part of a text: its character, its name, what it says of itself on the right, and what it holds. */
export function Section({ id, han, title, aside, children }: { id: string; han: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rd-part" id={id} data-part>
      <header className="rd-part-head">
        <span className="hanzi" aria-hidden>
          {han}
        </span>
        <h2>{title}</h2>
        <span className="spacer" />
        {aside && <span className="rd-part-aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}
