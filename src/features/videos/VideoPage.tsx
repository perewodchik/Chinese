import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { lookUpYouTube } from '../../api/videos';
import { checkScore } from '../../domain/dictation';
import {
  clock,
  latestChecks,
  partLines,
  VIDEO_STATUSES,
  videoFromLookup,
  watchUrl,
  type Video,
  type VideoStatus,
} from '../../domain/video';
import { paths, VIDEO_STEPS, type VideoStep } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { addVideo, deleteVideo, patchVideo } from '../../store/videoCommands';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { AskStep } from './AskStep';
import { CheckStep } from './CheckStep';
import { FitChips } from './FitChips';
import { useFit } from './hooks';
import { SayStep } from './SayStep';
import { StudyStep } from './StudyStep';
import { WatchStep } from './WatchStep';
import { WordsStep } from './WordsStep';
import { WriteStep } from './WriteStep';
import { VideoContext, type VideoCtx } from './context';
import { YouTubePlayer, type PlayerHandle, type PlayerState } from './YouTubePlayer';
import './videos.css';

const STEP_LABEL: Record<VideoStep, string> = {
  watch: 'Watch',
  write: 'Write',
  check: 'Check',
  words: 'Words',
  study: 'Study',
  ask: 'Ask',
  say: 'Say it',
};



/**
 * One video, worked on a part at a time.
 *
 * Every step is optional — the method is a menu, not a course: watch it and
 * say how much made sense; write it out in the notebook a line at a time and
 * check it; take its new words; read what Claude made of it; ask about it;
 * say it. The player stays on the page (hidden where it is not needed) so
 * moving between steps never reloads the video.
 */
export function VideoPage() {
  const { videoId = '' } = useParams();
  const video = useStore((s) => s.videos.find((v) => v.id === videoId) ?? null);
  const lib = useLibrary();
  const navigate = useNavigate();
  const [query, setQuery] = useQuery();
  const step = oneOf(query.get('do'), VIDEO_STEPS, 'watch');
  const partCount = video?.parts.length ?? 0;
  const part = Math.min(Math.max(0, Number(query.get('part') ?? 1) - 1 || 0), Math.max(0, partCount - 1));
  useTitle(video?.title ?? 'Video');

  const player = useRef<PlayerHandle>(null);
  const [state, setState] = useState<PlayerState>({ ready: false, playing: false, time: 0, blocked: false });
  const [filling, setFilling] = useState<string | null>(null);

  const lines = useMemo(() => (video ? partLines(video, part) : []), [video, part]);
  const fit = useFit(video, lines);

  // A video kept as a bare link — YouTube would not answer the server it was
  // added from. This device may have better luck; if so, the text arrives.
  const waiting = video?.textFrom === 'waiting' && !video.lines.length && video.source.kind === 'youtube';
  useEffect(() => {
    if (!waiting || !video || video.source.kind !== 'youtube') return;
    let live = true;
    setFilling('Fetching its captions…');
    lookUpYouTube(video.source.videoId)
      .then((found) => {
        if (!live) return;
        if (found.chinese) {
          addVideo(videoFromLookup(found, lib, Date.now()));
          setFilling(null);
        } else setFilling('It has no Chinese captions. Paste its text on the Add page.');
      })
      .catch(() => live && setFilling('YouTube would not give the captions here either. Paste the text on the Add page.'));
    return () => {
      live = false;
    };
  }, [waiting, video, lib]);

  if (!video) {
    return (
      <div className="empty">
        <div className="big hanzi">空</div>
        <p>That video is not on your shelf.</p>
        <Link className="btn" to={paths.videos()}>
          Back to videos
        </Link>
      </div>
    );
  }

  const v = video;
  const offset = v.parts[part]?.from ?? 0;
  const youTube = v.source.kind === 'youtube' ? v.source.videoId : null;
  const timed = lines.some((l) => l.end > 0);
  const checked = latestChecks(v);

  const ctx: VideoCtx = {
    video: v,
    part,
    lines,
    offset,
    pack: v.packs[part],
    canPlay: !!youTube && timed,
    player: state,
    playLine: (i) => {
      const l = lines[i];
      if (l) player.current?.play(l.at, l.end);
    },
    playPart: () => {
      if (lines.length) player.current?.play(lines[0]!.at, lines[lines.length - 1]!.end);
    },
    go: (s) => setQuery('do', s, 'watch'),
  };

  // The player is on the steps that use it and kept (hidden) on the others.
  const showPlayer = step === 'watch' || step === 'write' || step === 'say';

  return (
    <VideoContext.Provider value={ctx}>
      <section className="videos video-page" data-step={step}>
        <div className="video-top">
          <Link className="btn ghost sm" to={paths.videos()}>
            ← Videos
          </Link>
          <div className="spacer" />
          {youTube && (
            <a className="btn sm ghost" href={watchUrl(v, lines[0]?.at) ?? '#'} target="_blank" rel="noreferrer">
              Open in YouTube
            </a>
          )}
          <button
            className="btn sm ghost"
            onClick={() => {
              if (window.confirm(`Take “${v.title}” off your shelf, with its checks and notes?`)) {
                deleteVideo(v.id);
                navigate(paths.videos(), { replace: true });
              }
            }}
          >
            Remove
          </button>
        </div>
        <h1 className="video-title">{v.title}</h1>
        <p className="small muted video-sub">
          {[v.channel, v.seconds ? clock(v.seconds) : null, `${v.lines.length} lines`].filter(Boolean).join(' · ')}
          {v.textFrom === 'captions-auto' && ' · automatic captions, may have mistakes'}
          {v.textFrom === 'pasted' && ' · text pasted in'}
        </p>

        <div className="video-bar">
          <FitChips fit={fit} />
          <div className="spacer" />
          <Seg<VideoStatus>
            size="sm"
            value={v.status}
            options={VIDEO_STATUSES.map((s) => ({ id: s.id, label: s.id === 'want' ? 'Want' : s.id === 'working' ? 'Working' : s.id === 'done' ? 'Done' : 'Aside', title: s.label }))}
            onChange={(status) => patchVideo(v.id, { status })}
            label="Status"
          />
        </div>

        {filling && <p className="notice">{filling}</p>}

        {v.parts.length > 1 && (
          <div className="chips video-parts" role="group" aria-label="Part">
            {v.parts.map((p, i) => {
              const c = checked.get(i);
              return (
                <button
                  key={i}
                  className="chip"
                  aria-pressed={i === part}
                  data-state={c ? (checkScore(c) >= 0.8 ? 'right' : 'close') : undefined}
                  onClick={() => setQuery('part', i ? String(i + 1) : null)}
                >
                  Part {i + 1}
                  <span className="count">
                    {p.from + 1}–{p.to}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <nav className="video-steps" aria-label="What to do">
          {VIDEO_STEPS.map((s) => (
            <button key={s} aria-current={s === step ? 'page' : undefined} onClick={() => ctx.go(s)} data-done={stepDone(v, part, s) || undefined}>
              {STEP_LABEL[s]}
            </button>
          ))}
        </nav>

        {youTube && (
          <div className="video-player" hidden={!showPlayer}>
            <YouTubePlayer
              ref={player}
              videoId={youTube}
              onState={setState}
            />
            {state.blocked && (
              <p className="tiny muted video-blocked">
                Tap play inside the video once — the iPad wants the first play to be yours. After that the buttons work.
              </p>
            )}
          </div>
        )}

        {!v.lines.length ? (
          <div className="empty">
            <div className="big hanzi">字</div>
            <p>This video has no text yet, so there is nothing to write out or check.</p>
            {youTube && (
              <Link className="btn" to={paths.addVideo(`https://youtu.be/${youTube}`)}>
                Paste its text
              </Link>
            )}
          </div>
        ) : step === 'watch' ? (
          <WatchStep />
        ) : step === 'write' ? (
          <WriteStep />
        ) : step === 'check' ? (
          <CheckStep />
        ) : step === 'words' ? (
          <WordsStep />
        ) : step === 'study' ? (
          <StudyStep />
        ) : step === 'ask' ? (
          <AskStep />
        ) : (
          <SayStep />
        )}
      </section>
    </VideoContext.Provider>
  );
}

/** A small dot on a step: done for this part, as far as the records show. */
function stepDone(v: Video, part: number, s: VideoStep): boolean {
  switch (s) {
    case 'watch':
      return v.marks.watched > 0;
    case 'write':
    case 'check':
      return v.checks.some((c) => c.part === part);
    case 'words':
      return !!v.marks.words;
    case 'study':
      return !!v.packs[part];
    case 'ask':
      return v.asks.some((a) => a.part === part);
    case 'say':
      return !!v.marks.said;
  }
}
