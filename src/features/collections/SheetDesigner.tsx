import type { Collection } from '../../domain/collection';
import { LAYOUT_IDS, LAYOUTS, type LayoutId } from '../../domain/sheet';
import { setSheet } from '../../store/commands';
import { useStore } from '../../store/store';
import { PalettePicker } from '../../ui/PalettePicker';

interface Props {
  c: Collection;
}

/**
 * How the PDF looks: which layout, and — only if it should differ from every
 * other sheet — which colour.
 *
 * That is all there is to choose. The squares are 15 mm, twelve to a row, with
 * a 米 guide; the first go is traced and the next are faint; a word is
 * practised whole. Every block of a layout gets the same rows, so what the
 * preview shows for the first page is what every page will be.
 */
export function SheetDesigner({ c }: Props) {
  const fallback = useStore((s) => s.settings.printPalette);
  const o = c.sheet;

  return (
    <div className="designer">
      <section>
        <h3 className="field-title">Layout</h3>
        <div className="layout-picker">
          {LAYOUT_IDS.map((id) => (
            <button
              key={id}
              className="layout-option"
              aria-pressed={o.layout === id}
              onClick={() => setSheet(c.id, { layout: id })}
            >
              <LayoutThumb id={id} />
              <span>
                <b>{LAYOUTS[id].name}</b>
                <span>{LAYOUTS[id].blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="field-title">Colour</h3>
        <PalettePicker value={o.palette} fallback={fallback} onChange={(palette) => setSheet(c.id, { palette })} />
      </section>

      <p className="tiny muted" style={{ margin: 0 }}>
        Every square is 15 mm with a 米 guide, twelve to a row. Words are practised whole: 朋友 six
        times a row, 出租车 four. The first go is solid to trace and the next are faint.
      </p>
    </div>
  );
}

/** A miniature page: heading bars and grids, as many as the layout puts on one. */
function LayoutThumb({ id }: { id: LayoutId }) {
  const L = LAYOUTS[id];
  return (
    <span className="layout-thumb" data-layout={id} aria-hidden>
      {Array.from({ length: L.perPage }, (_, i) => (
        <span key={i} className="blk">
          <i className="head" />
          {id === 'study' && <i className="notes" />}
          <i className="grid" style={{ height: L.rows * (id === 'test' ? 2.4 : 3.4) }} />
        </span>
      ))}
    </span>
  );
}
