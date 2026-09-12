import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';

/**
 * A labelled input with a line under it: a hint while all is well, and what is
 * wrong when it is not — tied to the input, so a screen reader says it too.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactElement;
}) {
  const id = useId();
  const note = error || hint;
  return (
    <label className="field" data-invalid={error ? true : undefined}>
      {label}
      {cloneElement(children, {
        'aria-describedby': note ? `${id}-note` : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {note && (
        <span id={`${id}-note`} className={error ? 'tiny field-error' : 'tiny muted'}>
          {note}
        </span>
      )}
    </label>
  );
}
