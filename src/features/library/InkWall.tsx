import { useMemo, useState } from 'react';
import { inkCounts, wallOf } from '../../domain/inkWall';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useLibrary } from '../shared/library';
import './inkWall.css';

const INK_NAMES = ['not met yet', 'nearly gone', 'fading', 'holding', 'firm', 'solid'];

/**
 * Every character or word of a band on one wall, each as dark as it is held
 * today. What is fading shows as fading; a tap opens it.
 *
 * Worked out when the record changes, not on a timer: the wall is a picture
 * of the morning it was opened, and does not grey out under the reader's eyes.
 */
export function InkWall({ band: startBand }: { band: number }) {
  const lib = useLibrary();
  const open = useOpenItem();
  const recall = useStore((s) => s.recall);
  const learned = useStore((s) => s.learned);
  const [kind, setKind] = useState<'chars' | 'words'>('chars');
  const [band, setBand] = useState(String(Math.min(3, Math.max(1, startBand))) as '1' | '2' | '3');
  const tiles = useMemo(
    () => wallOf(lib, recall, learned, kind, Number(band), Date.now()),
    [lib, recall, learned, kind, band],
  );
  const counts = inkCounts(tiles);
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
            data-ink={t.ink}
            onClick={() => open(t.id)}
            title={`${t.text} — ${INK_NAMES[t.ink]}`}
          >
            {t.text}
          </button>
        ))}
      </div>
      <ul className="ink-legend tiny">
        {INK_NAMES.map((name, i) => (
          <li key={i}>
            <span className="ink-swatch" data-ink={i} />
            {name} <b>{counts[i]}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
