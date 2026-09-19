/**
 * The sounds of Mandarin an English speaker gets wrong, in seven lessons.
 *
 * Not the whole pinyin table. Most of it an English speaker says acceptably
 * on the first try — m is m. What is here is the short list that marks an
 * accent and, worse, changes words: the three families of hissing sounds
 * (j q x, zh ch sh r, z c s) that English has one of, the puff that separates
 * b from p, the vowel ü that English does not have at all, the -n and -ng
 * that English speakers let blur, and the finals that pinyin spells with a
 * letter missing.
 *
 * Each lesson has three parts, in the order they work. What the mouth does,
 * with the nearest English sound and the usual mistake. Pairs of words that
 * differ only in that sound, to tell apart by ear — a sound you cannot hear
 * is a sound you cannot aim at. Then words to say, which the browser's
 * speech recognition checks.
 */

export interface SaidWord {
  word: string;
  /** space-separated, one syllable per character */
  reading: string;
}

export interface SoundNote {
  /** the sound, as pinyin spells it: "q", "-ng", "ui" */
  sound: string;
  /** what the tongue and lips do */
  mouth: string;
  /** the nearest English sound, and how it differs */
  like: string;
  /** what usually goes wrong, and what it turns into */
  mistake: string;
  /** a word to hear it in */
  example: SaidWord;
}

export interface MinimalPair {
  a: SaidWord;
  b: SaidWord;
  /** what separates them: "q / ch" */
  contrast: string;
}

export interface SoundLesson {
  id: string;
  /** a few letters that stand for the lesson */
  mark: string;
  title: string;
  blurb: string;
  notes: SoundNote[];
  /** one line that applies to the whole family */
  rule?: string;
  pairs: MinimalPair[];
  words: SaidWord[];
}

const w = (word: string, reading: string): SaidWord => ({ word, reading });
const pair = (a: SaidWord, b: SaidWord, contrast: string): MinimalPair => ({ a, b, contrast });

export const SOUND_LESSONS: SoundLesson[] = [
  {
    id: 'jqx',
    mark: 'j q x',
    title: 'The smiling sounds',
    blurb: 'j, q and x: tongue tip down, lips spread. Not English j, ch and sh.',
    notes: [
      {
        sound: 'j',
        mouth: 'Tongue tip down behind your lower teeth, the middle of the tongue pressed up to the roof of your mouth, lips spread as if smiling.',
        like: 'The j in “jeep” — but with the tip of the tongue down and no pouting of the lips.',
        mistake: 'Lifting the tip and rounding the lips, which makes it zh: 鸡 jī drifts to 知 zhī.',
        example: w('鸡', 'jī'),
      },
      {
        sound: 'q',
        mouth: 'Exactly where j is, with a strong puff of air as it opens.',
        like: 'The ch in “cheap”, said through a smile with the tongue tip down.',
        mistake: 'An English ch — which is Mandarin’s ch, a different sound: 七 qī becomes 吃 chī.',
        example: w('七', 'qī'),
      },
      {
        sound: 'x',
        mouth: 'Same place again, and the air hisses out over the middle of the tongue.',
        like: 'Between the s in “see” and the sh in “sheep”: say “sheep” while smiling hard.',
        mistake: 'A full English sh: 西 xī turns into 诗 shī, and 小 xiǎo into 少 shǎo.',
        example: w('西', 'xī'),
      },
    ],
    rule: 'After j, q and x a written u is always ü: qu is qü, xue is xüe. There is no ju said with oo.',
    pairs: [
      pair(w('七', 'qī'), w('吃', 'chī'), 'q / ch'),
      pair(w('西', 'xī'), w('诗', 'shī'), 'x / sh'),
      pair(w('鸡', 'jī'), w('知', 'zhī'), 'j / zh'),
      pair(w('小', 'xiǎo'), w('少', 'shǎo'), 'x / sh'),
      pair(w('钱', 'qián'), w('缠', 'chán'), 'q / ch'),
      pair(w('洗', 'xǐ'), w('死', 'sǐ'), 'x / s'),
    ],
    words: [
      w('学校', 'xué xiào'),
      w('喜欢', 'xǐ huan'),
      w('起床', 'qǐ chuáng'),
      w('觉得', 'jué de'),
      w('谢谢', 'xiè xie'),
      w('今天', 'jīn tiān'),
      w('休息', 'xiū xi'),
      w('请进', 'qǐng jìn'),
    ],
  },
  {
    id: 'zh',
    mark: 'zh ch sh r',
    title: 'The curled sounds',
    blurb: 'zh, ch, sh and r: the tongue tip curls up and back.',
    notes: [
      {
        sound: 'zh',
        mouth: 'Tongue tip curled up to the roof of your mouth, a little behind the ridge behind your top teeth. Lips relaxed.',
        like: 'The j in “judge”, with the tongue further back and no puff of air.',
        mistake: 'Leaving the tongue flat at the teeth, which is z: 找 zhǎo becomes 早 zǎo.',
        example: w('中', 'zhōng'),
      },
      {
        sound: 'ch',
        mouth: 'Where zh is, with a strong puff of air.',
        like: 'The ch in “church”, with the tongue further back.',
        mistake: 'A flat tongue turns it into c: 迟 chí becomes 词 cí.',
        example: w('吃', 'chī'),
      },
      {
        sound: 'sh',
        mouth: 'Tip curled up, and the air let through the gap.',
        like: 'The sh in “shirt” — close to English already.',
        mistake: 'Losing the curl: 是 shì becomes 四 sì, and 山 shān becomes 三 sān.',
        example: w('是', 'shì'),
      },
      {
        sound: 'r',
        mouth: 'Tip curled up as for sh, but with the voice on, and softer.',
        like: 'Between the r in “run” and the s in “pleasure”.',
        mistake: 'An English r with rounded lips. Keep them flat: 热 rè, not “ruh”.',
        example: w('热', 'rè'),
      },
    ],
    rule: 'In zhi, chi, shi and ri the i is not “ee”. Hold the consonant and let the voice buzz on it.',
    pairs: [
      pair(w('找', 'zhǎo'), w('早', 'zǎo'), 'zh / z'),
      pair(w('是', 'shì'), w('四', 'sì'), 'sh / s'),
      pair(w('迟', 'chí'), w('词', 'cí'), 'ch / c'),
      pair(w('山', 'shān'), w('三', 'sān'), 'sh / s'),
      pair(w('热', 'rè'), w('乐', 'lè'), 'r / l'),
      pair(w('中', 'zhōng'), w('宗', 'zōng'), 'zh / z'),
    ],
    words: [
      w('知道', 'zhī dào'),
      w('吃饭', 'chī fàn'),
      w('老师', 'lǎo shī'),
      w('中国', 'zhōng guó'),
      w('认识', 'rèn shi'),
      w('时候', 'shí hou'),
      w('手机', 'shǒu jī'),
      w('出租车', 'chū zū chē'),
    ],
  },
  {
    id: 'zcs',
    mark: 'z c s',
    title: 'The flat sounds',
    blurb: 'z, c and s: tongue tip flat against the back of the top teeth.',
    notes: [
      {
        sound: 'z',
        mouth: 'Tongue tip flat against the back of your top teeth. No voice and no puff.',
        like: 'The ds in “kids” — not the buzzing z of “zoo”.',
        mistake: 'Buzzing it like English z, or curling the tongue into zh: 早 zǎo drifts to 找 zhǎo.',
        example: w('早', 'zǎo'),
      },
      {
        sound: 'c',
        mouth: 'Where z is, with a strong puff of air.',
        like: 'The ts in “cats”, puffed hard. Nothing to do with k.',
        mistake: 'Reading the letter as k, or dropping the puff: 草 cǎo becomes 早 zǎo.',
        example: w('菜', 'cài'),
      },
      {
        sound: 's',
        mouth: 'Tip flat behind the top teeth, air hissing through.',
        like: 'The s in “sun”.',
        mistake: 'Curling the tongue into sh: 色 sè becomes 社 shè.',
        example: w('三', 'sān'),
      },
    ],
    rule: 'In zi, ci and si the i is a buzz, not “ee”: keep the tongue where the consonant was and hum. Not “zee”, “tsee”, “see”.',
    pairs: [
      pair(w('早', 'zǎo'), w('草', 'cǎo'), 'z / c'),
      pair(w('在', 'zài'), w('菜', 'cài'), 'z / c'),
      pair(w('擦', 'cā'), w('插', 'chā'), 'c / ch'),
      pair(w('色', 'sè'), w('社', 'shè'), 's / sh'),
      pair(w('从', 'cóng'), w('虫', 'chóng'), 'c / ch'),
      pair(w('字', 'zì'), w('志', 'zhì'), 'z / zh'),
    ],
    words: [
      w('自己', 'zì jǐ'),
      w('再见', 'zài jiàn'),
      w('厕所', 'cè suǒ'),
      w('四十', 'sì shí'),
      w('词典', 'cí diǎn'),
      w('早上', 'zǎo shang'),
      w('颜色', 'yán sè'),
      w('从来', 'cóng lái'),
    ],
  },
  {
    id: 'puff',
    mark: 'b p',
    title: 'Puff or no puff',
    blurb: 'b d g against p t k: the difference is air, not voice.',
    notes: [
      {
        sound: 'b d g',
        mouth: 'Lips or tongue close and open with no puff of air — and no voice either.',
        like: 'The p in “spot”, the t in “stop”, the k in “skip”. Not the b in “bed”.',
        mistake: 'A voiced English b or d. It is understood, but it is the first thing that sounds foreign.',
        example: w('爸', 'bà'),
      },
      {
        sound: 'p t k',
        mouth: 'The same closures, opened with a strong puff of air.',
        like: 'The p in “pot”, t in “top”, k in “kit” — and puffed harder than English does.',
        mistake: 'Too little air: 跑 pǎo sounds like 宝 bǎo, and 兔 tù like 肚 dù.',
        example: w('怕', 'pà'),
      },
    ],
    rule: 'Hold your palm, or a tissue, in front of your mouth: it should feel the p and not the b.',
    pairs: [
      pair(w('跑', 'pǎo'), w('宝', 'bǎo'), 'p / b'),
      pair(w('兔', 'tù'), w('肚', 'dù'), 't / d'),
      pair(w('科', 'kē'), w('哥', 'gē'), 'k / g'),
      pair(w('牌', 'pái'), w('白', 'bái'), 'p / b'),
      pair(w('替', 'tì'), w('弟', 'dì'), 't / d'),
      pair(w('快', 'kuài'), w('怪', 'guài'), 'k / g'),
      pair(w('怕', 'pà'), w('爸', 'bà'), 'p / b'),
    ],
    words: [
      w('朋友', 'péng you'),
      w('爸爸', 'bà ba'),
      w('他们', 'tā men'),
      w('大家', 'dà jiā'),
      w('可以', 'kě yǐ'),
      w('跑步', 'pǎo bù'),
      w('考试', 'kǎo shì'),
      w('公共', 'gōng gòng'),
    ],
  },
  {
    id: 'u',
    mark: 'ü',
    title: 'The vowel English does not have',
    blurb: 'ü: the tongue of “ee” with the lips of “oo”.',
    notes: [
      {
        sound: 'ü',
        mouth: 'Say “ee”, then round your lips as for “oo” without moving your tongue at all.',
        like: 'No English sound. The ü of German “über”, the u of French “tu”.',
        mistake: 'Saying “oo”: 女 nǚ becomes 努 nǔ, and 绿 lǜ becomes 路 lù.',
        example: w('女', 'nǚ'),
      },
      {
        sound: 'üe',
        mouth: 'ü, then a short open e.',
        like: 'Something like “yweh”, quickly, with rounded lips at the start.',
        mistake: 'Saying “yoo-ay”: 月 yuè spread out into two syllables.',
        example: w('月', 'yuè'),
      },
    ],
    rule: 'The dots are only written after n and l (nǚ, lǜ). After j, q, x and y a plain u is ü anyway: qù, xué, yú.',
    pairs: [
      pair(w('女', 'nǚ'), w('努', 'nǔ'), 'ü / u'),
      pair(w('绿', 'lǜ'), w('路', 'lù'), 'ü / u'),
      pair(w('鱼', 'yú'), w('无', 'wú'), 'ü / u'),
      pair(w('雨', 'yǔ'), w('五', 'wǔ'), 'ü / u'),
      pair(w('去', 'qù'), w('气', 'qì'), 'ü / i'),
      pair(w('月', 'yuè'), w('叶', 'yè'), 'üe / ie'),
    ],
    words: [
      w('女儿', 'nǚ ér'),
      w('绿色', 'lǜ sè'),
      w('去年', 'qù nián'),
      w('下雨', 'xià yǔ'),
      w('旅游', 'lǚ yóu'),
      w('音乐', 'yīn yuè'),
      w('学生', 'xué sheng'),
      w('一起去', 'yì qǐ qù'),
    ],
  },
  {
    id: 'nasal',
    mark: 'n ng',
    title: 'Front and back n',
    blurb: '-n and -ng change the word, and the vowel before them moves too.',
    notes: [
      {
        sound: '-n',
        mouth: 'Tongue tip touches the ridge behind your top teeth at the end, and stays there.',
        like: 'The n in “ban”, “sin”.',
        mistake: 'Letting it slide back into ng: 心 xīn becomes 星 xīng.',
        example: w('心', 'xīn'),
      },
      {
        sound: '-ng',
        mouth: 'The back of the tongue rises to the soft palate; the tip stays down.',
        like: 'The ng in “sing”, “song” — with no hard g after it.',
        mistake: 'Adding a g (“shang-g”), or ending on the tip: 放 fàng becomes 饭 fàn.',
        example: w('星', 'xīng'),
      },
      {
        sound: 'an / ang',
        mouth: 'an is a front a; ang is a back a, far down the throat.',
        like: 'an like “an” in Spanish “pan”; ang like the a in “father”, then ng.',
        mistake: 'One vowel for both, so only the ending is left to tell them apart.',
        example: w('上', 'shàng'),
      },
      {
        sound: 'en / eng',
        mouth: 'Both have a short, neutral e — the vowel of “the”.',
        like: 'en like “un” in “under” + n; eng like “ung” in “lung”.',
        mistake: 'Saying the e like the e in “bed”: 很 hěn is not “hen”.',
        example: w('冷', 'lěng'),
      },
    ],
    rule: 'in and ing: in like “een” in “seen”, ing like “ing” in “sing”.',
    pairs: [
      pair(w('心', 'xīn'), w('星', 'xīng'), 'in / ing'),
      pair(w('山', 'shān'), w('商', 'shāng'), 'an / ang'),
      pair(w('饭', 'fàn'), w('放', 'fàng'), 'an / ang'),
      pair(w('盆', 'pén'), w('朋', 'péng'), 'en / eng'),
      pair(w('进', 'jìn'), w('静', 'jìng'), 'in / ing'),
      pair(w('真', 'zhēn'), w('蒸', 'zhēng'), 'en / eng'),
      pair(w('人', 'rén'), w('仍', 'réng'), 'en / eng'),
    ],
    words: [
      w('心情', 'xīn qíng'),
      w('很冷', 'hěn lěng'),
      w('电影', 'diàn yǐng'),
      w('饭店', 'fàn diàn'),
      w('上班', 'shàng bān'),
      w('明天', 'míng tiān'),
      w('真正', 'zhēn zhèng'),
      w('朋友', 'péng you'),
    ],
  },
  {
    id: 'glide',
    mark: 'ui iu',
    title: 'Finals that glide',
    blurb: 'Two and three vowels run together — and the ones pinyin spells short.',
    notes: [
      {
        sound: 'ai ei ao ou',
        mouth: 'One syllable each, the tongue gliding from the first vowel to the second.',
        like: 'ai as in “eye”, ei as in “hey”, ao as in “cow”, ou as in “go”.',
        mistake: 'ao as “ay-oh”, or ei as “ee”: 北 běi becomes 百 bǎi.',
        example: w('好', 'hǎo'),
      },
      {
        sound: 'ia ie iao',
        mouth: 'A quick y-glide into the vowel.',
        like: 'ia as “ya”, ie as the “ye” in “yes”, iao as the “yow” in “meow”.',
        mistake: 'ie as “ee-ay” in two beats: 写 xiě is one syllable, like “shyeh”.',
        example: w('谢', 'xiè'),
      },
      {
        sound: 'iu = iou',
        mouth: 'Spelled iu, said with an o in the middle.',
        like: 'The “yo” of “yo-yo”: 九 jiǔ is close to “jyo”.',
        mistake: 'Reading the spelling: “jee-oo”.',
        example: w('九', 'jiǔ'),
      },
      {
        sound: 'ui = uei',
        mouth: 'Spelled ui, said with an e in the middle.',
        like: 'The “way” of “away”: 对 duì is close to “dway”.',
        mistake: 'Reading the spelling: “doo-ee”. The same goes for un, which is uen.',
        example: w('对', 'duì'),
      },
      {
        sound: 'ua uo uai',
        mouth: 'A quick w-glide into the vowel.',
        like: 'ua as “wah”, uo as the “wo” of “war” without the r, uai as “why”.',
        mistake: 'uo as “oo-oh” in two beats: 国 guó is one syllable.',
        example: w('国', 'guó'),
      },
    ],
    pairs: [
      pair(w('北', 'běi'), w('百', 'bǎi'), 'ei / ai'),
      pair(w('口', 'kǒu'), w('考', 'kǎo'), 'ou / ao'),
      pair(w('贵', 'guì'), w('过', 'guò'), 'ui / uo'),
      pair(w('九', 'jiǔ'), w('脚', 'jiǎo'), 'iu / iao'),
      pair(w('写', 'xiě'), w('小', 'xiǎo'), 'ie / iao'),
      pair(w('会', 'huì'), w('坏', 'huài'), 'ui / uai'),
      pair(w('家', 'jiā'), w('街', 'jiē'), 'ia / ie'),
    ],
    words: [
      w('对不起', 'duì bu qǐ'),
      w('小孩', 'xiǎo hái'),
      w('外国', 'wài guó'),
      w('没有', 'méi yǒu'),
      w('九月', 'jiǔ yuè'),
      w('学校', 'xué xiào'),
      w('很贵', 'hěn guì'),
      w('多少', 'duō shǎo'),
    ],
  },
];

export const lessonById = (id: string | undefined) => SOUND_LESSONS.find((l) => l.id === id) ?? null;
