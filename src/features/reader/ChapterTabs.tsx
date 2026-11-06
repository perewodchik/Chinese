import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { GeneratedText } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { bestByLine } from '../pinyin/speechHistory';

/** A chapter's tabs: the text, and what there is to do with it. */
export type ChapterTab = 'read' | 'write' | 'speak' | 'words' | 'questions';

export interface TabInfo {
  id: ChapterTab;
  han: string;
  label: string;
  /** how far it has got, 0 to 1 */
  fill: number;
}

/** Which tab an address's #part opens on: the old parts and what opens over them map to their tab. */
export function tabOfHash(hash: string): ChapterTab {
  if (hash === 'write' || hash === 'copy' || hash === 'more' || hash === 'dictation') return 'write';
  if (hash === 'speak' || hash === 'words' || hash === 'questions') return hash;
  return 'read';
}

/**
 * The chapter's tabs: along the bottom on a phone, where the app's own are
 * on other pages, and in the bar on a wider page. Each says how far it has
 * got with a short line in jade under its name.
 */
export function ChapterTabs({ tabs, current, onPick, place }: { tabs: TabInfo[]; current: ChapterTab; onPick: (t: ChapterTab) => void; place: 'bottom' | 'bar' }) {
  return (
    <nav className={`rd-tabs no-print`} data-place={place} aria-label="This chapter">
      {tabs.map((t) => (
        <button
          key={t.id}
          className="rd-tab"
          aria-current={current === t.id ? 'page' : undefined}
          onClick={() => onPick(t.id)}
          style={{ '--fill': `${Math.round(t.fill * 100)}%` } as CSSProperties}
          title={`${t.label}: ${t.fill >= 1 ? 'done' : t.fill > 0 ? 'started' : 'not yet'}`}
        >
          <span className="rd-tab-han hanzi" aria-hidden>
            {t.han}
          </span>
          <span className="rd-tab-label">{t.label}</span>
          <span className="rd-tab-fill" aria-hidden />
        </button>
      ))}
    </nav>
  );
}

/** Each line's best score among the account's tries, by the line's text; loaded once a text is open. */
export function useLineBests(textId: string): Record<string, number> {
  const [bests, setBests] = useState<Record<string, number>>({});
  useEffect(() => {
    let live = true;
    bestByLine().then(
      (b) => live && setBests(b),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [textId]);
  return bests;
}

/** How a score reads: jade when it is good, gold when nearly, the red pen when not yet. */
const scoreState = (n: number) => (n >= 80 ? 'right' : n >= 60 ? 'nearly' : 'wrong');

/**
 * 说 Speak: the text said line by line after the narrator, each line scored
 * character by character on the speaking page. Here, each line with its best
 * score so far, and the button to the first line not said yet.
 */
export function SpeakPart({ text, bests }: { text: GeneratedText; bests: Record<string, number> }) {
  const lines = text.lines.map((l, i) => ({ i, zh: l.zh, best: bests[l.zh] }));
  const said = lines.filter((l) => l.best !== undefined);
  const next = lines.find((l) => l.best === undefined) ?? null;
  const average = said.length ? Math.round(said.reduce((n, l) => n + l.best!, 0) / said.length) : null;
  return (
    <section className="rd-part rd-speak" id="part-speak">
      <header className="rd-part-head">
        <span className="hanzi" aria-hidden>
          说
        </span>
        <h2>Speak</h2>
        <span className="spacer" />
        <span className="rd-part-aside">
          {said.length} of {lines.length} said
        </span>
      </header>
      <p className="rd-part-lede">Say it line by line after the narrator; each line is scored, character by character.</p>
      {average !== null && (
        <div className="rd-speak-sum">
          <span className="rd-score" data-state={scoreState(average)}>
            {average}
          </span>
          <span>
            <b>
              {said.length} of {lines.length} lines said
            </b>
            <small>Their best scores, on average. Tap a line for its tries.</small>
          </span>
        </div>
      )}
      <ol className="rd-speak-lines">
        {lines.map((l) => (
          <li key={l.i}>
            <Link to={paths.speakingSay(text.id, l.i)} className="rd-speak-line">
              <span className="rd-speak-n">{l.i + 1}</span>
              <span className="hanzi" lang="zh">
                {l.zh}
              </span>
              <span className="rd-score" data-state={l.best === undefined ? undefined : scoreState(l.best)}>
                {l.best ?? '–'}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="rd-speak-go">
        <Link className="btn primary lg" to={paths.speakingSay(text.id, next?.i ?? 0)}>
          {next ? (said.length ? `Say line ${next.i + 1}` : 'Start saying it') : 'Say it again from the start'}
        </Link>
      </div>
    </section>
  );
}
