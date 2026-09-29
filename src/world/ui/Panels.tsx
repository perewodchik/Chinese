import { useState } from 'react';
import { dayOf } from '../core/clock';
import { contentNames, diaryDays, diaryLines } from '../core/diary';
import { dateZh, WEATHER_ICON, WEATHER_ZH, weatherOf } from '../core/calendar';
import type { WorldSave, WorldSettings } from '../core/types';
import { canRecognise } from '../../platform/audio/recognition';
import { Seg } from '../../ui/Seg';
import { rememberInput } from './typing';
import type { WorldContent } from './content';
import {
  bagRows,
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
import { CityMap } from './CityMap';

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
  user,
  onReset,
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
  /** whose album this device keeps (X6) */
  user: string;
  /** start the whole game over */
  onReset: () => void;
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
          {tab === 'bag' && <Bag save={save} content={content} onUse={onUse} />}
          {tab === 'map' && <CityMap save={save} onGo={onGo} />}
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

function Bag({ save, content, onUse }: { save: WorldSave; content: WorldContent; onUse: (item: string) => void }) {
  const rows = bagRows(save, content.items);
  return (
    <>
      <div className="wp-money">
        <span>
          <span className="han">钱</span> <b>{save.bag.money}</b> 元
        </span>
        <span>
          <span className="han">交通卡</span> {save.bag.card === null ? <span className="muted">not yet</span> : <b>{save.bag.card} 元</b>}
        </span>
      </div>
      {rows.length ? (
        <ul className="wp-grid">
          {rows.map((r) => (
            <li key={r.id} className="wp-item">
              <span className="han">{r.name}</span>
              <span className="tiny muted">{r.en}</span>
              {r.count > 1 && <span className="wp-count">×{r.count}</span>}
              <button type="button" className="btn sm wp-use" onClick={() => onUse(r.id)}>
                Use / give
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty han="空">Nothing in the bag yet.</Empty>
      )}
    </>
  );
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
  if (!rows.length && !save.cat.name) return <Empty han="成">No 成语 yet. When someone says one, it is written here.</Empty>;
  return (
    <>
      {!save.flags.includes('idiom-book') && <p className="tiny muted">The book 《成语故事》 itself turns up in a bookshop later; until then they are kept here.</p>}
      <ul className="wp-cards">
        {rows.map(({ idiom: x, npc }) => (
          <li key={x.id} className="wp-card wp-idiom">
            <div>
              <b className="han wp-name">{x.id}</b> <span className="small">{x.pinyin}</span>
              {x.tier === 'story' && <span className="tiny muted"> · a story</span>}
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
