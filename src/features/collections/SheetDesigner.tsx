import type { Collection } from '../../domain/collection';
import { bandsLostAt, BAND_NAME, PER_PAGE_CHOICES, profileFor } from '../../domain/sheet';
import type { FitReport } from '../../pdf/render';
import { setSheet } from '../../store/commands';
import { SheetLook } from '../../ui/SheetLook';

interface Props {
  c: Collection;
  fit: FitReport;
}

/**
 * Everything about how the PDF looks, in the order you would think about it:
 * how much goes on a page, then what it is printed in, then how big the
 * squares are.
 *
 * The first control is the only one that changes what the sheet says. Choosing
 * four characters a page is choosing a shorter sheet, and the panel says so —
 * before the download, in words, naming the sections that go — rather than
 * offering eight switches that are mostly disabled anyway.
 */
export function SheetDesigner({ c, fit }: Props) {
  const o = c.sheet;
  const lost = bandsLostAt(o.perPage);

  return (
    <SheetLook
      sheet={o}
      onChange={(patch) => setSheet(c.id, patch)}
      fit={fit}
      notice={
        fit.dropped.length > 0 ? (
          <p className="notice">
            <b>{fit.dropped.join(', ')}</b> did not fit on at least one of these, so it is being
            left off. Fewer per page, or smaller squares, brings it back.
          </p>
        ) : null
      }
    >
      <section>
        <h3 className="field-title">How many to a page</h3>
        <div className="perpage">
          {PER_PAGE_CHOICES.map((n) => (
            <button
              key={n}
              className="perpage-option"
              aria-pressed={o.perPage === n}
              onClick={() => setSheet(c.id, { perPage: n })}
            >
              <b>{n}</b>
              <span>{profileFor(n).blurb}</span>
            </button>
          ))}
        </div>
        {lost.length > 0 && (
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            At {o.perPage} a page there is no room for{' '}
            <b>{lost.map((b) => BAND_NAME[b].toLowerCase()).join(', ')}</b>. Everything else stays,
            at a size that still reads on paper.
          </p>
        )}
      </section>
    </SheetLook>
  );
}
