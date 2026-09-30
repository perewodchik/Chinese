import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../features/shared/library';
import { dayOf, formatTime } from '../core/clock';
import { contentNames, diaryDays, diaryLines } from '../core/diary';
import { dateZh, WEATHER_ICON, WEATHER_ZH, weatherOf } from '../core/calendar';
import { HOODS, hoodOf } from '../core/hoods';
import { seenInChapter } from '../core/cutscene';
import { stepIndexOf } from '../core/save';
import { sideQuests, whoWhere, type SideEntry } from '../core/sidequests';
import { directions, journal, story, type Directions, type Journal, type JournalQuest, type RouteLeg, type StoryChapter } from '../core/journal';
import { placeOf, type MapLinks } from '../core/places';
import { line, station } from '../core/travel';
import type { Quest, WorldSave } from '../core/types';
import type { WorldContent } from './content';
import { riddleRows } from './panelRows';
import { loadIndex } from './PlaceCard';
import { pinyinOf } from './pinyin';
import { Portrait } from './Portrait';
import { useEscape } from './useEscape';
import { ZhText } from './ZhText';
import './journal.css';

/**
 * The 📜 日志 tab (§10 J3): **Now** — the quest you follow as a card with
 * the place and the route there by metro, the others under way as quiet
 * rows, leads to side quests not yet started, and the riddles; **Story** —
 * the chapters as a timeline; **日记** — the diary, cross-linked with the
 * story by day. The work is done in core/journal.ts; this only draws it.
 */

/** by chapter number (§13 S1: 5 香火 and 9 过年 are new; 10 is the epilogue, 11 the story told) */
export const CHAPTER_ZH = ['', '第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '第八章', '第九章', '尾声', '尾声'];

/** public/world/maps/index.json, for the walks (empty until it arrives) */
export function useMapIndex(): MapLinks {
  const [index, setIndex] = useState<MapLinks>({});
  useEffect(() => {
    let on = true;
    void loadIndex().then((i) => on && setIndex(i));
    return () => {
      on = false;
    };
  }, []);
  return index;
}

export const placeZh = (map: string) => placeOf(map)?.zh ?? hoodOf(map)?.zh ?? map;
const stationZh = (id: string) => {
  try {
    return station(id).zh;
  } catch {
    return id;
  }
};

export interface RouteRequest {
  legs: readonly RouteLeg[];
  to: string;
}

/** The way as chips (J3): 🚶 to a place, a line chip in its colour with its direction and stops, ↔ at a change. */
export function RouteStrip({ dir }: { dir: Directions }) {
  if (dir.kind === 'here') return <p className="small jn-here">📍 You are here.</p>;
  if (dir.kind === 'none') return <p className="small muted">{dir.note}</p>;
  return (
    <ol className="jn-route" aria-label="The way there">
      {dir.legs.map((l, i) =>
        l.kind === 'walk' ? (
          <li key={i} className="jn-walk" title={l.maps.map(placeZh).join(' → ')}>
            <span aria-hidden>🚶</span> <span className="han">{placeZh(l.maps.at(-1)!)}</span>
          </li>
        ) : l.kind === 'change' ? (
          <li key={i} className="jn-change" title={`Change at ${stationZh(l.at)}`}>
            ↔
          </li>
        ) : (
          <li key={i} className="jn-ride" title={`${line(l.line).en}: ${stationZh(l.from)} → ${stationZh(l.to)}`}>
            <span className="jn-line han" style={{ background: line(l.line).color }}>
              {line(l.line).zh}
            </span>
            <span className="tiny">
              <span className="han">{l.direction || stationZh(l.to)}</span> · {l.stops.length - 1} {l.stops.length === 2 ? 'stop' : 'stops'} →{' '}
              <span className="han">{stationZh(l.to)}</span>
            </span>
          </li>
        ),
      )}
    </ol>
  );
}

/** Under the strip: the fare, and whether the 交通卡 will do. */
export function FareNote({ dir }: { dir: Directions }) {
  if (dir.kind !== 'ride') return null;
  return (
    <p className="tiny muted jn-fare">
      {dir.fare} 元 ·{' '}
      {dir.hasCard ? (
        dir.enough ? (
          <span className="han">交通卡 ✓</span>
        ) : (
          <>
            <span className="han">交通卡</span> — top it up at a ticket machine
          </>
        )
      ) : (
        <>
          no <span className="han">交通卡</span> yet — buy one at the station (40 元)
        </>
      )}
    </p>
  );
}

/** A destination: its little picture, 汉字 · pinyin · English. The picture's box is sized before it loads. */
export function Destination({ map, more = 0 }: { map: string; more?: number }) {
  const lib = useLibrary();
  const p = placeOf(map);
  const zh = placeZh(map);
  return (
    <div className="jn-dest">
      <span className="jn-mini">
        <img src={`/world/minis/${map}.png`} alt="" width={96} height={72} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
      </span>
      <span className="jn-dest-text">
        <b className="han">{zh}</b>
        <span className="tiny muted">
          {pinyinOf(zh, lib)}
          {p ? ` · ${p.en}` : ''}
          {more ? ` · and ${more} more` : ''}
        </span>
      </span>
    </div>
  );
}

const TAG = { main: '主线', side: '支线' } as const;

/** The known reward of a quest, never an item or a spirit: a stamp, a friend's heart. */
function rewardHint(q: Quest): string | null {
  const r = q.reward ?? [];
  const parts = [r.some((a) => a.do === 'stamp') && 'a stamp for your passport', r.some((a) => a.do === 'hearts') && 'a friend’s heart'].filter(Boolean);
  return parts.length ? `Brings ${parts.join(' and ')}.` : null;
}

function Face({ content, npc, size = 2 }: { content: WorldContent; npc?: string; size?: number }) {
  const card = npc ? content.npcs.find((n) => n.id === npc) : undefined;
  return card ? <Portrait sprite={card.look.sprite} scale={size} /> : <Portrait sprite="rabbit" scale={size} />;
}

/** One quest's drawer: what it is about, who asked, where and how to get there, what happened so far, and Track. */
export function QuestSheet({
  save,
  content,
  quest,
  jq,
  index,
  onClose,
  onTrack,
  onShowRoute,
}: {
  save: WorldSave;
  content: WorldContent;
  quest: Quest;
  /** when it is under way */
  jq?: JournalQuest;
  index: MapLinks;
  onClose: () => void;
  onTrack?: (quest: string) => void;
  onShowRoute?: (r: RouteRequest) => void;
}) {
  const giver = quest.giver ? content.npcs.find((n) => n.id === quest.giver) : undefined;
  const st = save.quests[quest.id];
  const to = jq?.targets[0]?.map;
  const dir = to ? directions(save, to, index) : null;
  const tracked = (save.tracked?.quest ?? '') === quest.id;
  const log = jq?.log ?? (st ? story(save, content).flatMap((c) => [...(c.quest === quest.id ? c.entries : []), ...c.side.filter((x) => x.quest.id === quest.id).flatMap((x) => x.entries)]) : []);
  const hint = rewardHint(quest);
  useEscape(onClose);
  return (
    <div className="w-sheet-scrim" onClick={onClose}>
      <section className="w-sheet jn-sheet" role="dialog" aria-label={quest.title} onClick={(e) => e.stopPropagation()}>
        <header className="w-sheet-head">
          <span className="jn-tag han" data-kind={quest.kind}>
            {TAG[quest.kind]}
          </span>
          <b className="jn-title">{quest.title}</b>
          <span className="spacer" />
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {quest.blurb && <p className="small">{quest.blurb}</p>}
        {giver && (
          <p className="jn-giver small">
            <Face content={content} npc={giver.id} /> <span className="han">{giver.name}</span> <span className="tiny muted">{giver.role}</span>
          </p>
        )}
        {jq ? (
          <>
            <p className="jn-now">{jq.step.now}</p>
            {to && <Destination map={to} more={jq.targets.length - 1} />}
            {jq.when && <p className="tiny jn-when">⏰ {jq.when}</p>}
            {dir && (
              <>
                <RouteStrip dir={dir} />
                <FareNote dir={dir} />
              </>
            )}
          </>
        ) : st?.done ? (
          <p className="small muted">Done ✓</p>
        ) : null}
        {log.length > 0 && (
          <>
            <h3 className="wp-label">So far</h3>
            <ul className="mn-rows jn-log">
              {log.map((e) => (
                <li key={e.step}>
                  <span className="tiny muted jn-day">{e.day ? `第${e.day}天` : 'earlier'}</span>
                  <span>{e.past}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {hint && <p className="tiny muted">{hint}</p>}
        {jq && (
          <div className="row jn-acts">
            {onTrack && (
              <button type="button" className="btn sm" aria-pressed={tracked} onClick={() => onTrack(tracked ? '' : quest.id)}>
                {tracked ? '★ Following' : '☆ Track'}
              </button>
            )}
            {onShowRoute && to && dir?.kind === 'ride' && (
              <button type="button" className="btn sm" onClick={() => onShowRoute({ legs: dir.legs, to })}>
                Show on map
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** One side quest, spelled out (§13 Q1): who, where, the first thing to do, what it gives, when, and the way there. */
function SideSheet({ save, content, entry, index, onClose, onShowRoute }: { save: WorldSave; content: WorldContent; entry: SideEntry; index: MapLinks; onClose: () => void; onShowRoute: (r: RouteRequest) => void }) {
  const dir = entry.map ? directions(save, entry.map, index) : null;
  useEscape(onClose);
  return (
    <div className="w-sheet-scrim" onClick={onClose}>
      <section className="w-sheet jn-sheet" role="dialog" aria-label={entry.quest.title} onClick={(e) => e.stopPropagation()}>
        <header className="w-sheet-head">
          <Face content={content} npc={entry.giver} />
          <b className="jn-title">{entry.quest.title}</b>
          <span className="spacer" />
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {entry.quest.blurb && <p className="small">{entry.quest.blurb}</p>}
        <dl className="jn-facts small">
          <dt>Who</dt>
          <dd className="han">{whoWhere(entry)}</dd>
          <dt>{entry.state === 'on' ? 'Next' : 'First'}</dt>
          <dd>{entry.first}</dd>
          <dt>When</dt>
          <dd>{entry.when === null ? (entry.state === 'on' ? 'Under way' : 'Now') : entry.when}</dd>
          {entry.gives.length > 0 && (
            <>
              <dt>Gives</dt>
              <dd className="han">{entry.gives.join(' · ')}</dd>
            </>
          )}
        </dl>
        {entry.map && <Destination map={entry.map} />}
        {dir && (
          <>
            <RouteStrip dir={dir} />
            <FareNote dir={dir} />
          </>
        )}
        {entry.map && dir?.kind === 'ride' && (
          <button type="button" className="btn sm" onClick={() => onShowRoute({ legs: dir.legs, to: entry.map! })}>
            Show on map
          </button>
        )}
      </section>
    </div>
  );
}

/**
 * Journal → Side (§13 Q1): every side quest of the chapters reached, by
 * neighbourhood (yours first) — under way, then ones you can start now,
 * then ones that wait, each saying when. No vague leads.
 */
export function JournalSide({ save, content, onShowRoute }: { save: WorldSave; content: WorldContent; onShowRoute: (r: RouteRequest) => void }) {
  const index = useMapIndex();
  const all = useMemo(() => sideQuests(save, content), [save, content]);
  const [open, setOpen] = useState<SideEntry | null>(null);
  if (!all.length) return <Empty han="闲">No side quests right now — the next chapter brings new people.</Empty>;
  const mine = hoodOf(save.place.map)?.id;
  const order: (string | undefined)[] = [];
  for (const e of all) if (!order.includes(e.hood)) order.push(e.hood);
  order.sort((a, b) => Number(b === mine) - Number(a === mine));
  const rank = (e: SideEntry) => (e.state === 'on' ? 0 : e.when === null ? 1 : 2);
  return (
    <>
      {order.map((hood) => (
        <section key={hood ?? '-'}>
          <h3 className="wp-label han">{hood ? (HOODS.find((h) => h.id === hood)?.zh ?? hood) : '北京'}</h3>
          <ul className="mn-rows jn-rows">
            {all
              .filter((e) => e.hood === hood)
              .sort((a, b) => rank(a) - rank(b))
              .map((e) => (
                <li key={e.quest.id}>
                  <button type="button" className="jn-row" data-wait={e.when !== null && e.state === 'new' ? '' : undefined} onClick={() => setOpen(e)}>
                    <Face content={content} npc={e.giver} />
                    <span className="jn-row-text">
                      <span className="jn-row-top">
                        <span className="jn-mark" data-kind={e.state === 'on' ? 'next' : 'side'} aria-hidden>
                          {e.state === 'on' ? '…' : '!'}
                        </span>
                        <b>{e.quest.title}</b>
                        <span className="jn-when tiny">{e.state === 'on' ? 'under way' : (e.when ?? 'now')}</span>
                      </span>
                      <span className="small muted jn-one">
                        <span className="han">{whoWhere(e)}</span> — {e.first}
                      </span>
                      {e.gives.length > 0 && <span className="tiny jn-gives han">{e.gives.join(' · ')}</span>}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {open && <SideSheet save={save} content={content} entry={open} index={index} onClose={() => setOpen(null)} onShowRoute={onShowRoute} />}
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

/** Journal → Now (J3). */
export function JournalNow({
  save,
  content,
  pinyin,
  onTrack,
  onShowRoute,
  onSide,
}: {
  save: WorldSave;
  content: WorldContent;
  pinyin: boolean;
  onTrack: (quest: string) => void;
  onShowRoute: (r: RouteRequest) => void;
  /** open Journal → Side (§13 Q1) */
  onSide?: () => void;
}) {
  const index = useMapIndex();
  const j = useMemo(() => journal(save, content), [save, content]);
  const startable = useMemo(() => sideQuests(save, content).filter((e) => e.state === 'new' && e.when === null).length, [save, content]);
  const [open, setOpen] = useState<string | null>(null);
  const [solvedOpen, setSolvedOpen] = useState(false);
  const riddles = riddleRows(save, content.scenes);
  const unsolved = riddles.filter((r) => !r.solved);
  const solved = riddles.filter((r) => r.solved);
  const npcName = (id?: string) => content.npcs.find((n) => n.id === id)?.name;
  const day = dayOf(save.clock);
  const w = weatherOf(day);
  const main = j.tracked?.quest.kind === 'main' ? j.tracked : j.active.find((a) => a.quest.kind === 'main');
  const openQuest = open ? [j.tracked, ...j.active].find((x) => x?.quest.id === open) : undefined;

  return (
    <>
      <p className="jn-head tiny">
        <span className="han">第{day}天</span> · {WEATHER_ICON[w]} <span className="han">{WEATHER_ZH[w]}</span> · {formatTime(save.clock)} · <span className="han">余额</span> {save.bag.money}
        {main && (
          <>
            {' '}
            · <span className="han">{CHAPTER_ZH[main.quest.chapter] ?? ''}</span> {main.log.length + 1} / {main.quest.steps.length}
          </>
        )}
      </p>
      {j.tracked ? (
        <TrackedCard save={save} jq={j.tracked} index={index} onOpen={() => setOpen(j.tracked!.quest.id)} onShowRoute={onShowRoute} />
      ) : (
        <Empty han="事">Nothing to do right now. Walk around and talk to people — someone always needs a hand.</Empty>
      )}
      {j.active.length > 0 && (
        <>
          <h3 className="wp-label">Also under way</h3>
          <ul className="mn-rows jn-rows">
            {j.active.map((a) => (
              <li key={a.quest.id}>
                <button type="button" className="jn-row" onClick={() => setOpen(a.quest.id)}>
                  <Face content={content} npc={a.giver} />
                  <span className="jn-row-text">
                    <span className="jn-row-top">
                      <b>{a.quest.title}</b>
                      {a.targets[0]?.hood && <span className="jn-hood han">{hoodOf(a.targets[0].map)?.zh}</span>}
                    </span>
                    <span className="small muted jn-one">{a.step.now}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {startable > 0 && onSide && (
        <button type="button" className="jn-also small jn-side-link" onClick={onSide}>
          <span className="jn-mark" data-kind="side" aria-hidden>
            !
          </span>
          {startable === 1 ? 'A side quest you could start now' : `${startable} side quests you could start now`} — Side ›
        </button>
      )}
      <h3 className="wp-label">📌 Riddles</h3>
      {riddles.length ? (
        <ul className="mn-rows">
          {unsolved.map((r) => (
            <li key={r.id} className="jn-riddle">
              <div>
                {npcName(r.npc) && <span className="tiny muted han">{npcName(r.npc)}：</span>}
                <ZhText zh={r.zh} pinyin={pinyin} />
                <p className="tiny muted">Tap the hard words, ask someone “……是什么意思？”, or ask 兔儿爷.</p>
              </div>
            </li>
          ))}
          {solved.length > 0 && (
            <li>
              <button type="button" className="jn-fold small" aria-expanded={solvedOpen} onClick={() => setSolvedOpen((v) => !v)}>
                Worked out: {solved.length} {solvedOpen ? '▴' : '▾'}
              </button>
            </li>
          )}
          {solvedOpen &&
            solved.map((r) => (
              <li key={r.id} className="jn-riddle" data-done="">
                <div>
                  <ZhText zh={r.zh} pinyin={pinyin} />
                  <p className="tiny muted">“{r.en}”</p>
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <p className="small muted">Key lines 📌 — the hard ones that matter — pin themselves here.</p>
      )}
      {openQuest && (
        <QuestSheet save={save} content={content} quest={openQuest.quest} jq={openQuest} index={index} onClose={() => setOpen(null)} onTrack={onTrack} onShowRoute={onShowRoute} />
      )}
    </>
  );
}

function TrackedCard({ save, jq, index, onOpen, onShowRoute }: { save: WorldSave; jq: JournalQuest; index: MapLinks; onOpen: () => void; onShowRoute: (r: RouteRequest) => void }) {
  const to = jq.targets[0]?.map;
  const dir = to ? directions(save, to, index) : null;
  const followed = save.tracked?.quest === jq.quest.id;
  return (
    <article className="jn-card" data-kind={jq.quest.kind}>
      <button type="button" className="jn-card-head" onClick={onOpen} aria-label={`${jq.quest.title} — open`}>
        <span className="jn-tag han" data-kind={jq.quest.kind}>
          {TAG[jq.quest.kind]}
        </span>
        <b className="jn-title">{jq.quest.title}</b>
        {followed && <span className="tiny muted">★</span>}
        <span className="spacer" />
        <span className="tiny muted" aria-hidden>
          ›
        </span>
      </button>
      <p className="jn-now">{jq.step.now}</p>
      {to ? <Destination map={to} more={jq.targets.length - 1} /> : <p className="small muted">Ask around — {jq.quest.lead ?? 'people here will know something.'}</p>}
      {jq.when && <p className="tiny jn-when">⏰ {jq.when}</p>}
      {dir && (
        <>
          <RouteStrip dir={dir} />
          <FareNote dir={dir} />
        </>
      )}
      {to && dir?.kind === 'ride' && (
        <button type="button" className="btn sm primary jn-show" onClick={() => onShowRoute({ legs: dir.legs, to })}>
          Show on map
        </button>
      )}
    </article>
  );
}

/** The current step's "what now" of a quest under way. */
const nowOf = (quests: readonly Quest[], s: WorldSave, id: string) => {
  const q = quests.find((x) => x.id === id);
  const st = s.quests[id];
  return q && st ? q.steps[stepIndexOf(q, st)]?.now : undefined;
};

/** Journal → Story (J3): the chapters as a timeline; the current one open, finished ones one line each. */
export function JournalStory({ save, content, onDay, onReplay }: { save: WorldSave; content: WorldContent; onDay: (day: number) => void; onReplay?: (cutscene: string) => void }) {
  const chapters = useMemo(() => journal(save, content).story, [save, content]);
  const current = chapters.at(-1)?.chapter;
  const [open, setOpen] = useState<Set<number>>(() => new Set(current !== undefined ? [current] : []));
  const [side, setSide] = useState<string | null>(null);
  if (!chapters.length) return <Empty han="始">The story has only begun.</Empty>;
  const toggle = (c: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  return (
    <ol className="jn-story">
      {chapters.map((c) => (
        <li key={c.chapter} data-done={c.done ? '' : undefined}>
          <button type="button" className="jn-chapter" aria-expanded={open.has(c.chapter)} onClick={() => toggle(c.chapter)}>
            <span className="han jn-ch">{CHAPTER_ZH[c.chapter] ?? ''}</span>
            <b>{c.title}</b>
            {c.done && <span className="jn-ok">✓</span>}
            <span className="spacer" />
            <span className="tiny muted">{daysText(c)}</span>
          </button>
          {open.has(c.chapter) && (
            <ul className="jn-entries">
              {onReplay && seenInChapter(save, content.cutscenes, c.chapter).length > 0 && (
                <li className="jn-replays">
                  {seenInChapter(save, content.cutscenes, c.chapter).map((cs) => (
                    <button key={cs.id} type="button" className="chip jn-replay" onClick={() => onReplay(cs.id)} title="Watch again">
                      ▶ <span className="han">{cs.title?.zh ?? cs.id}</span>
                    </button>
                  ))}
                </li>
              )}
              {c.entries.map((e) => (
                <Entry key={e.step} day={e.day} past={e.past} onDay={onDay} />
              ))}
              {!c.done && c.quest && <li className="jn-next tiny muted">… {nowOf(content.quests, save, c.quest)}</li>}
              {c.side.map((x) => (
                <li key={x.quest.id} className="jn-side">
                  <button type="button" className="jn-side-head small" aria-expanded={side === x.quest.id} onClick={() => setSide(side === x.quest.id ? null : x.quest.id)}>
                    <span className="jn-tag han" data-kind="side">
                      支线
                    </span>{' '}
                    {x.quest.title} <span className="tiny muted">✓</span>
                  </button>
                  {side === x.quest.id && (
                    <ul className="jn-entries">
                      {x.entries.map((e) => (
                        <Entry key={e.step} day={e.day} past={e.past} onDay={onDay} />
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

const daysText = (c: StoryChapter) => (c.days ? (c.days[0] === c.days[1] ? `day ${c.days[0]}` : `days ${c.days[0]}–${c.days[1]}`) : '');

function Entry({ day, past, onDay }: { day?: number; past: string; onDay: (day: number) => void }) {
  return (
    <li className="jn-entry small">
      {day ? (
        <button type="button" className="jn-daylink tiny" onClick={() => onDay(day)} title="Open this day in the diary">
          第{day}天
        </button>
      ) : (
        <span className="tiny muted jn-day">earlier</span>
      )}
      <span>{past}</span>
    </li>
  );
}

/**
 * The diary (X3), moved into the journal (J3): each game day in a few
 * simple sentences, newest first; every word tappable. Each day adds
 * "Also: …" — the story's steps of that day — which opens the story.
 */
export function Diary({ save, content, pinyin, focus, onStory }: { save: WorldSave; content: WorldContent; pinyin: boolean; focus?: number | null; onStory: () => void }) {
  const [open, setOpen] = useState<number | null>(focus ?? null);
  const days = diaryDays(save);
  const also = useMemo(() => {
    const by = new Map<number, string[]>();
    for (const c of journal(save, content).story)
      for (const e of [...c.entries, ...c.side.flatMap((x) => x.entries)]) if (e.day) by.set(e.day, [...(by.get(e.day) ?? []), e.past]);
    return by;
  }, [save, content]);
  const focused = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focused.current?.scrollIntoView({ block: 'start' });
  }, [focus]);
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
          const more = also.get(d.day);
          return (
            <li key={d.day} ref={d.day === focus ? focused : undefined} data-focus={d.day === focus ? '' : undefined}>
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
              {more && (
                <button type="button" className="jn-also tiny" onClick={onStory}>
                  Also: {more.join(' · ')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** A journal for the rest of the menu (the People tab's quests). */
export const useJournal = (save: WorldSave, content: WorldContent): Journal => useMemo(() => journal(save, content), [save, content]);
