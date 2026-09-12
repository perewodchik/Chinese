#!/usr/bin/env python3
"""
Build the character and stroke datasets consumed by the app.

Radicals are a dataset of their own, built afterwards by build_radicals.py
from the hand-written table in radicals_table.py.

Reads raw sources from .cache/ (downloading anything missing) and writes
JSON into public/data/. Run with:  python scripts/build_data.py

Sources
  charlist.txt / wordlist.txt   HSK 3.0 standard, OCR'd by Pleco      (MIT)
  mmah_dictionary.txt           Make Me a Hanzi                       (LGPL / Arphic PL)
  hanziDB.csv                   Jun Da frequency + Kangxi radical no. (MIT)
  cedict.txt                    CC-CEDICT                             (CC BY-SA 4.0)
  tatoeba/                      Tatoeba sentence pairs                (CC BY 2.0 FR)
  hanzi-writer-data             stroke outlines, via jsDelivr         (Arphic PL)
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from radicals_table import shape_glosses  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")
OUT = os.path.join(ROOT, "public", "data")
STROKE_CACHE = os.path.join(CACHE, "strokes")

DOWNLOADS = {
    "charlist.txt": "https://raw.githubusercontent.com/elkmovie/hsk30/master/charlist.txt",
    "wordlist.txt": "https://raw.githubusercontent.com/elkmovie/hsk30/master/wordlist.txt",
    "mmah_dictionary.txt": "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt",
    "hanziDB.csv": "https://raw.githubusercontent.com/ruddfawcett/hanziDB.csv/master/data/hanziDB.csv",
    "jieba_dict.txt": "https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt",
}

UA = {"User-Agent": "Mozilla/5.0 (hanzi-workshop build script)"}


def log(*a):
    print(*a, flush=True)


def ensure_sources():
    os.makedirs(CACHE, exist_ok=True)
    for name, url in DOWNLOADS.items():
        p = os.path.join(CACHE, name)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            continue
        log(f"  downloading {name} ...")
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r:
            open(p, "wb").write(r.read())


# --------------------------------------------------------------------------
# Ideographic Description Sequence parsing
# --------------------------------------------------------------------------
# ⿲ and ⿳ take three operands; every other IDC takes two.
IDC_3 = "⿲⿳"
IDC_2 = "⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻"
IDC = IDC_2 + IDC_3


def parse_ids(s: str):
    """Parse an IDS string into a nested tree: (operator, [children]) or a leaf str."""
    pos = 0

    def node():
        nonlocal pos
        if pos >= len(s):
            return None
        ch = s[pos]
        pos += 1
        if ch in IDC:
            n = 3 if ch in IDC_3 else 2
            kids = [node() for _ in range(n)]
            return (ch, [k for k in kids if k is not None])
        return ch

    t = node()
    return t


def top_parts(tree):
    """Top-level operands of the decomposition, as strings."""
    if not isinstance(tree, tuple):
        return [tree] if tree else []
    return [flatten(k) for k in tree[1]]


def flatten(tree):
    """Render a subtree back to a string (drops IDC operators)."""
    if tree is None:
        return ""
    if not isinstance(tree, tuple):
        return tree
    return "".join(flatten(k) for k in tree[1])


def all_leaves(tree):
    if tree is None:
        return []
    if not isinstance(tree, tuple):
        return [tree]
    out = []
    for k in tree[1]:
        out += all_leaves(k)
    return out


# --------------------------------------------------------------------------
# Load raw sources
# --------------------------------------------------------------------------
def load_hsk_chars():
    """{'一级汉字表': [chars...], ...} from the official standard."""
    secs, cur = {}, None
    for line in open(os.path.join(CACHE, "charlist.txt"), encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"):
            continue
        if "\t" not in line:
            cur = line.strip()
            secs[cur] = []
        else:
            secs[cur].append(line.split("\t")[1].strip())
    return secs


def load_hsk_words():
    """word -> lowest HSK level it appears at."""
    lvl_of, cur = {}, 0
    names = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7}
    for line in open(os.path.join(CACHE, "wordlist.txt"), encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "级词汇表" in line or "级词语表" in line:
            cur = names.get(line[0], cur)
            continue
        parts = line.split(None, 1)
        if len(parts) != 2:
            continue
        # entries look like: 白（形）  or  爸爸｜爸
        for w in re.split(r"[｜|]", parts[1]):
            w = re.sub(r"[（(].*?[)）]", "", w).strip()
            if w and all("一" <= c <= "鿿" for c in w):
                lvl_of.setdefault(w, cur)
    return lvl_of


def load_mmah():
    d = {}
    for line in open(os.path.join(CACHE, "mmah_dictionary.txt"), encoding="utf-8"):
        e = json.loads(line)
        d.setdefault(e["character"], e)
    return d


def load_hanzidb():
    rows = {}
    with open(os.path.join(CACHE, "hanziDB.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.setdefault(r["charcter"], r)
    return rows


TONE = {
    "a": "āáǎà", "e": "ēéěè", "i": "īíǐì", "o": "ōóǒò",
    "u": "ūúǔù", "v": "ǖǘǚǜ", "ü": "ǖǘǚǜ",
}


def numbered_to_accented(syl: str) -> str:
    """CC-CEDICT writes 'hao3'; render it as 'hǎo'."""
    m = re.match(r"^([a-zA-ZüÜ:]+)([1-5])$", syl)
    if not m:
        return syl.replace("u:", "ü").replace("U:", "Ü")
    body, tone = m.group(1).replace("u:", "ü").replace("U:", "Ü"), int(m.group(2))
    if tone == 5:
        return body
    low = body.lower()
    # standard placement: a/e win; 'ou' takes the o; else the last vowel
    idx = -1
    for v in ("a", "e"):
        if v in low:
            idx = low.index(v)
            break
    if idx < 0 and "ou" in low:
        idx = low.index("o")
    if idx < 0:
        for i in range(len(low) - 1, -1, -1):
            if low[i] in "aeiouüv":
                idx = i
                break
    if idx < 0:
        return body
    base = low[idx]
    marked = TONE[base][tone - 1]
    if body[idx].isupper():
        marked = marked.upper()
    return body[:idx] + marked + body[idx + 1:]


def pinyin_str(raw: str) -> str:
    return " ".join(numbered_to_accented(s) for s in raw.split())


def tidy(s: str) -> str:
    """Collapse the stray non-breaking spaces the source data is full of."""
    return re.sub(r"\s+", " ", (s or "").replace(" ", " ")).strip()


def sentence_pinyin(zh: str, ced, char_py: dict[str, str]) -> str:
    """
    Transcribe a sentence by matching the longest word CC-CEDICT knows at each
    position, falling back to single characters.

    Single characters take their reading from the character dictionaries rather
    than from CC-CEDICT, whose first entry is often a rare one: it lists 胖 as
    "pán" before "pàng", and 那 as the surname "Nā". For multi-character words a
    capitalised reading is a proper noun and is passed over the same way.

    Base tones only: tone sandhi (三 + 三, and the shifts on 不 and 一) is a rule
    of speech, not of spelling, and dictionaries write the base tone.
    """
    def word_py(chunk: str, prev: str = "") -> str:
        if len(chunk) == 1 and chunk in char_py:
            # 只 is the one character whose fallback reading has to be decided
            # from context rather than from a table: after a number, a
            # demonstrative or 有/是 it is the measure word zhī (一只猫, 有只鸟),
            # and anywhere else it is the adverb zhǐ (只吃菜). Both are the same
            # headword, so no dictionary can make the call. 只是 and 只有 are
            # matched as words before this is reached, so 是/有 are safe here.
            if chunk == "只":
                return "zhī" if prev in "一二两三四五六七八九十几这那每某半有是" else "zhǐ"
            return char_py[chunk]
        entries = ced.get(chunk) or []
        ranked = sorted(entries, key=lambda e: e["py"][:1].isupper())
        return ranked[0]["py"] if ranked else ""

    out: list[str] = []
    i = 0
    while i < len(zh):
        if not ("一" <= zh[i] <= "鿿"):
            i += 1
            continue
        for n in (4, 3, 2, 1):
            chunk = zh[i:i + n]
            if len(chunk) < n:
                continue
            if (len(chunk) == 1 and chunk in char_py) or chunk in ced:
                py = word_py(chunk, zh[i - 1] if i else "")
                if py:
                    out.append(py)
                    i += n
                    break
        else:
            i += 1
    return " ".join(out)


def load_wordfreq():
    """word -> corpus frequency, from jieba's dictionary."""
    d = {}
    for line in open(os.path.join(CACHE, "jieba_dict.txt"), encoding="utf-8"):
        p = line.split()
        if len(p) >= 2 and p[1].isdigit():
            d[p[0]] = int(p[1])
    return d


def load_cedict():
    """simplified -> list of {py, defs}, best entry first."""
    d = defaultdict(list)
    pat = re.compile(r"^(\S+) (\S+) \[([^\]]*)\] /(.*)/$")
    for line in open(os.path.join(CACHE, "cedict.txt"), encoding="utf-8"):
        if line.startswith("#"):
            continue
        m = pat.match(line.strip())
        if not m:
            continue
        trad, simp, py, defs = m.groups()
        gl = [g for g in defs.split("/") if g]
        d[simp].append({"trad": trad, "py": pinyin_str(py), "defs": gl})
    return d


def traditional_only(ced) -> set[str]:
    """
    Characters that exist only as traditional forms.

    Tatoeba's Chinese corpus mixes both scripts, and hanziDB lists traditional
    characters too, so filtering against it let 良藥苦口 and 請打開窗 through onto
    simplified worksheets. Comparing each CC-CEDICT headword against its own
    simplified spelling gives the set precisely.
    """
    trad: set[str] = set()
    simp: set[str] = set()
    for key, entries in ced.items():
        simp.update(key)
        for e in entries:
            t = e.get("trad", "")
            if len(t) == len(key):
                trad.update(a for a, b in zip(t, key) if a != b)
    return trad - simp


def load_sentences(targets: set[str], reject: set[str] | None = None):
    """Pick one short simplified example sentence per target character."""
    tdir = os.path.join(CACHE, "tatoeba")
    need = (os.path.join(tdir, "cmn_sentences.tsv"),
            os.path.join(tdir, "eng_sentences.tsv"),
            os.path.join(tdir, "cmn-eng_links.tsv"))
    if not all(os.path.exists(p) for p in need):
        log("  ! tatoeba files absent - skipping example sentences")
        return {}

    cmn = {}
    for line in open(need[0], encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 3:
            cmn[p[0]] = p[2]
    eng = {}
    for line in open(need[1], encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 3:
            eng[p[0]] = p[2]

    # Prefer sentences built only from characters we can vouch for as simplified.
    simp_ok = set(load_hanzidb().keys())
    reject = reject or set()

    best: dict[str, tuple] = {}
    for line in open(need[2], encoding="utf-8"):
        a, _, b = line.rstrip("\n").partition("\t")
        zh, en = cmn.get(a), eng.get(b.strip())
        if not zh or not en:
            continue
        n = len(zh)
        if not (5 <= n <= 16) or len(en) > 70:
            continue
        hz = [c for c in zh if "一" <= c <= "鿿"]
        if not hz or any(c not in simp_ok or c in reject for c in hz):
            continue
        for c in set(hz) & targets:
            # shortest sentence wins; it is the easiest to read on a worksheet
            if c not in best or n < best[c][0]:
                best[c] = (n, zh, en)
    return {c: {"zh": v[1], "en": v[2]} for c, v in best.items()}


# --------------------------------------------------------------------------
# Stroke outlines
# --------------------------------------------------------------------------
def fetch_strokes(chars):
    os.makedirs(STROKE_CACHE, exist_ok=True)

    def one(ch):
        p = os.path.join(STROKE_CACHE, f"{ord(ch)}.json")
        if os.path.exists(p):
            return
        url = ("https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/"
               + urllib.parse.quote(ch) + ".json")
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                open(p, "wb").write(r.read())
        except Exception:
            pass

    todo = [c for c in chars
            if not os.path.exists(os.path.join(STROKE_CACHE, f"{ord(c)}.json"))]
    if todo:
        log(f"  fetching {len(todo)} stroke files ...")
        with ThreadPoolExecutor(16) as ex:
            list(ex.map(one, todo))

    out = {}
    for c in chars:
        p = os.path.join(STROKE_CACHE, f"{ord(c)}.json")
        if os.path.exists(p):
            try:
                out[c] = json.load(open(p, encoding="utf-8"))
            except Exception:
                pass
    return out


# --------------------------------------------------------------------------
# Make Me a Hanzi supplies the headword reading, and is right where CC-CEDICT is
# not (胖 pàng before pán, 说 shuō before shuì). These are the characters where
# it is the one that is wrong: either it lists a single literary reading, or it
# lists several and the modern one is not first. Found by cross-checking every
# character against CC-CEDICT, hanziDB and the readings its own example words
# use, then judging the disagreements by hand. The sheet prints every reading a
# character has, so each entry is the whole list, commonest first.
PINYIN_OVERRIDE = {
    # -- the leading reading is the wrong one --------------------------------
    "谁": ["shéi", "shuí"],  # MMAH has only the literary shuí; speech is shéi
    "呢": ["ne", "ní"],      # MMAH leads with né; the particle is ne, 呢子 is ní
    "吧": ["ba", "bā"],      # MMAH leads with bā (酒吧); HSK 1 wants the particle
    "子": ["zǐ", "zi"],      # MMAH gives only the suffix zi; the character is zǐ
    "地": ["dì", "de"],      # de is the adverbial particle; the character is dì
    "只": ["zhǐ", "zhī"],    # zhǐ "only"; zhī is the measure word
    "似": ["sì", "shì"],     # shì occurs only in 似的
    "甚": ["shèn", "shén"],  # shén only in 甚么, a variant spelling of 什么
    "著": ["zhù", "zhuó"],   # zhe belongs to traditional 著 = simplified 着
    "咳": ["ké", "hāi"],     # hāi is the interjection, not 咳嗽
    "茄": ["qié", "jiā"],    # jiā only in 雪茄 (cigar)
    "杠": ["gàng", "gāng"],  # 杠铃, 杠杆
    "罗": ["luó", "luō"],    # luō only in the 啰嗦 spelling
    "拓": ["tuò", "tà"],     # tà is taking a rubbing; 开拓 is tuò
    "咽": ["yān", "yàn", "yè"],  # the noun (throat) is yān
    "哗": ["huá", "huā"],    # huā is the sound of water; 喧哗 is huá
    "匙": ["chí", "shi"],    # MMAH writes shī; 钥匙 is neutral shi
    "绷": ["bēng", "běng"],
    "嚼": ["jiáo", "jué", "jiào"],  # jiáo is chewing, the everyday sense
    "绩": ["jì"],            # jī is the older reading; 成绩 is jì
    "驯": ["xùn"],
    "甸": ["diàn"],
    "卓": ["zhuó"],
    "迹": ["jì"],
    "框": ["kuàng"],
    "脊": ["jǐ"],
    "萎": ["wěi"],
    "掺": ["chān"],
    # -- right reading, but one the sheet's own words use is missing ----------
    "冠": ["guān", "guàn"],   # 冠军
    "假": ["jiǎ", "jià"],     # 假期
    "薄": ["báo", "bó"],      # 薄弱
    "爪": ["zhǎo", "zhuǎ"],   # 爪子
    "吁": ["xū", "yù"],       # 呼吁
    "呛": ["qiāng", "qiàng"],
    "帖": ["tiē", "tiě", "tiè"],  # 请帖
    "贾": ["jiǎ", "gǔ"],      # the surname, and 商贾
    "勒": ["lēi", "lè"],      # 勒索
    "逮": ["dǎi", "dài"],     # 逮捕
    "揣": ["chuāi", "chuǎi"], # 揣测
    "潦": ["lǎo", "liáo"],    # 潦草
    "臊": ["sāo", "sào"],     # 害臊
    "曝": ["pù", "bào"],      # 曝光
    "啊": ["a", "ā"],
    "仆": ["pú", "pū"],       # pú is 仆人, pū is to fall forward
    "宿": ["sù", "xiǔ", "xiù"],  # MMAH omits xiǔ, the 一宿 of "one night"
    # -- radicals ------------------------------------------------------------
    "宀": ["mián"],          # MMAH lists a spurious gài first
    "卜": ["bǔ"],            # MMAH gives bo, which occurs only in 萝卜
    "尢": ["wāng"],          # MMAH gives yóu, treating it as a form of 尤
}

# What a lone character should be read as when transcribing a sentence, where
# that is not the headword reading above. 地 heads its entry as dì because that
# is what the character means, but a 地 that CC-CEDICT did not swallow into a
# word is nearly always the adverbial 地 of 慢慢地走; the same split applies to
# 著, which reaches the corpus mostly as the traditional spelling of 着. 只 needs
# more than a table and is handled in sentence_pinyin.
SENTENCE_READING = {
    "地": "de",
    "著": "zhe",
}

# --------------------------------------------------------------------------
# Themed sets, so a sheet can be about something rather than just the next 20
# characters. Written by hand - no dataset groups hanzi by topic - and filtered
# against the syllabus at build time, so a typo silently drops rather than
# producing a template that cannot render.
THEMES: list[tuple[str, str, str, str]] = [
    ("numbers", "Numbers & counting", "Digits, amounts and the measure words that go with them",
     "一二三四五六七八九十百千万亿零个半两双多少几第次些倍"),
    ("family", "Family & people", "Who is who at home and among friends",
     "人爸妈儿子女孩朋友哥姐弟妹爷奶男她他你我们家亲父母夫妻姓名"),
    ("food", "Food & drink", "Eating out, cooking and ordering",
     "吃喝饭菜茶水果肉鱼米面包蛋奶糖盐油汤酒杯碗饿渴甜辣咸酸香味餐厅点单饮"),
    ("time", "Time & dates", "Clock, calendar and how often",
     "年月日时分秒早晚午今明昨天周星期点钟前后现在刚才常总每次久久"),
    ("travel", "Travel & getting around", "Tickets, transport and directions",
     "车火机飞船路走去来到站票旅游国际出发回程地图快慢近远送接过"),
    ("places", "Places & directions", "Where things are, and getting there",
     "上下左右前后里外中东西南北边面这那哪场店家学校室房间院城市国街道口"),
    ("body", "Body & health", "The body, feeling unwell, and the doctor",
     "头手脚眼耳口鼻心身体病医院药疼累休息睡病重轻死活血牙腿背胖瘦"),
    ("nature", "Weather & nature", "Sky, land, seasons and living things",
     "天气风雨雪云山水火土木石花草树林河海月阳光热冷凉暖春夏秋冬鸟马牛羊虫鱼狗猫"),
    ("study", "School & study", "The classroom and getting things learned",
     "学生老师书写读课本笔字词语问题考试班级教科目习练懂知道会能对错"),
    ("money", "Work & money", "Buying, selling and going to work",
     "工作钱买卖贵便宜元块公司业务事忙做用花费收给还借银行价"),
    ("home", "Home & everyday objects", "The things around you all day",
     "房间门窗床桌椅灯电话视机衣服鞋帽杯碗刀纸笔包箱袋镜表钥匙"),
    ("colour", "Colours & describing", "Adjectives you reach for constantly",
     "红黄蓝绿白黑色大小长短高低新旧好坏快慢多少胖瘦干净漂亮美丑真假"),
    ("feelings", "Feelings & opinions", "Saying how you feel about it",
     "爱喜欢想觉得高兴快乐忙累怕气笑哭愿意希望怕急难愉悲乐"),
    ("verbs", "Everyday verbs", "The actions that carry most sentences",
     "是有看听说读写做去来吃喝走跑坐站睡起给拿放开关买卖找问答带送带回"),
    ("grammar", "Question words & particles", "The small words that hold sentences together",
     "谁什么哪几怎为的了吗呢吧和也不很都还就再又只把被让从对向被比更最"),
]


def main():
    log("· sources")
    ensure_sources()
    hsk_secs = load_hsk_chars()
    hsk_words = load_hsk_words()
    # Everyday expressions the HSK 3.0 word table does not list as lexical items
    # (it has 谢谢 and 再见 but not 你好). Without these a beginner sheet for 好
    # would never show the first word anyone learns.
    for w, lv in {"你好": 1, "你们好": 1, "早上好": 1, "晚上好": 1}.items():
        hsk_words.setdefault(w, lv)
    mm = load_mmah()
    hdb = load_hanzidb()
    ced = load_cedict()
    wordfreq = load_wordfreq()

    # Every character in the standard, level by level. Band 7 is published as
    # one combined 七一九级 table of 1200, so levels 7, 8 and 9 are not
    # separable and are all labelled 7.
    DIGIT = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7}
    levels: list[tuple[int, list[str]]] = []
    hsk_level: dict[str, int] = {}
    for name, chars in hsk_secs.items():
        m = re.match(r"([一二三四五六七])", name)
        if not m or "汉字表" not in name:
            continue
        lv = DIGIT[m.group(1)]
        levels.append((lv, chars))
        for c in chars:
            hsk_level.setdefault(c, lv)
    levels.sort(key=lambda t: t[0])
    all_chars = [c for _, chars in levels for c in chars]
    log("  HSK 3.0 characters: "
        + ", ".join(f"L{lv} {len(ch)}" for lv, ch in levels)
        + f"  = {len(all_chars)}")

    def freq(c):
        r = hdb.get(c)
        return int(r["frequency_rank"]) if r else 99999

    # ---------------- characters ----------------
    log("· characters")
    target = set(all_chars)
    sentences = load_sentences(target, traditional_only(ced))
    log(f"  example sentences matched: {len(sentences)}/{len(target)}")

    # Primary reading per character, preferred over CC-CEDICT's first entry.
    char_py: dict[str, str] = {}
    for ch, entry in mm.items():
        if entry.get("pinyin"):
            char_py[ch] = entry["pinyin"][0]
    for ch, row in hdb.items():
        if ch not in char_py and row.get("pinyin"):
            char_py[ch] = row["pinyin"].split()[0]
    char_py.update({ch: py[0] for ch, py in PINYIN_OVERRIDE.items()})
    char_py.update(SENTENCE_READING)

    def with_pinyin(sent):
        if not sent:
            return None
        return {**sent, "py": sentence_pinyin(sent["zh"], ced, char_py)}

    def components_of(c):
        ids = mm.get(c, {}).get("decomposition", "")
        if not ids or ids == "？":
            return [], []
        tree = parse_ids(ids)
        return top_parts(tree), [x for x in all_leaves(tree) if x != "？"]

    # recursive dependency: every level-1 character reachable inside c
    def deep_parts(c, depth=0, seen=None):
        seen = seen or set()
        if depth > 6 or c in seen:
            return set()
        seen = seen | {c}
        out = set()
        _, leaves = components_of(c)
        for p in leaves:
            if p == c:
                continue
            out.add(p)
            out |= deep_parts(p, depth + 1, seen)
        return out

    strokes_needed = set(all_chars)
    deps = {}
    for c in all_chars:
        # Only wait for parts you would actually have met by then. A band-1
        # character built from a band-6 component can never have that component
        # taught first, so treating it as a prerequisite would just stall it.
        lv = hsk_level[c]
        d = {p for p in deep_parts(c) & target if hsk_level.get(p, 99) <= lv}
        d.discard(c)
        deps[c] = d
        strokes_needed |= deep_parts(c)

    # depth of the longest dependency chain, kept for display only
    layer = {}

    def calc(c, guard=None):
        if c in layer:
            return layer[c]
        guard = guard or set()
        if c in guard:
            return 0
        v = 0
        for d in deps.get(c, ()):
            v = max(v, calc(d, guard | {c}) + 1)
        layer[c] = v
        return v

    for c in all_chars:
        calc(c)

    sc_of = {}
    stroke_data = fetch_strokes(strokes_needed)
    log(f"  stroke outlines: {len(stroke_data)}/{len(strokes_needed)}")
    for c, d in stroke_data.items():
        sc_of[c] = len(d["strokes"])

    # Greedy topological order, one HSK band at a time: a character becomes
    # available once every part of it that is also in the syllabus has been
    # taught, and among everything available we take the simplest and most
    # useful next. Sorting by dependency depth instead would bury 的 at the end
    # of band 1 purely because 白 sits above it.
    #
    # `done` carries across bands, so a band-2 character whose parts were taught
    # in band 1 is available immediately.
    done: set[str] = set()
    ordered: list[str] = []
    for lv, chars in levels:
        remaining = set(chars)
        while remaining:
            ready = [c for c in remaining if deps[c] <= done]
            if not ready:  # cyclic decomposition; fall back to the remainder
                ready = list(remaining)
            pick = min(ready, key=lambda c: (sc_of.get(c, 99), freq(c)))
            ordered.append(pick)
            done.add(pick)
            remaining.discard(pick)
        log(f"  band {lv}: ordered {len(chars)}")

    # -------- words per character --------
    # This ends up on a worksheet, so a gloss has to be usable as-is: no register
    # labels, no cross-references, and nothing crude.
    DROP_PREFIX = ("surname", "variant of", "abbr.", "see ", "old variant",
                   "used in", "erhua variant", "also written")
    DIRTY = re.compile(
        r"\b(vulgar|slang|coarse|offensive|derogatory|obscene|taboo|fuck|shit|"
        r"damn|whore|bitch|penis|vagina|sexual|prostitut)", re.I)

    def clean_gloss(defs):
        out, seen = [], set()
        for g in defs:
            g = g.strip()
            if not g or g.startswith(DROP_PREFIX) or g.startswith("CL:"):
                continue
            if DIRTY.search(g):
                return None  # one crude sense taints the whole entry
            # CC-CEDICT leaks numbered pinyin into glosses:
            # "equivalent to either 是[shi4] or 就是[jiu4 shi4]".
            g = re.sub(r"\s*\[[^\]]*\]", "", g)
            g = re.sub(r"\s*\(.*?\)\s*", " ", g).strip(" ,;")
            g = re.sub(r"\s+", " ", g)
            k = g.lower()
            if g and k not in seen:
                seen.add(k)
                out.append(g)
        return out or None

    def shorten(s, n=46):
        if len(s) <= n:
            return s
        cut = s[:n].rsplit(" ", 1)[0].rstrip(" ,;")
        return (cut or s[:n]) + "…"

    # Invert CC-CEDICT once: scanning all 125k entries per character was fine
    # for 300 of them and is not for 3000.
    words_by_char: dict[str, list[str]] = defaultdict(list)
    for w in ced:
        if 2 <= len(w) <= 3 and all("一" <= x <= "鿿" for x in w):
            for x in set(w):
                words_by_char[x].append(w)

    def words_for(c):
        cands = []
        for w in words_by_char.get(c, ()):
            if w == c:
                continue
            # CC-CEDICT capitalises proper-noun readings and often lists them
            # first: 大学 resolves to "the Great Learning" before "university".
            entries = sorted(ced[w], key=lambda e: (e["py"][:1].isupper(), -len(e["defs"])))
            e, gl = None, None
            for cand in entries:
                g = clean_gloss(cand["defs"])
                if g:
                    e, gl = cand, g
                    break
            if not gl:
                continue
            lvl = hsk_words.get(w)
            wf = wordfreq.get(w, 0)
            if lvl is None and wf < 200:
                continue  # not a real word in the corpus, or far too rare
            if lvl is None and e["py"][:1].isupper():
                continue  # place / person name that is not on the syllabus
            # HSK order first (it is a curated teaching sequence), then corpus
            # frequency to fill the remaining slots and to break ties.
            score = (0 if lvl else 1, lvl or 99, -wf, len(w))
            cands.append((score, {"w": w, "p": e["py"],
                                  "d": shorten("; ".join(gl[:2])), "hsk": lvl}))
        cands.sort(key=lambda t: t[0])
        return [c2 for _, c2 in cands[:3]]

    # -------- confusable characters --------
    pool = [c for c in hdb if freq(c) <= 2500 and c in mm]
    ids_of = {c: mm[c].get("decomposition", "") for c in pool}

    def edit(a, b):
        if a == b:
            return 0
        prev = list(range(len(b) + 1))
        for i, x in enumerate(a, 1):
            cur = [i]
            for j, y in enumerate(b, 1):
                cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
            prev = cur
        return prev[-1]

    by_sc = defaultdict(list)
    for c in pool:
        s = int(hdb[c]["stroke_count"]) if hdb[c]["stroke_count"].isdigit() else 0
        by_sc[s].append(c)

    CURATED = {
        "我": ["找"], "找": ["我"], "天": ["夫"], "己": ["已"], "日": ["白", "目"],
        "白": ["百", "日"], "百": ["白"], "木": ["本"], "本": ["木"], "人": ["入", "八"],
        "干": ["千"], "王": ["主"], "田": ["由"], "力": ["刀"], "太": ["大"],
        "先": ["洗"], "洗": ["先"], "问": ["间", "门"], "间": ["问"], "门": ["问"],
        "住": ["注"], "买": ["卖"], "午": ["牛"], "牛": ["午"], "土": ["士"],
        "见": ["贝"], "米": ["来"], "东": ["车"], "书": ["车"], "冷": ["零"],
        "他": ["她"], "她": ["他"], "在": ["再"], "再": ["在"], "做": ["作"],
        "作": ["做"], "很": ["跟"], "跟": ["很"], "睡": ["醒"], "话": ["活"],
    }

    def confusables(c):
        out = list(CURATED.get(c, []))
        s = int(hdb[c]["stroke_count"]) if c in hdb and hdb[c]["stroke_count"].isdigit() else 0
        me = ids_of.get(c, "")
        cands = []
        if me and len(me) > 1:
            for s2 in (s - 1, s, s + 1):
                for d in by_sc.get(s2, ()):
                    if d == c or d in out:
                        continue
                    other = ids_of.get(d, "")
                    if not other or abs(len(other) - len(me)) > 1:
                        continue
                    dist = edit(me, other)
                    if dist == 1 and other[0] == me[0]:
                        cands.append((freq(d), d))
        cands.sort()
        for _, d in cands:
            if len(out) >= 3:
                break
            if d not in out:
                out.append(d)
        return out[:3]

    items = []
    for i, c in enumerate(ordered, 1):
        e = mm.get(c, {})
        hd = hdb.get(c, {})
        tops, leaves = components_of(c)
        cd = ced.get(c, [{}])[0]
        py = (PINYIN_OVERRIDE.get(c) or e.get("pinyin")
              or ([cd.get("py")] if cd.get("py") else []))
        defs = e.get("definition") or "; ".join(cd.get("defs", [])[:2])
        rad = e.get("radical") or hd.get("radical")
        radnum = None
        if hd.get("radical_code", "").split(".")[0].isdigit():
            radnum = int(hd["radical_code"].split(".")[0])
        items.append({
            "c": c,
            "i": i,
            "py": py,
            "def": tidy(defs),
            "rad": rad,
            "radNum": radnum,
            "sc": sc_of.get(c),
            "ids": e.get("decomposition") if e.get("decomposition") != "？" else None,
            # Make Me a Hanzi writes ？ for a component it cannot identify -
            # 那 decomposes to ⿰⿹？？阝. A breakdown showing "？ + 阝" teaches
            # nothing, so unless every top-level part is known, there is no
            # breakdown to show.
            "parts": [] if any("？" in p for p in tops) else tops,
            "leaves": [p for p in leaves if p != "？"],
            "ety": ({**e["etymology"], "hint": tidy(e["etymology"].get("hint", ""))}
                    if e.get("etymology") else None),
            "trad": cd.get("trad") if cd.get("trad") and cd.get("trad") != c else None,
            "hsk": hsk_level.get(c, 1),
            "freq": freq(c),
            "layer": layer[c],
            "words": words_for(c),
            "sent": with_pinyin(sentences.get(c)),
            "conf": confusables(c),
        })
        if i % 60 == 0:
            log(f"  {i}/{len(ordered)}")

    # ---------------- write ----------------
    os.makedirs(OUT, exist_ok=True)
    strokes_out = {}
    for c, d in stroke_data.items():
        rec = {"s": d["strokes"], "m": d.get("medians")}
        mt = mm.get(c, {}).get("matches")
        if mt:
            # top-level component index per stroke, for colour-coding
            rec["g"] = [(x[0] if x else 0) for x in mt]
        strokes_out[c] = rec

    def write(name, obj):
        p = os.path.join(OUT, name)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        log(f"  wrote {name}  {os.path.getsize(p)/1024:.0f} KB")

    # Gloss for every component that can appear in a decomposition diagram, so
    # "⿰女子" can be shown as "woman + child" rather than as bare shapes.
    comp_chars = set()
    for it in items:
        comp_chars.update(it["parts"])
        comp_chars.update(it["leaves"])
        if it["rad"]:
            comp_chars.add(it["rad"])
        for d in it["conf"]:
            comp_chars.add(d)
    # A shape that only ever occurs inside other characters - 氵, 扌, 忄 - is
    # glossed with what it means as a radical, because Unihan's own entry for
    # it is a curiosity (乛 is "kwukyel"). A shape that is a character in its
    # own right keeps its own meaning. That second half is what used to be
    # missing: 心, 贝 and 户 took the meaning of whichever radical happened to
    # list them as a variant, and printed on every sheet as "eight", "lid,
    # cover" and "body, corpse".
    shapes = shape_glosses(lambda g: g in target or freq(g) <= 3000)
    components = {}
    for ch in sorted(comp_chars):
        e = mm.get(ch, {})
        hd = hdb.get(ch, {})
        gloss = (e.get("definition") or hd.get("definition") or "").strip()
        py = (" / ".join(PINYIN_OVERRIDE.get(ch) or e.get("pinyin", []))
              or (hd.get("pinyin") or ""))
        if ch in shapes:
            gloss = shapes[ch]
        elif freq(ch) > 4000:
            gloss = ""
        if not gloss and not py:
            continue
        components[ch] = {"py": py, "def": shorten(gloss, 40)}
    log(f"  component glosses: {len(components)}")

    known = {it["c"]: it for it in items}
    order_of = {it["c"]: it["i"] for it in items}
    themes = []
    for tid, name, blurb, chars in THEMES:
        seen, picked = set(), []
        for ch in chars:
            if ch in known and ch not in seen:
                seen.add(ch)
                picked.append(ch)
        picked.sort(key=lambda c: order_of[c])
        dropped = len([c for c in set(chars) if c not in known])
        themes.append({"id": tid, "name": name, "blurb": blurb, "items": picked,
                       "maxHsk": max(known[c]["hsk"] for c in picked)})
        log(f"  theme {tid:9s} {len(picked):3d} characters"
            + (f"  ({dropped} not in the syllabus)" if dropped else ""))

    write("characters.json", {"set": "hsk3.0", "count": len(items),
                              "order": "component-first-by-band", "items": items,
                              "components": components})
    write("themes.json", {"items": themes})

    # Stroke outlines are by far the biggest payload, so the bands most people
    # start with load up front and the rest is fetched only when a template or
    # a filter actually reaches into them.
    core_chars: set[str] = set()
    for it in items:
        if it["hsk"] <= 3:
            core_chars.add(it["c"])
            core_chars.update(it["parts"])
            core_chars.update(it["leaves"])
            core_chars.update(it["conf"])
    core = {c: v for c, v in strokes_out.items() if c in core_chars}
    ext = {c: v for c, v in strokes_out.items() if c not in core_chars}
    write("strokes-core.json", core)
    write("strokes-ext.json", ext)

    log("\nfirst 24 in teaching order:")
    log("  " + " ".join(f"{x['c']}" for x in items[:24]))
    log("last 12:")
    log("  " + " ".join(f"{x['c']}" for x in items[-12:]))
    miss = [x["c"] for x in items if not x["sc"]]
    if miss:
        log(f"! no stroke data for: {''.join(miss)}")


if __name__ == "__main__":
    main()
