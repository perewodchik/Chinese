import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { PlaylistLookup, VideoLookup } from '../../../shared/videos';
import { ApiError } from '../../api/http';
import { lookUpPlaylist, lookUpYouTube } from '../../api/videos';
import {
  autoParts,
  clock,
  linesFromText,
  thumbnailOf,
  videoFromLookup,
  videoKey,
  waitingVideo,
  playlistIdOf,
  youTubeId,
  type Video,
} from '../../domain/video';
import { paths } from '../../navigation/paths';
import { useQuery } from '../../navigation/query';
import { addVideo } from '../../store/videoCommands';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { FitChips, newWordsLine } from './FitChips';
import { useFit } from './hooks';
import './videos.css';

type Look =
  | { state: 'idle' }
  | { state: 'looking' }
  | { state: 'found'; found: VideoLookup }
  | { state: 'failed'; message: string };

/**
 * Adding a video: a link in, a look at how well it fits, then onto the shelf.
 *
 * The fit is shown *before* it is added, because the question when a video
 * is found is "is this one for me yet?", and the answer is in its words. When
 * YouTube will not hand over Chinese captions — the channel burned them into
 * the picture, or YouTube refused the server — the text can be pasted in, or
 * the link kept for the home computer to fill in.
 */
export function AddVideoPage() {
  useTitle('Add a video');
  const lib = useLibrary();
  const navigate = useNavigate();
  const videos = useStore((s) => s.videos);
  const [query, setQuery] = useQuery();
  const [link, setLink] = useState(query.get('url') ?? '');
  const id = youTubeId(link);
  const list = playlistIdOf(link);
  const [look, setLook] = useState<Look>({ state: 'idle' });
  const [pasted, setPasted] = useState('');
  const [pasting, setPasting] = useState(false);
  const already = id ? videos.find((v) => v.id === videoKey(id)) : undefined;

  // A link that arrives filled in (from the shelf, from an idea) is looked up at once.
  useEffect(() => {
    if (!id) {
      setLook({ state: 'idle' });
      return;
    }
    let live = true;
    setLook({ state: 'looking' });
    lookUpYouTube(id)
      .then((found) => live && setLook({ state: 'found', found }))
      .catch((err: unknown) => {
        if (!live) return;
        const message =
          err instanceof ApiError && err.code !== 'network'
            ? err.message
            : 'The server could not be reached. Check the connection and try again.';
        setLook({ state: 'failed', message });
      });
    return () => {
      live = false;
    };
  }, [id]);

  const now = useMemo(() => Date.now(), []);

  /** What would go on the shelf: from the captions, or from pasted text on top of what YouTube said. */
  const draft: Video | null = useMemo(() => {
    if (!id) return null;
    const base = look.state === 'found' ? videoFromLookup(look.found, lib, now) : waitingVideo(id, now);
    if (!pasting || !pasted.trim()) return base.lines.length ? base : null;
    const lines = linesFromText(pasted, lib);
    if (!lines.length) return null;
    return { ...base, lines, parts: autoParts(lines), textFrom: 'pasted' };
  }, [id, look, pasting, pasted, lib, now]);

  const fit = useFit(draft);
  const needsText = look.state === 'failed' || (look.state === 'found' && !look.found.chinese);

  function add(v: Video) {
    addVideo(v);
    navigate(paths.video(v.id), { replace: true });
  }

  async function readFile(file: File) {
    setPasting(true);
    setPasted(await file.text());
  }

  return (
    <section className="videos video-add">
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn ghost sm" to={paths.videos()}>
          ← Videos
        </Link>
      </div>
      <h1 style={{ margin: '0 0 12px' }}>Add a video</h1>

      <div className="video-add-bar">
        <input
          type="text"
          inputMode="url"
          autoFocus={!link}
          placeholder="Paste a YouTube link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setQuery('url', e.target.value.trim() || null);
          }}
          aria-label="YouTube link"
        />
      </div>
      {link.trim() && !id && !list && <p className="tiny muted video-add-hint">That does not look like a YouTube link yet.</p>}

      {list && <PlaylistCard playlistId={list} />}

      {already && (
        <p className="notice">
          This one is on your shelf already. <Link to={paths.video(already.id)}>Open it</Link>
        </p>
      )}

      {look.state === 'looking' && <p className="small muted">Asking YouTube for its captions…</p>}

      {look.state === 'failed' && <p className="notice error">{look.message}</p>}

      {look.state === 'found' && (
        <div className="video-preview card">
          <div className="video-preview-head">
            <span className="video-thumb">
              <img src={thumbnailOf({ source: { kind: 'youtube', videoId: look.found.videoId } })!} alt="" />
            </span>
            <span className="video-preview-meta">
              <b>{look.found.title}</b>
              <span className="tiny muted">
                {look.found.channel}
                {look.found.seconds ? ` · ${clock(look.found.seconds)}` : ''}
              </span>
              <span className="tiny muted">
                {look.found.chinese
                  ? look.found.chinese.source === 'captions'
                    ? `Chinese captions made by the channel · ${draft?.lines.length ?? 0} lines`
                    : `Only YouTube's automatic Chinese captions · ${draft?.lines.length ?? 0} lines · they may have mistakes`
                  : `No Chinese captions${look.found.languages.length ? ` (it has: ${look.found.languages.join(', ')})` : ''}.`}
              </span>
            </span>
          </div>
        </div>
      )}

      {needsText && id && !pasting && (
        <div className="video-need-text">
          <p className="small">
            {look.state === 'found'
              ? 'Its Chinese is probably written into the picture. Paste the text in — from the channel’s transcript, or typed from the screen — and it can be worked on like any other.'
              : 'Paste the text in, or keep the link: opening it on the home computer fetches its captions there.'}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => setPasting(true)}>
              Paste the text
            </button>
            {look.state === 'failed' && !already && (
              <button className="btn" onClick={() => add(waitingVideo(id, Date.now()))}>
                Keep the link for now
              </button>
            )}
          </div>
        </div>
      )}

      {pasting && (
        <div className="video-paste card">
          <header>
            <h2>The video’s text</h2>
          </header>
          <div className="body">
            <p className="tiny muted" style={{ marginTop: 0 }}>
              A line of Chinese per line (pinyin and English on the lines after it are fine), or an .srt / .vtt subtitle
              file. With times, each line can be played on its own.
            </p>
            <textarea rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="我家有一只猫。" />
            <label className="btn sm ghost" style={{ marginTop: 8 }}>
              Open a subtitle file
              <input
                type="file"
                accept=".srt,.vtt,.txt,text/plain"
                hidden
                onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      )}

      {draft && draft.lines.length > 0 && (
        <div className="video-fit-card card">
          <header>
            <h2>How it fits you</h2>
          </header>
          <div className="body">
            <FitChips fit={fit} />
            <p className="small" style={{ margin: '8px 0 4px' }}>
              {fit && `${Math.round(fit.coverage * 100)}% of the ${fit.words} words said are ones you know or are learning.`}{' '}
              {newWordsLine(fit)}.
              {fit?.perSecond ? ` About ${fit.perSecond} characters a second.` : ''}
            </p>
            {fit && fit.newInBand.length > 0 && (
              <div className="video-word-row">
                <span className="tiny muted">Worth learning:</span>
                {fit.newInBand.slice(0, 12).map((w) => (
                  <span key={w.w} className="word-pill hanzi">
                    {w.w}
                  </span>
                ))}
              </div>
            )}
            {fit && fit.newAbove.length > 0 && (
              <div className="video-word-row">
                <span className="tiny muted">Harder:</span>
                {fit.newAbove.slice(0, 10).map((w) => (
                  <span key={w.w} className="word-pill hanzi" data-above>
                    {w.w}
                  </span>
                ))}
              </div>
            )}
            <ol className="video-first-lines">
              {draft.lines.slice(0, 6).map((l, i) => (
                <li key={i}>
                  <span className="hanzi">{l.zh}</span>
                  <span className="tiny video-py">{l.py}</span>
                </li>
              ))}
            </ol>
            <div className="row" style={{ gap: 8 }}>
              {already && already.lines.length ? (
                <Link className="btn primary" to={paths.video(already.id)}>
                  Open it
                </Link>
              ) : already ? (
                <button className="btn primary" onClick={() => add(draft)}>
                  Give it this text
                </button>
              ) : (
                <button className="btn primary" onClick={() => add({ ...draft, added: Date.now(), updatedAt: Date.now() })}>
                  Add to my videos
                </button>
              )}
              <Link className="btn ghost" to={paths.videos()}>
                Not now
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type Adding = { done: number; total: number; added: number; noText: number; failed: number } | null;

/**
 * A playlist in the link: all its videos onto the shelf in one go.
 *
 * Each is looked up for its captions one after another — a playlist of
 * twenty is a minute — and added with its text where YouTube has Chinese
 * captions. Where it has none (the text is in the picture, as on Mandarin
 * Click) the video still goes on the shelf, named and timed, waiting for its
 * text to be pasted in. Videos already on the shelf are left as they are.
 */
function PlaylistCard({ playlistId }: { playlistId: string }) {
  const lib = useLibrary();
  const videos = useStore((s) => s.videos);
  const [found, setFound] = useState<PlaylistLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Adding>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => void (live.current = false);
  }, []);

  useEffect(() => {
    let on = true;
    setFound(null);
    setError(null);
    lookUpPlaylist(playlistId)
      .then((p) => on && setFound(p))
      .catch((err: unknown) => on && setError(err instanceof ApiError ? err.message : 'The server could not be reached.'));
    return () => {
      on = false;
    };
  }, [playlistId]);

  const have = new Set(videos.map((v) => v.id));
  const fresh = found?.videos.filter((v) => !have.has(videoKey(v.videoId))) ?? [];

  async function addAll() {
    const todo = fresh;
    const tally = { done: 0, total: todo.length, added: 0, noText: 0, failed: 0 };
    setAdding({ ...tally });
    for (const item of todo) {
      if (!live.current) return;
      try {
        const lookup = await lookUpYouTube(item.videoId);
        const v = videoFromLookup(lookup, lib, Date.now());
        addVideo({ ...v, title: v.title || item.title });
        if (v.lines.length) tally.added++;
        else tally.noText++;
      } catch {
        addVideo(waitingVideo(item.videoId, Date.now(), item));
        tally.failed++;
      }
      tally.done++;
      if (live.current) setAdding({ ...tally });
    }
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!found) return <p className="small muted">Reading the playlist…</p>;

  return (
    <div className="card video-playlist">
      <header>
        <h2>
          Playlist: {found.title} · {found.videos.length} videos
        </h2>
      </header>
      <div className="body">
        <ol className="video-playlist-list">
          {found.videos.map((v) => (
            <li key={v.videoId} data-have={have.has(videoKey(v.videoId)) || undefined}>
              <span className="small">{v.title}</span>
              <span className="tiny muted">
                {v.seconds ? clock(v.seconds) : ''}
                {have.has(videoKey(v.videoId)) ? ' · on your shelf' : ''}
              </span>
            </li>
          ))}
        </ol>
        {found.more && <p className="tiny muted">The playlist is longer than could be read; the first {found.videos.length} are here.</p>}
        {adding ? (
          <p className="small" aria-live="polite">
            {adding.done < adding.total ? `Adding ${adding.done + 1} of ${adding.total}…` : `Done: ${adding.total} added.`}
            {adding.added > 0 && ` ${adding.added} with their Chinese captions.`}
            {adding.noText > 0 && ` ${adding.noText} have no Chinese captions (the text is in the picture) — paste their text when you work on them.`}
            {adding.failed > 0 && ` ${adding.failed} could not be looked up and were kept as links.`}{' '}
            {adding.done === adding.total && <Link to={paths.videos()}>See them on the shelf</Link>}
          </p>
        ) : (
          <button className="btn primary" disabled={!fresh.length} onClick={() => void addAll()}>
            {fresh.length ? `Add all ${fresh.length}${fresh.length < found.videos.length ? ' not yet on your shelf' : ''}` : 'All on your shelf already'}
          </button>
        )}
      </div>
    </div>
  );
}
