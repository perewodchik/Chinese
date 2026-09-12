interface Option<T extends string> {
  id: T;
  label: string;
  title?: string;
}

/**
 * A segmented control: three or four exclusive choices that all fit on one
 * line, where a dropdown would hide two of them behind a click.
 *
 * The app uses it for the choices that are worth seeing while you make them —
 * how long, how hard, how rare — and keeps `<select>` for the ones that are
 * merely long lists.
 */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  size,
}: {
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (v: T) => void;
  label?: string;
  size?: 'sm';
}) {
  return (
    <div className={`seg${size === 'sm' ? ' sm' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          title={o.title}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
