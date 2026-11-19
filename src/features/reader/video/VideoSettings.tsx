import { useState, type ReactNode } from 'react';
import { pictureUrl } from '../../../api/pictures';
import { type VideoLook } from '../../../domain/textVideo';
import { Icon } from '../../../ui/Icon';
import { stored } from '../../../platform/storage';
import type { Own } from './VideoStudio';

/** The video studio's settings: its rows, segments and switches, the panel of them, and the kept presets. */

export function Row({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="vs-row">
      <span className="vs-row-name">
        {title}
        {note && <span className="tiny muted">{note}</span>}
      </span>
      {children}
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onPick, label, disabled }: { value: T; options: Array<[T, ReactNode]>; onPick: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <div className="seg sm" role="group" aria-label={label}>
      {options.map(([v, name]) => (
        <button key={String(v)} aria-pressed={value === v} onClick={() => onPick(v)} disabled={disabled}>
          {name}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button className="vs-switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} disabled={disabled}>
      <span />
    </button>
  );
}

const LAYOUTS: Array<[VideoLook['layout'], string]> = [
  ['above', 'Picture above'],
  ['over', 'Words on it'],
  ['side', 'Picture, then text'],
  ['words', 'Text only'],
];

export function Settings({
  look,
  change,
  disabled,
  safe,
  setSafe,
  hasQuestions,
  questionsRead,
  quick,
  onReadQuestions,
  readingQuestions,
  own,
  changeOwn,
  covers,
  parts,
  children,
}: {
  look: VideoLook;
  change: (p: Partial<VideoLook>) => void;
  disabled: boolean;
  safe: boolean;
  setSafe: (v: boolean) => void;
  hasQuestions: boolean;
  questionsRead: boolean;
  /** made quickly: the music and the questions' voice can go in; recorded as it plays, they cannot */
  quick: boolean;
  onReadQuestions: () => void;
  readingQuestions: boolean;
  own: Own;
  changeOwn: (p: Partial<Own>) => void;
  covers: Array<{ key: string; para: number }>;
  parts: number;
  children: ReactNode;
}) {
  return (
    <>
      <Presets look={look} change={change} disabled={disabled} />

      <section className="vs-section">
        <h2 className="block-title">Shape</h2>
        <div className="vs-shapes">
          {(
            [
              ['9:16', 'Upright', 'Reels, Shorts, TikTok, a phone held up'],
              ['16:9', 'Wide', 'YouTube, a TV, a laptop'],
            ] as const
          ).map(([id, name, note]) => (
            <button key={id} className="vs-tile vs-shape" aria-pressed={look.shape === id} onClick={() => change({ shape: id })} disabled={disabled}>
              <span className="vs-shape-box" data-shape={id} aria-hidden />
              <span className="vs-shape-name">
                <b>{name}</b> <span className="tiny muted">{id}</span>
                <span className="tiny muted">{note}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="vs-section">
        <h2 className="block-title">Layout</h2>
        <div className="vs-tiles">
          {LAYOUTS.map(([id, name]) => (
            <button key={id} className="vs-tile" aria-pressed={look.layout === id} onClick={() => change({ layout: id })} disabled={disabled}>
              <span className="vs-mini" data-layout={id} data-shape={look.shape} aria-hidden>
                <i className="p" />
                <i className="t" />
                <i className="t" />
              </span>
              <span className="tiny">{look.shape === '16:9' && id === 'side' ? 'Side by side' : name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="vs-section">
        <h2 className="block-title">On screen</h2>
        <Row title="Title at the top">
          <Seg
            label="What the top says"
            value={look.title}
            onPick={(v) => change({ title: v })}
            disabled={disabled}
            options={[
              ['off', 'Off'],
              ['chapter', 'Chapter'],
              ['book', 'Book too'],
            ]}
          />
        </Row>
        {look.title !== 'off' && (
          <Row title="Its look">
            <Seg label="Title look" value={look.titleLook} onPick={(v) => change({ titleLook: v })} disabled={disabled} options={[['band', 'Band'], ['plain', 'Plain']]} />
          </Row>
        )}
        <Row title="Theme">
          <Seg
            label="Theme"
            value={look.background}
            onPick={(v) => change({ background: v })}
            disabled={disabled}
            options={[
              ['paper', 'Paper'],
              ['night', 'Night'],
              ['board', 'Board'],
              ['sepia', 'Sepia'],
            ]}
          />
        </Row>
        <Row title="Who is speaking" note="Their name over their line, in their own colour, where the text says who (小智说：…)">
          <Switch label="Who is speaking" on={look.speakers} onChange={(v) => change({ speakers: v })} disabled={disabled} />
        </Row>
        <label className="vs-field vs-field-row">
          <span className="vs-row-name">
            Your signature
            <span className="tiny muted">In a corner of every scene and on the thumbnail; empty for none</span>
          </span>
          <input value={look.mark} maxLength={40} placeholder="@your_channel" onChange={(e) => change({ mark: e.target.value })} disabled={disabled} />
        </label>
        <Row title="Characters">
          <Seg
            label="Typeface of the Chinese"
            value={look.type}
            onPick={(v) => change({ type: v })}
            disabled={disabled}
            options={[
              ['kai', <span key="k"><span className="hanzi">楷</span> Brush</span>],
              ['print', <span key="p"><span className="vs-print">黑</span> Print</span>],
            ]}
          />
        </Row>
        {look.layout === 'over' && (
          <Row title="Words on the picture">
            <Seg label="Subtitle look" value={look.overLook} onPick={(v) => change({ overLook: v })} disabled={disabled} options={[['box', 'Box'], ['outline', 'Outline']]} />
          </Row>
        )}
        <Row title="Progress line" note="Along the bottom">
          <Switch label="Progress line" on={look.progress} onChange={(v) => change({ progress: v })} disabled={disabled} />
        </Row>
        <Row title="Pictures move" note="A slow zoom, and a fade between them">
          <Switch label="Pictures move" on={look.zoom} onChange={(v) => change({ zoom: v, fade: v })} disabled={disabled} />
        </Row>
      </section>

      <section className="vs-section">
        <h2 className="block-title">Subtitles</h2>
        <Row title="Size of the Chinese">
          <Seg
            label="Size"
            value={look.size}
            onPick={(v) => change({ size: v })}
            disabled={disabled}
            options={[
              ['s', <span key="s" className="hanzi" style={{ fontSize: 13 }}>字</span>],
              ['m', <span key="m" className="hanzi" style={{ fontSize: 16 }}>字</span>],
              ['l', <span key="l" className="hanzi" style={{ fontSize: 19 }}>字</span>],
              ['xl', <span key="x" className="hanzi" style={{ fontSize: 22 }}>字</span>],
            ]}
          />
        </Row>
        <Row title="Pinyin" note="Over each character">
          <Switch label="Pinyin" on={look.pinyin} onChange={(v) => change({ pinyin: v })} disabled={disabled} />
        </Row>
        <Row title="English" note="Under the line">
          <Switch label="English" on={look.english} onChange={(v) => change({ english: v })} disabled={disabled} />
        </Row>
        <Row title="Break long lines at commas" note="Two short lines read faster than one long one">
          <Switch label="Break long lines at commas" on={look.breakLines} onChange={(v) => change({ breakLines: v })} disabled={disabled} />
        </Row>
        <Row title="Show the safe zones" note="Only here: where Reels, Shorts and TikTok draw over the video">
          <Switch label="Show the safe zones" on={safe} onChange={setSafe} />
        </Row>
      </section>

      <section className="vs-section">
        <h2 className="block-title">Voice and pace</h2>
        {children}
        {quick && (
        <Row title="Music" note="Quiet, under the voice and lower while it speaks; in the made video">
          <Seg
            label="Music"
            value={look.music}
            onPick={(v) => change({ music: v })}
            disabled={disabled}
            options={[
              ['off', 'Off'],
              ['calm', 'Calm'],
              ['bright', 'Bright'],
            ]}
          />
        </Row>
        )}
        <Row title="Pause between paragraphs" note="Time to look at the picture">
          <Seg
            label="Pause"
            value={look.pause}
            onPick={(v) => change({ pause: v })}
            disabled={disabled}
            options={[
              [0, 'None'],
              [1000, '1 s'],
              [2000, '2 s'],
            ]}
          />
        </Row>
      </section>

      <section className="vs-section">
        <h2 className="block-title">{look.shape === '16:9' ? 'The opening' : 'For Reels and Shorts'}</h2>
        <Row title="Open with a question" note="Two seconds over the cover picture, before anything else">
          <Switch label="Open with a question" on={look.hook} onChange={(v) => change({ hook: v })} disabled={disabled} />
        </Row>
        {look.hook && (
          <label className="vs-field">
            <span className="tiny muted">The question</span>
            <input className="hanzi" value={own.hook} maxLength={40} placeholder="皮卡丘能吃到苹果吗？" onChange={(e) => changeOwn({ hook: e.target.value })} disabled={disabled} />
          </label>
        )}
        {covers.length > 1 && (
          <div className="vs-cover-row">
            <span className="vs-row-name">
              Cover
              <span className="tiny muted">The first frame, which a feed shows before it plays</span>
            </span>
            <div className="vs-covers">
              {covers.map((c) => (
                <button key={c.key} className="vs-cover" aria-pressed={own.cover === c.para} aria-label={`Paragraph ${c.para + 1}'s picture`} onClick={() => changeOwn({ cover: c.para })} disabled={disabled}>
                  <img src={pictureUrl(c.key)} alt="" />
                </button>
              ))}
            </div>
          </div>
        )}
        {look.shape === '9:16' && (
        <Row title="Split into parts" note={look.parts ? (parts > 1 ? `${parts} parts, each under a minute, cut at paragraphs` : 'Short enough to stay whole') : 'Each under a minute, cut at paragraphs, “Part 1 of 2” in the corner'}>
          <Switch label="Split into parts" on={look.parts} onChange={(v) => change({ parts: v })} disabled={disabled} />
        </Row>
        )}
      </section>

      <section className="vs-section">
        <h2 className="block-title">Before and after</h2>
        <Row title="Title card" note="The picture, the book and the chapter, first">
          <Switch label="Title card" on={look.titleCard} onChange={(v) => change({ titleCard: v })} disabled={disabled} />
        </Row>
        <Row title="Questions at the end" note={hasQuestions ? 'Each shown, then time to answer aloud, then the answer' : 'This text has none'}>
          <Switch label="Questions at the end" on={look.questions && hasQuestions} onChange={(v) => change({ questions: v })} disabled={disabled || !hasQuestions} />
        </Row>
        {quick && look.questions && hasQuestions && (
          <Row
            title="Said by the narrator"
            note={questionsRead ? 'The questions and answers, read once and kept' : 'Read once by MiniMax, then kept for every video'}
          >
            <Switch label="Said by the narrator" on={look.voiceQuestions} onChange={(v) => change({ voiceQuestions: v })} disabled={disabled} />
          </Row>
        )}
        {look.questions && hasQuestions && look.voiceQuestions && !questionsRead && (
          <div className="vs-row">
            <span className="vs-row-name">
              Not read yet
              <span className="tiny muted">Until then they are shown silent</span>
            </span>
            <button className="btn tonal sm" onClick={onReadQuestions} disabled={disabled || readingQuestions}>
              {readingQuestions ? 'Reading…' : 'Read them now'}
            </button>
          </div>
        )}
        {look.questions && hasQuestions && (
          <Row title="Time to answer">
            <Seg
              label="Time to answer"
              value={look.think}
              onPick={(v) => change({ think: v })}
              disabled={disabled}
              options={[
                [3000, '3 s'],
                [5000, '5 s'],
                [8000, '8 s'],
              ]}
            />
          </Row>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------ presets */

interface Preset {
  name: string;
  look: Partial<VideoLook>;
}

/** Two to start from; the signature is never part of a preset. */
const BUILT_IN: Preset[] = [
  {
    name: 'Shorts',
    look: { shape: '9:16', layout: 'above', size: 'l', hook: true, parts: true, titleCard: false, pause: 0, english: false, pinyin: true, breakLines: true, music: 'bright', questions: true, think: 3000 },
  },
  {
    name: 'YouTube lesson',
    look: { shape: '16:9', layout: 'side', size: 'm', hook: false, parts: false, titleCard: true, title: 'book', pause: 1000, english: true, pinyin: true, music: 'calm', questions: true, think: 5000 },
  },
];

const PRESETS = 'hanzi.video.presets';
const keptPresets = (): Preset[] => {
  try {
    const raw = JSON.parse(stored.get(PRESETS) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((p): p is Preset => Boolean(p && typeof p.name === 'string' && p.look && typeof p.look === 'object')) : [];
  } catch {
    return [];
  }
};

const same = (look: VideoLook, p: Partial<VideoLook>) => Object.entries(p).every(([k, v]) => k === 'mark' || look[k as keyof VideoLook] === v);

/**
 * Presets: a whole look at a tap. Shorts and YouTube lesson to start from, and
 * the learner's own, saved from the look as it is now and kept on this device.
 */
export function Presets({ look, change, disabled }: { look: VideoLook; change: (p: Partial<VideoLook>) => void; disabled: boolean }) {
  const [own, setOwn] = useState<Preset[]>(keptPresets);
  const [naming, setNaming] = useState<string | null>(null);
  const keep = (list: Preset[]) => {
    setOwn(list);
    try {
      stored.set(PRESETS, JSON.stringify(list));
    } catch {
      // kept for this visit only
    }
  };
  const saveAs = (name: string) => {
    const { mark: _mark, ...rest } = look;
    keep([...own.filter((p) => p.name !== name), { name, look: rest }]);
    setNaming(null);
  };
  return (
    <section className="vs-section">
      <h2 className="block-title">Presets</h2>
      <div className="vs-presets">
        {[...BUILT_IN, ...own].map((p, i) => (
          <span key={`${i}-${p.name}`} className="vs-preset">
            <button className="chip" aria-pressed={same(look, p.look)} onClick={() => change(p.look)} disabled={disabled}>
              {p.name}
            </button>
            {i >= BUILT_IN.length && (
              <button className="vs-preset-x" aria-label={`Remove the preset ${p.name}`} onClick={() => keep(own.filter((x) => x !== p))} disabled={disabled}>
                <Icon name="close" size={14} />
              </button>
            )}
          </span>
        ))}
        {naming === null && (
          <button className="chip vs-preset-add" onClick={() => setNaming('')} disabled={disabled}>
            <Icon name="plus" size={14} /> Save this look
          </button>
        )}
      </div>
      {naming !== null && (
        <form
          className="vs-preset-name"
          onSubmit={(e) => {
            e.preventDefault();
            if (naming.trim()) saveAs(naming.trim());
          }}
        >
          <input value={naming} maxLength={30} placeholder="A name for this look" autoFocus onChange={(e) => setNaming(e.target.value)} />
          <button className="btn tonal sm" type="submit" disabled={!naming.trim()}>
            Save
          </button>
          <button className="btn quiet sm" type="button" onClick={() => setNaming(null)}>
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}
