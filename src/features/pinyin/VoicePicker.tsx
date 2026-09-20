import { useEffect, useState } from 'react';
import type { NaturalVoice } from '../../api/speech';
import { saveVoice, usePinyinMemory } from './voice';
import { packVoices, sampleFor, say } from './voiceOut';

/**
 * Whose voice to hear.
 *
 * "Any" is the default and the better teacher: the hearing drills take each
 * word in whichever voice has it, in turn, and hearing a sound in several
 * voices is what teaches the ear which part is the sound and which is the
 * speaker. Picking one is for when a particular voice is simply nicer to
 * copy — it is used wherever it has the word, and the others fill in.
 *
 * It belongs on the pages where the voice is actually heard, not on the one
 * that lists them: a setting offered where nothing is being said is a setting
 * you change blind. So it says the new voice as you pick it — the thing in
 * front of you where there is one, and a word from the pack otherwise — and
 * the choice is remembered for the whole section.
 *
 * Just the chips: the heading beside them belongs to the row it is put in.
 */
export function VoicePicker({ preview }: { preview?: string }) {
  const chosen = usePinyinMemory().voice;
  const [voices, setVoices] = useState<NaturalVoice[]>([]);

  useEffect(() => {
    void packVoices().then(setVoices);
  }, []);

  // One voice is not a choice, and none is not a picker.
  if (voices.length < 2) return null;

  const pick = (id: string | null) => {
    saveVoice(id);
    if (!id) return;
    if (preview?.trim()) void say(preview, { voice: id });
    else void sampleFor(id).then((text) => text && say(text, { voice: id }));
  };

  return (
    <div className="chips">
      <button className="chip" aria-pressed={chosen === null} onClick={() => pick(null)}>
        Any, in turn
      </button>
      {voices.map((v) => (
        <button key={v.id} className="chip" aria-pressed={chosen === v.id} onClick={() => pick(v.id)}>
          {v.name}
          <span className="count">{v.gender === 'female' ? '♀' : '♂'}</span>
        </button>
      ))}
    </div>
  );
}
