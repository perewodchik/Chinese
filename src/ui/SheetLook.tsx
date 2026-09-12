import type { ReactNode } from 'react';
import type { GridStyle, PaletteId, SheetOptions, SquareSize, StyleId } from '../domain/sheet';
import { PALETTES, STYLES } from '../pdf/theme';

interface Props {
  sheet: SheetOptions;
  onChange: (patch: Partial<SheetOptions>) => void;
  /** what the chosen size actually leaves room for */
  fit: { rows: number; cols: number; maxRows: number };
  /** the "how many to a page" picker, which is the one part that differs */
  children?: ReactNode;
  /** anything the sheet had to give up at this size */
  notice?: ReactNode;
}

/**
 * How a sheet looks: the colour, the design, the squares.
 *
 * The same panel for character worksheets and for radical sheets, because it
 * is the same paper out of the same printer. What each of them puts *on* the
 * page is their own business, and that is the picker above this.
 */
export function SheetLook({ sheet: o, onChange: set, fit, children, notice }: Props) {
  const swatch = (PALETTES.find((p) => p.id === o.palette) ?? PALETTES[0]).swatch;

  return (
    <div className="designer">
      {children}

      <section>
        <h3 className="field-title">Colour</h3>
        <div className="swatches">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              className="swatch-option"
              aria-pressed={o.palette === p.id}
              title={p.blurb}
              onClick={() => set({ palette: p.id as PaletteId })}
              style={{ background: p.swatch[1], color: p.swatch[2] }}
            >
              <span className="dab" style={{ background: p.swatch[0] }} />
              {p.name}
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          {PALETTES.find((p) => p.id === o.palette)?.blurb}
        </p>
      </section>

      <section>
        <h3 className="field-title">Design</h3>
        <div className="style-picker">
          {STYLES.map((s) => (
            <button
              key={s.id}
              className="style-option"
              aria-pressed={o.style === s.id}
              onClick={() => set({ style: s.id as StyleId })}
            >
              <StylePreview id={s.id} accent={swatch} />
              <b>{s.name}</b>
              <span>{s.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="field-title">Squares</h3>
        <div className="row" style={{ gap: 12 }}>
          <label className="field" style={{ flex: 1.3 }}>
            Guides
            <select value={o.gridStyle} onChange={(e) => set({ gridStyle: e.target.value as GridStyle })}>
              <option value="mizi">米字格 rice grid</option>
              <option value="tian">田字格 cross</option>
              <option value="blank">Plain box</option>
            </select>
          </label>
          <label className="field" style={{ flex: 1 }}>
            Size
            <select value={o.squareSize} onChange={(e) => set({ squareSize: e.target.value as SquareSize })}>
              <option value="large">Large, ~15 mm</option>
              <option value="medium">Medium, ~13 mm</option>
              <option value="small">Small, ~11 mm</option>
            </select>
          </label>
        </div>

        <label className="field" style={{ marginTop: 12 }}>
          <span className="row" style={{ justifyContent: 'space-between' }}>
            <span>Rows to write</span>
            <b>
              {fit.rows} of {Math.max(1, fit.maxRows)}
            </b>
          </span>
          {/* Capped at what the page can actually hold: dragging past that used
              to move the handle without changing anything. */}
          <input
            type="range"
            min={1}
            max={Math.max(1, fit.maxRows)}
            value={Math.min(o.practiceRows, Math.max(1, fit.maxRows))}
            disabled={fit.maxRows <= 1}
            onChange={(e) => set({ practiceRows: Number(e.target.value) })}
          />
          <span className="tiny muted">
            {fit.maxRows <= 1
              ? 'Only one row fits. Try smaller squares, or fewer per page.'
              : `${fit.rows} × ${fit.cols} squares under each one.`}
          </span>
        </label>

        <div className="row" style={{ gap: 12, marginTop: 10 }}>
          <label className="field" style={{ flex: 1 }}>
            Trace
            <input
              type="number"
              min={0}
              max={8}
              value={o.traceCount}
              onChange={(e) => set({ traceCount: Number(e.target.value) })}
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            Faint
            <input
              type="number"
              min={0}
              max={8}
              value={o.fadeCount}
              onChange={(e) => set({ fadeCount: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>
          The first {o.traceCount} squares are solid enough to trace and the next {o.fadeCount} are
          faint; the rest are yours.
        </p>

        {notice}
      </section>
    </div>
  );
}

/**
 * A thumbnail of what each design does to a page. Drawn rather than described
 * because the difference between them is what they look like.
 */
function StylePreview({ id, accent }: { id: StyleId; accent: [string, string, string] }) {
  const [ink, paper, dark] = [accent[0], accent[1], accent[2]];
  return (
    <span className="style-thumb" style={{ background: paper }} aria-hidden>
      {id === 'classic' && (
        <>
          <i className="tab" style={{ background: ink }} />
          <i className="rule" style={{ background: dark, opacity: 0.35 }} />
          <i className="box" style={{ borderColor: dark }} />
          <i className="row-a" style={{ background: dark, opacity: 0.25 }} />
        </>
      )}
      {id === 'workbook' && (
        <>
          <i className="band" style={{ background: ink, opacity: 0.16 }} />
          <i className="box" style={{ borderColor: dark, background: '#fff' }} />
          <i className="rule wide" style={{ background: dark, opacity: 0.3 }} />
          <i className="row-a" style={{ background: dark, opacity: 0.25 }} />
        </>
      )}
      {id === 'quiet' && (
        <>
          <i className="rule thin" style={{ background: dark, opacity: 0.2 }} />
          <i className="box" style={{ borderColor: dark, opacity: 0.45 }} />
          <i className="row-a" style={{ background: dark, opacity: 0.18 }} />
        </>
      )}
      {id === 'card' && (
        <>
          <i className="frame" style={{ borderColor: dark, opacity: 0.5 }} />
          <i className="box" style={{ borderColor: dark }} />
          <i className="row-a" style={{ background: ink, opacity: 0.3 }} />
        </>
      )}
    </span>
  );
}
