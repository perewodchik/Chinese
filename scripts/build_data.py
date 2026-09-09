#!/usr/bin/env python3
"""
Build the character / radical / stroke datasets consumed by the app.

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
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

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
    def word_py(chunk: str) -> str:
        if len(chunk) == 1 and chunk in char_py:
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
                py = word_py(chunk)
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


def load_sentences(targets: set[str]):
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
        if not hz or any(c not in simp_ok for c in hz):
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
# Radical colloquial names (部首名称) - not present in any dataset, authored here.
# Keyed by the written form the learner actually meets.
# --------------------------------------------------------------------------
RADICAL_NAMES = {
    "亻": ("单人旁", "dān rén páng"), "冫": ("两点水", "liǎng diǎn shuǐ"),
    "讠": ("言字旁", "yán zì páng"), "刂": ("立刀旁", "lì dāo páng"),
    "阝": ("耳刀旁", "ěr dāo páng"), "忄": ("竖心旁", "shù xīn páng"),
    "宀": ("宝盖头", "bǎo gài tóu"), "辶": ("走之底", "zǒu zhī dǐ"),
    "扌": ("提手旁", "tí shǒu páng"), "艹": ("草字头", "cǎo zì tóu"),
    "彳": ("双人旁", "shuāng rén páng"), "犭": ("反犬旁", "fǎn quǎn páng"),
    "饣": ("食字旁", "shí zì páng"), "纟": ("绞丝旁", "jiǎo sī páng"),
    "灬": ("四点底", "sì diǎn dǐ"), "礻": ("示字旁", "shì zì páng"),
    "衤": ("衣字旁", "yī zì páng"), "钅": ("金字旁", "jīn zì páng"),
    "疒": ("病字旁", "bìng zì páng"), "穴": ("穴宝盖", "xué bǎo gài"),
    "⺮": ("竹字头", "zhú zì tóu"), "竹": ("竹字头", "zhú zì tóu"),
    "攵": ("反文旁", "fǎn wén páng"), "⺼": ("月字旁", "yuè zì páng"),
    "氵": ("三点水", "sān diǎn shuǐ"), "土": ("提土旁", "tí tǔ páng"),
    "口": ("口字旁", "kǒu zì páng"), "囗": ("方框儿", "fāng kuàng r"),
    "木": ("木字旁", "mù zì páng"), "禾": ("禾木旁", "hé mù páng"),
    "女": ("女字旁", "nǚ zì páng"), "日": ("日字旁", "rì zì páng"),
    "月": ("月字旁", "yuè zì páng"), "火": ("火字旁", "huǒ zì páng"),
    "心": ("心字底", "xīn zì dǐ"), "王": ("王字旁", "wáng zì páng"),
    "目": ("目字旁", "mù zì páng"), "田": ("田字旁", "tián zì páng"),
    "石": ("石字旁", "shí zì páng"), "皿": ("皿字底", "mǐn zì dǐ"),
    "贝": ("贝字旁", "bèi zì páng"), "见": ("见字旁", "jiàn zì páng"),
    "页": ("页字旁", "yè zì páng"), "虫": ("虫字旁", "chóng zì páng"),
    "足": ("足字旁", "zú zì páng"), "车": ("车字旁", "chē zì páng"),
    "马": ("马字旁", "mǎ zì páng"), "鸟": ("鸟字旁", "niǎo zì páng"),
    "鱼": ("鱼字旁", "yú zì páng"), "门": ("门字框", "mén zì kuàng"),
    "广": ("广字旁", "guǎng zì páng"), "厂": ("厂字旁", "chǎng zì páng"),
    "尸": ("尸字头", "shī zì tóu"), "巾": ("巾字旁", "jīn zì páng"),
    "山": ("山字旁", "shān zì páng"), "弓": ("弓字旁", "gōng zì páng"),
    "欠": ("欠字旁", "qiàn zì páng"), "斤": ("斤字旁", "jīn zì páng"),
    "方": ("方字旁", "fāng zì páng"), "立": ("立字旁", "lì zì páng"),
    "米": ("米字旁", "mǐ zì páng"), "耳": ("耳字旁", "ěr zì páng"),
    "舟": ("舟字旁", "zhōu zì páng"), "走": ("走字旁", "zǒu zì páng"),
    "酉": ("酉字旁", "yǒu zì páng"), "雨": ("雨字头", "yǔ zì tóu"),
    "革": ("革字旁", "gé zì páng"), "骨": ("骨字旁", "gǔ zì páng"),
    "隹": ("隹字旁", "zhuī zì páng"), "力": ("力字旁", "lì zì páng"),
    "又": ("又字旁", "yòu zì páng"), "人": ("人字头", "rén zì tóu"),
    "八": ("八字旁", "bā zì páng"), "白": ("白字旁", "bái zì páng"),
    "工": ("工字旁", "gōng zì páng"), "大": ("大字头", "dà zì tóu"),
    "子": ("子字旁", "zǐ zì páng"), "寸": ("寸字旁", "cùn zì páng"),
    "手": ("手字旁", "shǒu zì páng"), "水": ("水字旁", "shuǐ zì páng"),
    "言": ("言字旁", "yán zì páng"), "金": ("金字旁", "jīn zì páng"),
    "食": ("食字旁", "shí zì páng"), "衣": ("衣字旁", "yī zì páng"),
    "示": ("示字旁", "shì zì páng"), "爫": ("爪字头", "zhǎo zì tóu"),
    "亠": ("点横头", "diǎn héng tóu"), "勹": ("包字头", "bāo zì tóu"),
    "卩": ("单耳旁", "dān ěr páng"), "厶": ("私字儿", "sī zì r"),
    "彡": ("三撇儿", "sān piě r"), "夕": ("夕字旁", "xī zì páng"),
    "小": ("小字头", "xiǎo zì tóu"), "户": ("户字头", "hù zì tóu"),
    "止": ("止字旁", "zhǐ zì páng"), "牛": ("牛字旁", "niú zì páng"),
    "父": ("父字头", "fù zì tóu"), "气": ("气字头", "qì zì tóu"),
    "矢": ("矢字旁", "shǐ zì páng"), "舌": ("舌字旁", "shé zì páng"),
    "虍": ("虎字头", "hǔ zì tóu"), "覀": ("西字头", "xī zì tóu"),
    "西": ("西字头", "xī zì tóu"), "身": ("身字旁", "shēn zì páng"),
    "角": ("角字旁", "jiǎo zì páng"), "音": ("音字旁", "yīn zì páng"),
}

# Radicals 163 (邑) and 170 (阜) are both written 阝 and are told apart only by
# which side of the character they sit on, so they need per-number entries.
RADICAL_NAMES_BY_NUM = {
    163: ("右耳旁", "yòu ěr páng"),
    170: ("左耳旁", "zuǒ ěr páng"),
}
RADICAL_NOTES_BY_NUM = {
    163: "Written 阝 on the RIGHT of the character. From 邑 (city): 那, 都, 部.",
    170: "Written 阝 on the LEFT of the character. From 阜 (mound): 阳, 院, 陈.",
}

# "Careful, not the same thing" notes for radicals that are habitually confused.
RADICAL_NOTES = {
    "氵": "Three dots = water. Two dots 冫 = ice.",
    "冫": "Two dots = ice. Three dots 氵 = water.",
    "礻": "One dot = spirit/ritual. Two dots 衤 = clothing.",
    "衤": "Two dots = clothing. One dot 礻 = spirit/ritual.",
    "犭": "Curved = dog/animal. Compare 彳 (step) and 亻 (person).",
    "彳": "Two strokes then vertical = step/walk. Compare 亻 (person).",
    "亻": "Person on the left. Compare 彳 (double, = step).",
    "阝": "On the LEFT it is 阜 (mound, hill). On the RIGHT it is 邑 (city).",
    "宀": "Roof with a dot. Compare 冖 (cover, no dot) and 穴 (cave).",
    "冖": "Bare cover. Compare 宀 (roof, has a dot).",
    "艹": "Grass on top. Traditionally written with four strokes.",
    "刂": "Knife on the right. Compare 力 (power).",
    "力": "Power. Compare 刀/刂 (knife).",
    "土": "Earth: lower stroke is longer. Compare 士 (scholar): upper is longer.",
    "士": "Scholar: upper stroke is longer. Compare 土 (earth).",
    "日": "Sun/day. Compare 曰 (to say), which is wider and flatter.",
    "月": "Moon/month. As a left radical it is often ⺼ (flesh/body).",
    "⺼": "Flesh/body radical - looks identical to 月 (moon) in modern print.",
    "木": "Tree. Compare 禾 (grain), which has a extra stroke on top.",
    "禾": "Grain - a 木 (tree) with a drooping head.",
    "见": "To see. Compare 贝 (shell/money).",
    "贝": "Shell, money. Compare 见 (to see).",
    "大": "Big. Compare 犬 (dog, extra dot) and 太 (too, extra dot below).",
    "王": "King / jade. As a radical it usually means jade, not king.",
    "灬": "Four dots = fire underneath. Same radical as 火.",
    "⺮": "Bamboo on top. Compare 艹 (grass).",
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

    # ---------------- radicals ----------------
    log("· radicals")
    # Kangxi number + canonical form from hanziDB; written variants from MMAH.
    kangxi_form, variants, uses = {}, defaultdict(Counter), defaultdict(list)
    for ch, r in hdb.items():
        code = r["radical_code"].split(".")[0]
        if not code.isdigit():
            continue
        n = int(code)
        kangxi_form.setdefault(n, r["radical"])
        v = mm.get(ch, {}).get("radical")
        if v:
            variants[n][v] += 1
        uses[n].append(ch)

    radicals = []
    for n in sorted(kangxi_form):
        forms = variants[n].most_common()
        primary = forms[0][0] if forms else kangxi_form[n]
        allf, seen = [], set()
        for f, _ in forms:
            if f not in seen:
                seen.add(f)
                allf.append(f)
        if kangxi_form[n] not in seen:
            allf.append(kangxi_form[n])
        # drop traditional-only variants when a simplified one is in use
        info = mm.get(kangxi_form[n]) or mm.get(primary) or {}
        hd = hdb.get(primary) or hdb.get(kangxi_form[n]) or {}
        ex = sorted(uses[n], key=lambda c: (hsk_level.get(c, 9), freq(c)))[:8]
        name = (RADICAL_NAMES_BY_NUM.get(n) or RADICAL_NAMES.get(primary)
                or RADICAL_NAMES.get(kangxi_form[n]))
        strokes = int(hd["stroke_count"]) if hd.get("stroke_count", "").isdigit() else None
        # Rank by characters a learner will actually meet, not by raw inventory:
        # 艹/钅/纟 build hundreds of rare characters and would otherwise dominate.
        useful = sum(1 for c in uses[n] if freq(c) <= 3000)
        radicals.append({
            "n": n,
            "r": primary,
            "kangxi": kangxi_form[n],
            "variants": [f for f in allf if f != primary],
            "py": (" / ".join(info.get("pinyin", [])) or (hd.get("pinyin") or "")),
            "mean": (info.get("definition") or hd.get("definition") or "").strip(),
            "cn": name[0] if name else None,
            "cnPy": name[1] if name else None,
            "sc": strokes,
            "count": len(uses[n]),
            "useful": useful,
            "ex": ex,
            "note": (RADICAL_NOTES_BY_NUM.get(n) or RADICAL_NOTES.get(primary)
                     or RADICAL_NOTES.get(kangxi_form[n])),
        })
    radicals.sort(key=lambda r: (-r["useful"], -r["count"]))
    for i, r in enumerate(radicals, 1):
        r["rank"] = i
    radicals.sort(key=lambda r: r["n"])
    log(f"  {len(radicals)} radicals; top 12 by learner-weighted use: "
        + " ".join(r["r"] for r in sorted(radicals, key=lambda r: r["rank"])[:12]))

    # ---------------- characters ----------------
    log("· characters")
    target = set(all_chars)
    sentences = load_sentences(target)
    log(f"  example sentences matched: {len(sentences)}/{len(target)}")

    # Primary reading per character, preferred over CC-CEDICT's first entry.
    char_py: dict[str, str] = {}
    for ch, entry in mm.items():
        if entry.get("pinyin"):
            char_py[ch] = entry["pinyin"][0]
    for ch, row in hdb.items():
        if ch not in char_py and row.get("pinyin"):
            char_py[ch] = row["pinyin"].split()[0]

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
    for r in radicals:
        strokes_needed.add(r["r"])
        strokes_needed.update(r["variants"])
        strokes_needed.update(r["ex"])

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
        py = e.get("pinyin") or ([cd.get("py")] if cd.get("py") else [])
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
            "parts": [p for p in tops if p != "？"],
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
    for r in radicals:
        comp_chars.add(r["r"])
        comp_chars.update(r["variants"])
    rad_by_form = {}
    for r in radicals:
        for form in [r["r"], *r["variants"], r["kangxi"]]:
            rad_by_form.setdefault(form, r["n"])
    # Unihan glosses for obscure stroke-shapes are noise on a worksheet - 乛
    # is defined as "kwukyel", which helps nobody. Keep a gloss only for
    # components that are radicals or characters in their own right.
    components = {}
    for ch in sorted(comp_chars):
        e = mm.get(ch, {})
        hd = hdb.get(ch, {})
        gloss = (e.get("definition") or hd.get("definition") or "").strip()
        py = " / ".join(e.get("pinyin", [])) or (hd.get("pinyin") or "")
        if not gloss and not py:
            continue
        if ch in rad_by_form:
            # Prefer the radical's own meaning: Unihan's entry for a variant
            # shape is often an unrelated curiosity (乛 is glossed "kwukyel").
            r = next((x for x in radicals if x["n"] == rad_by_form[ch]), None)
            if r and r["mean"]:
                gloss = r["mean"]
        elif freq(ch) > 4000:
            gloss = ""
            if not py:
                continue
        components[ch] = {
            "py": py,
            "def": shorten(gloss, 40),
            "rad": rad_by_form.get(ch),
        }
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
    write("radicals.json", {"count": len(radicals), "items": radicals})

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
    for r in radicals:
        core_chars.add(r["r"])
        core_chars.update(r["variants"])
        core_chars.add(r["kangxi"])
        core_chars.update(r["ex"])
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
