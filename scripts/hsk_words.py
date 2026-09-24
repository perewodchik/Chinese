"""
The HSK word lists, and the words.json the app learns words from.

Characters are what you write; words are what you read, and the syllabus is
written in words. The lists here are the 2026 revision of HSK 3.0 — 294 words
at band 1, 491 by band 2 — as collected by complete-hsk-vocabulary (MIT),
pinned to one commit so a rebuild is a rebuild and not an update. That file
also carries the 2021 lists and the old HSK 2.0 ones; only the 2026 levels
(`t1`..`t7`) are read.

Each word arrives with every reading CC-CEDICT has for it, in CC-CEDICT's
order, which is not the order a learner needs: 东西 is "east and west" before
it is "thing", and 便宜 is "convenient" before it is "cheap". `choose` takes
the reading with the most senses, which is the everyday one far more often
than not. Where it is not — about one word in seven of the first thousand,
counting the ones whose rarest sense came first — SENSE decides by hand,
after reading every HSK 1–3 choice the rule made.

Imported by build_data.py, which owns the other sources.
"""
from __future__ import annotations

import json
import os
import re

SOURCE_SHA = "7ac65bf1a6387d35f1ade478906172a19311c7f9"
SOURCE_FILE = "hsk_vocabulary.json"
SOURCE_URL = ("https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/"
              f"{SOURCE_SHA}/complete.min.json")

# Bands 7, 8 and 9 are one exam and one table, here as everywhere else in the app.
TOP_BAND = 7

# Words at these bands carry example sentences. The file is loaded with the
# app, and the bands past these are for looking up rather than for learning.
EXAMPLE_BANDS = 4
EXAMPLES_PER_WORD = 2

CJK = re.compile(r"^[一-鿿]+$")


def load_hsk2026(cache: str) -> dict[str, dict]:
    """word -> {"band", "q", "forms"} for every word on the 2026 lists."""
    raw = json.load(open(os.path.join(cache, SOURCE_FILE), encoding="utf-8"))
    out: dict[str, dict] = {}
    for e in raw:
        bands = [int(l[1:]) for l in e.get("l", []) if l[:1] == "t" and l[1:].isdigit()]
        w = e.get("s", "")
        if not bands or not CJK.match(w):
            continue
        band = min(TOP_BAND, min(bands))
        had = out.get(w)
        if had and had["band"] <= band:
            continue
        out[w] = {"band": band, "q": e.get("q") or 999_999, "forms": e.get("f", [])}
    return out


def char_bands(words: dict[str, dict]) -> dict[str, int]:
    """Each character's band: the first band whose words use it."""
    out: dict[str, int] = {}
    for w, e in words.items():
        for ch in w:
            if ch not in out or e["band"] < out[ch]:
                out[ch] = e["band"]
    return out


# ------------------------------------------------------------------ meanings

DROP = ("surname", "variant of", "abbr.", "see ", "old variant", "used in",
        "erhua variant", "also written", "japanese variant", "archaic", "cl:",
        "euphemistic variant", "(old)", "(literary)", "(dialect)", "(archaic)",
        "also pr", "taiwan pr")
DIRTY = re.compile(
    r"\b(vulgar|slang|coarse|offensive|derogatory|obscene|taboo|fuck|shit|"
    r"damn|whore|bitch|penis|vagina|sexual|prostitut)", re.I)


def meaning_items(meanings: list[str]) -> list[str]:
    """A form's senses, one per item, less the ones no learner needs."""
    out: list[str] = []
    seen: set[str] = set()
    for group in meanings:
        for x in group.split("; "):
            x = re.sub(r"\s*\[[^\]]*\]", "", x).strip(" ,;")
            if not x or x.lower().startswith(DROP) or DIRTY.search(x):
                continue
            # A parenthesis is usually a note — "bar (loanword)" — and goes; a
            # sense that is nothing but one — "(question particle)" — stays.
            # Innermost first: "person(s)" sits inside a note often enough.
            bare, prev = x, None
            while bare != prev:
                prev, bare = bare, re.sub(r"\s*\([^()]*\)\s*", " ", bare)
            bare = bare.strip(" ,;")
            if "(" in bare or ")" in bare:
                bare = ""
            x = re.sub(r"\s+", " ", bare or x)
            if x.lower() not in seen:
                seen.add(x.lower())
                out.append(x)
    return out


def gloss(items: list[str], n: int = 48) -> str:
    """The first few senses, as many as fit in a line."""
    out: list[str] = []
    for x in items:
        if out and len("; ".join(out + [x])) > n:
            break
        out.append(x)
        if len(out) == 4:
            break
    g = "; ".join(out)
    return g if len(g) <= n + 12 else g[: n].rsplit(" ", 1)[0].rstrip(" ,;") + "…"


# Reading and meaning decided by hand, where the rule picks the wrong reading
# (吗 as má, 胖 as pán) or the right one with its rarest senses first (年 as
# "grain; harvest"). Written after reading every HSK 1–3 choice the rule made.
# A word here is (pinyin, gloss), or (pinyin, gloss, other readings) where the
# other readings the dictionary offers are noise — [] for none worth showing.
Alt = list[tuple[str, str]]
SENSE: dict[str, tuple[str, str] | tuple[str, str, Alt]] = {
    # ---- band 1
    "的": ("de", "~'s; of (joins a description to a noun)"),
    "了": ("le", "particle: action done, or a change of state"),
    "在": ("zài", "to be at; in; at; (doing) right now"),
    "他": ("tā", "he; him"),
    "个": ("gè", "the general measure word; individual", []),
    "好": ("hǎo", "good; well; fine; OK"),
    "很": ("hěn", "very; quite"),
    "去": ("qù", "to go; to go to"),
    "想": ("xiǎng", "to want to; to think; to miss (sb)"),
    "做": ("zuò", "to do; to make"),
    "吧": ("ba", "let's…; …right?; suggestion particle"),
    "点": ("diǎn", "o'clock; a little; point; to order (food)"),
    "里": ("lǐ", "inside; in"),
    "年": ("nián", "year"),
    "吗": ("ma", "yes-or-no question particle", []),
    "太": ("tài", "too; very; extremely"),
    "呢": ("ne", "and…?; what about…?; question particle"),
    "只": ("zhǐ", "only; just", [("zhī", "measure word for animals; one of a pair")]),
    "家": ("jiā", "home; family; household"),
    "吃": ("chī", "to eat"),
    "新": ("xīn", "new; newly"),
    "车": ("chē", "car; vehicle"),
    "大家": ("dà jiā", "everyone; all of us"),
    "听": ("tīng", "to listen; to hear", []),
    "叫": ("jiào", "to be called; to call; to shout; to ask (sb to do)"),
    "钱": ("qián", "money"),
    "本": ("běn", "measure word for books; this; origin"),
    "回": ("huí", "to go back; to return; measure word for times"),
    "东西": ("dōng xi", "thing; stuff"),
    "岁": ("suì", "years old; year (of age)"),
    "号": ("hào", "number; day of the month; size"),
    "件": ("jiàn", "measure word for clothes and matters; item"),
    "分": ("fēn", "minute; cent; point (score); to divide"),
    "正在": ("zhèng zài", "in the middle of (doing); -ing"),
    "坐": ("zuò", "to sit; to take (a bus, a plane)"),
    "块": ("kuài", "piece; lump; yuan (spoken)"),
    "多少": ("duō shao", "how many?; how much?"),
    "哪": ("nǎ", "which", []),
    "先生": ("xiān sheng", "Mr.; sir; husband"),
    "男": ("nán", "male; man"),
    "些": ("xiē", "some; a few"),
    "口": ("kǒu", "mouth; measure word for family members"),
    "二": ("èr", "two"),
    "店": ("diàn", "shop; store"),
    "元": ("yuán", "yuan (unit of money); first"),
    "热": ("rè", "hot; to heat up"),
    "第": ("dì", "ordinal prefix: 第一 first, 第二 second"),
    "读": ("dú", "to read; to read aloud; to study", []),
    "猫": ("māo", "cat"),
    "饭": ("fàn", "meal; cooked rice"),
    "好看": ("hǎo kàn", "good-looking; nice to watch or read"),
    "雨": ("yǔ", "rain", []),
    "星期": ("xīng qī", "week; day of the week"),
    "贵": ("guì", "expensive; noble; your (polite)"),
    "包子": ("bāo zi", "steamed stuffed bun"),
    "不客气": ("bù kè qi", "you're welcome; don't mention it"),
    "汉字": ("hàn zì", "Chinese character"),
    "零": ("líng", "zero"),
    "星期天": ("xīng qī tiān", "Sunday"),
    "星期日": ("xīng qī rì", "Sunday"),
    # ---- band 2
    "着": ("zhe", "particle: an ongoing state or action (-ing)"),
    "啊": ("a", "ah; oh (softens or stresses a sentence)", []),
    "得": ("de", "particle joining a verb to how it is done (跑得快)"),
    "过": ("guò", "to pass; to cross; to spend (time); to celebrate"),
    "等": ("děng", "to wait; and so on; class"),
    "次": ("cì", "time (measure word for occurrences); next"),
    "跟": ("gēn", "with; and; to follow"),
    "快": ("kuài", "fast; quick; soon"),
    "打": ("dǎ", "to hit; to play (ball games); to make (a call)"),
    "起来": ("qǐ lai", "to get up; to stand up; (after a verb) to start"),
    "位": ("wèi", "measure word for people (polite); position"),
    "别": ("bié", "don't; other; to leave"),
    "名": ("míng", "name; famous"),
    "长": ("cháng", "long; length"),
    "条": ("tiáo", "measure word for long thin things; strip; item"),
    "周": ("zhōu", "week; circle; all around"),
    "不错": ("bù cuò", "not bad; pretty good; correct"),
    "花": ("huā", "flower; to spend (money, time)"),
    "间": ("jiān", "measure word for rooms; between; among"),
    "面": ("miàn", "face; side; surface; noodles"),
    "包": ("bāo", "bag; package; to wrap"),
    "楼": ("lóu", "building; floor (storey)"),
    "意思": ("yì si", "meaning; idea; interest"),
    "教": ("jiāo", "to teach"),
    "妻子": ("qī zi", "wife"),
    "洗": ("xǐ", "to wash; to bathe"),
    "左": ("zuǒ", "left"),
    "右": ("yòu", "right (side)"),
    "鸟": ("niǎo", "bird"),
    "酒店": ("jiǔ diàn", "hotel; restaurant; pub"),
    "红色": ("hóng sè", "red"),
    "游": ("yóu", "to swim; to travel; to tour"),
    "白色": ("bái sè", "white"),
    "奶奶": ("nǎi nai", "grandma (father's mother)"),
    "不好意思": ("bù hǎo yì si", "sorry; excuse me; to feel embarrassed"),
    "阴": ("yīn", "overcast; cloudy; shady"),
    "开学": ("kāi xué", "(of school) to start the term"),
    "绿茶": ("lǜ chá", "green tea"),
    "爱好": ("ài hào", "hobby; interest; to be fond of"),
    "公交车": ("gōng jiāo chē", "bus"),
    # ---- band 3
    "把": ("bǎ", "particle putting the object first (把门关上); to hold; measure word for things with handles"),
    "被": ("bèi", "by (marks the passive); quilt"),
    "为": ("wèi", "for; for the sake of; because of"),
    "才": ("cái", "only then; not until; only (so few); talent"),
    "起": ("qǐ", "to rise; to get up; to start"),
    "带": ("dài", "to bring; to take along; belt; zone"),
    "种": ("zhǒng", "kind; type; seed"),
    "老": ("lǎo", "old; (before a surname) 老王; always"),
    "行": ("xíng", "OK; capable; to walk; to go"),
    "张": ("zhāng", "measure word for flat things; to open"),
    "发": ("fā", "to send; to issue; to develop"),
    "干": ("gàn", "to do; to work"),
    "刚": ("gāng", "just (now); only just; hard"),
    "越": ("yuè", "the more… the more (越…越…); to exceed"),
    "句": ("jù", "measure word for sentences; sentence"),
    "马": ("mǎ", "horse"),
    "双": ("shuāng", "pair; two; double"),
    "来自": ("lái zì", "to come from"),
    "卡": ("kǎ", "card; to block"),
    "挺": ("tǐng", "quite; rather; straight"),
    "马上": ("mǎ shàng", "at once; right away; immediately"),
    "一般": ("yī bān", "ordinary; so-so; generally"),
    "差": ("chà", "poor; not up to standard; to lack; to be short of"),
    "久": ("jiǔ", "long (time); for a long time"),
    "关": ("guān", "to close; to turn off; pass"),
    "牛": ("niú", "cow; ox"),
    "照": ("zhào", "to shine; to take (a photo); according to"),
    "节": ("jié", "festival; measure word for lessons; section"),
    "层": ("céng", "floor (storey); layer"),
    "遍": ("biàn", "time through (看一遍 read it once); everywhere"),
    "室": ("shì", "room"),
    "咱们": ("zán men", "we; us (including you)"),
    "封": ("fēng", "measure word for letters; to seal"),
    "旧": ("jiù", "old; used; former"),
    "北": ("běi", "north"),
    "员": ("yuán", "person doing a job; member; employee"),
    "胖": ("pàng", "fat; plump", []),
    "页": ("yè", "page", []),
    "刷": ("shuā", "to brush; to swipe (a card, a phone)"),
    "相机": ("xiàng jī", "camera"),
    "叔叔": ("shū shu", "uncle (father's younger brother; also a friendly address)"),
    "刻": ("kè", "quarter (of an hour); moment; to carve"),
    "锻炼": ("duàn liàn", "to exercise; to work out; to toughen"),
    "黄色": ("huáng sè", "yellow"),
    "园": ("yuán", "garden; park"),
    "阿姨": ("ā yí", "aunt; auntie (friendly address); nanny"),
    "感冒": ("gǎn mào", "to catch cold; a cold"),
    "晚点": ("wǎn diǎn", "late; delayed"),
    "一块儿": ("yī kuài r", "together; a piece; one yuan"),
    "四季": ("sì jì", "the four seasons"),
    "凉快": ("liáng kuai", "pleasantly cool"),
    "外卖": ("wài mài", "takeout; food delivery"),
    "关机": ("guān jī", "to turn off (a phone, a computer)"),
    "开机": ("kāi jī", "to turn on (a phone, a computer)"),
    "后天": ("hòu tiān", "the day after tomorrow"),
    "课文": ("kè wén", "text (of a lesson)"),
    "角": ("jiǎo", "angle; corner; horn; jiao (a tenth of a yuan)"),
    "的话": ("de huà", "if (…的话)"),
    "生气": ("shēng qì", "angry; to get angry"),
    "一边": ("yī biān", "one side; while (一边…一边…)"),
    "心里": ("xīn li", "in one's heart; in one's mind"),
    "毛": ("máo", "hair; fur; mao (a tenth of a yuan)"),
    "极": ("jí", "extremely"),
    "东": ("dōng", "east"),
    "季": ("jì", "season"),
    "蓝": ("lán", "blue"),
    "纸": ("zhǐ", "paper"),
    "草": ("cǎo", "grass"),
    "牙": ("yá", "tooth"),
}


def choose(word: str, entry: dict) -> dict | None:
    """The reading a learner at this band means, and what else the word can be."""
    forms = []
    for f in entry["forms"]:
        py = (f.get("i") or {}).get("y", "")
        items = meaning_items(f.get("m", []))
        if py and items:
            forms.append({"py": py, "items": items, "cl": [c for c in f.get("c", []) if c]})
    # A capitalised reading is a name — 百 as the surname Bǎi — and goes,
    # unless the word is nothing but a name: 中国, 汉语.
    common = [f for f in forms if not f["py"][:1].isupper()]
    forms = common or forms
    if not forms:
        return None

    fixed = SENSE.get(word)
    same = lambda a, b: a.lower() == b.lower()  # noqa: E731
    if fixed:
        main = next((f for f in forms if same(f["py"], fixed[0])), None)
        main = {**(main or {"items": [], "cl": []}), "py": fixed[0]}
        d = fixed[1]
    else:
        main = max(forms, key=lambda f: len(f["items"]))
        d = gloss(main["items"])

    alt: list[dict] = []
    if fixed and len(fixed) > 2:
        alt = [{"py": py, "d": ad} for py, ad in fixed[2]]
    else:
        for f in forms:
            if same(f["py"], main["py"]) or any(same(a["py"], f["py"]) for a in alt):
                continue
            alt.append({"py": f["py"], "d": gloss(f["items"], 36)})
    out = {"w": word, "py": main["py"], "d": d, "hsk": entry["band"]}
    cl = main["cl"] or next((f["cl"] for f in forms if same(f["py"], main["py"]) and f["cl"]), [])
    if cl:
        out["cl"] = cl[:3]
    if alt:
        out["alt"] = alt[:2]
    return out


# ------------------------------------------------------------------ examples

GRIM = re.compile(
    r"\b(kill|killed|killer|murder|suicide|rape|drugs?|gun|blood|corpse|die|died|"
    r"dead|death|bomb|war|hate|stupid|idiot|drunk|naked|sex)\b", re.I)


class Segmenter:
    """Longest match first, over the syllabus plus CC-CEDICT's short words."""

    def __init__(self, vocab: set[str]):
        self.vocab = vocab

    def cut(self, zh: str) -> list[str]:
        out: list[str] = []
        i = 0
        while i < len(zh):
            if not ("一" <= zh[i] <= "鿿"):
                i += 1
                continue
            for n in (4, 3, 2, 1):
                piece = zh[i:i + n]
                if len(piece) == n and (n == 1 or piece in self.vocab):
                    out.append(piece)
                    i += n
                    break
        return out


def pick_examples(words: list[dict], pairs: list[tuple[str, str]], ced: dict,
                  to_pinyin) -> None:
    """
    Up to two short sentences per word, written in words from its own band or
    below wherever the corpus has one — a sentence with three harder words in
    it does not show the word, it hides it. The word has to be a word of the
    sentence, not a run of its characters: 大 is not shown in 大家好.
    """
    band = {w["w"]: w["hsk"] for w in words}
    vocab = set(band) | {w for w in ced if 2 <= len(w) <= 4 and CJK.match(w)}
    seg = Segmenter(vocab)

    by_word: dict[str, list[tuple]] = {}
    seen: set[str] = set()
    for zh, en in pairs:
        # 在这等着。 and 在这等着！ are one sentence as far as reading goes.
        key = "".join(c for c in zh if "\u4e00" <= c <= "\u9fff")
        if key in seen or GRIM.search(en):
            continue
        seen.add(key)
        tokens = seg.cut(zh)
        if not tokens:
            continue
        for t in set(tokens):
            b = band.get(t)
            if not b or b > EXAMPLE_BANDS:
                continue
            others = [x for x in tokens if x != t]
            # Harder than the word itself, or off the lists altogether (names:
            # Tatoeba is full of 汤姆 and 玛丽).
            above = sum(1 for x in others if band.get(x, 99) > b)
            by_word.setdefault(t, []).append((above, len(zh), zh, en))

    for w in words:
        if w["hsk"] > EXAMPLE_BANDS:
            continue
        cands = sorted(by_word.get(w["w"], []))[:EXAMPLES_PER_WORD]
        if cands:
            w["ex"] = [{"zh": zh, "py": to_pinyin(zh), "en": en} for _, _, zh, en in cands]


def build_words(hsk26: dict[str, dict], pairs: list[tuple[str, str]], ced: dict,
                to_pinyin) -> list[dict]:
    """
    Every word on the lists, band by band, commonest first within a band.

    `to_pinyin(zh, ced)` transcribes an example. It is handed a dictionary in
    which each word's chosen reading comes first, so the sentence under 东西
    says dōng xi, the way the word above it does.
    """
    order = sorted(hsk26.items(), key=lambda kv: (kv[1]["band"], kv[1]["q"], kv[0]))
    words = [w for w in (choose(k, v) for k, v in order) if w]
    chosen = dict(ced)
    for w in words:
        if len(w["w"]) > 1:
            chosen[w["w"]] = [{"py": w["py"], "defs": [w["d"]]}] + ced.get(w["w"], [])
    pick_examples(words, pairs, ced, lambda zh: to_pinyin(zh, chosen))
    return words
