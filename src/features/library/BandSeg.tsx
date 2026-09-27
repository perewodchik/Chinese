import { HSK_BANDS } from '../../domain/text';
import { setSettings } from '../../store/commands';
import { Seg } from '../../ui/Seg';

const BANDS = [
  { id: '0', label: 'All', title: 'Every band' },
  ...HSK_BANDS.map((b) => ({ id: String(b.id), label: b.label.replace('HSK ', ''), title: b.label })),
];

/**
 * The HSK band, as numbers in a row: the same strip over the characters and
 * over the words, and the same saved setting behind both, so moving from 字
 * to 词 keeps you in the band you were in.
 */
export function BandSeg({ value }: { value: number }) {
  return (
    <Seg
      label="HSK band"
      value={String(value)}
      options={BANDS}
      onChange={(v) => setSettings({ hskBand: Number(v) })}
    />
  );
}
