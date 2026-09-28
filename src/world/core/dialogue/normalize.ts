/**
 * What the player typed or said, made comparable.
 *
 * Input arrives three ways: hanzi from the speech recogniser or the system
 * keyboard, pinyin typed plain (`ditie zai nar`), or pinyin with tone numbers
 * (`di4tie3 zai4 na3r`). Everything ends up as trimmed hanzi without
 * punctuation, or as a list of toneless syllables — `['di', 'tie', 'zai', 'na']`.
 *
 * Erhua is dropped on both sides (哪儿 → `na`, `nar` → `na`), so 在哪儿,
 * 在哪 and `zai nar` all read the same.
 */

const HANZI = /[\u3400-\u4dbf\u4e00-\u9fff]/;
export const hasHanzi = (s: string) => HANZI.test(s);

/** Full-width latin and digits → half width, ideographic space → space. */
function halfWidth(s: string): string {
  return s.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ');
}

/** Punctuation of either script, and emoji-ish symbols, go. Apostrophes stay (xi'an). */
const PUNCT = /[\p{P}\p{S}]/gu;

/** Trimmed, half width, no punctuation, single spaces. */
export function clean(s: string): string {
  return halfWidth(s.normalize('NFC'))
    .replace(/['’]/g, "'")
    .replace(/[^\S\n]+/g, ' ')
    .replace(PUNCT, (c) => (c === "'" ? c : ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** The hanzi of a line with everything else removed — for comparing lines. */
export const hanziOnly = (s: string) => [...s].filter((c) => HANZI.test(c)).join('');

/** Toneless, lower case, ü as v: `nǚ` → `nv`, `lü` → `lv`. */
export function toneless(py: string): string {
  return py
    .normalize('NFD')
    .toLowerCase()
    // ü is u + a combining diaeresis once decomposed; keep it apart from u.
    .replace(/u\u0308|u:/g, 'v')
    .replace(/[\u0300-\u036f]/g, '');
}

/** One whole toneless syllable: an initial, if any, and a final. */
const SYLLABLE =
  /^(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ueng|iao|ian|uai|uan|van|ang|eng|ing|ong|ai|ei|ao|ou|an|en|in|un|vn|ia|ie|iu|ua|uo|ui|ve|a|o|e|i|u|v)$|^er$/;

export const isSyllable = (s: string) => SYLLABLE.test(s);

/**
 * A run of latin letters as toneless syllables, or null if it does not
 * split. Fewest syllables wins (`xian` is one, not `xi an`; write `xi'an`
 * for two); a syllable may carry an erhua `r`, which is dropped.
 */
export function splitRun(run: string): string[] | null {
  const n = run.length;
  // best[i] = [syllable count, erhua count] for run[0..i)
  const best: Array<[number, number] | null> = new Array(n + 1).fill(null);
  const from = new Array<number>(n + 1).fill(-1);
  const erAt = new Array<boolean>(n + 1).fill(false);
  best[0] = [0, 0];
  for (let j = 1; j <= n; j++) {
    for (let k = 1; k <= Math.min(7, j); k++) {
      const prev = best[j - k];
      if (!prev) continue;
      const piece = run.slice(j - k, j);
      let er = false;
      if (!isSyllable(piece)) {
        // 哪儿 typed as `nar`: the syllable, then an r that is only erhua.
        if (!(piece.length > 1 && piece.endsWith('r') && isSyllable(piece.slice(0, -1)))) continue;
        er = true;
      }
      const cand: [number, number] = [prev[0] + 1, prev[1] + (er ? 1 : 0)];
      const cur = best[j];
      if (!cur || cand[0] < cur[0] || (cand[0] === cur[0] && cand[1] < cur[1])) {
        best[j] = cand;
        from[j] = j - k;
        erAt[j] = er;
      }
    }
  }
  if (!best[n]) return null;
  const out: string[] = [];
  for (let j = n; j > 0; j = from[j]!) {
    const piece = run.slice(from[j]!, j);
    out.push(erAt[j] ? piece.slice(0, -1) : piece);
  }
  return out.reverse();
}

/**
 * Typed pinyin as toneless syllables, or null when it is not pinyin (English,
 * or letters that do not split). Tone numbers and tone marks are both fine.
 */
export function pinyinSyllables(input: string): string[] | null {
  const s = clean(input);
  if (!s || hasHanzi(s)) return null;
  const words = toneless(s)
    .replace(/([a-zv])[1-5]/g, '$1')
    .split(/[\s']+/)
    .filter(Boolean);
  if (!words.length) return null;
  const out: string[] = [];
  for (const w of words) {
    if (!/^[a-zv]+$/.test(w)) return null;
    const parts = splitRun(w);
    if (!parts) return null;
    out.push(...parts);
  }
  return out;
}

/** Syllables of a dictionary reading (`nǎ r`, `dì tiě`), erhua dropped. */
export function readingSyllables(py: string): string[] {
  const out: string[] = [];
  for (const raw of toneless(py).split(/[\s']+/)) {
    const w = raw.replace(/[1-5]/g, '');
    if (!w) continue;
    // A lone `r` after a syllable is the 儿 of erhua.
    if (w === 'r' && out.length) continue;
    const parts = /^[a-zv]+$/.test(w) ? splitRun(w) : null;
    out.push(...(parts ?? [w]));
  }
  return out;
}

export type InputKind = 'hanzi' | 'pinyin' | 'other' | 'empty';

export interface Normalized {
  /** what came in, untouched */
  raw: string;
  kind: InputKind;
  /** hanzi input: the hanzi without punctuation or spaces */
  hanzi: string;
  /** toneless syllables: typed pinyin, or the reading of the hanzi */
  syllables: string[];
}
