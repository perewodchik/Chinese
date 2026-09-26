import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  clock,
  latestChecks,
  thumbnailOf,
  touchedAt,
  VIDEO_STATUSES,
  playlistIdOf,
  youTubeId,
  type Video,
  type VideoStatus,
} from '../../domain/video';
import { checkScore } from '../../domain/dictation';
import type { VideoFit } from '../../domain/videoFit';
import { oneOf, useQuery } from '../../navigation/query';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { FitChips, newWordsLine } from './FitChips';
import { useFits } from './hooks';
import { SUGGESTIONS } from './suggestions';
import './videos.css';

const SORTS = [
  { id: 'fit', label: 'Best fit' },
  { id: 'recent', label: 'Recent' },
] as const;

const SHOWS = ['all', 'working', 'want', 'done', 'shelved'] as const;

/**
 * The shelf: every video being studied, each with how well it fits today.
 *
 * The videos are watched on YouTube and worked on here, with a paper notebook
 * — the pinyin written by hand, checked against the video's own. So the shelf
 * is mostly the question "which one next?": the fit says how much of it is
 * already yours, and the dots under each say how far the notebook has got.
 */
export function VideosPage() {
  useTitle('Videos');
  const videos = useStore((s) => s.videos);
  const navigate = useNavigate();
  const [query, setQuery] = useQuery();
  const show = oneOf(query.get('show'), SHOWS, 'all');
  const sort = oneOf(query.get('sort'), ['fit', 'recent'] as const, 'fit');
  const [link, setLink] = useState('');
  const id = youTubeId(link);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: videos.length };
    for (const v of videos) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [videos]);

  const shown = useMemo(() => {
    const list = videos.filter((v) => show === 'all' || v.status === show);
    // Recent is the order things were last touched; best fit is decided per
    // card (it needs the fit), so here it only keeps the ones in hand first.
    const rank: Record<VideoStatus, number> = { working: 0, want: 1, done: 2, shelved: 3 };
    return [...list].sort((a, b) =>
      sort === 'recent' ? touchedAt(b) - touchedAt(a) : rank[a.status] - rank[b.status] || touchedAt(b) - touchedAt(a),
    );
  }, [videos, show, sort]);

  const ideas = SUGGESTIONS.filter((s) => !videos.some((v) => v.source.kind === 'youtube' && v.source.videoId === s.videoId));

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (id || playlistIdOf(link)) navigate(paths.addVideo(link.trim()));
  }

  return (
    <section className="videos">
      <div className="row videos-head">
        <div>
          <h1 style={{ margin: 0 }}>Videos</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            Watch on YouTube, then work on it here: write the pinyin in your notebook and check it.
          </p>
        </div>
      </div>

      <form className="video-add-bar" onSubmit={add}>
        <input
          type="text"
          inputMode="url"
          placeholder="Paste a YouTube link to add a video"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-label="YouTube link"
        />
        <button className="btn primary" disabled={!id && !playlistIdOf(link)}>
          Add
        </button>
      </form>
      {link.trim() && !id && !playlistIdOf(link) && <p className="tiny muted video-add-hint">That does not look like a YouTube link yet.</p>}

      {videos.length > 0 && (
        <div className="videos-bar">
          <div className="chips videos-chips">
            {SHOWS.map((s) =>
              s === 'all' || counts[s] ? (
                <button key={s} className="chip" aria-pressed={show === s} onClick={() => setQuery('show', s, 'all')}>
                  {s === 'all' ? 'All' : VIDEO_STATUSES.find((x) => x.id === s)!.label}
                  <span className="count">{counts[s] ?? 0}</span>
                </button>
              ) : null,
            )}
          </div>
          <div className="spacer" />
          <Seg size="sm" value={sort} options={SORTS} onChange={(v) => setQuery('sort', v, 'fit')} label="Order" />
        </div>
      )}

      {videos.length === 0 ? (
        <div className="empty">
          <div className="big hanzi">视</div>
          <p>No videos yet. Paste a link above, or start with one of these.</p>
        </div>
      ) : (
        <Grid videos={shown} byFit={sort === 'fit'} />
      )}

      {ideas.length > 0 && (
        <section className="video-ideas">
          <h2 className="videos-label">Good ones to start with</h2>
          <div className="video-idea-list">
            {ideas.map((s) => (
              <div key={s.videoId} className="video-idea">
                <img src={`https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`} alt="" loading="lazy" />
                <span className="video-idea-text">
                  <b>{s.title}</b>
                  <span className="tiny muted">
                    {s.channel} · {s.why}
                  </span>
                </span>
                <Link className="btn sm" to={paths.addVideo(`https://youtu.be/${s.videoId}`)}>
                  Look at it
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function Grid({ videos, byFit }: { videos: Video[]; byFit: boolean }) {
  const fits = useFits(videos);
  const ordered = useMemo(() => {
    if (!byFit) return videos;
    const rank: Record<VideoStatus, number> = { working: 0, want: 1, done: 2, shelved: 3 };
    const cover = (v: Video) => fits.get(v.id)?.coverage ?? -1;
    return [...videos].sort((a, b) => rank[a.status] - rank[b.status] || cover(b) - cover(a));
  }, [videos, byFit, fits]);
  return (
    <div className="video-grid">
      {ordered.map((v) => (
        <VideoCard key={v.id} video={v} fit={fits.get(v.id) ?? null} />
      ))}
    </div>
  );
}

function VideoCard({ video: v, fit }: { video: Video; fit: VideoFit | null }) {
  const thumb = thumbnailOf(v);
  const checked = latestChecks(v);
  const status = VIDEO_STATUSES.find((s) => s.id === v.status)!.label;

  return (
    <Link className="video-card" to={paths.video(v.id)} data-status={v.status}>
      <span className="video-thumb">{thumb && <img src={thumb} alt="" loading="lazy" />}</span>
      <span className="video-card-body">
        <b className="video-card-title">{v.title}</b>
        <span className="tiny muted video-card-meta">
          {[v.channel, v.seconds ? clock(v.seconds) : null, status].filter(Boolean).join(' · ')}
        </span>
        <FitChips fit={fit} compact />
        <span className="tiny muted">
          {v.textFrom === 'waiting' ? 'Waiting for its text' : v.textFrom === 'none' ? 'Needs its text: open it to get it from Gemini' : newWordsLine(fit)}
        </span>
        {v.parts.length > 0 && (
          <span className="part-dots" aria-label="Parts checked in the notebook">
            {v.parts.map((_, i) => {
              const c = checked.get(i);
              return (
                <i
                  key={i}
                  data-state={c ? (checkScore(c) >= 0.8 ? 'right' : 'close') : undefined}
                  title={c ? `Part ${i + 1}: ${Math.round(checkScore(c) * 100)}%` : `Part ${i + 1}: not checked yet`}
                />
              );
            })}
          </span>
        )}
      </span>
    </Link>
  );
}
