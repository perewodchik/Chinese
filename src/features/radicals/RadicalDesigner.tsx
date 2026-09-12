import type { RadicalSet } from '../../domain/radicals/sets';
import { RADICAL_PER_PAGE, radicalProfile } from '../../domain/radicals/sheet';
import type { RadicalFitReport } from '../../pdf/radicals/render';
import { setRadicalSheet } from '../../store/radicals';
import { SheetLook } from '../../ui/SheetLook';

interface Props {
  set: RadicalSet;
  fit: RadicalFitReport;
}

/**
 * How a radical sheet looks, and — the choice that matters — how many share a
 * page, which decides whether every way of writing a radical gets a row of its
 * own or the rarer ones share one.
 */
export function RadicalDesigner({ set, fit }: Props) {
  const o = set.sheet;

  return (
    <SheetLook
      sheet={o}
      onChange={(patch) => setRadicalSheet(set.id, patch)}
      fit={fit}
      notice={
        fit.shared > 0 ? (
          <p className="notice">
            On {fit.shared} of these the forms share a row of squares. Fewer per page, or smaller
            squares, gives each of them a row of its own.
          </p>
        ) : null
      }
    >
      <section>
        <h3 className="field-title">How many to a page</h3>
        <div className="perpage">
          {RADICAL_PER_PAGE.map((n) => (
            <button
              key={n}
              className="perpage-option"
              aria-pressed={o.perPage === n}
              onClick={() => setRadicalSheet(set.id, { perPage: n })}
            >
              <b>{n}</b>
              <span>{radicalProfile(n).blurb}</span>
            </button>
          ))}
        </div>
        {fit.lost.length > 0 && (
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            At {o.perPage} a page there is no room for <b>{fit.lost.join(', ')}</b>. The forms and
            their squares stay, whatever the size.
          </p>
        )}
      </section>
    </SheetLook>
  );
}
