import { useEffect, useState } from 'react';
import type { CaptionCue } from '../../../shared/videos';
import { lookUpYouTube } from '../../api/videos';
import { autoParts, linesFromText, type Video, type VideoLine } from '../../domain/video';
import { geminiPrompt } from '../../domain/transcribePrompt';
import { copyText } from '../../platform/clipboard';
import { useLibrary } from '../shared/library';

/**
 * Getting a video's Chinese from Gemini, for the videos YouTube has none for.
 *
 * Claude cannot hear or watch a video; Gemini takes the YouTube link and
 * listens. So this is the clipboard route the app uses for Claude on the
 * iPad, pointed at Gemini: copy the prompt, paste it into Gemini, paste the
 * SRT it writes back here. The video's English captions, fetched first, give
 * Gemini the times to line its Chinese up with, so each line plays on its own.
 */
export function TranscribeBox({ video, onLines }: { video: Video; onLines: (lines: VideoLine[], parts: Video['parts']) => void }) {
  const lib = useLibrary();
  const [english, setEnglish] = useState<CaptionCue[] | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const youTube = video.source.kind === 'youtube' ? video.source.videoId : null;

  // The English captions' times, fetched before the button is pressed: an
  // iPad only copies to the clipboard straight from a tap, not after a wait.
  useEffect(() => {
    if (!youTube) return;
    let live = true;
    lookUpYouTube(youTube)
      .then((found) => live && setEnglish(found.english))
      .catch(() => live && setEnglish(null));
    return () => {
      live = false;
    };
  }, [youTube]);

  if (!youTube) return null;

  const prompt = () =>
    geminiPrompt({ url: `https://www.youtube.com/watch?v=${youTube}`, title: video.title, seconds: video.seconds, english });

  async function copy() {
    const ok = await copyText(prompt());
    setCopied(ok);
    setProblem(ok ? null : 'The prompt could not be copied here. Try again.');
  }

  function use() {
    const lines = linesFromText(paste, lib);
    if (!lines.length) {
      setProblem('No Chinese lines were found in that. Paste the whole answer, with the SRT block.');
      return;
    }
    setProblem(null);
    onLines(lines, autoParts(lines));
  }

  return (
    <div className="card transcribe-box">
      <header>
        <h2>Get its text from Gemini</h2>
      </header>
      <div className="body">
        <p className="small" style={{ marginTop: 0 }}>
          Gemini can listen to a YouTube video; Claude cannot. Copy the prompt, paste it into Gemini, then paste
          Gemini’s whole answer below.
          {english === undefined
            ? ' Fetching the video’s caption times…'
            : english?.length
              ? ` The prompt lines Gemini up with the video’s ${english.length} English captions, so each line can be played on its own.`
              : ''}
        </p>
        <div className="claude-relay-row">
          <button className={`btn ${copied ? '' : 'primary'}`} disabled={english === undefined} onClick={() => void copy()}>
            {copied ? 'Copied — copy again' : 'Copy the prompt for Gemini'}
          </button>
          <a className="btn ghost" href="https://gemini.google.com/app" target="_blank" rel="noreferrer">
            Open Gemini
          </a>
        </div>
        <textarea
          className="claude-paste"
          rows={copied || paste ? 6 : 2}
          placeholder="Gemini’s answer (the SRT block)"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div>
          <button className={`btn sm ${paste.trim() ? 'primary' : ''}`} disabled={!paste.trim()} onClick={use}>
            Use this text
          </button>
        </div>
        {problem && <p className="notice error">{problem}</p>}
        <p className="tiny muted" style={{ margin: 0 }}>
          A machine’s hearing: when a line looks wrong, ask about it on the video’s Ask step, or correct its pinyin there.
        </p>
      </div>
    </div>
  );
}
