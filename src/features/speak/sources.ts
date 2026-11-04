import { useEffect, useMemo, useState } from 'react';
import type { NarratorDto, OwnTextDto } from '../../../shared/narration';
import { chooseNarrator, chosenNarrator, listNarrators, ownTexts } from '../../api/narration';
import { pinyinOf } from '../../domain/ownText';
import { EVERYDAY, type Phrase } from '../../domain/phrases';
import { shelve, type GeneratedText } from '../../domain/text';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';
import { accountKey } from '../../platform/accountStorage';

/**
 * What can be said in Speak: the learner's texts by shelf, as Read has them,
 * the everyday phrases, the texts written in Voices — and sets made for a
 * sitting (the lines to say again, the lines with one kind of fault), which
 * are frozen as they were when the sitting began, so a line that turns green
 * does not pull the next one out from under the learner.
 */

export interface Source {
  id: string;
  title: string;
  sub: string;
  phrases: Phrase[];
}

export interface Shelf {
  name: string;
  list: Source[];
}

/* ------------------------------------------------------------ sets made for a sitting */

const SETS = 'hanzi.speak.sets';
interface KeptSet {
  title: string;
  sub: string;
  lines: string[];
}
const readSets = (): Record<string, KeptSet> => {
  try {
    return (JSON.parse(localStorage.getItem(accountKey(SETS)) ?? '{}') as Record<string, KeptSet>) ?? {};
  } catch {
    return {};
  }
};

/** Keeps a set of lines under `id` for a sitting: `weak`, `fault:tone3`, `again:<text>`. */
export function keepSet(id: string, set: KeptSet) {
  try {
    localStorage.setItem(accountKey(SETS), JSON.stringify({ ...readSets(), [id]: set }));
  } catch {
    // kept for this visit only: the sitting still has it in the address's state
  }
}

export const isMadeSet = (id: string) => id === 'weak' || id.startsWith('fault:') || id.startsWith('again:');

/* ------------------------------------------------------------ the narrator */

let narratorList: Promise<NarratorDto[]> | null = null;
/** The learner's narrators, asked once a visit; an error leaves it to be asked again. */
export function narrators(fresh = false): Promise<NarratorDto[]> {
  if (!narratorList || fresh) {
    narratorList = listNarrators();
    narratorList.catch(() => (narratorList = null));
  }
  return narratorList;
}

/** The narrator who reads the examples (the one chosen on this device, else the first), and the way to choose another. */
export function useNarrator() {
  const [list, setList] = useState<NarratorDto[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [id, setId] = useState(chosenNarrator);
  useEffect(() => {
    let live = true;
    narrators().then(
      (l) => live && setList(l),
      (e: Error) => {
        if (!live) return;
        setList([]);
        setFailed(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  const narrator = list ? (list.find((n) => n.id === id) ?? list[0] ?? null) : null;
  return {
    list,
    narrator,
    failed,
    choose: (n: NarratorDto) => {
      chooseNarrator(n.id);
      setId(n.id);
    },
  };
}

/* ------------------------------------------------------------ the sources */

export function useSources() {
  const lib = useLibrary();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const [own, setOwn] = useState<OwnTextDto[] | null>(null);
  useEffect(() => {
    let live = true;
    ownTexts().then(
      (t) => live && setOwn(t),
      () => live && setOwn([]),
    );
    return () => {
      live = false;
    };
  }, []);

  // The shelves as Read has them, chapters in reading order; the shelf read most lately first.
  const shelves = useMemo((): Shelf[] => {
    const source = (t: GeneratedText): Source => ({
      id: t.id,
      title: t.titleZh || t.title,
      sub: t.titleZh && t.title !== t.titleZh ? t.title : '',
      phrases: t.lines.map((l) => ({ zh: l.zh, py: l.py, en: l.en })),
    });
    const { bySet, loose } = shelve(
      texts.filter((t) => t.lines.length),
      sets,
    );
    const lately = (list: GeneratedText[]) => Math.max(...list.map((t) => t.lastReadAt ?? t.createdAt));
    const groups = sets
      .filter((x) => bySet.get(x.id)?.length)
      .map((x) => ({ name: x.name, at: lately(bySet.get(x.id)!), list: bySet.get(x.id)!.map(source) }));
    if (loose.length) groups.push({ name: 'Other texts', at: lately(loose), list: loose.map(source) });
    return groups.sort((x, y) => y.at - x.at).map(({ name, list }) => ({ name, list }));
  }, [texts, sets]);

  const everyday = useMemo((): Source => ({ id: 'everyday', title: 'Everyday phrases', sub: 'Greetings, shopping, asking again', phrases: EVERYDAY }), []);
  const owns = useMemo(
    (): Source[] => (own ?? []).map((t) => ({ id: `own:${t.id}`, title: t.title || 'Untitled', sub: 'Written in Voices', phrases: t.lines.map((zh) => ({ zh, py: pinyinOf(zh, lib), en: '' })) })),
    [own, lib],
  );
  const base = useMemo(() => [...shelves.flatMap((g) => g.list), everyday, ...owns], [shelves, everyday, owns]);

  // Every line known by its characters, to make a set of lines from anywhere into phrases again.
  const byZh = useMemo(() => {
    const m = new Map<string, Phrase>();
    for (const s of base) for (const p of s.phrases) if (!m.has(p.zh) || (!m.get(p.zh)!.en && p.en)) m.set(p.zh, p);
    return m;
  }, [base]);
  const phraseOf = (zh: string): Phrase => byZh.get(zh) ?? { zh, py: pinyinOf(zh, lib), en: '' };

  const find = (id: string): Source | null => {
    if (isMadeSet(id)) {
      const kept = readSets()[id];
      return kept ? { id, title: kept.title, sub: kept.sub, phrases: kept.lines.map(phraseOf) } : null;
    }
    return base.find((x) => x.id === id) ?? null;
  };

  return { shelves, everyday, owns, ownLoaded: own !== null, find, phraseOf };
}
