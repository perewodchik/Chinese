import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { narrationAudio, narrationBlob } from '../../../api/narration';
import { pictureUrl } from '../../../api/pictures';
import { DEFAULT_LOOK, lookOf, mmss, momentAt, videoPlan, type VideoLook } from '../../../domain/textVideo';
import type { GeneratedText } from '../../../domain/text';
import { useStore } from '../../../store/store';
import { Icon } from '../../../ui/Icon';
import { useLibrary } from '../../shared/library';
import { narratedReadings, type Narrated } from '../narratedClips';
import { drawFrame, H, SAFE, W } from './draw';
import { forgetVideo, keepVideo, keptVideo, type KeptVideo } from './kept';
import { canRecord, run, type Run } from './record';
import { canRenderFast, renderFast, type Render } from './render';
import './video.css';

const KEPT = 'hanzi.video.look';
const keptLook = () => {
  try {
    return lookOf(JSON.parse(localStorage.getItem(KEPT) ?? 'null'));
  } catch {
    return DEFAULT_LOOK;
  }
};

type Mode = 'idle' | 'playing' | 'making' | 'done';

/** What is the text's own: its opening question, and whose picture is the cover. */
interface Own {
  hook: string;
  cover: number;
}
const ownKey = (id: string) => `hanzi.video.own.${id}`;
function keptOwn(text: GeneratedText): Own {
  try {
    const o = JSON.parse(localStorage.getItem(ownKey(text.id)) ?? 'null') as Partial<Own> | null;
    if (o) return { hook: typeof o.hook === 'string' ? o.hook : '', cover: Number.isInteger(o.cover) ? o.cover! : 0 };
  } catch {
    // as new
  }
  return { hook: text.questions[0]?.zh ?? '', cover: 0 };
}

type Made = KeptVideo & { urls: string[] };
const withUrls = (v: KeptVideo): Made => ({ ...v, urls: v.parts.map((b) => URL.createObjectURL(b)) });

/**
 * Video: the text made into an upright video, on this device, from what it
 * already has — its pictures, a narrator's kept reading, its questions.
 *
 * The preview is the video itself: the same drawing as the recording, at any
 * moment, so a setting changed is seen at once. Making plays the whole plan
 * once in real time and records it; the result is saved or shared from here.
 * Nothing is paid: the reading was paid for once, when it was made.
 */
export function VideoStudio({ text, onClose }: { text: GeneratedText; onClose: () => void }) {
  const lib = useLibrary();
  const book = useStore((s) => s.sets.find((x) => x.id === text.setId)?.name ?? '');
  const canvas = useRef<HTMLCanvasElement>(null);
  const [look, setLook] = useState<VideoLook>(keptLook);
  const [readings, setReadings] = useState<Narrated[] | null>(null);
  const [narratorId, setNarratorId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [pictures, setPictures] = useState<Map<string, HTMLImageElement>>(new Map());
  // Bumped as each picture and the fonts arrive, so the preview is drawn again.
  const [, setReady] = useState(0);
  const [t, setT] = useState(0);
  const [mode, setMode] = useState<Mode>('idle');
  const [own, setOwn] = useState<Own>(() => keptOwn(text));
  const [video, setVideo] = useState<Made | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [safe, setSafe] = useState(true);
  const running = useRef<Run | Render | null>(null);
  // Whether this browser makes the video in seconds (WebCodecs) or as it plays.
  const [fast, setFast] = useState<boolean | null>(null);
  useEffect(() => {
    void canRenderFast().then(setFast, () => setFast(false));
  }, []);

  const reading = readings?.find((r) => r.n.narratorId === narratorId) ?? readings?.[0] ?? null;
  const plan = useMemo(() => (reading ? videoPlan(text, reading.n, look, own) : null), [text, reading, look, own]);

  const changeOwn = (patch: Partial<Own>) =>
    setOwn((o) => {
      const next = { ...o, ...patch };
      try {
        localStorage.setItem(ownKey(text.id), JSON.stringify(next));
      } catch {
        // kept for this visit only
      }
      return next;
    });

  // A video made before opens first.
  useEffect(() => {
    let live = true;
    void keptVideo(text.id).then((v) => {
      if (!live || !v?.parts.length) return;
      setVideo(withUrls(v));
      setMode((m) => (m === 'idle' ? 'done' : m));
    });
    return () => {
      live = false;
    };
  }, [text.id]);

  const change = (patch: Partial<VideoLook>) =>
    setLook((l) => {
      const next = { ...l, ...patch };
      try {
        localStorage.setItem(KEPT, JSON.stringify(next));
      } catch {
        // kept for this visit only
      }
      return next;
    });

  useEffect(() => {
    let live = true;
    narratedReadings(text.lines.map((l) => l.zh)).then(
      (list) => live && setReadings(list),
      (err: Error) => {
        if (!live) return;
        setReadings([]);
        setError(err.message);
      },
    );
    return () => {
      live = false;
    };
  }, [text.lines]);

  useEffect(() => {
    if (!reading) return;
    let live = true;
    setAudioUrl(null);
    narrationAudio(reading.n).then(
      (u) => live && setAudioUrl(u),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [reading]);

  // The pictures and the fonts, before anything is drawn for real.
  useEffect(() => {
    const keys = [...new Set((text.pictures ?? []).map((p) => p.key).filter((k): k is string => Boolean(k)))];
    const map = new Map<string, HTMLImageElement>();
    let live = true;
    for (const k of keys) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => live && setReady((n) => n + 1);
      img.src = pictureUrl(k);
      map.set(k, img);
    }
    setPictures(map);
    void Promise.all(['72px WenKai', '500 30px "Fira Sans"', '30px Literata'].map((f) => document.fonts?.load(f).catch(() => undefined))).then(
      () => live && setReady((n) => n + 1),
    );
    return () => {
      live = false;
    };
  }, [text.pictures]);

  // Opened on the first paragraph, a moment in.
  useEffect(() => {
    if (!plan) return;
    const first = plan.steps.find((s) => s.kind === 'para');
    setT((cur) => (cur ? Math.min(cur, plan.duration - 1) : first ? first.at + Math.min(1500, first.dur / 2) : 0));
  }, [plan]);

  const ctx = () => canvas.current?.getContext('2d') ?? null;
  const drawAt = (time: number) => {
    const c = ctx();
    if (!c || !plan || !reading) return;
    drawFrame(c, { text, book, plan, moment: momentAt(plan, time, reading.n.timings), look, pictures, lib });
  };

  // The still preview follows every change while nothing plays.
  useEffect(() => {
    if (mode === 'idle' || mode === 'done') drawAt(t);
  });

  useEffect(
    () => () => {
      running.current?.stop();
    },
    [],
  );
  useEffect(() => () => video?.urls.forEach((u) => URL.revokeObjectURL(u)), [video]);

  async function start(record: boolean) {
    if (!plan || !reading || !audioUrl || !canvas.current) return;
    setError(null);
    const r = record && fast
      ? renderFast({
          canvas: canvas.current,
          plan,
          audio: await narrationBlob(reading.n),
          draw: (time) => {
            const c = ctx();
            if (c) drawFrame(c, { text, book, plan, moment: momentAt(plan, time, reading.n.timings), look, pictures, lib });
          },
          onTime: setT,
        })
      : run({
      canvas: canvas.current,
      plan,
      timings: reading.n.timings,
      audioUrl,
      record,
      from: record ? 0 : t >= plan.duration - 50 ? 0 : t,
      draw: (m) => {
        const c = ctx();
        if (c) drawFrame(c, { text, book, plan, moment: m, look, pictures, lib });
      },
      onTime: setT,
    });
    running.current = r;
    setMode(record ? 'making' : 'playing');
    // The screen kept on while it records: a locked phone stops drawing.
    const lock = record && 'wakeLock' in navigator ? navigator.wakeLock.request('screen').catch(() => null) : Promise.resolve(null);
    void r.done.finally(() => void lock.then((l) => l?.release()));
    r.done.then(
      (blobs) => {
        running.current = null;
        if (blobs?.length && blobs.every((b) => b.size)) {
          const made: KeptVideo = { textId: text.id, parts: blobs, duration: plan.duration, narrator: reading.name, at: Date.now() };
          void keepVideo(made);
          setVideo(withUrls(made));
          setShown(0);
          setMode('done');
        } else setMode('idle');
      },
      (err: Error) => {
        running.current = null;
        setError(err.message);
        setMode('idle');
      },
    );
  }

  const stop = () => {
    running.current?.stop();
    running.current = null;
    setMode('idle');
  };

  async function save() {
    if (!video) return;
    const n = video.parts.length;
    const files = video.parts.map((b, i) => {
      const ext = b.type.includes('mp4') ? 'mp4' : 'webm';
      return new File([b], `${text.titleZh || text.title}${n > 1 ? ` ${i + 1} of ${n}` : ''}.${ext}`, { type: b.type });
    });
    try {
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files });
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
    files.forEach((f, i) => {
      const a = document.createElement('a');
      a.href = video.urls[i]!;
      a.download = f.name;
      a.click();
    });
  }

  async function remove() {
    await forgetVideo(text.id);
    setVideo(null);
    setMode('idle');
  }

  const busy = mode === 'playing' || mode === 'making';
  const stepAt = (kind: string) => plan?.steps.find((x) => x.kind === kind)?.at ?? 0;
  const scenes = plan
    ? [
        ...(plan.hook ? [{ id: 'hook', label: 'Opening', at: 600, pic: plan.cover, han: '问' }] : []),
        ...(look.titleCard ? [{ id: 'title', label: 'Title', at: stepAt('title') + 600, pic: null as string | null, han: '题' }] : []),
        ...plan.paras.map((_, p) => {
          const s = plan.steps.find((x) => x.kind === 'para' && x.para === p)!;
          return { id: `p${p}`, label: `¶${p + 1}`, at: s.at + Math.min(1500, s.dur / 2), pic: plan.pictureOf[p] ?? null, han: '' };
        }),
        ...(look.questions && text.questions.length
          ? [{ id: 'q', label: 'Questions', at: plan.steps.find((x) => x.kind === 'question')!.at + 3000, pic: null, han: '问' }]
          : []),
      ]
    : [];
  const sceneAt = (time: number) => {
    let id = scenes[0]?.id;
    for (const s of scenes) if (time >= s.at - (s.id.startsWith('p') ? 1500 : s.id === 'q' ? 3000 : 600)) id = s.id;
    return id;
  };
  const partNow = plan ? momentAt(plan, t, reading?.n.timings ?? []).part : 0;
  const parts = plan?.parts.length ?? 1;

  return (
    <div className="co-scrim vs-scrim" role="dialog" aria-modal="true" aria-label="Video">
      <div className="vs">
        <header className="vs-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
          <div className="vs-title">
            <b>Video</b>
            <span className="small muted hanzi">{text.titleZh || text.title}</span>
          </div>
          <span className="tiny muted">9:16</span>
        </header>

        <div className="vs-body">
          <div className="vs-stage">
            {mode === 'done' && video ? (
              <div className="vs-box">
                <video key={shown} className="vs-video" src={video.urls[shown]} controls playsInline />
              </div>
            ) : (
              <div className="vs-box">
                <div className="vs-frame">
                  <canvas ref={canvas} width={W} height={H} aria-label="The video, as it will be" />
                  {safe && mode === 'idle' && (
                    <>
                      <span className="vs-safe" style={{ top: 0, height: `${(SAFE.top / H) * 100}%`, left: 0, right: 0 }} />
                      <span className="vs-safe" style={{ bottom: 0, height: `${((H - SAFE.bottom) / H) * 100}%`, left: 0, right: 0 }} />
                      <span
                        className="vs-safe"
                        style={{ top: `${(SAFE.buttonsFrom / H) * 100}%`, bottom: `${((H - SAFE.bottom) / H) * 100}%`, right: 0, width: `${(SAFE.right / W) * 100}%` }}
                      />
                    </>
                  )}
                  {!plan && (
                    <div className="vs-empty small">
                      {readings === null ? 'Getting the reading…' : 'This text has no narrator’s reading yet. Make one in Listen with the + by the voices, then come back: the video is timed by it.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {plan && mode !== 'done' && (
              <>
                <div className="vs-line" role="group" aria-label="Where in the video">
                  {plan.steps.map((s, i) => (
                    <button
                      key={i}
                      style={{ flexGrow: s.dur }}
                      data-state={t >= s.at + s.dur ? 'past' : t >= s.at ? 'now' : undefined}
                      aria-label={`Go to ${mmss(s.at)}`}
                      onClick={() => !busy && setT(s.at + Math.min(1200, s.dur / 2))}
                      disabled={busy}
                    />
                  ))}
                </div>
                <div className="vs-times tiny muted">
                  <span>{mmss(t)}</span>
                  <span>{mmss(plan.duration)}</span>
                </div>
                <div className="vs-controls">
                  {mode === 'making' ? (
                    <div className="vs-making">
                      <div className="vs-bar">
                        <i style={{ width: `${Math.round((t / plan.duration) * 100)}%` }} />
                      </div>
                      <span className="small">
                        {parts > 1 ? `Making part ${partNow + 1} of ${parts}` : 'Making the video'} · {Math.round((t / plan.duration) * 100)}%
                      </span>
                      <button className="btn quiet sm" onClick={stop}>
                        Stop
                      </button>
                    </div>
                  ) : (
                    <button className="rd-play" onClick={() => (mode === 'playing' ? stop() : void start(false))} disabled={!audioUrl} aria-label={mode === 'playing' ? 'Pause' : 'Play the preview'}>
                      <Icon name={mode === 'playing' ? 'pause' : 'play'} size={22} />
                    </button>
                  )}
                </div>
                <div className="vs-scenes">
                  {scenes.map((s) => (
                    <button key={s.id} className="vs-scene" aria-pressed={sceneAt(t) === s.id} onClick={() => !busy && setT(s.at)} disabled={busy}>
                      {s.pic ? <img src={pictureUrl(s.pic)} alt="" /> : <span className="hanzi">{s.han}</span>}
                      <span className="tiny">{s.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="vs-settings">
            {mode === 'done' && video ? (
              <div className="vs-done">
                <b className="hanzi vs-done-title">{text.titleZh || text.title}</b>
                <span className="small muted">
                  {mmss(video.duration)} · 9:16, 1080 × 1920 · {(video.parts.reduce((n, b) => n + b.size, 0) / 1e6).toFixed(1)} MB · {video.narrator}
                </span>
                {video.parts.length > 1 && (
                  <Seg
                    label="Part"
                    value={shown}
                    onPick={setShown}
                    options={video.parts.map((_, i) => [i, `Part ${i + 1}`] as [number, ReactNode])}
                  />
                )}
                <button className="btn primary lg" onClick={() => void save()}>
                  {video.parts.length > 1 ? `Save or share all ${video.parts.length}` : 'Save or share'}
                </button>
                <button className="btn tonal" onClick={() => setMode('idle')}>
                  Change and make again
                </button>
                <button className="btn quiet danger" onClick={() => void remove()}>
                  Delete this video
                </button>
                <p className="tiny muted">
                  On an iPhone or iPad, Save Video in the sheet puts it in Photos. It is kept on this device: Video opens it until it is made again.
                </p>
              </div>
            ) : (
              <Settings
                look={look}
                change={change}
                disabled={busy}
                safe={safe}
                setSafe={setSafe}
                hasQuestions={text.questions.length > 0}
                own={own}
                changeOwn={changeOwn}
                covers={plan ? [...new Set(plan.pictureOf)].map((key) => ({ key, para: plan.pictureOf.indexOf(key) })).filter((c): c is { key: string; para: number } => Boolean(c.key)) : []}
                parts={parts}
              >
                {readings && readings.length > 1 && (
                  <Row title="Narrator">
                    <select value={reading?.n.narratorId} onChange={(e) => setNarratorId(e.target.value)} disabled={busy}>
                      {readings.map((r) => (
                        <option key={r.n.narratorId} value={r.n.narratorId}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </Row>
                )}
              </Settings>
            )}
            {error && (
              <p className="narrator-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        {mode !== 'done' && (
          <footer className="vs-foot">
            <button className="btn primary lg" onClick={() => void start(true)} disabled={!plan || !audioUrl || busy || fast === null || (!fast && !canRecord())}>
              {mode === 'making' ? 'Making…' : 'Make the video'}
            </button>
            <span className="tiny muted">
              {!plan || fast === null
                ? ''
                : fast
                  ? `A ${mmss(plan.duration)} video. Making it takes less than watching it; nothing is paid.`
                  : !canRecord()
                    ? 'This browser cannot make a video.'
                    : `A ${mmss(plan.duration)} video. Making it takes as long as watching it, the screen kept on; nothing is paid.`}
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------ settings */

function Row({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
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

function Seg<T extends string | number>({ value, options, onPick, label, disabled }: { value: T; options: Array<[T, ReactNode]>; onPick: (v: T) => void; label: string; disabled?: boolean }) {
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

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
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

function Settings({
  look,
  change,
  disabled,
  safe,
  setSafe,
  hasQuestions,
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
  own: Own;
  changeOwn: (p: Partial<Own>) => void;
  covers: Array<{ key: string; para: number }>;
  parts: number;
  children: ReactNode;
}) {
  return (
    <>
      <section className="vs-section">
        <h2 className="block-title">Layout</h2>
        <div className="vs-tiles">
          {LAYOUTS.map(([id, name]) => (
            <button key={id} className="vs-tile" aria-pressed={look.layout === id} onClick={() => change({ layout: id })} disabled={disabled}>
              <span className="vs-mini" data-layout={id} aria-hidden>
                <i className="p" />
                <i className="t" />
                <i className="t" />
              </span>
              <span className="tiny">{name}</span>
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
        <Row title="Background">
          <Seg label="Background" value={look.background} onPick={(v) => change({ background: v })} disabled={disabled} options={[['paper', 'Paper'], ['night', 'Night']]} />
        </Row>
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
        <h2 className="block-title">For Reels and Shorts</h2>
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
        <Row title="Split into parts" note={look.parts ? (parts > 1 ? `${parts} parts, each under a minute, cut at paragraphs` : 'Short enough to stay whole') : 'Each under a minute, cut at paragraphs, “Part 1 of 2” in the corner'}>
          <Switch label="Split into parts" on={look.parts} onChange={(v) => change({ parts: v })} disabled={disabled} />
        </Row>
      </section>

      <section className="vs-section">
        <h2 className="block-title">Before and after</h2>
        <Row title="Title card" note="The picture, the book and the chapter, first">
          <Switch label="Title card" on={look.titleCard} onChange={(v) => change({ titleCard: v })} disabled={disabled} />
        </Row>
        <Row title="Questions at the end" note={hasQuestions ? 'Each shown, then time to answer aloud, then the answer' : 'This text has none'}>
          <Switch label="Questions at the end" on={look.questions && hasQuestions} onChange={(v) => change({ questions: v })} disabled={disabled || !hasQuestions} />
        </Row>
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
