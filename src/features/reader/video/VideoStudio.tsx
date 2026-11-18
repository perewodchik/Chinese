import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { narrationBlob, narrationOf } from '../../../api/narration';
import type { TextNarrationDto } from '../../../../shared/narration';
import { pictureUrl } from '../../../api/pictures';
import { DEFAULT_LOOK, lookOf, mmss, momentAt, questionLines, videoPlan, type VideoLook } from '../../../domain/textVideo';
import type { GeneratedText } from '../../../domain/text';
import { useStore } from '../../../store/store';
import { Icon } from '../../../ui/Icon';
import { useLibrary } from '../../shared/library';
import { narratedReadings, type Narrated } from '../../shared/narratedClips';
import { drawFrame, geometry } from './draw';
import { forgetVideo, keepVideo, keptVideo, type KeptVideo } from './kept';
import { canRecord, decodeReading, run, type Run } from './record';
import { makeThumbnail } from './thumbnail';
import './video.css';
import { stored } from '../../../platform/storage';
import { Row, Seg, Settings } from './VideoSettings';

const KEPT = 'hanzi.video.look';
const keptLook = () => {
  try {
    return lookOf(JSON.parse(stored.get(KEPT) ?? 'null'));
  } catch {
    return DEFAULT_LOOK;
  }
};

type Mode = 'idle' | 'playing' | 'making' | 'done';

/** What is the text's own: its opening question, and whose picture is the cover. */
export interface Own {
  hook: string;
  cover: number;
}
const ownKey = (id: string) => `hanzi.video.own.${id}`;
function keptOwn(text: GeneratedText): Own {
  try {
    const o = JSON.parse(stored.get(ownKey(text.id)) ?? 'null') as Partial<Own> | null;
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
  const [pictures, setPictures] = useState<Map<string, HTMLImageElement>>(new Map());
  // Bumped as each picture and the fonts arrive, so the preview is drawn again.
  const [, setReady] = useState(0);
  const [t, setT] = useState(0);
  const [mode, setMode] = useState<Mode>('idle');
  const [own, setOwn] = useState<Own>(() => keptOwn(text));
  const [video, setVideo] = useState<Made | null>(null);
  const [shown, setShown] = useState(0);
  const [watching, setWatching] = useState(false);
  const [thumb, setThumb] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [safe, setSafe] = useState(true);
  const running = useRef<Run | null>(null);

  const reading = readings?.find((r) => r.n.narratorId === narratorId) ?? readings?.[0] ?? null;
  // The narrator's reading of the questions and answers: undefined while it is looked for, null when there is none yet.
  const asking = useMemo(() => questionLines(text.questions).lines, [text.questions]);
  const [asked, setAsked] = useState<TextNarrationDto | null | undefined>(undefined);
  const [askingNow, setAskingNow] = useState(false);
  // The readings decoded before any tap, so a tap starts the video at once (iOS lets sound begin only there).
  const [sound, setSound] = useState<{ reading: AudioBuffer; asked: AudioBuffer | null } | null>(null);
  useEffect(() => {
    if (!reading || !asking.length) {
      setAsked(null);
      return;
    }
    let live = true;
    setAsked(undefined);
    narrationOf(reading.n.narratorId, asking).then(
      (n) => live && setAsked(n),
      () => live && setAsked(null),
    );
    return () => {
      live = false;
    };
  }, [reading, asking]);

  const planWith = (a: TextNarrationDto | null | undefined) => (reading ? videoPlan(text, reading.n, look, own, a ?? null) : null);
  const g = geometry(look.shape);
  // Recorded as it plays, the video carries the reading alone: the questions are shown silent, and there is no music.
  const plan = useMemo(() => planWith(asked), [text, reading, look, own, asked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!reading) return;
    let live = true;
    setSound(null);
    void (async () => {
      try {
        const r = await decodeReading(await narrationBlob(reading.n));
        const a = asked ? await decodeReading(await narrationBlob(asked)) : null;
        if (live) setSound({ reading: r, asked: a });
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : 'The reading could not be loaded.');
      }
    })();
    return () => {
      live = false;
    };
  }, [reading, asked]);

  /** The questions read by the narrator, once, asked for with a tap; kept for every video after. */
  async function readQuestions() {
    if (!reading || !asking.length) return;
    setAskingNow(true);
    setError(null);
    try {
      setAsked(await narrationOf(reading.n.narratorId, asking, { generate: true }));
    } catch (err) {
      setError(`The questions could not be read: ${err instanceof Error ? err.message : 'MiniMax did not answer'}.`);
    } finally {
      setAskingNow(false);
    }
  }

  const changeOwn = (patch: Partial<Own>) =>
    setOwn((o) => {
      const next = { ...o, ...patch };
      try {
        stored.set(ownKey(text.id), JSON.stringify(next));
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
        stored.set(KEPT, JSON.stringify(next));
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

  function start(record: boolean) {
    if (!plan || !reading || !sound || !canvas.current) return;
    setError(null);
    const use = plan;
    const r = run({
      canvas: canvas.current,
      plan: use,
      timings: reading.n.timings,
      reading: sound.reading,
      asked: sound.asked,
      music: record ? look.music : 'off',
      record,
      from: record ? 0 : t >= use.duration - 50 ? 0 : t,
      draw: (m) => {
        const c = ctx();
        if (c) drawFrame(c, { text, book, plan: use, moment: m, look, pictures, lib });
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
          const made: KeptVideo = { textId: text.id, parts: blobs, duration: use.duration, narrator: reading.name, at: Date.now(), shape: look.shape };
          void keepVideo(made);
          setVideo(withUrls(made));
          setShown(0);
          setWatching(false);
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

  // The thumbnail, made as soon as the video is: the cover, the chapter large, the signature.
  useEffect(() => {
    if (mode !== 'done' || !video) return;
    let live = true;
    const cover = plan?.cover ? (pictures.get(plan.cover) ?? null) : null;
    void makeThumbnail({ title: text.titleZh || text.title, book, cover, look: { ...look, shape: video.shape ?? '9:16' } }).then((b) => {
      if (live && b) setThumb({ url: URL.createObjectURL(b), blob: b });
    });
    return () => {
      live = false;
    };
  }, [mode, video]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void (thumb && URL.revokeObjectURL(thumb.url)), [thumb]);

  async function saveThumbnail() {
    if (!thumb) return;
    const file = new File([thumb.blob], `${text.titleZh || text.title} cover.jpg`, { type: 'image/jpeg' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = thumb.url;
    a.download = file.name;
    a.click();
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
          <span className="tiny muted">{look.shape}</span>
        </header>

        <div className="vs-body">
          <div className="vs-stage">
            {mode === 'done' && video ? (
              <div className="vs-box" data-shape={mode === 'done' && video ? (video.shape ?? '9:16') : look.shape}>
                {watching ? (
                  <video key={shown} className="vs-video" data-shape={video.shape ?? '9:16'} src={video.urls[shown]} controls playsInline autoPlay />
                ) : (
                  // Ready: the cover and a word, not a player to sit through.
                  <div className="vs-frame vs-ready" data-shape={video.shape ?? '9:16'}>
                    {plan?.cover && <img src={pictureUrl(plan.cover)} alt="" />}
                    <div className="vs-ready-note">
                      <span className="vs-ready-mark" aria-hidden>
                        <Icon name="check" size={28} />
                      </span>
                      <b>Ready</b>
                      <span className="small">
                        {mmss(video.duration)}
                        {video.parts.length > 1 ? `, ${video.parts.length} parts` : ''}
                      </span>
                      <button className="btn quiet sm" onClick={() => setWatching(true)}>
                        Watch it
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="vs-box" data-shape={mode === 'done' && video ? (video.shape ?? '9:16') : look.shape}>
                <div className="vs-frame" data-shape={look.shape}>
                  <canvas ref={canvas} width={g.w} height={g.h} aria-label="The video, as it will be" />
                  {safe && mode === 'idle' && look.shape === '9:16' && (
                    <>
                      <span className="vs-safe" style={{ top: 0, height: `${(g.safe.top / g.h) * 100}%`, left: 0, right: 0 }} />
                      <span className="vs-safe" style={{ bottom: 0, height: `${((g.h - g.safe.bottom) / g.h) * 100}%`, left: 0, right: 0 }} />
                      <span
                        className="vs-safe"
                        style={{ top: `${(g.safe.buttonsFrom / g.h) * 100}%`, bottom: `${((g.h - g.safe.bottom) / g.h) * 100}%`, right: 0, width: `${(g.safe.right / g.w) * 100}%` }}
                      />
                    </>
                  )}
                  {askingNow && (
                    <div className="vs-loader" role="status">
                      <span className="vs-spinner" aria-hidden />
                      <b>The narrator is reading the questions</b>
                      <span className="small muted">Once, up to a minute; kept for every video after</span>
                    </div>
                  )}
                  {mode === 'making' && plan && (
                    // Made out of sight: a loader over the canvas the frames are drawn on.
                    <div className="vs-loader" role="status">
                      <span className="vs-spinner" aria-hidden />
                      <b>{parts > 1 ? `Making part ${partNow + 1} of ${parts}` : 'Making the video'}</b>
                      <span className="vs-loader-pct">{Math.round((t / plan.duration) * 100)}%</span>
                      <div className="vs-bar">
                        <i style={{ width: `${Math.round((t / plan.duration) * 100)}%` }} />
                      </div>
                      <button className="btn quiet sm" onClick={stop}>
                        Stop
                      </button>
                    </div>
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
                  <button
                    className="rd-play"
                    onClick={() => (mode === 'playing' ? stop() : start(false))}
                    disabled={!sound || mode === 'making'}
                    aria-label={mode === 'playing' ? 'Pause' : 'Play the preview'}
                  >
                    <Icon name={mode === 'playing' ? 'pause' : 'play'} size={22} />
                  </button>
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
                  {mmss(video.duration)} · {video.shape === '16:9' ? '16:9, 1920 × 1080' : '9:16, 1080 × 1920'} · {(video.parts.reduce((n, b) => n + b.size, 0) / 1e6).toFixed(1)} MB · {video.narrator}
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
                  {video.parts.length > 1 ? `Save all ${video.parts.length} parts` : 'Save the video'}
                </button>
                <div className="vs-thumb">
                  <div className="vs-thumb-img" data-shape={video.shape ?? '9:16'}>{thumb && <img src={thumb.url} alt="The thumbnail" />}</div>
                  <span className="vs-thumb-text">
                    <b>Thumbnail</b>
                    <span className="tiny muted">The cover with the chapter's name, for YouTube or a feed to show before it plays.</span>
                    <button className="btn tonal sm" onClick={() => void saveThumbnail()} disabled={!thumb}>
                      Save the thumbnail
                    </button>
                  </span>
                </div>
                <button
                  className="btn tonal"
                  onClick={() => {
                    setWatching(false);
                    setMode('idle');
                  }}
                >
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
                questionsRead={Boolean(asked)}
                quick
                onReadQuestions={() => void readQuestions()}
                readingQuestions={askingNow}
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
            <button className="btn primary lg" onClick={() => start(true)} disabled={!plan || !sound || busy || !canRecord()}>
              {mode === 'making' ? 'Making…' : 'Make the video'}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
