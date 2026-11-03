import { useState } from 'react';
import { Link } from 'react-router';
import type { NarratorDto } from '../../../shared/narration';
import { paths } from '../../navigation/paths';
import { Modal } from '../../ui/Modal';
import { AUTOPLAY, keepPref, pref } from './prefs';

/**
 * Who reads the examples: every narrator, chosen with a tap (the same choice
 * as Listen's, on this device), and whether a line plays as it opens. Any of
 * them can read any line — one who has not read the text whole reads each
 * line the first time it is asked for.
 */
export function VoiceSheet({
  list,
  current,
  wholeIds,
  failed,
  onChoose,
  onClose,
}: {
  list: NarratorDto[];
  current: NarratorDto | null;
  /** the narrators who have read this text whole */
  wholeIds: string[];
  failed: string | null;
  onChoose: (n: NarratorDto) => void;
  onClose: () => void;
}) {
  const [auto, setAuto] = useState(() => pref(AUTOPLAY, true));
  return (
    <Modal
      title="The voice"
      subtitle="Who reads each line for you to copy."
      onClose={onClose}
      footer={
        <div className="sk-sheet-foot">
          <Link className="btn quiet" to={paths.speakingNarrators()}>
            Make or tune a voice
          </Link>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      <div className="list ph-sheet-list">
        {list.map((n) => (
          <button key={n.id} className="ph-sheet-row" aria-pressed={current?.id === n.id} onClick={() => onChoose(n)}>
            <span className="ph-sheet-radio" aria-hidden />
            <span className="ph-text-name">
              <b>{n.name}</b>
              <span className="tiny muted">{wholeIds.includes(n.id) ? 'Has read this text' : 'Reads each line as it comes'}</span>
            </span>
          </button>
        ))}
        {list.length === 0 && <p className="small muted">{failed ?? 'No narrators yet: make one in Voices, with your MiniMax key.'}</p>}
      </div>
      <label className="toggle sk-auto">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            keepPref(AUTOPLAY, e.target.checked);
          }}
        />
        <span>
          Play each line as it opens
          <span className="d">So Next is all it takes: the line is heard, and the microphone is next.</span>
        </span>
      </label>
    </Modal>
  );
}
