import { useState } from 'react';
import { useLibrary } from '../../features/shared/library';
import { districtInfo, type DistrictInfo } from '../core/districts';
import { formatTime, dayOf } from '../core/clock';
import type { WorldSave } from '../core/types';
import type { WorldContent } from './content';
import { pinyinOf } from './pinyin';
import {
  bagRows,
  idiomRows,
  mapHint,
  mapSpots,
  PANELS,
  riddleRows,
  spiritRows,
  stampRows,
  taskRows,
  type PanelId,
} from './panelRows';
import { ZhText } from './ZhText';

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
}: {
  tab: PanelId;
  setTab: (t: PanelId) => void;
  save: WorldSave;
  content: WorldContent;
  pinyin: boolean;
  onClose: () => void;
  /** "Go": to the nearest station of where you are, to ride from there */
  onGo: (station: string) => void;
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
          {tab === 'bag' && <Bag save={save} content={content} />}
          {tab === 'map' && <BeijingMap save={save} onGo={onGo} />}
          {tab === 'spirits' && <Spirits save={save} content={content} pinyin={pinyin} />}
          {tab === 'idioms' && <Idioms save={save} content={content} pinyin={pinyin} />}
          {tab === 'stamps' && <Stamps save={save} content={content} />}
        </div>
      </section>
    </div>
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

function Bag({ save, content }: { save: WorldSave; content: WorldContent }) {
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
            </li>
          ))}
        </ul>
      ) : (
        <Empty han="空">Nothing in the bag yet.</Empty>
      )}
    </>
  );
}

function BeijingMap({ save, onGo }: { save: WorldSave; onGo: (station: string) => void }) {
  const lib = useLibrary();
  const [picked, setPicked] = useState<DistrictInfo | null>(null);
  const spots = mapSpots(save);
  const hint = picked ? mapHint(save, picked) : null;
  const here = districtInfo(save.district);
  return (
    <>
      <div className="wp-map" role="img" aria-label="A map of Beijing's districts">
        <span className="wp-map-ring" aria-hidden />
        {spots.map((s) => (
          <button
            key={s.d.id}
            type="button"
            className="wp-spot"
            style={{ left: `${s.d.at[0]}%`, top: `${s.d.at[1]}%` }}
            data-visited={s.visited ? '' : undefined}
            data-here={s.here ? '' : undefined}
            data-later={s.later ? '' : undefined}
            aria-pressed={picked?.id === s.d.id}
            onClick={() => setPicked(s.d)}
            title={s.d.en}
          >
            <i aria-hidden />
            <span className="han">{s.d.name.split(' · ')[0]}</span>
          </button>
        ))}
      </div>
      <div className="wp-route">
        {picked ? (
          <>
            <b className="han">{picked.name}</b> <span className="tiny muted">{pinyinOf(picked.name, lib)} · {picked.en}</span>
            <p className="small">
              {hint?.kind === 'here' ? 'You are here.' : hint && 'text' in hint ? hint.text : ''}
              {picked.chapter > save.chapter && picked.id !== save.district && ' (The story gets there later — you may go already.)'}
            </p>
            {hint?.kind === 'route' && (
              <button type="button" className="btn sm primary" onClick={() => onGo(hint.from)}>
                Go — to the station
              </button>
            )}
          </>
        ) : (
          <p className="small muted">Tap a place for the way there{here ? ` from ${here.name}` : ''}.</p>
        )}
      </div>
      <p className="tiny muted">
        Day {dayOf(save.clock)} · {formatTime(save.clock)} · stations used: {save.stations.length}
      </p>
    </>
  );
}

function Spirits({ save, content, pinyin }: { save: WorldSave; content: WorldContent; pinyin: boolean }) {
  const rows = spiritRows(save, content.spirits);
  if (!rows.length) return <Empty han="灵">The spirits of the broken lantern are still out there.</Empty>;
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
  if (!rows.length) return <Empty han="印">Your Beijing passport. Stamps come for what you do — buying a ticket, asking the way.</Empty>;
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
