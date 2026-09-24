import {
  GENRES,
  LEVELS,
  STRUCTURES,
  hanziIn,
  hskLabel,
  sentenceRange,
  type TextPlan,
  type TextSpec,
} from './text';

/**
 * What the app knows that the plan does not carry.
 *
 * `words` is the inventory the other way round — the compounds the reader can
 * actually read, rather than the characters they are made of. Handing over
 * only characters is what produces passages full of technically-legal
 * compounds nobody writes: 好 and 天 are both known, so 好天 looks permissible,
 * and it is not a word.
 *
 * `revisit` is the schedule's contribution: characters an earlier passage
 * taught that are now falling due. Meeting one again in a sentence is worth
 * more than meeting it in a grid, and it costs the passage nothing — they are
 * already known, so they are free to use.
 */
export interface PromptExtras {
  words?: string[];
  revisit?: string[];
}

/**
 * The brief, written out for a person to paste into Claude.
 *
 * This used to be a system prompt and a JSON schema sent over the wire with an
 * API key. It is the same brief, but it now has to survive being pasted into a
 * chat window: everything is stated once, in the open, in an order that reads
 * top to bottom, and the answer is asked for as a single code block because
 * that is the one thing that reliably makes it back across a clipboard.
 *
 * What it does *not* do is name the characters to teach. That is the writer's
 * call — a character picked to fit the story earns its place; a character
 * picked off a frequency table has to have a story built around it.
 */

const FENCE = '```';

const list = (items: string[]) => items.map((s) => `- ${s}`).join('\n');

/** The words and characters a spec asks to be worked in, one per entry. */
export function includeList(spec: Pick<TextSpec, 'include'>): string[] {
  return [
    ...new Set(
      spec.include
        .split(/[\s,，、;；/]+/)
        .map((w) => w.trim())
        .filter((w) => hanziIn(w).length > 0),
    ),
  ];
}

/**
 * The vocabulary line of a brief.
 *
 * The number is a density target, not a ceiling. Asking for "exactly six new
 * characters" made the writer contort sentences to dodge the seventh — and
 * the seventh was usually 的-level ordinary, inside a word at my band that I
 * would meet next week anyway. So the band says what is fair game, the
 * ceiling says how far a stretch word may reach, and the number says roughly
 * how much new material the passage should carry.
 */
function vocabBrief(spec: TextSpec): string[] {
  const band = hskLabel(spec.hsk);
  const ceiling = hskLabel(Math.max(spec.hsk, spec.ceiling));
  const words = includeList(spec);
  const out = [
    `**Vocabulary band:** ${band}. Words at or below ${band} are fair game even where they contain characters I have not met — they count towards the new material but do not need avoiding. A few stretch words up to ${ceiling} are welcome where the topic wants them; nothing above ${ceiling}.`,
  ];
  if (spec.newCount > 0) {
    out.push(
      `**New material:** aim for about ${spec.newCount} new character${spec.newCount === 1 ? '' : 's'} — a target, not a cap. Choose them yourself; do not strangle a natural sentence to stay under the number, and do not pad one to reach it. Introduce each in a sentence where everything else is familiar, use it at least twice, and list them under \`teach\`.`,
    );
  } else {
    out.push('**New material:** none. Stay entirely inside what I know, and return an empty `teach` list.');
  }
  if (words.length && spec.vocabMode === 'strict') {
    out.push(
      `**Must include:** every one of ${words.join('、')}. These are required — each appears at least once, and any character in them I have not met goes in \`teach\` however that moves the count.`,
    );
  } else if (words.length) {
    out.push(`**Would be nice to include:** ${words.join('、')} — where they fit naturally, not at any cost.`);
  }
  return out;
}

function specBrief(spec: TextSpec, n: number): string {
  const [lo, hi] = sentenceRange(spec.length);
  const level = LEVELS.find((d) => d.id === spec.level);
  const genre = GENRES.find((g) => g.id === spec.genre);
  const structure = STRUCTURES.find((x) => x.id === spec.structure) ?? STRUCTURES[0];

  return [
    `### ${spec.id} — passage ${n}`,
    '',
    list(
      [
        `**About:** ${spec.topic.trim() || 'anything ordinary and everyday'}`,
        `**Form:** ${genre?.brief ?? 'a small story'}`,
        `**Shape:** ${structure.brief}`,
        `**Length:** about ${lo} to ${hi} sentences`,
        `**How far past me:** ${level?.brief ?? ''}`,
        ...vocabBrief(spec),
        spec.questions
          ? '**Questions:** 2 or 3 comprehension questions at the end, each with a short model answer in Chinese'
          : '**Questions:** none — return an empty list',
      ].filter(Boolean),
    ),
  ].join('\n');
}

const SHAPE = `{
  "texts": [
    {
      "id": "t1",
      "title": "The cat on the roof",
      "titleZh": "屋上的猫",
      "teach": [
        { "c": "屋", "py": "wū", "d": "house, room" },
        { "c": "猫", "py": "māo", "d": "cat" }
      ],
      "lines": [
        { "zh": "我家有一只猫。", "py": "wǒ jiā yǒu yì zhī māo", "en": "My family has a cat.", "p": true },
        { "zh": "它天天在屋上睡觉。", "py": "tā tiān tiān zài wū shàng shuì jiào", "en": "It sleeps on the roof every day." }
      ],
      "vocab": [
        { "w": "屋子", "py": "wū zi", "d": "house, room", "new": true },
        { "w": "睡觉", "py": "shuì jiào", "d": "to sleep", "new": false }
      ],
      "questions": [
        { "zh": "猫在哪儿睡觉？", "py": "māo zài nǎr shuì jiào", "en": "Where does the cat sleep?", "a": "它在屋上睡觉。" }
      ],
      "grammar": [
        { "point": "在 + place for where something happens", "zh": "它在屋上睡觉。", "en": "It sleeps on the roof." }
      ],
      "note": "Watch 上 here: it is a surface, not a direction.",
      "hsk": { "1": 14, "2": 3, "3": 1 }
    }
  ]
}`;

/**
 * The whole prompt, as one block of markdown.
 *
 * Long on purpose. The inventory is the feature — a passage with fifteen
 * characters I cannot read is not a graded text, it is a wall — so the
 * inventory is given in full, the budget for new characters is stated per
 * passage, and the last line asks for a check rather than trusting the first
 * draft.
 */
export function buildPrompt(plan: TextPlan, extra: PromptExtras = {}): string {
  const n = plan.specs.length;
  const budget = plan.specs.reduce((sum, s) => sum + s.newCount, 0);

  const out: string[] = [];

  out.push(
    `# ${plan.name.trim() || 'Chinese reading practice'} — ${n} passage${n === 1 ? '' : 's'}`,
  );
  out.push('');
  out.push(
    'You are my Chinese teacher. I am learning Mandarin on the HSK syllabus (the 2026 word lists), and I read what you write me on paper, away from a dictionary. Below is exactly what I can read today. Everything past that is your call.',
  );
  out.push('');
  out.push(
    `Each passage says how many characters it may teach me and how far past my level to go. Choose those characters yourself — the ones the subject actually needs — and teach them, do not merely use them: a new character has to appear often enough, and in plain enough company, that I can work out what it means from the passage itself. There ${n === 1 ? 'is' : 'are'} ${n} passage${n === 1 ? '' : 's'} to write, and roughly ${budget} new character${budget === 1 ? '' : 's'} across ${n === 1 ? 'it' : 'them'}.`,
  );
  out.push('');

  out.push(`## What I can already read — ${plan.basis.length} characters`);
  out.push('');
  out.push(plan.basis.join(''));
  out.push('');

  if (extra.words?.length) {
    out.push(`## Words I can already read — ${extra.words.length}`);
    out.push('');
    out.push(extra.words.join('、'));
    out.push('');
    out.push(
      'Build out of these where you can. Characters I know do not make a word just because I know them: two familiar characters put together is a new word to me, and often not a word at all. Where the passage needs a compound that is not on this list, prefer one whose meaning is obvious from its parts, and put it in the vocabulary list.',
    );
    out.push('');
  }

  if (extra.revisit?.length) {
    out.push(`## Please work these back in — ${extra.revisit.length}`);
    out.push('');
    out.push(extra.revisit.join(''));
    out.push('');
    out.push(
      'These were taught by earlier passages and I am starting to lose them. Use each at least once, in a sentence where the rest is easy. They are not new and do not go in `teach` — they just need to come round again.',
    );
    out.push('');
  }

  if (plan.met.length) {
    out.push(`## What earlier passages have already taught me — ${plan.met.length}`);
    out.push('');
    out.push(plan.met.join(''));
    out.push('');
    out.push(
      'Treat these as mine: using them again is good and I need the practice, but they do not count as new. Do not spend a passage re-teaching one.',
    );
    out.push('');
  }

  if (plan.supplement.trim()) {
    const extra = hanziIn(plan.supplement);
    out.push(`## Also mine to use — ${extra.length}`);
    out.push('');
    out.push(extra.join(''));
    out.push('');
    out.push('I am studying these right now. Use them as freely as the list above: they are not new and do not go in `teach`.');
    out.push('');
  }

  out.push('## Rules');
  out.push('');
  out.push(
    list(
      [
        '**Everything that is not in the lists above counts as new to me.** Each passage gives a target for new material and an HSK band. Treat the target as a density to aim for, not a cap: a few over, in words from my band, is fine; twenty strangers is a wall, and I will stop reading.',
        'Introduce a new character first in a sentence whose other characters are all familiar, so the meaning is guessable from context, and use it at least twice in the passage.',
        'List every character you have introduced under `teach`, with its reading and its meaning. This is what I practise afterwards, so it has to be complete and it has to match what is actually in the passage.',
        'Write real Chinese, not a word list: ordinary word order, sentences that follow on from one another, repetition where repetition is natural. Natural flow comes first — a paragraph should read as a paragraph, not as a list of sentences that happen to be adjacent.',
        'Pinyin: tone marks, lower case, grouped by word (`nǐ hǎo`, not `ni3 hao3` and not `nǐhǎo`), no punctuation.',
        'English: a natural translation of the whole sentence, not a gloss of each character.',
        'Punctuation is free — it is not a character. Use 。，、？！：；“” and 「」 as you like.',
        'In `lines`, one sentence per entry, in reading order — they are joined back into paragraphs on my screen. Mark the first sentence of every paragraph with `"p": true`. Dialogue turns count as sentences, and each turn starts a paragraph.',
        'The vocabulary list is the key to the passage: 4 to 10 words it actually uses, new ones first. Mark `"new": true` for the ones built out of the characters you have just taught.',
        'Each passage stands alone: do not refer to the others, and do not carry a story across them.',
      ],
    ),
  );
  out.push('');

  out.push('## The passages');
  out.push('');
  plan.specs.forEach((s, i) => {
    out.push(specBrief(s, i + 1));
    out.push('');
  });

  out.push('## What to send back');
  out.push('');
  out.push(
    'One JSON code block and nothing else — no commentary before it, none after it. I paste it straight back into my app, so the shape matters more than the prose:',
  );
  out.push('');
  out.push(`${FENCE}json`);
  out.push(SHAPE);
  out.push(FENCE);
  out.push('');
  if (plan.script === 'both') {
    out.push(
      'Write every line in simplified characters in `zh`, and add `zht` with the same sentence in traditional characters. Do the same for questions. Everything else — `teach`, `vocab`, `grammar` — stays simplified.',
    );
    out.push('');
  }
  out.push(
    list([
      '`id` — copy the id of the brief this passage answers (`t1`, `t2` …), in the same order.',
      '`teach` — every character new to me that the passage uses, with reading and meaning. Order them the way the passage introduces them.',
      '`titleZh` — the title in Chinese. `title` is the same title in English.',
      '`grammar` — one to three things the passage was written to show, each with the sentence from the passage that shows it. This is what I study after reading.',
      '`note` — one or two sentences from you to me: what to watch for in this passage, or a mistake it would be easy to make.',
      '`questions` — an empty list when the brief says none. Each question carries `a`, a short model answer in Chinese, so I can check myself.',
      '`hsk` — how many distinct characters of the passage come from each HSK band, as you count them: `{ "1": 40, "2": 12, … }`. Characters outside the syllabus go under `"0"`.',
    ]),
  );
  out.push('');
  out.push(
    'Before you answer, read back over what you have written and count the characters that are in none of the lists above. If there are far more than the passage aimed for, or any word sits above its ceiling, rewrite the sentences that carry them rather than adding them to `teach`. That count is the one thing I cannot check for myself while reading.',
  );

  return out.join('\n');
}

/**
 * The same brief as data, for when you would rather hand over JSON than prose.
 *
 * It carries its own instructions so it can be pasted on its own, with no
 * covering message, and still produce the right thing.
 */
export function buildBrief(plan: TextPlan, extra: PromptExtras = {}): string {
  const brief = {
    task: 'Write graded Chinese reading passages for a learner, choosing the new vocabulary yourself and following every constraint exactly.',
    rules: [
      'Anything not in "known", "met" or "supplement" is new to the learner. Each passage\'s newCharacters is a density target, not a cap; stay inside its HSK band and ceiling.',
      'Natural flow first: sentences lean on each other. Mark the first sentence of each paragraph with "p": true.',
      'Every word in a passage\'s mustInclude list appears at least once.',
      'Introduce each new character in a sentence whose other characters are familiar, and use it at least twice.',
      'List every new character under "teach" with its reading and meaning; it must match the passage.',
      '"met" characters may be reused freely but are not new and must not be re-taught.',
      'Prefer compounds from "knownWords". Two known characters side by side is not automatically a word.',
      'Use every character in "revisit" at least once; they are not new and do not belong in "teach".',
      'Pinyin with tone marks, lower case, grouped by word, no punctuation.',
      'English is a natural translation of the whole sentence.',
      'Punctuation is unrestricted.',
    ],
    known: plan.basis.join(''),
    knownCount: plan.basis.length,
    knownWords: extra.words?.join('、'),
    revisit: extra.revisit?.join(''),
    met: plan.met.join(''),
    supplement: hanziIn(plan.supplement).join('') || undefined,
    script: plan.script === 'both' ? 'simplified in zh, traditional in zht' : 'simplified',
    reply: {
      format: 'A single JSON object, in one json code block, with no other text.',
      shape: {
        texts: [
          {
            id: 'the id of the brief this answers',
            title: 'English title',
            titleZh: 'Chinese title',
            teach: [{ c: '', py: '', d: '' }],
            lines: [{ zh: '', py: '', en: '', p: true }],
            vocab: [{ w: '', py: '', d: '', new: false }],
            questions: [{ zh: '', py: '', en: '', a: 'model answer in Chinese' }],
            grammar: [{ point: '', zh: '', en: '' }],
            note: 'one or two sentences of advice to the learner',
            hsk: { '1': 0 },
          },
        ],
      },
    },
    texts: plan.specs.map((s) => {
      const [lo, hi] = sentenceRange(s.length);
      return {
        id: s.id,
        topic: s.topic.trim() || 'anything ordinary and everyday',
        form: GENRES.find((g) => g.id === s.genre)?.brief,
        sentences: `${lo}-${hi}`,
        howFarPastMe: LEVELS.find((d) => d.id === s.level)?.brief,
        shape: STRUCTURES.find((x) => x.id === s.structure)?.brief,
        hskBand: s.hsk,
        hskCeiling: Math.max(s.hsk, s.ceiling),
        newCharacters: `about ${s.newCount} — a target, not a cap`,
        mustInclude: s.vocabMode === 'strict' ? includeList(s) : undefined,
        niceToInclude: s.vocabMode === 'soft' && includeList(s).length ? includeList(s) : undefined,
        questions: s.questions ? '2 or 3 comprehension questions' : 'none',
      };
    }),
  };
  return JSON.stringify(brief, null, 2);
}

/** A one-line reminder of what to do with the prompt, shown next to it. */
export const HANDOFF_STEPS = [
  'Copy the prompt.',
  'Open Claude — a new chat, Opus, extended thinking on if you have it.',
  'Paste, send, and wait for the JSON block.',
  'Copy the whole reply and bring it back to the Paste step.',
];
