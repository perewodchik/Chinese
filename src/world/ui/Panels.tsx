import { useLibrary } from '../../features/shared/library';
import { combos, VERB_ZH, verbsOf } from '../core/verbs';
import type { SaveAction } from '../core/save';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayOf, formatTime } from '../core/clock';
import type { Item, WorldSave, WorldSettings } from '../core/types';
import { priceYen, priceZh } from '../core/shop';
import { pinyinOf } from './pinyin';
import { canRecognise } from '../../platform/audio/recognition';
import { Seg } from '../../ui/Seg';
import { rememberInput } from './typing';
import type { WorldContent } from './content';
import { BAG_FILTERS, bagRows, filterOf, itemFacts, type BagFilter } from './panelRows';
import { Diary, JournalNow, JournalSide, JournalStory, type RouteRequest } from './Journal';
import { People } from './People';
import { markSeen, MENU, menuNews, newSideIds, panelTarget, readMemory, remember, tabForKey, tabHasNews, viewKey, VIEWS, writeMemory, type MenuAt, type MenuMemory, type MenuTab, type PanelId } from './menu';
import './menu.css';
import { Album, Idioms, Spirits, Stamps } from './Collection';
import { BookReader, Books } from './BookReader';
import { MapTab } from './MapTab';
import { ItemSprite, MenuIcon } from './PropSprite';
import { PixelIcon } from './PixelIcon';

/**
 * The menu over the (paused) world (§10 P1): five tabs — 日志 journal, 包
 * bag, 地图 map, 朋友 people, 收藏 collection — and ⚙ beside ×. A tab with
 * inner views has one segmented control at its top, never a second tab row.
 * On a phone the sheet fills the screen with the tabs at the bottom, in
 * thumb reach; on the iPad they sit on top. Red dots mark news until the
 * view is opened. The menu reopens where this device left it.
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
  onReplay,
  ride,
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
  /** 吃 / 喝, two things made into a third (Y4), and the menu's own marks (seen, tracked) */
  onAct?: (a: SaveAction) => void;
  /** whose album this device keeps (X6) */
  user: string;
  /** start the whole game over */
  onReset: () => void;
  /** the neighbourhood the 🗺 tab opens on (a tap on the minimap), else yours */
  mapStart?: string | null;
  /** watch a cutscene again (Journal → Story, §13 K1) */
  onReplay?: (cutscene: string) => void;
  /** §13 L2: 骑车去 on the metro map while you ride your own bike */
  ride?: Parameters<typeof MapTab>[0]['ride'];
}) {
  const [mem, setMem] = useState<MenuMemory>(readMemory);
  const [at, setAt] = useState<MenuAt>(() => panelTarget(tab, mem));
  // someone outside (the top bar, a key, the minimap) opened another tab
  const asked = useRef(tab);
  useEffect(() => {
    if (asked.current === tab) return;
    asked.current = tab;
    setAt(panelTarget(tab, mem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  /** the journal's "Show on map" (J3b): the metro with the way drawn */
  const [route, setRoute] = useState<RouteRequest | null>(null);
  /** a Story entry's day, opened in the diary */
  const [diaryDay, setDiaryDay] = useState<number | null>(null);
  /** a book open over the menu (收藏 → 书) */
  const [reading, setReading] = useState<string | null>(null);
  const book = reading ? content.books.find((b) => b.id === reading) : undefined;
  const go = (next: MenuAt) => {
    if (next.tab !== 'map') setRoute(null);
    if (next.view !== 'diary') setDiaryDay(null);
    setAt(next);
    asked.current = next.tab;
    setTab(next.tab);
  };
  const openTab = (t: MenuTab) => go(panelTarget(t, mem));
  const showRoute = (r: RouteRequest) => {
    go({ tab: 'map' });
    setRoute(r);
  };
  // the menu reopens on this tab and view (per device)
  useEffect(() => {
    const m = remember(mem, at);
    if (m === mem) return;
    setMem(m);
    writeMemory(m);
  }, [mem, at]);

  const leadIds = useMemo(() => newSideIds(save, content), [save, content]);
  const news = useMemo(() => menuNews(save, leadIds), [save, leadIds]);
  // opening a view clears its dot
  const key = viewKey(at);
  useEffect(() => {
    if (news.has(key)) for (const a of markSeen(save, at, leadIds)) onAct?.(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, news]);

  // 1–5 switch tabs (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, textarea, [contenteditable]')) return;
      const t = tabForKey(e.key);
      if (t) openTab(t);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const views = at.tab === 'settings' ? undefined : VIEWS[at.tab];
  const cur = MENU.find((m) => m.id === at.tab);
  return (
    <div className="mn-scrim" onClick={onClose}>
      <section className="mn" role="dialog" aria-label="Menu" data-tab={at.tab} onClick={(e) => e.stopPropagation()}>
        {/* one bar: the five tabs as bookmarks, then ⚙ and × at its end — nothing between it and the page */}
        <nav className="mn-bar" aria-label="Menu">
          <div className="mn-tabs" role="tablist">
            {MENU.map((m, i) => (
              <button key={m.id} type="button" role="tab" aria-selected={at.tab === m.id} onClick={() => openTab(m.id)} title={`${m.en} (${i + 1})`}>
                <MenuIcon name={m.icon} />
                <span className="han mn-zh">{m.zh}</span>
                <span className="mn-en">{m.en}</span>
                {tabHasNews(news, m.id) && at.tab !== m.id && <i className="mn-dot" aria-label="new" />}
              </button>
            ))}
          </div>
          <div className="mn-keys">
            <button
              type="button"
              className="mn-key mn-gear"
              aria-pressed={at.tab === 'settings'}
              onClick={() => go(at.tab === 'settings' ? panelTarget('menu', mem) : { tab: 'settings' })}
              aria-label="Settings"
              title="Settings"
            >
              <PixelIcon name="gear" size={18} />
            </button>
            <button type="button" className="mn-key mn-close" onClick={onClose} aria-label="Back to the world (Esc)" title="Back to the world (Esc)">
              <PixelIcon name="close" size={14} />
            </button>
          </div>
        </nav>
        <div className="mn-page">
          {views ? (
            <div className="mn-views" role="tablist" aria-label={cur?.en}>
              {views.map((v) => (
                <button key={v.id} type="button" role="tab" aria-selected={at.view === v.id} aria-pressed={at.view === v.id} title={v.title} onClick={() => go({ tab: at.tab, view: v.id })}>
                  <span className={/[一-鿿]/.test(v.label) ? 'han' : undefined}>{v.label}</span>
                  {news.has(`${at.tab}/${v.id}`) && at.view !== v.id && <i className="mn-dot" aria-label="new" />}
                </button>
              ))}
            </div>
          ) : (
            at.tab === 'settings' && (
              <h2 className="mn-title">
                <span className="han">设置</span> <span className="tiny muted">Settings</span>
              </h2>
            )
          )}
        <div className="mn-body" key={key}>
          {key === 'journal/now' && (
            <JournalNow save={save} content={content} pinyin={pinyin} onTrack={(quest) => onAct?.({ do: 'track', quest, rev: Date.now() })} onShowRoute={showRoute} onSide={() => go({ tab: 'journal', view: 'side' })} />
          )}
          {key === 'journal/side' && <JournalSide save={save} content={content} onShowRoute={showRoute} />}
          {key === 'journal/story' && <JournalStory save={save} content={content} onDay={(day) => (setDiaryDay(day), go({ tab: 'journal', view: 'diary' }))} {...(onReplay ? { onReplay } : {})} />}
          {key === 'journal/diary' && <Diary save={save} content={content} pinyin={pinyin} focus={diaryDay} onStory={() => go({ tab: 'journal', view: 'story' })} />}
          {key === 'bag' && <Bag save={save} content={content} onUse={onUse} onAct={onAct} />}
          {key === 'map' && <MapTab save={save} content={content} onGo={onGo} start={mapStart ?? null} route={route} ride={ride ?? null} />}
          {key === 'people' && <People save={save} content={content} onTrack={(quest) => onAct?.({ do: 'track', quest, rev: Date.now() })} onShowRoute={showRoute} />}
          {key === 'collection/spirits' && <Spirits save={save} content={content} pinyin={pinyin} />}
          {key === 'collection/idioms' && <Idioms save={save} content={content} pinyin={pinyin} onAct={onAct} />}
          {key === 'collection/stamps' && <Stamps save={save} content={content} onShowRoute={showRoute} />}
          {key === 'collection/books' && <Books save={save} books={content.books} onOpen={setReading} />}
          {key === 'collection/album' && <Album user={user} />}
          {key === 'settings' && <Settings settings={save.settings} onChange={onSettings} onReset={onReset} />}
        </div>
        </div>
      </section>
      {book && <BookReader book={book} save={save} pinyin={pinyin} onAct={(a) => onAct?.(a)} onClose={() => setReading(null)} />}
    </div>
  );
}

const KIND_ZH: Record<string, string> = { food: '食物', drink: '喝的', gift: '礼物', toy: '玩具', tool: '工具', decor: '装饰', key: '重要' };

/** Each pocket's picture: an item of that kind, or one of the menu's icons. */
const POCKET_ICON: Record<BagFilter, { item?: string; ui?: string }> = {
  all: { ui: 'bag' },
  food: { item: 'baozi' },
  gift: { ui: 'gift' },
  tool: { item: 'shoudiantong' },
  decor: { item: 'denglong' },
  key: { ui: 'seal' },
};

/** The bag's slots: six across, never fewer than four rows, so it always looks like a bag with room in it. */
const SLOT_COLS = 6;
const SLOT_MIN = 24;

/**
 * The bag (Y5, redrawn as a game inventory): the wallet on top (余额, 交通卡,
 * the last payment — tap it for the phone and its 账单), the pockets, and the
 * things in square slots, each with its picture, name and count. One thing
 * is always picked, and its card sits beside the slots on the iPad (above
 * them on a phone): big hanzi, pinyin, what it is, where it is sold, who
 * liked it, and what you can do with it as Chinese verbs.
 */
function Bag({ save, content, onUse, onAct }: { save: WorldSave; content: WorldContent; onUse: (item: string) => void; onAct?: (a: SaveAction) => void }) {
  const [filter, setFilter] = useState<BagFilter>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const byId = new Map(content.items.map((i) => [i.id, i]));
  const rows = bagRows(save, content.items);
  const counts = new Map<BagFilter, number>(BAG_FILTERS.map((f) => [f.id, f.id === 'all' ? rows.length : rows.filter((r) => filterOf(byId.get(r.id)) === f.id).length]));
  const shown = filter === 'all' ? rows : rows.filter((r) => filterOf(byId.get(r.id)) === filter);
  // the pick stays on its thing; when that is gone (eaten, given, another pocket) the first one here is picked
  const cur = shown.find((r) => r.id === picked) ?? shown[0];
  const item = cur ? byId.get(cur.id) : undefined;
  const last = save.bills.at(-1);
  const slots = Math.max(SLOT_MIN, Math.ceil(shown.length / SLOT_COLS) * SLOT_COLS);
  if (phone) return <Phone save={save} content={content} onBack={() => setPhone(false)} />;
  return (
    <div className="bg">
      <button type="button" className="bg-wallet" onClick={() => setPhone(true)} aria-label="Open the phone: 余额, 交通卡 and 账单">
        <span className="bg-purse">
          <MenuIcon name="coin" />
          <span className="han">余额</span>
          <b>¥{save.bag.money}</b>
        </span>
        <span className="bg-purse">
          <MenuIcon name="card" />
          <span className="han">交通卡</span>
          {save.bag.card === null ? <span className="muted">—</span> : <b>¥{save.bag.card}</b>}
        </span>
        {last && (
          <span className="bg-last">
            <span className="han">{billName(last.who, content)}</span> <Amount n={last.amount} />
          </span>
        )}
        <span className="bg-go" aria-hidden>
          <span className="han">账单</span> ›
        </span>
      </button>
      <div className="bg-pockets" role="tablist" aria-label="Pockets">
        {BAG_FILTERS.map((f) => {
          const icon = POCKET_ICON[f.id];
          const n = counts.get(f.id) ?? 0;
          return (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} title={f.title} disabled={!n} onClick={() => setFilter(f.id)}>
              {icon.item ? <ItemSprite id={icon.item} /> : <MenuIcon name={icon.ui!} />}
              <span className="han">{f.label}</span>
              <span className="bg-n">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="bg-main">
        <ul className="bg-slots" aria-label={BAG_FILTERS.find((f) => f.id === filter)?.title}>
          {Array.from({ length: slots }, (_, i) => {
            const r = shown[i];
            if (!r) return <li key={`empty-${i}`} className="bg-slot" data-empty="" aria-hidden />;
            const kind = byId.get(r.id)?.kind;
            return (
              <li key={r.id} className="bg-slot">
                <button type="button" aria-pressed={cur?.id === r.id} onClick={() => setPicked(r.id)} title={r.en}>
                  <ItemSprite id={r.id} scale={2} />
                  <span className="han bg-name">{r.name}</span>
                  {r.count > 1 && <span className="bg-count">{r.count}</span>}
                  {kind === 'key' && <i className="bg-key" title="A story thing: not a present, not for sale" />}
                </button>
              </li>
            );
          })}
        </ul>
        {cur && item ? (
          <BagCard
            key={item.id}
            item={item}
            count={cur.count}
            save={save}
            content={content}
            onUse={onUse}
            onAct={(a) => onAct?.(a)}
          />
        ) : (
          <div className="bg-card bg-card-empty">
            <b className="han">空</b>
            <p className="small muted">{rows.length ? 'Nothing in this pocket.' : 'Nothing in the bag yet. Shops, friends and the street fill it.'}</p>
          </div>
        )}
      </div>
    </div>
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

/** The picked thing's card (Y5): its picture in a little display case, the word, the facts, the verbs. */
function BagCard({
  item,
  count,
  save,
  content,
  onUse,
  onAct,
}: {
  item: Item;
  count: number;
  save: WorldSave;
  content: WorldContent;
  onUse: (item: string) => void;
  onAct: (a: SaveAction) => void;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const facts = itemFacts(item, save, content.shops, content.npcs);
  const names = new Map(content.items.map((i) => [i.id, i]));
  const shop = facts.sold[0];
  const verbs = verbsOf(item);
  const mix = combos(item, save.bag.items);
  return (
    <section className="bg-card" aria-label={item.en}>
      <header className="bg-card-head">
        <span className="bg-case">
          <ItemSprite id={item.id} scale={4} label={item.en} />
        </span>
        <span className="bg-card-word">
          <button type="button" className="han bg-card-han" onClick={() => openItem(itemForToken(lib, item.name))} title="Open the word">
            {item.name}
          </button>
          <span className="bg-card-py">{pinyinOf(item.name, lib)}</span>
          <span className="small muted bg-card-en">
            {item.en}
            {count > 1 ? ` · ×${count}` : ''}
          </span>
        </span>
        {item.kind && (
          <span className="bg-tag han" data-kind={item.kind}>
            {KIND_ZH[item.kind] ?? item.kind}
          </span>
        )}
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
        {(item.kind === 'food' || item.kind === 'drink') && save.fresh[item.id] !== undefined && (
          <>
            <dt className="han">{save.fresh[item.id] === dayOf(save.clock) ? '热的' : '凉了'}</dt>
            <dd className="muted">{save.fresh[item.id] === dayOf(save.clock) ? 'bought today — still warm' : 'bought on an earlier day — gone cold'}</dd>
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
      {(verbs.length > 0 || mix.length > 0) && (
        <div className="bg-verbs">
          {verbs.map((v) => (
            <button
              key={v}
              type="button"
              className="bg-verb"
              title={VERB_ZH[v].en}
              onClick={() => (v === 'eat' || v === 'drink' ? onAct({ do: 'eat', item: item.id }) : v === 'look' ? openItem(itemForToken(lib, item.name)) : onUse(item.id))}
            >
              <span className="han">{VERB_ZH[v].zh}</span> <span className="tiny">{VERB_ZH[v].en}</span>
            </button>
          ))}
          {mix.map((c) => (
            <button
              key={c.with}
              type="button"
              className="bg-verb"
              title={`with the ${names.get(c.with)?.en ?? c.with}: makes ${names.get(c.makes)?.en ?? c.makes}`}
              onClick={() => onAct({ do: 'combine', a: item.id, b: c.with, makes: c.makes })}
            >
              <ItemSprite id={c.with} scale={1} />
              <span className="han">
                +{names.get(c.with)?.name} → {names.get(c.makes)?.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** The phone (Y5): 余额, the 交通卡 and the 账单 — the last payments in and out. */
function Phone({ save, content, onBack }: { save: WorldSave; content: WorldContent; onBack: () => void }) {
  return (
    <div className="w-phone w-phone-home">
      <div className="w-phone-head">
        <button type="button" className="wd-tool" onClick={onBack} aria-label="Back to the bag">
          <PixelIcon name="back" />
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
  if (who === 'bike') return '共享单车';
  if (who.startsWith('machine-')) return '售票机';
  return who ? '北京' : '—';
}

const ON_OFF = [
  { id: 'off', label: 'Off' },
  { id: 'on', label: 'On' },
] as const;
const LEVELS = [
  { id: 'off', label: 'Off' },
  { id: 'soft', label: 'Soft' },
  { id: 'on', label: 'On' },
] as const;
const level = (v: number) => (v <= 0 ? 'off' : v < 0.5 ? 'soft' : 'on');
const volumeOf = (v: string) => (v === 'off' ? 0 : v === 'soft' ? 0.35 : 0.8);

/** ⚙ (§10 P1): the game's settings in four groups — Sound, Text, Controls, Game. */
function Settings({ settings, onChange, onReset }: { settings: WorldSettings; onChange: (patch: Partial<WorldSettings>) => void; onReset: () => void }) {
  const listenable = canRecognise();
  const [sure, setSure] = useState(false);
  return (
    <div className="wp-settings">
      <h3 className="wp-label">Sound</h3>
      <label>
        <span>Street sounds</span>
        <Seg value={level(settings.volume)} options={LEVELS} onChange={(v) => onChange({ volume: volumeOf(v) })} size="sm" />
      </label>
      <label>
        <span>City voices</span>
        <Seg value={settings.cityVoices === false ? 'off' : 'on'} options={ON_OFF} onChange={(v) => onChange({ cityVoices: v === 'on' })} size="sm" />
      </label>
      <label>
        <span>Music</span>
        <Seg value={level(settings.music)} options={LEVELS} onChange={(v) => onChange({ music: volumeOf(v) })} size="sm" />
      </label>
      <label>
        <span>Celebrations</span>
        <Seg
          value={settings.celebrate ?? 'full'}
          options={[
            { id: 'quiet', label: 'Quiet', title: 'Seals only, no sound' },
            { id: 'full', label: 'Full', title: 'Seals with a sound, and the spirits’ flight home' },
          ]}
          onChange={(celebrate) => onChange({ celebrate })}
          size="sm"
        />
      </label>
      <h3 className="wp-label">Text</h3>
      <label>
        <span>拼 under lines</span>
        <Seg value={settings.pinyin ? 'on' : 'off'} options={ON_OFF} onChange={(v) => onChange({ pinyin: v === 'on' })} size="sm" />
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
      <h3 className="wp-label">Controls</h3>
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
        <span>On-screen joystick</span>
        <Seg value={settings.joystick ? 'on' : 'off'} options={ON_OFF} onChange={(v) => onChange({ joystick: v === 'on' })} size="sm" />
      </label>
      <label>
        <span>Quest marks 「!」</span>
        <Seg value={settings.questMarks === false ? 'off' : 'on'} options={ON_OFF} onChange={(v) => onChange({ questMarks: v === 'on' })} size="sm" />
      </label>
      <label>
        <span>Mark what I can use</span>
        <Seg value={settings.highlight ? 'on' : 'off'} options={ON_OFF} onChange={(v) => onChange({ highlight: v === 'on' })} size="sm" />
      </label>
      <h3 className="wp-label">Game</h3>
      <p className="tiny muted">Settings are kept in your game save, so the iPad and the Mac share them. Keys: 1–5 switch tabs, Esc closes.</p>
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
