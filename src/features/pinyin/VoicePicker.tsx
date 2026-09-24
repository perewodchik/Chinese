import { useEffect, useState } from 'react';
import type { NaturalVoice } from '../../api/speech';
import { saveVoice, usePreferredVoice } from '../../platform/audio/voicePreference';
import { packVoices, sampleFor, say, voicesFor } from '../../platform/audio/voiceOut';

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
 * Given `preview`, only the voices that actually read *that* text are
 * offered. The native speaker has single syllables and nothing longer, so on
 * a page of sentences it has nothing to say; left in the list it could be
 * picked, and the pack would answer in the designed voice while the chip
 * still read Native Speaker. A choice that cannot be honoured is not offered.
 *
 * Just the chips: the heading beside them belongs to the row it is put in.
 */
export function VoicePicker({ preview }: { preview?: string }) {
  const chosen = usePreferredVoice();
  const [voices, setVoices] = useState<NaturalVoice[]>([]);
  const [have, setHave] = useState<string[] | null>(null);

  useEffect(() => {
    void packVoices().then(setVoices);
  }, []);

  useEffect(() => {
    if (!preview?.trim()) {
      setHave(null);
      return;
    }
    let live = true;
    void voicesFor(preview).then((ids) => live && setHave(ids));
    return () => {
      live = false;
    };
  }, [preview]);

  const offered = have ? voices.filter((v) => have.includes(v.id)) : voices;

  // One voice is not a choice, and none is not a picker.
  if (offered.length < 2) return null;

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
      {offered.map((v) => (
        <button key={v.id} className="chip" aria-pressed={chosen === v.id} onClick={() => pick(v.id)}>
          {v.name}
          <span className="count">{v.gender === 'female' ? '♀' : '♂'}</span>
        </button>
      ))}
    </div>
  );
}
