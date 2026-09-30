import { useNavigate } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayOf, partOfDay } from '../../world/core/clock';
import { festivalOf, seasonOf, skyOf, weatherOf, type FestivalId } from '../../world/core/calendar';
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
import { useTakeMeThere } from '../../world/ui/takeMeThere';
import { setVoiceCards } from '../../world/ui/lineVoice';
import { Ambient } from '../../world/audio/ambient';
import { isDrumShow, mixFor } from '../../world/audio/mix';
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
import { cueLine, glossTurn, IDLE_MS, keepable, speaksUpAfterMisses, turnOf } from '../../world/ui/companionLines';
import { wantOf } from '../../world/ui/talkWant';
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
import { Creator, type CreatorMode } from '../../world/ui/Creator';
import { dressOf } from '../../world/ui/HeroFigure';
import { setCurrentDress } from '../../world/ui/heroPicture';
import { WardrobeSheet } from '../../world/ui/WardrobeSheet';
import { BookReader, BookShelf } from '../../world/ui/BookReader';
import { owedBooks } from '../../world/core/books';
import { RackSheet } from '../../world/ui/RackSheet';
import { remarkAt } from '../../world/core/notice';
import { PLACES } from '../../world/core/places';
import { homeProp } from '../../world/core/wardrobe';
import { cutsceneActions, cutscenesDue, isSpiritActor, type Actor } from '../../world/core/cutscene';
import { CutsceneOverlay, EMPTY_CUT, type CutView } from '../../world/ui/CutsceneOverlay';
import { autoCutscenes, isSpiritReturn, litFigures, SEAL_MS, sealsFor, spiritReturn, spiritsHome, SPIRIT_RETURN, type Seal } from '../../world/core/celebrate';
import { LanternCard, SealToast } from '../../world/ui/Celebrate';
import { arrivalNudge, chapterHoods, markedMaps, nudgeKey, openBeforeFinale, questMarks, whoWhere, type SideEntry } from '../../world/core/sidequests';
import { hoodOf } from '../../world/core/hoods';
import { bedScene, canWaitHere, sleepTarget } from '../../world/core/rest';
import { isAway, recapOf, wordsOfScene, type Recap } from '../../world/core/recap';
import { RecapCard } from '../../world/ui/Recap';
import { holds } from '../../world/core/flags';
import type { RunningCutscene } from '../../world/engine/cutscene';
import { stamped } from '../../world/ui/stamped';

const TIMES: PartOfDay[] = ['morning', 'day', 'evening', 'night'];

/** Until chapter 1's maps exist, a save that points at a map this build lacks starts in the prototype lane. */
const FALLBACK = { map: 'hutong-proto', tile: [14, 7] as Tile };
/** signs that do something when used: the departure boards and the ticket gates */
const USE_SIGNS = new Set(['board', 'bus-board', 'train-board', 'gates-in', 'gates-out']);

type MapIndex = Record<string, { district: string; width: number; height: number }>;
/** a cutscene waiting to play (§13 K1): `back` is where a replay returns you; `after` runs when it ends (the talk it came before) */
type CutItem = { id: string; back?: WorldSave['place']; after?: () => void; nudged?: boolean };

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
  /** cutscenes waiting to play (§13 K1): said in a talk, a quest step done, ▶ in the journal; `back` is where a replay returns you */
  const cutQueue = useRef<CutItem[]>([]);
  /** a cutscene waiting to arrive on its map */
  const pendingCut = useRef<CutItem | null>(null);
  const [cutTick, setCutTick] = useState(0);
  const talkDispatch = (actions: readonly SaveAction[], who: TalkWho) => {
    const cuts = cutsceneActions(actions);
    if (cuts.length) {
      cutQueue.current.push(...cuts.map((id) => ({ id })));
      setCutTick((t) => t + 1);
    }
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
    if (it) setPal((p) => ({ open: p.open, said: `Try the ${it.en} — ${it.name} — from your bag.` }));
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
    talkRef.current.start(lineScene('nothing', 'hero', NOTHING_HAPPENS.zh, NOTHING_HAPPENS.en), null, 'hero', s, '我');
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
    else talkRef.current.start(scene, null, who === 'hero' ? 'hero' : 'sign', s, spirit?.hanzi ?? '我');
  };
  const talkRef = useRef(talk);
  // a scene that names a cutscene `before` it plays that first, the first time (§13 K3)
  talkRef.current = {
    ...talk,
    start: (scene, ...rest) => {
      const s = game.current();
      if (scene.before && s && !s.cutscenes.includes(scene.before) && contentRef.current.cutscenes.some((c) => c.id === scene.before)) {
        cutQueue.current.unshift({ id: scene.before, after: () => talk.start(scene, ...rest) });
        setCutTick((t) => t + 1);
        return;
      }
      talk.start(scene, ...rest);
    },
  };
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
  // M6: "Take me there" — footprints on every map, the right train marked on the platform
  const guideRides = useTakeMeThere(world, game.save, (said) => setPal((p) => ({ open: p.open, said })));
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
  /** the character creator (§12, W3) — once per new game — or the mirror at home (W4) */
  const [creator, setCreator] = useState<CreatorMode | null>(null);
  /** a scene that starts by itself waits while the creator is open (the first morning comes after it) */
  const pendingAuto = useRef<Scene | null>(null);
  /** 兔儿爷's remarks on your clothes already made (W6): kind-day */
  const remarked = useRef(new Set<string>());
  /** the 衣柜 at home (W4) */
  const [wardrobe, setWardrobe] = useState(false);
  /** the 书架 at home, and a book open from it or from the "new book" note (§13 B1) */
  const [shelfOpen, setShelfOpen] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  /** a book just come to you, told once the talk it came in is over */
  const [newBook, setNewBook] = useState<string | null>(null);
  const booksHad = useRef<Set<string> | null>(null);
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
  /** §13 Q3: "last time…" after twelve real hours away (?recap=1 shows it anyway) */
  const [recap, setRecap] = useState<Recap | null>(null);
  /** the recap waits for the world to be up and the creator done */
  const pendingRecap = useRef(false);
  /** the talk on screen, to take its words when it ends (§13 Q3) */
  const lastTalk = useRef<Scene | null>(null);
  /** the cutscene on screen (§13 K1): what the overlay shows, how to go on or skip */
  const [cut, setCut] = useState<CutView | null>(null);
  /** "Before we go…" (§13 Q1): the finale waiting while 兔儿爷 names what is still open here */
  const [beforeGo, setBeforeGo] = useState<{ item: CutItem; open: SideEntry[] } | null>(null);
  /** a finale put off with "Not yet": it plays on your next arrival somewhere */
  const laterCut = useRef<CutItem | null>(null);
  const cutRun = useRef<RunningCutscene | null>(null);
  const sayNext = useRef<(() => void) | null>(null);
  const titleNext = useRef<(() => void) | null>(null);
  const busy = useRef(false);
  busy.current = cut !== null || beforeGo !== null || recap !== null || note !== null || talk.view !== null || panel !== null || riding !== null || photo || creator !== null || wardrobe || shelfOpen || reading !== null;

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
  // a book a scene you've already seen gives (a chapter deepened after you played it) comes now (§13 B1)
  useEffect(() => {
    const s = game.current();
    if (!s || !content.books.length) return;
    const owed = owedBooks(s, content.scenes, content.books);
    if (owed.length) void game.dispatch(owed.map((id) => ({ do: 'book' as const, id })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, opened]);
  const start = useMemo(() => {
    const s = game.current();
    if (!s) return null;
    if (isAway(s, Date.now()) || query.get('recap') === '1') pendingRecap.current = true;
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
        const index = (await (await fetch(stamped('/world/maps/index.json'))).json()) as MapIndex;
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
            // §13 Q1: into a neighbourhood with someone who could use a hand — 兔儿爷 says so, once a chapter
            const hood = hoodOf(info.id)?.id;
            const nudge = s && hood && hood !== lastHood.current ? arrivalNudge(s, contentRef.current, hood) : null;
            lastHood.current = hood;
            if (s && hood && nudge) {
              game.dispatch([{ do: 'seen', key: nudgeKey(hood, s.chapter), at: 1 }]);
              setPal((p) => ({ open: p.open, said: nudge }));
            }
            // a cutscene that sent you here plays now (§13 K1); nothing else starts by itself first
            setCutTick((t) => t + 1);
            // a finale put off with "Not yet" (§13 Q1) comes back on the next arrival
            if (laterCut.current && !pendingCut.current) {
              cutQueue.current.push(laterCut.current);
              laterCut.current = null;
            }
            if (pendingCut.current) {
              cutQueue.current.unshift(pendingCut.current);
              pendingCut.current = null;
              return;
            }
            // a memory at home once its spirit is back, a new game's opening (§13 K2–K3): the content's `auto` cutscenes, one per arrival;
            // the creator still comes first, and a scene that would start here waits for the next arrival
            const own = s && autoCutscenes(s, contentRef.current.cutscenes, info.id, (c) => holds(c, s))[0];
            if (s && own && !cutQueue.current.some((q) => q.id === own.id)) {
              cutQueue.current.push({ id: own.id });
              if (!s.created) setCreator(s.scenes.length ? 'first' : 'new');
              return;
            }
            if (info.id.startsWith('station-')) ambient.current?.chime();
            // 兔儿爷 on what you wear here (§12 W6): a T-shirt in the snow, a hat indoors — each once a day
            const kind = PLACES.find((p) => p.map === info.id)?.kind;
            const remark = s && kind ? remarkAt(s, kind, (s.bag.items.yusan ?? 0) > 0) : null;
            if (s && remark && !remarked.current.has(`${remark.kind}-${dayOf(s.clock)}`)) {
              remarked.current.add(`${remark.kind}-${dayOf(s.clock)}`);
              setPal((p) => ({ open: p.open, said: remark.text }));
            }
            // a scene that starts by itself here (the first morning, a first visit)
            const auto = s && autoScene(contentRef.current.scenes, s, info.id);
            // before the first morning: who you are (W3); the scene waits for the creator's Done
            if (s && !s.created) {
              pendingAuto.current = auto || null;
              setCreator(s.scenes.length ? 'first' : 'new');
              return;
            }
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
            // your room's 衣柜 and 镜子 (W4)
            const home = homeProp(o, s.place.map);
            if (home === 'wardrobe') return setWardrobe(true);
            if (home === 'mirror') return setCreator('mirror');
            if (home === 'bookcase') return setShelfOpen(true);
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
            const found = sceneFor(c.scenes, s, { look: o.id, map: s.place.map });
            // §13 Q2: the bed also offers 「睡到中秋节」 when what you follow waits for a later day
            const scene = found?.id === 'bed' ? bedScene(found, sleepTarget(s, c)) : found;
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
          // §13 V3: the season on the map, and what people do while they stand about
          season: seasonOf(dayOf(game.current()?.clock ?? 0)),
          idles: Object.fromEntries(people.npcs.flatMap((n) => (n.idle ? [[n.id, n.idle]] : []))),
          // the named cat follows you in 帽儿胡同 (X5)
          pet: (m) => m === CAT_LANE.map && !!game.current()?.cat.name,
          // the player's own look and clothes (W1/W2), read at every map
          dress: () => {
            const s = game.current();
            return s && people.clothes.clothes.length ? dressOf(s.look, s.outfit, people.clothes) : null;
          },
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

  // A quest step done that names a cutscene (`onDone`) queues it (§13 K1).
  const lastSave = useRef<WorldSave | null>(null);
  useEffect(() => {
    const now = game.save;
    if (!now) return;
    const before = lastSave.current;
    lastSave.current = now;
    if (!before) return;
    const c = contentRef.current;
    const full = (now.settings.celebrate ?? 'full') === 'full';
    // a spirit come home flies off first (full celebrations), then a step's own cutscene
    const home = full ? spiritsHome(before, now).map((id) => `${SPIRIT_RETURN}${id}`) : [];
    const due = [...home, ...cutscenesDue(before, now, c.quests)].filter((id) => !cutQueue.current.some((q) => q.id === id));
    if (due.length) {
      cutQueue.current.push(...due.map((id) => ({ id })));
      setCutTick((t) => t + 1);
    }
    // a seal for each step done and each quest finished (K2)
    const earned = sealsFor(before, now, c.quests, c);
    if (earned.length) setSeals((q) => [...q, ...earned]);
  }, [game.save]);
  // the seals one after another, each for its time, with a wood block (and a chime for a quest) unless quiet
  const [seals, setSeals] = useState<Seal[]>([]);
  const seal = seals[0];
  useEffect(() => {
    if (!seal) return;
    if ((game.current()?.settings.celebrate ?? 'full') === 'full') {
      ambient.current?.cue('wood');
      if (seal.kind === 'quest') ambient.current?.chime();
    }
    const id = window.setTimeout(() => setSeals((q) => q.slice(1)), SEAL_MS[seal.kind]);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seal]);
  /** the neighbourhood you were last in, for 兔儿爷's once-a-chapter line on arriving somewhere new */
  const lastHood = useRef<string | undefined>(undefined);
  /** the 走马灯 card in a spirit's return: the figures lighting now */
  const [lantern, setLantern] = useState<string[] | null>(null);
  // ?cutscene=<id> plays one (development, and the review probe's frames)
  const askedCut = query.get('cutscene');
  useEffect(() => {
    if (state !== 'ready' || !askedCut) return;
    cutQueue.current.push({ id: askedCut, back: game.current()?.place });
    setCutTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, askedCut]);
  const cutNames = (a: Actor): string => {
    if (a === 'hero') return game.current()?.name || '我';
    if (a === 'rabbit') return '兔儿爷';
    if (isSpiritActor(a)) return contentRef.current.spirits.find((x) => x.id === a.slice(7))?.hanzi ?? '?';
    if (a.startsWith('extra:')) return '路人';
    return contentRef.current.npcs.find((n) => n.id === a)?.name ?? a;
  };
  /** Plays the next cutscene when nothing else holds the screen: first travelling to its map if you are elsewhere. */
  const startCut = (item: CutItem) => {
    const s = game.current();
    const w = world.current;
    const h = here.current;
    // a spirit's flight home is made for the map you are on (K2); the rest are the content's
    const cs = isSpiritReturn(item.id)
      ? s && h ? spiritReturn(item.id.slice(SPIRIT_RETURN.length), h.id, h.objects, s.place.tile) : undefined
      : contentRef.current.cutscenes.find((c) => c.id === item.id);
    if (!cs || !s || !w) return;
    // §13 Q1: before a chapter's finale, the side quests still open on its streets — one tap goes on anyway
    if (cs.finale && cs.chapter && !item.back && !item.nudged) {
      const open = openBeforeFinale(s, contentRef.current, chapterHoods(contentRef.current, cs.chapter));
      if (open.length) {
        setBeforeGo({ item: { ...item, nudged: true }, open });
        return;
      }
    }
    if (s.place.map !== cs.map) {
      const ix = mapIndex.current[cs.map];
      if (!ix) return;
      const hero = cs.cast?.find((c) => c.actor === 'hero');
      pendingCut.current = item;
      w.travel({ map: cs.map, tile: hero?.at ?? [Math.floor(ix.width / 2), ix.height - 4], facing: hero?.facing ?? 'up' });
      return;
    }
    setCut({ ...EMPTY_CUT, letterbox: cs.letterbox ?? true });
    const run = w.cutscene(cs, {
      say: (line) =>
        new Promise<void>((resolve) => {
          sayNext.current = resolve;
          setCut((c) => (c ? { ...c, line } : c));
        }),
      title: (t) =>
        new Promise<void>((resolve) => {
          setCut((c) => (c ? { ...c, title: t } : c));
          const end = () => {
            window.clearTimeout(id);
            titleNext.current = null;
            setCut((c) => (c ? { ...c, title: null } : c));
            resolve();
          };
          const id = window.setTimeout(end, 2600);
          titleNext.current = end;
        }),
      overlay: (fx, text) => {
        if (fx === 'seal') return setCut((c) => (c ? { ...c, seal: c.seal + 1 } : c));
        if (fx === 'lantern') {
          setLantern(text ?? []);
          window.setTimeout(() => setLantern(null), 3000);
          return;
        }
        const base = Date.now();
        const flying = (text ?? []).map((t, i) => ({ id: base + i, text: t, row: (i * 3) % 7, delay: i * 450 }));
        setCut((c) => (c ? { ...c, danmaku: [...c.danmaku, ...flying] } : c));
        window.setTimeout(() => setCut((c) => (c ? { ...c, danmaku: c.danmaku.filter((d) => !flying.includes(d)) } : c)), 7000 + flying.length * 450);
      },
      sound: (id) => {
        const a = ambient.current;
        if (id === 'chime') a?.chime();
        else if (id === 'blip') a?.blip();
        else a?.cue(id);
      },
      music: (m) => ambient.current?.duck(m === 'hush' ? 0 : m === 'soft' ? 0.35 : 1),
    });
    if (!run) {
      setCut(null);
      return;
    }
    cutRun.current = run;
    void run.done.then(() => {
      cutRun.current = null;
      sayNext.current = null;
      titleNext.current = null;
      setCut(null);
      // watched (or skipped): it does not play again by itself, and what it gives is given
      if (!item.back) {
        game.dispatch([{ do: 'watched', id: cs.id }, ...(cs.then ?? [])], 'important', { scene: `cutscene-${cs.id}` });
        // a `then` that moves you (the opening brings you home) goes there; else the talk that follows the moment starts
        const tp = cs.then?.find((a) => a.do === 'teleport');
        if (tp && tp.do === 'teleport') world.current?.travel({ map: tp.map, tile: tp.tile, facing: tp.facing ?? 'down' });
        else if (item.after) item.after();
        else if (cs.talk) {
          const sc = contentRef.current.scenes.find((x) => x.id === cs.talk);
          const now = game.current();
          if (sc && now) {
            const card = contentRef.current.npcs.find((n) => n.id === sc.npc) ?? null;
            if (card) talkRef.current.start(sc, card, lookOf(card, card.id), now);
            else startBare(sc, now);
          }
        }
      } else if (item.back.map !== cs.map) world.current?.travel(item.back);
      setCutTick((t) => t + 1);
    });
  };
  // The queue plays one cutscene at a time, when no talk, panel or sheet is open and no journey is under way.
  useEffect(() => {
    if (state !== 'ready' || cut || beforeGo || talk.view || panel || riding || creator || wardrobe || shelfOpen || reading || photo || pendingTravel.current || pendingCut.current) return;
    const next = cutQueue.current.shift();
    if (next) startCut(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, cutTick, cut, beforeGo, talk.view, panel, riding, creator, wardrobe, shelfOpen, reading, photo]);

  // §13 Q3: a finished talk leaves its words for next time's recap
  useEffect(() => {
    if (talk.view) {
      if (talk.view.npc) lastTalk.current = talk.view.scene;
      return;
    }
    const sc = lastTalk.current;
    lastTalk.current = null;
    const words = sc ? wordsOfScene(sc) : [];
    if (words.length) game.dispatch([{ do: 'heard', words }], 'walk');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talk.view]);
  // …and after a day away, the card: once, when the world is up and nothing else holds the screen
  useEffect(() => {
    if (!pendingRecap.current || state !== 'ready' || creator || cut || talk.view) return;
    const s = game.current();
    pendingRecap.current = false;
    const r = s ? recapOf(s, contentRef.current) : null;
    if (r) setRecap(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, creator, cut, talk.view, content]);

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
      // §13 V3: the 鼓楼's drummers play at their show times — heard on the square
      if (here.current?.id === 'gulou-square' && isDrumShow(minutes)) {
        for (let i = 0; i < 6; i++) window.setTimeout(() => ambient.current?.cue('drum'), i * 380);
        world.current?.emote('happy', 2000);
      }
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
    if (cue && speaksUpAfterMisses(misses, cue)) setPal((p) => ({ open: p.open, said: cueLine(cue) }));
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
      setPal((p) => ({ open: p.open, said: whatNow(s, contentRef.current.quests) }));
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
  // "Show what I can use": a small mark over people to talk to, ways into new
  // places, and things that do something (bikes, machines, boards, gates, a
  // scene) — not over plain name signs, which only say what is written
  const hints = game.save?.settings.highlight ?? false;
  const marksOn = game.save?.settings.questMarks !== false;
  useEffect(() => {
    const s = game.save;
    if (state !== 'ready' || !s) return;
    const scenes = contentRef.current.scenes;
    // §13 Q1: 「!」 and 「…」 over the people with something for you now; the hint diamond steps aside for them
    const marks = marksOn && here.current ? questMarks(s, contentRef.current, here.current.objects) : null;
    world.current?.setQuestMarks(marks);
    const hasScene = (o: MapObject) => !!sceneFor(scenes, s, { look: o.id, map: s.place.map });
    world.current?.setHints(
      hints
        ? (o: MapObject) =>
            (o.kind === 'npc' && !marks?.[o.id]) ||
            o.kind === 'door' ||
            o.kind === 'edge' ||
            o.kind === 'bike' ||
            isMachine(o) ||
            (o.kind === 'sign' && (USE_SIGNS.has(o.id) || hasScene(o))) ||
            (o.kind === 'prop' && hasScene(o)) ||
            !!homeProp(o, s.place.map)
        : null,
    );
  }, [hints, marksOn, state, game.save, content]);
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
    world.current?.setPaused(panel !== null || riding !== null || creator !== null || wardrobe || shelfOpen || reading !== null);
  }, [panel, riding, creator, wardrobe, shelfOpen, reading]);
  // a book that came to you (§13 B1): noted once, not for the books a loaded save already has
  useEffect(() => {
    const have = game.save ? Object.keys(game.save.books) : null;
    if (!have) return;
    if (!booksHad.current) {
      booksHad.current = new Set(have);
      return;
    }
    const fresh = have.find((id) => !booksHad.current!.has(id));
    booksHad.current = new Set(have);
    if (fresh) setNewBook(fresh);
  }, [game.save]);
  // What you look like and wear (§12): the world sprite and 我's portrait follow the save.
  const look = game.save?.look;
  const outfit = game.save?.outfit;
  useEffect(() => {
    if (!look || !outfit || !content.clothes.clothes.length) return;
    const d = dressOf(look, outfit, content.clothes);
    setCurrentDress(d);
    if (state === 'ready') world.current?.setDress(d);
  }, [look, outfit, content, state]);
  // A save that has not met the creator yet meets it once, wherever it opens (W3).
  const uncreated = game.save ? !game.save.created : false;
  useEffect(() => {
    if (state === 'ready' && uncreated && creator === null) setCreator((game.current()?.scenes.length ?? 0) ? 'first' : 'new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, uncreated]);
  useEffect(() => {
    if (!panel) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [panel]);
  const lastLine = talk.view ? [...talk.view.history].reverse().find((h) => h.who === 'npc' && h.line)?.line : undefined;
  const lastNode = talk.view && lastLine ? talk.view.scene.nodes.find((n) => n.id === lastLine.node) : undefined;
  // their turn (every line since your last reply), and its words to ask about: 「旧是什么意思？」
  const history = talk.view?.history;
  const turn = useMemo(() => (history ? turnOf(history) : []), [history]);
  const turnWords = useMemo(() => (lex ? keepable(glossTurn(turn, lex)).map((g) => g.w) : []), [turn, lex]);

  const npcNames = useMemo(
    () => Object.fromEntries([...content.npcs.map((n) => [n.id, n.name]), ...content.spirits.map((x) => [x.id, x.hanzi])]),
    [content],
  );
  const speakerName = (id: string): string | null =>
    id === 'speaker-box' ? '支付宝' : id === 'companion' ? '兔儿爷' : (npcNames[id] ?? null);
  const want =
    talk.view && game.save
      ? wantOf(talk.view.state, talk.view.scene.nodes.find((n) => n.id === talk.view!.state.node), game.save.bag.money, (id) => content.items.find((it) => it.id === id)?.name ?? id)
      : null;
  const setPinyin = (on: boolean) => void game.dispatch([{ do: 'settings', patch: { pinyin: on } }]);

  return (
    <div className="world-shell" data-state={state} data-textsize={game.save?.settings.textSize ?? 'm'} data-framed={frame ? '' : undefined}>
      <div
        className="world-canvas"
        ref={box}
        style={frame ? { width: Number(frame[1]), height: Number(frame[2]) } : undefined}
      />
      {game.save && state === 'ready' && !photo && !panel && !talk.view && !riding && !cut && (
        <Minimap
          place={game.save.place}
          goals={new Set(trackedMaps(game.save, content))}
          {...(game.save.settings.questMarks === false ? {} : { marks: markedMaps(game.save, content) })}
          onOpen={(hood) => {
            setMapStart(hood);
            setPanel('map');
          }}
        >
          <NextHop
            save={game.save}
            content={content}
            onOpen={() => setPanel('tasks')}
            {...(here.current && canWaitHere(here.current.id, here.current.objects)
              ? {
                  onWait: (hour: number) => {
                    game.dispatch([{ do: 'wait', until: hour }]);
                    world.current?.emote('sleepy', 2000);
                  },
                }
              : {})}
          />
        </Minimap>
      )}
      {game.save && state === 'ready' && !photo && !cut && <TopBar minutes={minutes} open={setPanel} news={menuNewsFor(game.save, content).size > 0} />}
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
          onReplay={(id) => {
            setPanel(null);
            cutQueue.current.push({ id, back: game.current()?.place });
            setCutTick((t) => t + 1);
          }}
          onReset={() => {
            // a new game, born now: it replaces this one on every device; this device's album goes too
            game.dispatch([{ do: 'reset', born: Date.now() }]);
            saveAlbum(user.id, []);
            void game.flush().finally(() => window.location.replace(window.location.pathname));
          }}
          onClose={() => setPanel(null)}
          onPhoto={() => {
            setPanel(null);
            setPhoto(true);
          }}
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
      {/* a clothes rack or the barber's (§12 W5): the rack over the talk, its buttons say the phrases */}
      {talk.view?.state.rack && !talk.view.state.due && talk.view.mode === 'reply' && game.save && (
        <RackSheet
          rackId={talk.view.scene.nodes.find((n) => n.rack)?.rack?.rack ?? ''}
          state={talk.view.state.rack}
          save={game.save}
          clothes={content.clothes}
          onSay={(text) => talk.reply(text, 'keyboard')}
        />
      )}
      {talk.view && game.save && (
        <Dialogue
          view={talk.view}
          names={npcNames}
          {...(talk.view.npc && game.save.npcs[talk.view.npc.id] ? { hearts: game.save.npcs[talk.view.npc.id]!.hearts } : {})}
          want={want}
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
            asks={turnWords}
            saved={game.save.settings.input}
            setSaved={(m) => void game.dispatch([{ do: 'settings', patch: { input: m } }])}
          />
        </Dialogue>
      )}
      {cut && game.save && (
        <CutsceneOverlay
          view={cut}
          names={cutNames}
          pinyin={game.save.settings.pinyin}
          setPinyin={setPinyin}
          onNext={() => {
            const go = sayNext.current;
            sayNext.current = null;
            setCut((c) => (c ? { ...c, line: null } : c));
            go?.();
          }}
          onSkip={() => {
            cutRun.current?.skip();
            titleNext.current?.();
            const go = sayNext.current;
            sayNext.current = null;
            setCut((c) => (c ? { ...c, line: null, title: null } : c));
            go?.();
          }}
        />
      )}
      {seal && <SealToast seal={seal} />}
      {recap && <RecapCard recap={recap} onClose={() => setRecap(null)} />}
      {lantern && game.save && (
        <LanternCard lit={litFigures(game.save).filter((f) => !lantern.includes(f))} now={lantern} names={(id) => content.spirits.find((x) => x.id === id)?.hanzi ?? (id === 'family' ? '家' : id)} />
      )}
      {/* 兔儿爷 is silent during a cutscene unless the script gives him a line */}
      {game.save && state === 'ready' && !cut && (
        <Companion
          open={pal.open}
          setOpen={(open) => setPal((p) => ({ open, said: open ? p.said : null }))}
          said={pal.said}
          turn={turn}
          speakerName={speakerName}
          why={lastNode?.why}
          canHint={!!hintNow && hintStep < 3 && talk.view?.mode === 'reply'}
          stuck={!!hintNow && hintStep < 3 && talk.view?.mode === 'reply' && misses >= 1}
          hintStep={hintStep}
          onBlip={() => ambient.current?.blip()}
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
          talking={!!talk.view}
          // "Before we go…" (§13 Q1) is his to ask, in his bubble (the learner, 2026-09-30)
          ask={
            beforeGo
              ? {
                  text: `Before we go… ${beforeGo.open.map((e) => `${e.quest.title} (${whoWhere(e)})`).join(' · ')} — still here, if you like. The story waits.`,
                  choices: [
                    {
                      id: 'later',
                      label: 'Not yet',
                      run: () => {
                        laterCut.current = beforeGo.item;
                        setBeforeGo(null);
                      },
                    },
                    {
                      id: 'go',
                      label: 'Go on',
                      run: () => {
                        const next = beforeGo.item;
                        setBeforeGo(null);
                        cutQueue.current.unshift(next);
                        setCutTick((t) => t + 1);
                      },
                    },
                  ],
                }
              : null
          }
        />
      )}
      {creator && game.save && (
        <Creator
          mode={creator}
          look={game.save.look}
          worn={dressOf(game.save.look, game.save.outfit, content.clothes).worn}
          onDone={(l) => {
            game.dispatch([{ do: 'create', look: l }]);
            setCreator(null);
            // the scene that waited (the first morning) starts now — unless a cutscene waits (the opening), which brings you back here
            const auto = pendingAuto.current;
            pendingAuto.current = null;
            const s = game.current();
            if (cutQueue.current.length) setCutTick((t) => t + 1);
            else if (auto && s) {
              const card = contentRef.current.npcs.find((n) => n.id === auto.npc) ?? null;
              if (card) talkRef.current.start(auto, card, lookOf(card, card.id), s);
              else startBare(auto, s);
            }
          }}
          {...(creator === 'mirror' ? { onClose: () => setCreator(null) } : {})}
        />
      )}
      {wardrobe && game.save && (
        <WardrobeSheet
          save={game.save}
          clothes={content.clothes}
          pinyin={game.save.settings.pinyin}
          // a thing sold goes to the recycler: his name on the 账单 line
          dispatch={(a, sold) => void game.dispatch(a, 'important', sold ? { npc: 'polan-shifu' } : undefined)}
          onClose={() => setWardrobe(false)}
        />
      )}
      {shelfOpen && game.save && <BookShelf save={game.save} books={content.books} onOpen={setReading} onClose={() => setShelfOpen(false)} />}
      {newBook && game.save && !talk.view && !cut && !reading && (() => {
        const b = content.books.find((x) => x.id === newBook);
        if (!b) return null;
        return (
          <div className="world-note" role="status">
            <span>
              📕 A book: <b className="han">《{b.zh}》</b> {b.en} — on your 书架 at home, and in 收藏 → 书.
            </span>
            <span className="cs-before-acts">
              <button type="button" className="btn sm ghost" onClick={() => setNewBook(null)}>
                Later
              </button>
              <button
                type="button"
                className="world-note-ok"
                autoFocus
                onClick={() => {
                  setNewBook(null);
                  setReading(b.id);
                }}
              >
                Read
              </button>
            </span>
          </div>
        );
      })()}
      {reading && game.save && (() => {
        const b = content.books.find((x) => x.id === reading);
        return b ? <BookReader book={b} save={game.save} pinyin={game.save.settings.pinyin} onAct={(a) => void game.dispatch([a])} onClose={() => setReading(null)} /> : null;
      })()}
      {riding && game.save && (
        <RideSheet
          from={riding.at}
          mode={riding.mode}
          pinyin={game.save.settings.pinyin}
          fast={Object.values(game.save.rides).reduce((a, b) => a + b, 0) >= 3}
          canExit={(id) => !!mapIndex.current[stopMap(id, riding.mode)]}
          guide={guideRides}
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
      {game.save?.settings.joystick && state === 'ready' && !talk.view && !panel && !cut && !beforeGo && note === null && !newBook && (
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

