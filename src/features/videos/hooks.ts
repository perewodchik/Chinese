import { useMemo } from 'react';
import { notebookConfusions } from '../../domain/dictation';
import { charsOf } from '../../domain/ids';
import { transcriptWords, type Video } from '../../domain/video';
import { videoFit, type VideoFit } from '../../domain/videoFit';
import type { Learner } from '../../domain/videoPrompt';
import { wordInventory } from '../../domain/words';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';
import { useWordKnowledge } from '../words/useWordKnowledge';

/** The words Claude marked "skip" on any part: names and noises, not counted against the video. */
export function skippedWords(v: Video): Set<string> {
  const out = new Set<string>();
  for (const pack of Object.values(v.packs)) for (const w of pack.words) if (w.verdict === 'skip') out.add(w.w);
  return out;
}

/** How well a set of lines fits today — the whole video, or one part. */
export function useFit(v: Video | null, lines = v?.lines ?? []): VideoFit | null {
  const lib = useLibrary();
  const knowledge = useWordKnowledge();
  const learned = useStore((s) => s.learned);
  const target = useStore((s) => s.settings.targetHsk);
  return useMemo(() => {
    if (!v || !lines.length) return null;
    return videoFit(lines, lib, knowledge, {
      target,
      knownChars: charsOf(learned),
      ignore: skippedWords(v),
      names: transcriptWords(v.lines, lib),
    });
  }, [v, lines, lib, knowledge, learned, target]);
}

/** Every video's fit at once, for the shelf: sorted by it, the cards must not jump when it arrives. */
export function useFits(videos: readonly Video[]): Map<string, VideoFit | null> {
  const lib = useLibrary();
  const knowledge = useWordKnowledge();
  const learned = useStore((s) => s.learned);
  const target = useStore((s) => s.settings.targetHsk);
  return useMemo(() => {
    const known = charsOf(learned);
    return new Map(
      videos.map((v) => [
        v.id,
        v.lines.length
          ? videoFit(v.lines, lib, knowledge, { target, knownChars: known, ignore: skippedWords(v), names: transcriptWords(v.lines, lib) })
          : null,
      ]),
    );
  }, [videos, lib, knowledge, learned, target]);
}

/** Who the learner is, for a prompt: band, words, characters, the sounds they mix up. */
export function useLearner(): Learner {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const learned = useStore((s) => s.learned);
  const band = useStore((s) => s.settings.targetHsk);
  const videos = useStore((s) => s.videos);
  return useMemo(() => {
    const inv = wordInventory(lib, recall, Date.now());
    const weak = notebookConfusions(videos, Date.now() - 60 * 864e5).flatMap((n) => n.examples);
    return { band, known: inv.known, learning: inv.learning, chars: [...charsOf(learned)], weak };
  }, [lib, recall, learned, band, videos]);
}
