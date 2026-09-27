import type { PaletteId } from '../domain/sheet';
import { PALETTES } from '../pdf/theme';

interface Props {
  value: PaletteId | null;
  onChange: (p: PaletteId | null) => void;
  /**
   * The colour in Settings, when this picker may defer to it: a "Default"
   * chip comes first, and choosing it stores null rather than a copy.
   */
  fallback?: PaletteId;
}

/**
 * The print colour: five papers, each chip set in its own palette so the
 * picker is a row of samples rather than a row of names.
 *
 * One colour, in Settings, covers every sheet the app prints. A collection can
 * take a different one when it wants to be told apart on the desk; until it
 * does, it follows Settings.
 */
export function PalettePicker({ value, onChange, fallback }: Props) {
  const shown = value ?? fallback ?? 'cinnabar';
  const deflt = fallback ? PALETTES.find((p) => p.id === fallback) : undefined;
  return (
    <div>
      <div className="swatches">
        {deflt && (
          <button
            className="swatch-option"
            aria-pressed={value === null}
            title="Follow the print colour in Settings"
            onClick={() => onChange(null)}
            style={{ background: deflt.swatch[1], color: deflt.swatch[2] }}
          >
            <span className="dab" style={{ background: deflt.swatch[0] }} />
            Default
          </button>
        )}
        {PALETTES.map((p) => (
          <button
            key={p.id}
            className="swatch-option"
            aria-pressed={value === p.id || (!fallback && shown === p.id)}
            title={p.blurb}
            onClick={() => onChange(p.id as PaletteId)}
            style={{ background: p.swatch[1], color: p.swatch[2] }}
          >
            <span className="dab" style={{ background: p.swatch[0] }} />
            {p.name}
          </button>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: '8px 0 0' }}>
        {value === null && deflt
          ? `${deflt.name}, the colour in Settings. Pick another to give this collection its own.`
          : PALETTES.find((p) => p.id === shown)?.blurb}
      </p>
    </div>
  );
}
