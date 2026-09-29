import { useNavigate } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayOf, partOfDay } from '../../world/core/clock';
import { festivalOf, skyOf, weatherOf, type FestivalId } from '../../world/core/calendar';
import { CAT_LANE } from '../../world/core/room';
import { DOZE_AFTER_MS, emoteFor, hatFor } from '../../world/core/rabbit';
import { districtInfo } from '../../world/core/districts';
import { subjectsIn } from '../../world/core/photo';
import { cropPhoto, loadAlbum, saveAlbum } from '../../world/ui/album';
import { FINDER, PhotoMode } from '../../world/ui/PhotoMode';
import { libraryLexicon } from '../../world/core/dialogue/lexicon';
import { autoScene, sceneFor } from '../../world/core/scenes';
import { gateCheck, isMachine, machineScene } from '../../world/core/machine';
import type { SaveAction } from '../../world/core/save';
import type { Facing, MapObject, NpcCard, PartOfDay, Scene, Tile, WorldSave } from '../../world/core/types';
import type { RunningWorld } from '../../world/engine/boot';
import { throughDoor } from '../../world/engine/doors';
import type { WorldHost } from '../../world/engine/scene';
import { loadContent, useWorldContent, EMPTY_CONTENT } from '../../world/ui/content';
import { castMap, looksOf } from '../../world/core/cast';
import { Dialogue, lookOf } from '../../world/ui/Dialogue';
import { InputBar } from '../../world/ui/InputBar';
import { reportCrash } from '../../world/ui/CrashGuard';
import { RideSheet } from '../../world/ui/RideSheet';
import { setVoiceCards } from '../../world/ui/lineVoice';
import { Ambient } from '../../world/audio/ambient';
import { mixFor } from '../../world/audio/mix';
import { moodFor } from '../../world/audio/music';
import type { MapLife } from '../../world/core/maptext';
import { fareOut, stopMap } from '../../world/core/ride';
import { rideKey, type Mode } from '../../world/core/travel';
import { Joystick } from '../../world/ui/Joystick';
import { Panels } from '../../world/ui/Panels';
import { Minimap } from '../../world/ui/Minimap';
import { NextHop } from '../../world/ui/NextHop';
import { trackedMaps } from '../../world/core/journal';
import { menuNewsFor, type PanelId } from '../../world/ui/menu';
import { Companion } from '../../world/ui/Companion';
import { cueLine, IDLE_MS, speaksUpAfterMisses } from '../../world/ui/companionLines';
import { activeQuests, whatNow } from '../../world/core/quests';
import { TopBar } from '../../world/ui/TopBar';
import { lineScene, signScene, smallTalk, useTalk } from '../../world/ui/useTalk';
import { GIFT_LINES, giveTo, NOTHING_HAPPENS } from '../../world/core/gifts';
import { useLibrary } from '../shared/library';
import { useWorldSave, type TalkWho } from '../../world/ui/useWorldSave';
import { useUser } from '../auth/session';
import { oneOf, useQuery } from '../../navigation/query';
import { paths } from '../../navigation/paths';
import { useTitle } from '../../ui/useTitle';

const TIMES: PartOfDay[] = ['morning', 'day', 'evening', 'night'];

/** Until chapter 1's maps exist, a save that points at a map this build lacks starts in the prototype lane. */
const FALLBACK = { map: 'hutong-proto', tile: [14, 7] as Tile };

type MapIndex = Record<string, { district: string; width: number; height: number }>;

/**
 * 走走 on the page: a box the canvas fills. Below 690px it takes the whole
 * screen and the site's bar goes, as 点单 does on a phone.
 *
 *   /play/world                       the game, where the save says you are
 *   /play/world?map=…&time=night      development: a map at a time of day
 *   &frame=1024x768                   pins the box to a size, for screenshots
 */
export function WorldPage() {
  useTitle('走走 Zǒuzou');
  const user = useUser();
  const lib = useLibrary();
  const content = useWorldContent() ?? EMPTY_CONTENT;
  const game = useWorldSave(user.id, content.quests);
  const lex = useMemo(() => libraryLexicon(lib), [lib]);
  // What a conversation does beyond the save: a teleport waits for the talk to end.
  const pendingTravel = useRef<{ map: string; tile: Tile; facing: Facing } | null>(null);
  /** a shop door's 点单 game, opened when the talk is over */
  const pendingGame = useRef<string | null>(null);
  const navigate = useNavigate();
  const talkDispatch = (actions: readonly SaveAction[], who: TalkWho) => {
    for (const a of actions) {
      if (a.do === 'teleport') pendingTravel.current = { map: a.map, tile: a.tile, facing: a.facing ?? 'down' };
      if (a.do === 'game') pendingGame.current = a.game;
    }
    const after = game.dispatch(actions, 'important', who);
    // a decoration put up, or the cat named (X5): draw the map again where you stand once the talk ends
    if (after && !pendingTravel.current && actions.some((a) => a.do === 'place' || a.do === 'cat_name')) {
      pendingTravel.current = { map: after.place.map, tile: after.place.tile, facing: after.place.facing };
    }
    return after;
  };
  // 「给你糖葫芦」 said in a talk hands it over as if it had been tapped on them (Y4)
  const talk = useTalk(content, lex, talkDispatch, (item, npc) => {
    const s = game.current();
    if (s) applyItem(item, { npc, card: contentRef.current.npcs.find((n) => n.id === npc) ?? null }, s);
  });
  /** wrong things tried on one person or thing (Y4): after two, 兔儿爷 glances at the right one */
  const wrongTries = useRef<{ at: string; n: number }>({ at: '', n: 0 });
  const missedWith = (at: string, s: WorldSave, who: { npc: string } | { look: string; map: string }) => {
    wrongTries.current = wrongTries.current.at === at ? { at, n: wrongTries.current.n + 1 } : { at, n: 1 };
    if (wrongTries.current.n < 2) return;
    const c = contentRef.current;
    const right = Object.keys(s.bag.items).find((id) => (s.bag.items[id] ?? 0) > 0 && sceneFor(c.scenes, s, { ...who, use: id }));
    const it = right && c.items.find((i) => i.id === right);
    if (it) setPal({ open: true, said: `Try the ${it.en} — ${it.name} — from your bag.` });
  };
  /**
   * Using an item on someone or something (X1): a scene written for it wins;
   * otherwise a person takes it as a present (likes, dislikes, one a day), and
   * anything else is a gentle "not this one". The item stays unless accepted.
   */
  const applyItem = (itemId: string, target: { npc: string; card: NpcCard | null } | { object: string }, s: WorldSave) => {
    setUsing(null);
    const c = contentRef.current;
    const item = c.items.find((i) => i.id === itemId);
    if (!item) return;
    if ('npc' in target) {
      const scene = sceneFor(c.scenes, s, { npc: target.npc, use: itemId });
      const look = target.card ? lookOf(target.card, target.card.id) : target.npc;
      if (scene) return talkRef.current.start(scene, target.card, look, s);
      if (!target.card) return talkRef.current.start(lineScene('no', target.npc, GIFT_LINES['not-a-gift'].zh, GIFT_LINES['not-a-gift'].en, target.npc), null, look, s);
      const r = giveTo(target.card, item, s);
      if (r.kind === 'not-a-gift') missedWith(`npc:${target.npc}`, s, { npc: target.npc });
      if (r.actions.length) game.dispatch(r.actions, 'important', { npc: target.npc });
      return talkRef.current.start(lineScene(`gift-${r.kind}`, target.npc, r.zh, r.en, target.npc), target.card, look, s);
    }
    const scene = sceneFor(c.scenes, s, { look: target.object, map: s.place.map, use: itemId });
    if (scene) {
      const card = c.npcs.find((n) => n.id === scene.npc) ?? null;
      return card ? talkRef.current.start(scene, card, lookOf(card, card.id), s) : startBare(scene, s);
    }
    missedWith(`look:${s.place.map}:${target.object}`, s, { look: target.object, map: s.place.map });
    talkRef.current.start(lineScene('nothing', 'hero', NOTHING_HAPPENS.zh, NOTHING_HAPPENS.en), null, 'sign', s, '我');
  };

  /**
   * A photo (X6): the canvas inside the viewfinder, small, into this device's
   * album; what stood inside the frame goes to the save for photo tasks.
   */
  const takePhoto = async (): Promise<string | null> => {
    const w = world.current;
    const h = here.current;
    const s = game.current();
    if (!w || !h || !s) return null;
    const shot = await w.snapshot();
    const img = await cropPhoto(shot, FINDER);
    const v = w.view();
    const subjects = v ? subjectsIn(h.objects, h.id, { x: v.x + v.w * FINDER.x, y: v.y + v.h * FINDER.y, w: v.w * FINDER.w, h: v.h * FINDER.h }) : [];
    const place = districtInfo(s.district)?.name ?? '北京';
    const id = `${Date.now().toString(36)}`;
    saveAlbum(user.id, [{ id, at: s.clock, map: h.id, subjects, place, img }, ...loadAlbum(user.id)]);
    game.dispatch([{ do: 'photo', subjects }]);
    const who = subjects.filter((x) => x.startsWith('npc:')).map((x) => contentRef.current.npcs.find((n) => n.id === x.slice(4))?.name).filter(Boolean);
    return who.length ? `Saved to 相册 — with ${who.slice(0, 2).join(', ')}.` : 'Saved to 相册.';
  };

  /** A scene with no person in it (a thought, 兔儿爷, a spirit): headed by whoever speaks first. */
  const startBare = (scene: Scene, s: WorldSave) => {
    const who = scene.nodes.find((n) => n.id === scene.start)?.speaker ?? 'hero';
    const spirit = contentRef.current.spirits.find((x) => x.id === who);
    if (who === 'companion') talkRef.current.start(scene, null, 'rabbit', s, '兔儿爷');
    else talkRef.current.start(scene, null, 'sign', s, spirit?.hanzi ?? '我');
  };
  const talkRef = useRef(talk);
  talkRef.current = talk;
  const contentRef = useRef(content);
  contentRef.current = content;
  useEffect(() => setVoiceCards(content.npcs), [content]);
  const [query] = useQuery();
  const frame = /^(\d+)x(\d+)$/.exec(query.get('frame') ?? '');
  const box = useRef<HTMLDivElement>(null);
  const world = useRef<RunningWorld | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [note, setNote] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [pal, setPal] = useState<{ open: boolean; said: string | null }>({ open: false, said: null });
  const [panel, setPanel] = useState<PanelId | null>(null);
  /** the neighbourhood the 🗺 tab opens on, when the minimap opened it */
  const [mapStart, setMapStart] = useState<string | null>(null);
  useEffect(() => {
    if (panel !== 'map') setMapStart(null);
  }, [panel]);
  /** an item chosen in the bag, waiting for someone or something to be used on (X1) */
  const [using, setUsing] = useState<string | null>(null);
  const usingRef = useRef<string | null>(null);
  usingRef.current = using;
  /** on a platform: the station you board at */
  const [riding, setRiding] = useState<{ at: string; mode: Mode } | null>(null);
  const mapIndex = useRef<MapIndex>({});
  const lastActive = useRef(Date.now());
  // the street's sounds (G1): made on first tap, mixed by where you are and the hour
  const ambient = useRef<Ambient | null>(null);
  const here = useRef<{ id: string; life: MapLife; objects: MapObject[] } | null>(null);
  const [photo, setPhoto] = useState(false);
  const remix = (minutes?: number) => {
    const h = here.current;
    const s = game.current();
    if (!h || !s) return;
    const at = minutes ?? s.clock;
    const time = partOfDay(at);
    const day = dayOf(at);
    ambient.current?.setMix(mixFor(h.id, h.life, time));
    // the music follows the place, the hour, the weather and the day (?weather= tries one)
    const sky = query.get('weather');
    const weather = sky === 'rain' || sky === 'snow' ? sky : weatherOf(day);
    const festival = (query.get('festival') as FestivalId | null) ?? festivalOf(day)?.id ?? null;
    ambient.current?.setMood(moodFor({ mapId: h.id, life: h.life, time, weather, festival }));
  };
  const busy = useRef(false);
  busy.current = note !== null || talk.view !== null || panel !== null || riding !== null || photo;

  // An error thrown inside the engine's loop never reaches React: hand it to the crash guard.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (/phaser|world\/engine|scene\.ts/i.test(`${e.filename} ${e.error?.stack ?? ''}`)) reportCrash(e.error ?? e.message);
    };
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.worldFull = '';
    return () => {
      delete html.dataset.worldFull;
    };
  }, []);

  const opened = game.save !== null;
  const start = useMemo(() => {
    const s = game.current();
    if (!s) return null;
    const time = oneOf(query.get('time'), TIMES, partOfDay(s.clock)) as PartOfDay;
    const asked = query.get('map');
    return { time, asked, place: s.place };
    // Only the first save opens the world; later changes come from inside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  useEffect(() => {
    const el = box.current;
    if (!el || !start) return;
    let gone = false;
    setState('loading');
    void (async () => {
      try {
        const index = (await (await fetch('/world/maps/index.json')).json()) as MapIndex;
        mapIndex.current = index;
        let { map, tile } = start.asked && index[start.asked] ? { map: start.asked, tile: null as Tile | null } : start.place;
        if (!index[map]) ({ map, tile } = FALLBACK);
        if (!tile) tile = map === FALLBACK.map ? FALLBACK.tile : [Math.floor(index[map]!.width / 2), index[map]!.height - 4];
        /** the ticket gates, walked into or tapped: the station's own gate scene if it has one, else through with a card */
        const gate = (tile: Tile, fromAbove: boolean) => {
          const s = game.current();
          if (!s) return;
          const c = contentRef.current;
          const own = sceneFor(c.scenes, s, { look: fromAbove ? 'gates-in' : 'gates-out', map: s.place.map });
          if (own) {
            const card = c.npcs.find((n) => n.id === own.npc) ?? null;
            if (card) talkRef.current.start(own, card, lookOf(card, card.id), s);
            else startBare(own, s);
            return;
          }
          const stop = gateCheck(s, fromAbove);
          if (stop) talkRef.current.start(stop, null, 'sign', s, '闸机 · The gates');
          else world.current?.passGate(tile, fromAbove);
        };
        const host: WorldHost = {
          onStep: (t, facing) => {
            lastActive.current = Date.now();
            game.dispatch([{ do: 'move', tile: t, facing }], 'walk');
          },
          onArrive: (info, t, facing) => {
            const s = game.dispatch([{ do: 'enter', map: info.id, tile: t, facing, district: info.district || undefined }]);
            here.current = { id: info.id, life: info.life, objects: info.objects };
            remix();
            if (info.id.startsWith('station-')) ambient.current?.chime();
            // a scene that starts by itself here (the first morning, a first visit)
            const auto = s && autoScene(contentRef.current.scenes, s, info.id);
            if (s && auto) {
              const card = contentRef.current.npcs.find((n) => n.id === auto.npc) ?? null;
              if (card) talkRef.current.start(auto, card, lookOf(card, card.id), s);
              else startBare(auto, s);
            }
          },
          onDoor: (door) => {
            const s = game.current();
            if (!s) return;
            const r = throughDoor(door, s);
            // nobody rides a bike indoors: it is parked at the door
            if (r.open && s.flags.includes('on-bike')) {
              game.dispatch([{ do: 'flag', flag: 'on-bike', value: false }, { do: 'money', amount: -1 }], 'important', { scene: 'bike' });
              world.current?.setBike(false);
            }
            if (r.open) world.current?.travel(r.to);
            else setNote(r.why);
          },
          onEdge: (to) => world.current?.travel(to),
          onTalk: (npc) => {
            const s = game.current();
            if (!s) return;
            const c = contentRef.current;
            const card = c.npcs.find((n) => n.id === npc) ?? null;
            if (usingRef.current) {
              applyItem(usingRef.current, { npc, card }, s);
              return;
            }
            const scene = sceneFor(c.scenes, s, { npc }) ?? smallTalk(npc, card);
            talkRef.current.start(scene, card, lookOf(card, npc), s);
          },
          onLook: (o: MapObject) => {
            const s = game.current();
            if (!s) return;
            if (usingRef.current) {
              applyItem(usingRef.current, { object: o.id }, s);
              return;
            }
            // the board on a platform or at a bus stop: what leaves from here
            // (subway maps are called station-<id>, bus and train stops stop-<id>);
            // a scene on the board (no ticket yet) comes first
            const boards: Record<string, Mode> = { board: 'subway', 'bus-board': 'bus', 'train-board': 'train' };
            const board = o.kind === 'sign' ? boards[o.id] : undefined;
            if (board && !sceneFor(contentRef.current.scenes, s, { look: o.id, map: s.place.map })) {
              const here = s.place.map.replace(/^(station|stop)-/, '');
              game.dispatch([{ do: 'station', station: here }]);
              setRiding({ at: here, mode: board });
              return;
            }
            const c = contentRef.current;
            const scene = sceneFor(c.scenes, s, { look: o.id, map: s.place.map });
            if (scene) {
              const card = c.npcs.find((n) => n.id === scene.npc) ?? null;
              if (card) talkRef.current.start(scene, card, lookOf(card, card.id), s);
              else startBare(scene, s);
            } else if (o.kind === 'sign' && (o.id === 'gates-in' || o.id === 'gates-out') && s.place.map.startsWith('station-')) {
              gate(o.tile, s.place.tile[1] < o.tile[1]);
            } else if (isMachine(o)) {
              // every station's ticket machine sells and tops up the 交通卡
              talkRef.current.start(machineScene(s, o.id), null, 'sign', s, '售票机 · Ticket machine');
            } else if (o.kind === 'sign') {
              talkRef.current.start(signScene(o), null, 'sign', s, o.en ?? 'A sign');
            } else if (o.kind === 'bike') {
              // 共享单车 (H8): scan to ride, park at any stand; after chapter 1
              const riding = s.flags.includes('on-bike');
              if (s.chapter < 2) {
                talkRef.current.start(signScene({ id: o.id, text: '扫码骑车', en: 'Scan to ride — once you have settled in (after chapter 1).' }), null, 'sign', s, 'Shared bikes');
                return;
              }
              game.dispatch([{ do: 'flag', flag: 'on-bike', value: !riding }]);
              world.current?.setBike(!riding);
              talkRef.current.start(
                signScene(riding ? { id: o.id, text: '还车', en: 'Bike parked. 1 元.' } : { id: o.id, text: '扫码骑车', en: 'Scan to ride — you are on a bike now (faster). Park at any stand.' }),
                null,
                'sign',
                s,
                'Shared bikes',
              );
              if (riding) game.dispatch([{ do: 'money', amount: -1 }], 'important', { scene: 'bike' });
            }
          },
          onGate: (tile, fromAbove) => gate(tile, fromAbove),
          // at the platform edge: the same as reading the board
          onBoard: () => {
            const board = here.current?.objects.find((o) => o.kind === 'sign' && (o.id === 'board' || o.id === 'bus-board' || o.id === 'train-board'));
            if (board) host.onLook(board);
          },
          // Tab (the companion) is the page's own key, so it works in a conversation too.
          onKey: (k) => k !== 'companion' && setPanel(k),
          isBusy: () => busy.current,
        };
        // The people on the maps come from the content's cards (who, where now, how they look).
        const people = await loadContent();
        const { startWorld } = await import('../../world/engine/boot');
        if (gone) return;
        const w = await startWorld(el, {
          map,
          time: start.time,
          hero: tile,
          facing: start.place.facing,
          host,
          looks: looksOf(people.npcs),
          bike: game.current()?.flags.includes('on-bike') ?? false,
          // today's weather (X4); ?weather=rain|snow|none tries one out
          sky: oneOf(query.get('weather'), ['rain', 'snow', 'none'] as const, skyOf(weatherOf(dayOf(game.current()?.clock ?? 0)))),
          // the silver butterflies light the way after dark (X11)
          butterflies: () => game.current()?.flags.includes('yindie') ?? false,
          // 兔儿爷 dresses for the day (X7)
          hat: hatFor(game.current()?.clock ?? 0),
          // the named cat follows you in 帽儿胡同 (X5)
          pet: (m) => m === CAT_LANE.map && !!game.current()?.cat.name,
          cast: (info) => {
            const s = game.current();
            return s ? castMap(info.objects, info.id, people.npcs, s) : info.objects;
          },
          onReady: () => !gone && setState('ready'),
        }, !!frame);
        if (gone) {
          w.destroy();
          return;
        }
        world.current = w;
        (window as unknown as { __world?: RunningWorld }).__world = w;
      } catch (err) {
        if (!gone) setState('failed');
        console.error('走走 could not start:', err);
      }
    })();
    return () => {
      gone = true;
      world.current?.destroy();
      world.current = null;
      delete (window as unknown as { __world?: RunningWorld }).__world;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  // 兔儿爷 feels what happens (X7): proud at a spirit, sulky at 守株待兔, glad of a stamp or a friend.
  const seen = useRef<WorldSave | null>(null);
  useEffect(() => {
    const now = game.save;
    if (!now) return;
    const before = seen.current;
    seen.current = now;
    const e = before ? emoteFor(before, now) : null;
    if (e) world.current?.emote(e);
  }, [game.save]);

  // The game clock: one real second is one game minute, and it only runs
  // while you are free in the world — not in a conversation, a panel, or a
  // hidden tab (concept §2). The save hears of it every ten game minutes.
  useEffect(() => {
    if (state !== 'ready' || !start) return;
    let minutes = game.current()?.clock ?? 0;
    setMinutes(minutes);
    // With ?map= / ?time= (development) the clock stands still.
    if (start.asked) return;
    let part = partOfDay(minutes);
    let told = minutes;
    const id = window.setInterval(() => {
      if (busy.current || document.visibilityState === 'hidden') return;
      // a sleep or a rest moved the save's clock on: catch up with it
      const saved = game.current()?.clock ?? minutes;
      if (saved > minutes) minutes = saved;
      minutes += 1;
      setMinutes(minutes);
      if (minutes - told >= 10) {
        told = minutes;
        game.dispatch([{ do: 'tick', minutes }], 'walk');
      }
      // a new day may bring other weather (X4)
      if (dayOf(minutes) !== dayOf(minutes - 1)) {
        world.current?.setSky(skyOf(weatherOf(dayOf(minutes))));
        world.current?.setHat(hatFor(minutes));
        remix(minutes);
      }
      const now = partOfDay(minutes);
      if (now !== part) {
        part = now;
        world.current?.setTime(now);
        remix(minutes);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, start]);

  // How far "What do I say?" has gone at this line: the 💡 taps, or the companion's own hint if further.
  const talkAt = talk.view ? `${talk.view.scene.id}/${talk.view.state.node}` : '';
  const [hint, setHint] = useState({ at: '', step: 0 });
  const cueStep = talk.view?.cue?.kind === 'hint' ? talk.view.cue.step : 0;
  const hintStep = Math.max(hint.at === talkAt ? hint.step : 0, cueStep);
  // the line's own hint, or at a shop the thing to order (Y1)
  const hintNow = talk.view ? talk.hint() : undefined;
  // 兔儿爷 speaks up by himself: after two misses in a row (or a misheard word), one short line.
  const cue = talk.view?.cue;
  const misses = talk.view?.misses ?? 0;
  useEffect(() => {
    if (cue && speaksUpAfterMisses(misses, cue)) setPal({ open: true, said: cueLine(cue) });
  }, [cue, misses]);
  useEffect(() => {
    if (!talk.view) setPal((p) => (p.said ? { open: false, said: null } : p));
  }, [talk.view]);
  // …and after a minute standing about while a quest waits, once until you move again.
  useEffect(() => {
    if (state !== 'ready') return;
    let told = false;
    let dozed = 0;
    const id = window.setInterval(() => {
      const s = game.current();
      if (!s || busy.current || document.visibilityState === 'hidden') {
        lastActive.current = Date.now();
        return;
      }
      // standing still a while, 兔儿爷 nods off (X7)
      if (Date.now() - lastActive.current > DOZE_AFTER_MS && Date.now() - dozed > 9000) {
        dozed = Date.now();
        world.current?.emote('sleepy', 6000);
      }
      if (Date.now() - lastActive.current < IDLE_MS) {
        told = false;
        return;
      }
      if (told || !activeQuests(s, contentRef.current.quests).length) return;
      told = true;
      setPal({ open: true, said: whatNow(s, contentRef.current.quests) });
    }, 5000);
    const touch = () => (lastActive.current = Date.now());
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    // Tab calls him from anywhere, in a conversation too.
    const tab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      setPal((p) => ({ open: !p.open, said: p.open ? null : p.said }));
    };
    window.addEventListener('keydown', tab);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      window.removeEventListener('keydown', tab);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Enter (or Escape) puts a note away, like its Ok button.
  useEffect(() => {
    if (note === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setNote(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [note]);
  useEffect(() => {
    const a = new Ambient(game.current()?.settings.volume ?? 0.6, game.current()?.settings.music ?? 0.6);
    ambient.current = a;
    const wake = () => a.wake();
    const vis = () => a.setHidden(document.visibilityState === 'hidden');
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      document.removeEventListener('visibilitychange', vis);
      a.dispose();
      ambient.current = null;
    };
  }, []);
  const volume = game.save?.settings.volume;
  useEffect(() => {
    if (volume !== undefined) ambient.current?.setVolume(volume);
  }, [volume]);
  const music = game.save?.settings.music;
  useEffect(() => {
    if (music !== undefined) ambient.current?.setMusicVolume(music);
  }, [music]);
  // "Show what I can use": a small mark over people, signs, bikes and the things that have something to say
  const hints = game.save?.settings.highlight ?? false;
  useEffect(() => {
    const s = game.save;
    if (state !== 'ready' || !s) return;
    const scenes = contentRef.current.scenes;
    world.current?.setHints(
      hints
        ? (o: MapObject) =>
            o.kind === 'npc' ||
            o.kind === 'sign' ||
            o.kind === 'bike' ||
            isMachine(o) ||
            (o.kind === 'prop' && !!sceneFor(scenes, s, { look: o.id, map: s.place.map }))
        : null,
    );
  }, [hints, state, game.save, content]);
  // the music steps back while someone talks, and under a full-screen panel
  const talking = talk.view !== null;
  useEffect(() => {
    ambient.current?.duck(talking ? 0.35 : panel !== null ? 0.6 : 1);
  }, [talking, panel]);
  useEffect(() => {
    if (riding) ambient.current?.chime();
  }, [riding]);

  // A teleport said in a conversation happens when it is over.
  useEffect(() => {
    if (talk.view || !pendingGame.current) return;
    const id = pendingGame.current;
    pendingGame.current = null;
    // the save already holds this spot (and is sent as the page closes); the game's way out comes back to it
    navigate(`${paths.game(id)}${paths.game(id).includes('?') ? '&' : '?'}back=world`);
  }, [talk.view, navigate]);
  useEffect(() => {
    if (talk.view || !pendingTravel.current) return;
    world.current?.travel(pendingTravel.current);
    pendingTravel.current = null;
  }, [talk.view]);

  // A full-screen panel stops the world: no drawing, no clock (D7).
  useEffect(() => {
    world.current?.setPaused(panel !== null || riding !== null);
  }, [panel, riding]);
  useEffect(() => {
    if (!panel) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [panel]);
  const lastLine = talk.view ? [...talk.view.history].reverse().find((h) => h.who === 'npc' && h.line)?.line : undefined;
  const lastNode = talk.view && lastLine ? talk.view.scene.nodes.find((n) => n.id === lastLine.node) : undefined;

  const npcNames = useMemo(
    () => Object.fromEntries([...content.npcs.map((n) => [n.id, n.name]), ...content.spirits.map((x) => [x.id, x.hanzi])]),
    [content],
  );
  const setPinyin = (on: boolean) => void game.dispatch([{ do: 'settings', patch: { pinyin: on } }]);

  return (
    <div className="world-shell" data-state={state} data-textsize={game.save?.settings.textSize ?? 'm'} data-framed={frame ? '' : undefined}>
      <div
        className="world-canvas"
        ref={box}
        style={frame ? { width: Number(frame[1]), height: Number(frame[2]) } : undefined}
      />
      {game.save && state === 'ready' && !photo && !panel && !talk.view && !riding && (
        <Minimap
          place={game.save.place}
          goals={new Set(trackedMaps(game.save, content))}
          onOpen={(hood) => {
            setMapStart(hood);
            setPanel('map');
          }}
        >
          <NextHop save={game.save} content={content} onOpen={() => setPanel('tasks')} />
        </Minimap>
      )}
      {game.save && state === 'ready' && !photo && <TopBar district={game.save.district} minutes={minutes} open={setPanel} onPhoto={() => setPhoto(true)} news={menuNewsFor(game.save, content).size > 0} />}
      {photo && <PhotoMode onTake={takePhoto} onZoom={(d) => world.current?.zoomBy(d)} onClose={() => setPhoto(false)} />}
      {panel && game.save && (
        <Panels
          tab={panel}
          setTab={setPanel}
          save={game.save}
          content={content}
          pinyin={game.save.settings.pinyin}
          user={user.id}
          mapStart={mapStart}
          onReset={() => {
            // a new game, born now: it replaces this one on every device; this device's album goes too
            game.dispatch([{ do: 'reset', born: Date.now() }]);
            saveAlbum(user.id, []);
            void game.flush().finally(() => window.location.replace(window.location.pathname));
          }}
          onClose={() => setPanel(null)}
          onUse={(item) => {
            setPanel(null);
            setUsing(item);
          }}
          onAct={(a) => {
            // 吃 / 喝: a small pleasure — 兔儿爷 is pleased; combining makes something new
            game.dispatch([a]);
            if (a.do === 'eat') world.current?.emote('happy');
          }}
          onSettings={(patch) => void game.dispatch([{ do: 'settings', patch }])}
          onGo={(station) => {
            setPanel(null);
            const map = `station-${station}`;
            if (mapIndex.current[map]) world.current?.travel({ map, tile: [Math.floor(mapIndex.current[map]!.width / 2), mapIndex.current[map]!.height - 3], facing: 'up' });
            else setNote('The station is not built yet — it comes with chapter 1’s subway ride.');
          }}
        />
      )}
      {talk.view && game.save && (
        <Dialogue
          view={talk.view}
          names={npcNames}
          {...(talk.view.npc && game.save.npcs[talk.view.npc.id] ? { hearts: game.save.npcs[talk.view.npc.id]!.hearts } : {})}
          pinyin={game.save.settings.pinyin}
          setPinyin={setPinyin}
          onProceed={talk.proceed}
          onClose={talk.close}
          onPick={talk.pick}
          onTraced={talk.traced}
          balance={game.save.bag.money}
          onPay={talk.pay}
          onDispute={talk.dispute}
        >
          <InputBar
            onSend={talk.reply}
            onSticker={(id) => talk.reply('', 'keyboard', id)}
            hint={hintNow}
            hintStep={hintStep}
            onHint={() => setHint({ at: talkAt, step: hintStep + 1 })}
            saved={game.save.settings.input}
            setSaved={(m) => void game.dispatch([{ do: 'settings', patch: { input: m } }])}
          />
        </Dialogue>
      )}
      {game.save && state === 'ready' && (
        <Companion
          open={pal.open}
          setOpen={(open) => setPal({ open, said: null })}
          said={pal.said}
          line={lastLine ?? undefined}
          why={lastNode?.why}
          canHint={!!hintNow && hintStep < 3 && talk.view?.mode === 'reply'}
          hat={hatFor(minutes)}
          onPat={() => {
            lastActive.current = Date.now();
            world.current?.emote('blush', 2000);
            world.current?.emote('happy', 2000);
          }}
          onHint={() => setHint({ at: talkAt, step: hintStep + 1 })}
          now={() => {
            const s = game.current();
            return s ? whatNow(s, contentRef.current.quests) : '';
          }}
          lex={lex}
          talking={!!talk.view}
        />
      )}
      {riding && game.save && (
        <RideSheet
          from={riding.at}
          mode={riding.mode}
          pinyin={game.save.settings.pinyin}
          fast={Object.values(game.save.rides).reduce((a, b) => a + b, 0) >= 3}
          canExit={(id) => !!mapIndex.current[stopMap(id, riding.mode)]}
          card={game.save.bag.card ?? 0}
          onClose={() => setRiding(null)}
          onExit={(r) => {
            setRiding(null);
            const fare = fareOut(r, riding.mode);
            game.dispatch([
              ...(fare ? [{ do: 'card' as const, amount: -fare }] : []),
              { do: 'station', station: r.at },
              ...(r.at !== r.from ? [{ do: 'ride' as const, route: rideKey(r.from, r.at) }] : []),
            ]);
            // every station map has its board at [8, 10]: you step off in front of it
            if (r.at !== riding.at) world.current?.travel({ map: stopMap(r.at, riding.mode), tile: [8, 11], facing: 'down' });
          }}
        />
      )}
      {using && game.save && (
        <div className="wu-bar" role="status">
          <span>
            🎒 <span className="han">{content.items.find((i) => i.id === using)?.name ?? using}</span> → tap someone or something
          </span>
          <button type="button" className="wd-tool" onClick={() => setUsing(null)} aria-label="Put it back">
            ×
          </button>
        </div>
      )}
      {game.save?.settings.joystick && state === 'ready' && !talk.view && !panel && (
        <Joystick onStick={(f, run) => world.current?.stick(f, run)} onAct={() => world.current?.act()} />
      )}
      {note !== null && (
        <div className="world-note" role="status">
          <span>{note}</span>
          <button type="button" className="world-note-ok" onClick={() => setNote(null)} autoFocus>
            Ok
          </button>
        </div>
      )}
      {state !== 'ready' && (
        <div className="world-loading small">{state === 'failed' ? 'The game could not start. Reload to try again.' : 'Opening Beijing…'}</div>
      )}
    </div>
  );
}

