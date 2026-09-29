import { useLibrary } from '../../features/shared/library';
import { combos, VERB_ZH, verbsOf } from '../core/verbs';
import type { SaveAction } from '../core/save';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useState } from 'react';
import { dayOf, formatTime } from '../core/clock';
import { contentNames, diaryDays, diaryLines } from '../core/diary';
import { dateZh, WEATHER_ICON, WEATHER_ZH, weatherOf } from '../core/calendar';
import type { Item, WorldSave, WorldSettings } from '../core/types';
import { priceYen, priceZh } from '../core/shop';
import { pinyinOf } from './pinyin';
import { canRecognise } from '../../platform/audio/recognition';
import { Seg } from '../../ui/Seg';
import { rememberInput } from './typing';
import type { WorldContent } from './content';
import {
  BAG_FILTERS,
  bagRows,
  filterOf,
  itemFacts,
  type BagFilter,
  friendRows,
  idiomRows,
  PANELS,
  riddleRows,
  spiritRows,
  stampRows,
  taskRows,
  type PanelId,
} from './panelRows';
import { Hearts } from './Hearts';
import { ALBUM_MAX, loadAlbum, postcardPng, saveAlbum, saveFile, type Photo } from './album';
import { ZhText } from './ZhText';
import { MapTab } from './MapTab';

/**
 * The game's sheets over the world (E5): tasks and riddles, the bag, the
 * map of Beijing, the 图鉴 of spirits, the 成语 book and the stamps
 * passport — one sheet, one tab row. The world is paused while it is open.
 */
export function Panels({
  tab,
  setTab,
  save,
  content,
  pinyin,
  onClose,
  onGo,
  onSettings,
  onUse,
  onAct,
  user,
  onReset,
  mapStart,
}: {
  tab: PanelId;
  setTab: (t: PanelId) => void;
  save: WorldSave;
  content: WorldContent;
  pinyin: boolean;
  onClose: () => void;
  /** "Go": to the nearest station of where you are, to ride from there */
  onGo: (station: string) => void;
  onSettings: (patch: Partial<WorldSettings>) => void;
  /** choose an item to use on someone or something (X1) */
  onUse: (item: string) => void;
  /** 吃 / 喝, and two things made into a third (Y4) */
  onAct?: (a: SaveAction) => void;
  /** whose album this device keeps (X6) */
  user: string;
  /** start the whole game over */
  onReset: () => void;
  /** the neighbourhood the 🗺 tab opens on (a tap on the minimap), else yours */
  mapStart?: string | null;
}) {
  return (
    <div className="wp-scrim" onClick={onClose}>
      <section className="wp" role="dialog" aria-label="Game panels" onClick={(e) => e.stopPropagation()}>
        <header className="wp-tabs" role="tablist">
          {PANELS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={tab === p.id} onClick={() => setTab(p.id)}>
              {p.label}
            </button>
          ))}
          <span className="spacer" />
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Back to the world">
            ×
          </button>
        </header>
        <div className="wp-body">
          {tab === 'tasks' && <Tasks save={save} content={content} pinyin={pinyin} />}
          {tab === 'bag' && <Bag save={save} content={content} onUse={onUse} onAct={onAct} />}
          {tab === 'map' && <MapTab save={save} content={content} onGo={onGo} start={mapStart ?? null} />}
          {tab === 'spirits' && <Spirits save={save} content={content} pinyin={pinyin} />}
          {tab === 'idioms' && <Idioms save={save} content={content} pinyin={pinyin} />}
          {tab === 'stamps' && <Stamps save={save} content={content} />}
          {tab === 'friends' && <Friends save={save} content={content} />}
          {tab === 'diary' && <Diary save={save} content={content} pinyin={pinyin} />}
          {tab === 'album' && <Album user={user} />}
          {tab === 'settings' && <Settings settings={save.settings} onChange={onSettings} onReset={onReset} />}
        </div>
      </section>
    </div>
  );
}

/** The album (X6): photos taken on this device; tap one to write a postcard or to throw it away. */
function Album({ user }: { user: string }) {
  const [list, setList] = useState<Photo[]>(() => loadAlbum(user));
  const [open, setOpen] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState<string | null>(null);
  if (!list.length) return <Empty han="照">No photos yet. Tap 📷 at the top to take one.</Empty>;
  const cur = list.find((p) => p.id === open) ?? null;
  const pick = (p: Photo) => {
    setOpen(open === p.id ? null : p.id);
    setCaption(p.caption ?? '');
    setNote(null);
  };
  const card = async () => {
    if (!cur) return;
    const text = caption.trim() || '北京，你好！';
    setList(saveAlbum(user, list.map((p) => (p.id === cur.id ? { ...p, caption: text } : p))));
    try {
      saveFile(await postcardPng(cur, text, cur.place), `postcard-${cur.id}.png`);
      setNote('Saved as a picture — send it or print it.');
    } catch {
      setNote('The postcard could not be made on this device.');
    }
  };
  const drop = () => {
    if (!cur) return;
    setList(saveAlbum(user, list.filter((p) => p.id !== cur.id)));
    setOpen(null);
  };
  return (
    <>
      <h3 className="wp-label">
        相册 <span className="tiny muted">· on this device, the newest {ALBUM_MAX}</span>
      </h3>
      <ul className="w-album">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" aria-pressed={open === p.id} onClick={() => pick(p)} aria-label={`Photo at ${p.place}`}>
              <img src={p.img} alt="" width={400} height={300} />
            </button>
          </li>
        ))}
      </ul>
      {cur && (
        <div className="w-card-edit">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="写一句话：北京，你好！" lang="zh" maxLength={24} aria-label="Caption in Chinese" />
          <button type="button" className="btn primary sm" onClick={() => void card()}>
            Postcard
          </button>
          <button type="button" className="btn sm" onClick={drop}>
            Delete
          </button>
          {note && <p className="tiny muted">{note}</p>}
        </div>
      )}
    </>
  );
}

/** The diary (X3): each game day in a few simple sentences, newest first; every word tappable. */
function Diary({ save, content, pinyin }: { save: WorldSave; content: WorldContent; pinyin: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const days = diaryDays(save);
  if (!days.length) return <Empty han="记">The diary writes itself as you go. Come back at the end of the day.</Empty>;
  const names = contentNames([content]);
  const today = dayOf(save.clock);
  return (
    <>
      <h3 className="wp-label">
        日记 <span className="tiny muted">· tap a word for its card; tap a day for the English</span>
      </h3>
      <ul className="wp-list">
        {days.map((d) => {
          const lines = diaryLines(d.codes, names, d.day);
          const w = weatherOf(d.day);
          return (
            <li key={d.day}>
              <button type="button" className="w-diary-day tiny muted" aria-expanded={open === d.day} onClick={() => setOpen(open === d.day ? null : d.day)}>
                <span className="han">
                  {dateZh(d.day)} · {WEATHER_ICON[w]} {WEATHER_ZH[w]}
                  {d.day === today ? ' · 今天' : ''}
                </span>
              </button>
              <p>
                {lines.map((l, i) => (
                  <ZhText key={i} zh={l.zh} pinyin={pinyin} />
                ))}
              </p>
              {open === d.day && <p className="small muted">{lines.map((l) => l.en).join(' ')}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Friends({ save, content }: { save: WorldSave; content: WorldContent }) {
  const rows = friendRows(save, content.npcs);
  if (!rows.length && !save.cat.name) return <Empty han="友">Nobody yet. Say 你好 to the neighbours.</Empty>;
  return (
    <>
      <h3 className="wp-label">People you know{save.name && <span className="han"> · 我叫{save.name}</span>}</h3>
      <ul className="wp-list">
        {rows.map((r) => (
          <li key={r.id}>
            <b className="han">{r.name}</b> <Hearts n={r.hearts} /> <span className="tiny muted">{r.role}</span>
            {r.notes.length > 0 && <p className="small muted">Remembers: {r.notes.join('; ')}.</p>}
          </li>
        ))}
        {save.cat.name && (
          <li key="cat">
            <b className="han">{save.cat.name}</b> <span className="tiny muted">· your cat, fed on {save.cat.fed} days — it sleeps in the courtyard and follows you in 帽儿胡同</span>
          </li>
        )}
      </ul>
      <p className="tiny muted">Friendship grows when you talk (once a day), give something they like, or help. At three hearts some people tell you their own story.</p>
    </>
  );
}

function Empty({ han, children }: { han: string; children: React.ReactNode }) {
  return (
    <div className="empty wp-empty">
      <div className="big han">{han}</div>
      <p className="small muted">{children}</p>
    </div>
  );
}

function Tasks({ save, content, pinyin }: { save: WorldSave; content: WorldContent; pinyin: boolean }) {
  const tasks = taskRows(save, content.quests);
  const riddles = riddleRows(save, content.scenes);
  const npcName = (id?: string) => content.npcs.find((n) => n.id === id)?.name;
  return (
    <>
      <h3 className="wp-label">Tasks</h3>
      {tasks.length ? (
        <ul className="wp-list">
          {tasks.map((t) => (
            <li key={t.quest.id} data-done={t.done ? '' : undefined}>
              <b>{t.quest.title}</b>
              {t.done ? <span className="tiny muted"> · done</span> : <p className="small">{t.now}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <Empty han="事">No tasks yet. Talk to people — someone always needs a hand.</Empty>
      )}
      <h3 className="wp-label">📌 Riddles</h3>
      {riddles.length ? (
        <ul className="wp-list">
          {riddles.map((r) => (
            <li key={r.id} data-done={r.solved ? '' : undefined}>
              {npcName(r.npc) && <span className="tiny muted han">{npcName(r.npc)}：</span>}
              <ZhText zh={r.zh} pinyin={pinyin} />
              <p className="tiny muted">{r.solved ? `Worked out — “${r.en}”` : 'Tap the hard words, ask someone “……是什么意思？”, or ask 兔儿爷.'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">Key lines 📌 — the hard ones that matter — pin themselves here.</p>
      )}
    </>
  );
}

const KIND_ZH: Record<string, string> = { food: '食物', drink: '喝的', gift: '礼物', toy: '玩具', tool: '工具', decor: '装饰', key: '重要' };

/**
 * The bag (Y5): the phone's mini summary on top (余额, 交通卡, the last
 * payment — tap it for the phone and its 账单), one fixed filter line, and
 * the things as small tiles. A tile opens the thing's card: big hanzi,
 * pinyin, what it is, where it is sold, who liked it as a present, and
 * what you can do with it as Chinese verbs.
 */
function Bag({ save, content, onUse, onAct }: { save: WorldSave; content: WorldContent; onUse: (item: string) => void; onAct?: (a: SaveAction) => void }) {
  const [filter, setFilter] = useState<BagFilter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const byId = new Map(content.items.map((i) => [i.id, i]));
  const rows = bagRows(save, content.items);
  const counts = new Map<BagFilter, number>(BAG_FILTERS.map((f) => [f.id, f.id === 'all' ? rows.length : rows.filter((r) => filterOf(byId.get(r.id)) === f.id).length]));
  const shown = filter === 'all' ? rows : rows.filter((r) => filterOf(byId.get(r.id)) === filter);
  const last = save.bills.at(-1);
  const cur = open ? rows.find((r) => r.id === open) : undefined;
  if (phone) return <Phone save={save} content={content} onBack={() => setPhone(false)} />;
  return (
    <>
      <button type="button" className="w-mini" onClick={() => setPhone(true)} aria-label="Open the phone: 余额, 交通卡 and 账单">
        <span aria-hidden>📱</span>
        <span className="han">余额</span> <b>{save.bag.money}</b>
        <span className="han">交通卡</span> {save.bag.card === null ? <span className="muted">—</span> : <b>{save.bag.card}</b>}
        {last && (
          <span className="w-mini-last">
            <span className="han">{billName(last.who, content)}</span> <Amount n={last.amount} />
          </span>
        )}
        <span className="spacer" />
        <span aria-hidden>›</span>
      </button>
      <div className="w-filters" role="tablist" aria-label="Show">
        {BAG_FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} title={f.title} disabled={!counts.get(f.id)} onClick={() => setFilter(f.id)}>
            <span className="han">{f.label}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className="wp-grid">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className="wp-item" onClick={() => setOpen(r.id)}>
                <span className="han">{r.name}</span>
                <span className="tiny muted">{r.en}</span>
                {r.count > 1 && <span className="wp-count">×{r.count}</span>}
                {byId.get(r.id)?.kind === 'key' && (
                  <span className="w-seal han" title="A story thing: not a present, not for sale">
                    印
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty han="空">Nothing in the bag yet.</Empty>
      )}
      {cur && byId.get(cur.id) && (
        <ItemSheet
          item={byId.get(cur.id)!}
          count={cur.count}
          save={save}
          content={content}
          onClose={() => setOpen(null)}
          onUse={(id) => {
            setOpen(null);
            onUse(id);
          }}
          onAct={(a) => {
            onAct?.(a);
            // the last one eaten, or made into something else: the card has nothing left to show
            if ((save.bag.items[cur.id] ?? 0) <= 1) setOpen(null);
          }}
        />
      )}
    </>
  );
}

function Amount({ n }: { n: number }) {
  return (
    <b className="w-bill" data-in={n > 0 ? '' : undefined}>
      {n > 0 ? '+' : '−'}
      {Math.abs(n).toFixed(2)}
    </b>
  );
}

/** One thing's card (Y5), over the bag like the app's word cards. */
function ItemSheet({
  item,
  count,
  save,
  content,
  onClose,
  onUse,
  onAct,
}: {
  item: Item;
  count: number;
  save: WorldSave;
  content: WorldContent;
  onClose: () => void;
  onUse: (item: string) => void;
  onAct: (a: SaveAction) => void;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const facts = itemFacts(item, save, content.shops, content.npcs);
  const names = new Map(content.items.map((i) => [i.id, i]));
  const shop = facts.sold[0];
  return (
    <div className="w-sheet-scrim" onClick={onClose}>
      <section className="w-sheet" role="dialog" aria-label={item.en} onClick={(e) => e.stopPropagation()}>
        <header className="w-sheet-head">
          <b className="han w-sheet-han">{item.name}</b>
          <span>
            <span className="small">{pinyinOf(item.name, lib)}</span>
            <br />
            <span className="small muted">
              {item.en}
              {count > 1 ? ` · ×${count}` : ''}
            </span>
          </span>
          <span className="spacer" />
          {item.kind && <span className="tag han">{KIND_ZH[item.kind] ?? item.kind}</span>}
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <dl className="w-facts small">
          {shop ? (
            <>
              <dt className="han">哪儿有</dt>
              <dd>
                {facts.sold.map((x, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    <span className="han">{x.shop}</span> {priceZh(x.price)}一{x.measure}
                  </span>
                ))}
              </dd>
            </>
          ) : item.kind === 'key' ? (
            <>
              <dt className="han">重要</dt>
              <dd className="muted">A story thing — not a present, never sold.</dd>
            </>
          ) : facts.worth !== undefined ? (
            <>
              <dt className="han">多少钱</dt>
              <dd>about {facts.worth} 元 — the recycler pays part of it</dd>
            </>
          ) : null}
          {facts.liked.length > 0 && (
            <>
              <dt className="han">喜欢</dt>
              <dd className="han">{facts.liked.join('、')}</dd>
            </>
          )}
          {facts.disliked.length > 0 && (
            <>
              <dt className="han">不喜欢</dt>
              <dd className="han">{facts.disliked.join('、')}</dd>
            </>
          )}
          {item.gift && !facts.liked.length && !facts.disliked.length && (
            <>
              <dt className="han">礼物</dt>
              <dd className="muted">Give it to someone to find out who likes it.</dd>
            </>
          )}
        </dl>
        {/* what you can do with it, as Chinese verbs (Y4) */}
        <div className="w-verbs">
          {verbsOf(item).map((v) => (
            <button
              key={v}
              type="button"
              className="btn sm"
              title={VERB_ZH[v].en}
              onClick={() => (v === 'eat' || v === 'drink' ? onAct({ do: 'eat', item: item.id }) : v === 'look' ? openItem(itemForToken(lib, item.name)) : onUse(item.id))}
            >
              <span className="han">{VERB_ZH[v].zh}</span> <span className="tiny muted">{VERB_ZH[v].en}</span>
            </button>
          ))}
          {combos(item, save.bag.items).map((c) => (
            <button key={c.with} type="button" className="btn sm" title={`with the ${names.get(c.with)?.en ?? c.with}: makes ${names.get(c.makes)?.en ?? c.makes}`} onClick={() => onAct({ do: 'combine', a: item.id, b: c.with, makes: c.makes })}>
              <span className="han">
                +{names.get(c.with)?.name} → {names.get(c.makes)?.name}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** The phone (Y5): 余额, the 交通卡 and the 账单 — the last payments in and out. */
function Phone({ save, content, onBack }: { save: WorldSave; content: WorldContent; onBack: () => void }) {
  return (
    <div className="w-phone w-phone-home">
      <div className="w-phone-head">
        <button type="button" className="wd-tool" onClick={onBack} aria-label="Back to the bag">
          ‹
        </button>
        <span className="han">支付宝</span>
      </div>
      <div className="w-phone-cards">
        <span>
          <span className="tiny muted han">余额</span>
          <b className="w-phone-amount">{priceYen(save.bag.money)}</b>
        </span>
        <span>
          <span className="tiny muted han">交通卡</span>
          <b className="w-phone-amount">{save.bag.card === null ? '—' : priceYen(save.bag.card)}</b>
        </span>
      </div>
      <h3 className="wp-label">
        账单 <span className="tiny muted">· the last payments</span>
      </h3>
      {save.bills.length ? (
        <ul className="wp-list w-bills">
          {[...save.bills].reverse().map((b, i) => (
            <li key={i}>
              <span className="han">{billName(b.who, content)}</span>
              <span className="tiny muted">
                第{dayOf(b.at)}天 {formatTime(b.at)}
              </span>
              <span className="spacer" />
              <Amount n={b.amount} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">Nothing paid yet.</p>
      )}
    </div>
  );
}

/** Who a payment was with, as the 账单 names it: a shop, a person, or the place. */
function billName(who: string, content: WorldContent): string {
  const shop = content.shops.find((x) => x.npc === who);
  if (shop) return shop.name;
  const npc = content.npcs.find((n) => n.id === who);
  if (npc) return npc.name;
  return who ? '北京' : '—';
}

function Spirits({ save, content, pinyin }: { save: WorldSave; content: WorldContent; pinyin: boolean }) {
  const rows = spiritRows(save, content.spirits);
  if (!rows.length && !save.cat.name) return <Empty han="灵">The spirits of the broken lantern are still out there.</Empty>;
  const found = rows.filter((r) => r.found).length;
  return (
    <>
      <p className="small muted">
        {found} of {rows.length} found
      </p>
      <ul className="wp-cards">
        {rows.map(({ spirit: x, found }) =>
          found ? (
            <li key={x.id} className="wp-card">
              <div className="wp-art">{x.image ? <img src={`/world/${x.image}`} alt="" width={96} height={96} /> : <span className="han">{x.hanzi}</span>}</div>
              <div>
                <b className="han wp-name">{x.hanzi}</b> <span className="small">{x.pinyin}</span> <span className="tiny muted">· {x.en} · {x.source}</span>
                <ZhText zh={x.legend.zh} pinyin={pinyin} className="wd-zh wp-zh" />
                <p className="small muted">{x.legend.en}</p>
                {x.credit && <p className="tiny muted">{x.credit}</p>}
              </div>
            </li>
          ) : (
            <li key={x.id} className="wp-card" data-missing="">
              <div className="wp-art">
                <span className="han">？</span>
              </div>
              <p className="small muted">Not found yet. People talk about strange things — listen.</p>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

function Idioms({ save, content, pinyin }: { save: WorldSave; content: WorldContent; pinyin: boolean }) {
  const rows = idiomRows(save, content.idioms);
  const npcName = (id?: string) => content.npcs.find((n) => n.id === id)?.name;
  if (!rows.length) return <Empty han="成">No 成语 yet. When someone says one, it is written here.</Empty>;
  return (
    <>
      {!save.flags.includes('idiom-book') && <p className="tiny muted">The book 《成语故事》 itself turns up in a bookshop later; until then they are kept here.</p>}
      <ul className="wp-cards">
        {rows.map(({ idiom: x, npc }) => (
          <li key={x.id} className="wp-card wp-idiom">
            <div>
              <b className="han wp-name">{x.id}</b> <span className="small">{x.pinyin}</span>
              {x.tier === 'story' && <span className="tiny muted"> · a story</span>}
              {x.line && <span className="tiny muted"> · from the {x.line} line</span>}
              <p className="wp-parts">
                {x.parts.map((p, i) => (
                  <span key={i}>
                    <span className="han">{p.c}</span> <span className="tiny muted">{p.gloss}</span>
                  </span>
                ))}
              </p>
              <p className="small">{x.meaning}</p>
              <ZhText zh={x.story.zh} pinyin={pinyin} className="wd-zh wp-zh" />
              <p className="small muted">{x.story.en}</p>
              {npcName(npc) && <p className="tiny muted">Heard from <span className="han">{npcName(npc)}</span>.</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Stamps({ save, content }: { save: WorldSave; content: WorldContent }) {
  const rows = stampRows(save, content.stamps);
  if (!rows.length && !save.cat.name) return <Empty han="印">Your Beijing passport. Stamps come for what you do — buying a ticket, asking the way.</Empty>;
  return (
    <ul className="wp-stamps">
      {rows.map(({ stamp: x, got }) => (
        <li key={x.id} className="wp-stamp" data-got={got ? '' : undefined} data-landmark={x.landmark ? '' : undefined} title={x.en}>
          <span className="wp-seal han" aria-hidden>
            {got ? x.name : ''}
          </span>
          <span className="tiny">{got ? x.en : '…'}</span>
        </li>
      ))}
    </ul>
  );
}

function Settings({ settings, onChange, onReset }: { settings: WorldSettings; onChange: (patch: Partial<WorldSettings>) => void; onReset: () => void }) {
  const listenable = canRecognise();
  const [sure, setSure] = useState(false);
  return (
    <div className="wp-settings">
      <label>
        <span>Answer by</span>
        <Seg
          value={settings.input}
          options={[
            { id: 'voice', label: '🎤 Voice', title: listenable ? 'Hold and talk' : 'This browser cannot listen' },
            { id: 'keyboard', label: '⌨ Keyboard' },
          ]}
          onChange={(input) => {
            if (input === 'voice' && !listenable) return;
            rememberInput(input);
            onChange({ input });
          }}
          size="sm"
        />
      </label>
      {!listenable && <p className="tiny muted">This browser cannot listen, so the game uses the keyboard. On an iPad, Safari with Siri &amp; Dictation on can.</p>}
      <label>
        <span>拼 under lines</span>
        <Seg
          value={settings.pinyin ? 'on' : 'off'}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
          onChange={(v) => onChange({ pinyin: v === 'on' })}
          size="sm"
        />
      </label>
      <label>
        <span>On-screen joystick</span>
        <Seg
          value={settings.joystick ? 'on' : 'off'}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
          onChange={(v) => onChange({ joystick: v === 'on' })}
          size="sm"
        />
      </label>
      <label>
        <span>Mark what I can use</span>
        <Seg
          value={settings.highlight ? 'on' : 'off'}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
          onChange={(v) => onChange({ highlight: v === 'on' })}
          size="sm"
        />
      </label>
      <label>
        <span>Street sounds</span>
        <Seg
          value={settings.volume <= 0 ? 'off' : settings.volume < 0.5 ? 'soft' : 'on'}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'soft', label: 'Soft' },
            { id: 'on', label: 'On' },
          ]}
          onChange={(v) => onChange({ volume: v === 'off' ? 0 : v === 'soft' ? 0.35 : 0.8 })}
          size="sm"
        />
      </label>
      <label>
        <span>Music</span>
        <Seg
          value={settings.music <= 0 ? 'off' : settings.music < 0.5 ? 'soft' : 'on'}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'soft', label: 'Soft' },
            { id: 'on', label: 'On' },
          ]}
          onChange={(v) => onChange({ music: v === 'off' ? 0 : v === 'soft' ? 0.35 : 0.8 })}
          size="sm"
        />
      </label>
      <label>
        <span>Text size</span>
        <Seg
          value={settings.textSize}
          options={[
            { id: 's', label: 'Small' },
            { id: 'm', label: 'Medium' },
            { id: 'l', label: 'Large' },
          ]}
          onChange={(textSize) => onChange({ textSize })}
          size="sm"
        />
      </label>
      <p className="tiny muted">Settings are kept in your game save, so the iPad and the Mac share them.</p>
      <div className="wp-reset">
        {sure ? (
          <>
            <p className="small">
              Start a new game from the first morning? The story, the bag and money, friends, stamps, spirits, 成语, the diary and the photos all go — on
              every device. Your settings stay. This cannot be undone.
            </p>
            <div className="row">
              <button type="button" className="btn sm danger" onClick={onReset}>
                Start over
              </button>
              <button type="button" className="btn sm ghost" onClick={() => setSure(false)}>
                Keep playing
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn sm ghost" onClick={() => setSure(true)}>
            Start a new game…
          </button>
        )}
      </div>
    </div>
  );
}
