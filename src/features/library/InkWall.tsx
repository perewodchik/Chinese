import { useMemo, useState } from 'react';
import { levelCounts, wallOf } from '../../domain/inkWall';
import { LEVEL_NAME, LEVELS } from '../../domain/memory';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useLibrary } from '../shared/library';
import './inkWall.css';


/**
 * Every character or word of a band on one wall, each filled as deeply as it
 * is known today, 0 to 3. A tap opens it.
 *
 * Worked out when the record changes, not on a timer: the wall is a picture
 * of the morning it was opened, and does not grey out under the reader's eyes.
 */
export function InkWall({ band: startBand }: { band: number }) {
  const lib = useLibrary();
  const open = useOpenItem();
  const recall = useStore((s) => s.recall);
  const [kind, setKind] = useState<'chars' | 'words'>('chars');
  const [band, setBand] = useState(String(Math.min(3, Math.max(1, startBand))) as '1' | '2' | '3');
  const tiles = useMemo(
    () => wallOf(lib, recall, kind, Number(band), Date.now()),
    [lib, recall, kind, band],
  );
  const counts = levelCounts(tiles);
  return (
    <section className="ink-wall-section">
      <div className="ink-wall-bar">
        <Seg
          size="sm"
          label="Characters or words"
          value={kind}
          onChange={setKind}
          options={[
            { id: 'chars', label: '字 Characters' },
            { id: 'words', label: '词 Words' },
          ]}
        />
        <Seg
          size="sm"
          label="Band"
          value={band}
          onChange={setBand}
          options={[
            { id: '1', label: 'HSK 1' },
            { id: '2', label: '2' },
            { id: '3', label: '3' },
          ]}
        />
      </div>
      <div className="ink-wall" data-kind={kind}>
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            className="ink-tile hanzi"
            data-level={t.level}
            onClick={() => open(t.id)}
            title={`${t.text} — ${LEVEL_NAME[t.level]}`}
          >
            {t.text}
          </button>
        ))}
      </div>
      <ul className="ink-legend tiny">
        {LEVELS.map((l) => (
          <li key={l}>
            <span className="ink-swatch" data-level={l} />
            {LEVEL_NAME[l]} <b>{counts[l]}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
