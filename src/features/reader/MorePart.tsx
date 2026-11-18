import { useEffect, useState } from 'react';
import { type GeneratedText } from '../../domain/text';
import { useHashFlag } from '../../navigation/hash';
import { studyText } from '../../store/commands';
import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { Dictation, openDictation } from './Dictation';
import { keptVideo, type KeptVideo } from './video/kept';
import { VideoStudio } from './video/VideoStudio';
import { isSpeakSectionEnabled } from '../../navigation/features';
import { mmss } from '../../domain/textVideo';
import { narratedReadings, pickReading, prepareClips } from '../shared/narratedClips';
import { Section } from './PartSection';

function TranslateBody({ text }: { text: GeneratedText }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = open.size === text.lines.length;
  const reveal = (next: Set<number>) => {
    setOpen(next);
    if (next.size && !text.study?.translated) studyText(text.id, { translated: Date.now() });
  };
  return (
    <>
      <div className="row rd-more-lede">
        <p className="rd-part-lede grow">Say to yourself what each line means, then tap it to check.</p>
        <button className="btn quiet sm rd-show-all" onClick={() => reveal(all ? new Set() : new Set(text.lines.map((_, i) => i)))}>
          {all ? 'Hide all' : 'Show all'}
        </button>
      </div>
      <ol className="rd-pairs">
        {text.lines.map((l, i) => {
          const shown = open.has(i);
          return (
            <li key={i}>
              <button
                className="rd-pair"
                aria-expanded={shown}
                onClick={() => {
                  const next = new Set(open);
                  if (shown) next.delete(i);
                  else next.add(i);
                  reveal(next);
                }}
              >
                <span className="hanzi rd-pair-zh">{l.zh}</span>
                <span className="rd-pair-en" data-hidden={!shown || undefined}>
                  {shown ? l.en : 'Tap to see the translation'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/* ---------------------------------------------------------------- 更 More */

/**
 * Translating and dictation: two ways of going over the text again, folded
 * away until one is wanted, and counted nowhere. Translate opens where it is;
 * dictation has the screen to itself.
 */
export function MorePart({ text, partId }: { text: GeneratedText; partId: string }) {
  const [open, setOpen] = useState<'translate' | null>(null);
  // Open over the text and kept in the address (#dictation), so a reload finds it open again.
  const [dictating, setDictating] = useHashFlag('dictation');
  const [filming, setFilming] = useState(false);
  const [film, setFilm] = useState<KeptVideo | null>(null);
  // A video made of this text, kept on this device: the row says so.
  useEffect(() => {
    if (filming || !isSpeakSectionEnabled) return;
    let live = true;
    void keptVideo(text.id).then((v) => live && setFilm(v));
    return () => {
      live = false;
    };
  }, [text.id, filming]);
  useEffect(() => setOpen(null), [text.id]);
  // A narrator's reading, fetched before Dictation is opened, so its first
  // sentence can be said inside the tap that opens it.
  useEffect(() => {
    let live = true;
    void narratedReadings(text.lines.map((l) => l.zh)).then((list) => {
      const r = pickReading(list);
      if (live && r) void prepareClips(text.id, r).catch(() => undefined);
    }, () => undefined);
    return () => {
      live = false;
    };
  }, [text.id, text.lines]);
  const dictated = Math.min(text.lines.length, text.study?.dictated ?? 0);
  const row = (id: 'translate', han: string, title: string, sub: string) => (
    <button className="rd-more-row" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
      <span className="hanzi" aria-hidden>
        {han}
      </span>
      <span className="grow">
        <b>{title}</b>
        <span className="small muted">{sub}</span>
      </span>
      <Icon name="chevron" />
    </button>
  );
  return (
    <Section id={partId} han="更" title="More" aside="Practice, not counted">
      <div className="rd-more-list">
        {/* A pasted text has no English to check against (T3): said, not offered. */}
        {!text.lines.some((l) => l.en) && (
          <Link className="rd-more-row" to={paths.explainText(text.id)}>
            <span className="hanzi" aria-hidden>
              译
            </span>
            <span className="grow">
              <b>Explain it with Claude</b>
              <span className="small muted">No English for its lines yet. Your own chat with Claude gives it, with words, grammar and questions.</span>
            </span>
            <Icon name="chevron" />
          </Link>
        )}
        {text.lines.some((l) => l.en) && row('translate', '译', 'Translate', 'Say what a line means, then check')}
        {open === 'translate' && (
          <div className="rd-more-body">
            <TranslateBody key={text.id} text={text} />
          </div>
        )}
        <button
          className="rd-more-row"
          onClick={() => {
            openDictation(text);
            setDictating(true);
          }}
        >
          <span className="hanzi" aria-hidden>
            默
          </span>
          <span className="grow">
            <b>Dictation</b>
            <span className="small muted">
              {dictated >= text.lines.length
                ? 'Written to the end. Again?'
                : dictated
                  ? `${dictated} of ${text.lines.length} sentences so far: go on from there`
                  : 'Hear a sentence, write it down, then see it'}
            </span>
          </span>
          <Icon name="chevron" />
        </button>
        {/* A video is timed by a narrator's reading, and narrators are made in Speak: without Speak there is none to make. */}
        {isSpeakSectionEnabled && (
          <button className="rd-more-row" onClick={() => setFilming(true)}>
            <span className="hanzi" aria-hidden>
              影
            </span>
            <span className="grow">
              <b>Video</b>
              <span className="small muted">
                {film
                  ? `A video, ${mmss(film.duration)}${film.parts.length > 1 ? ` in ${film.parts.length} parts` : ''}: watch it or make it again`
                  : 'The text as an upright video: its pictures, the narrator, subtitles'}
              </span>
            </span>
            <Icon name="chevron" />
          </button>
        )}
      </div>
      {dictating && <Dictation text={text} onClose={() => setDictating(false)} />}
      {filming && <VideoStudio text={text} onClose={() => setFilming(false)} />}
    </Section>
  );
}
