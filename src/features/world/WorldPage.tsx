import { useEffect, useMemo, useRef, useState } from 'react';
import { partOfDay } from '../../world/core/clock';
import { libraryLexicon } from '../../world/core/dialogue/lexicon';
import { sceneFor } from '../../world/core/scenes';
import type { MapObject, PartOfDay, Tile } from '../../world/core/types';
import type { RunningWorld } from '../../world/engine/boot';
import { throughDoor } from '../../world/engine/doors';
import type { WorldHost } from '../../world/engine/scene';
import { useWorldContent, EMPTY_CONTENT } from '../../world/ui/content';
import { Dialogue, lookOf } from '../../world/ui/Dialogue';
import { InputBar } from '../../world/ui/InputBar';
import { Joystick } from '../../world/ui/Joystick';
import { Panels } from '../../world/ui/Panels';
import type { PanelId } from '../../world/ui/panelRows';
import { Companion } from '../../world/ui/Companion';
import { cueLine, IDLE_MS, speaksUpAfterMisses } from '../../world/ui/companionLines';
import { activeQuests, whatNow } from '../../world/core/quests';
import { TopBar } from '../../world/ui/TopBar';
import { smallTalk, useTalk } from '../../world/ui/useTalk';
import { useLibrary } from '../shared/library';
import { useWorldSave } from '../../world/ui/useWorldSave';
import { useUser } from '../auth/session';
import { oneOf, useQuery } from '../../navigation/query';
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
  const talk = useTalk(content, lex, game.dispatch);
  const talkRef = useRef(talk);
  talkRef.current = talk;
  const contentRef = useRef(content);
  contentRef.current = content;
  const [query] = useQuery();
  const frame = /^(\d+)x(\d+)$/.exec(query.get('frame') ?? '');
  const box = useRef<HTMLDivElement>(null);
  const world = useRef<RunningWorld | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [note, setNote] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [pal, setPal] = useState<{ open: boolean; said: string | null }>({ open: false, said: null });
  const [panel, setPanel] = useState<PanelId | null>(null);
  const mapIndex = useRef<MapIndex>({});
  const lastActive = useRef(Date.now());
  const busy = useRef(false);
  busy.current = note !== null || talk.view !== null || panel !== null;

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
        const host: WorldHost = {
          onStep: (t, facing) => {
            lastActive.current = Date.now();
            game.dispatch([{ do: 'move', tile: t, facing }], 'walk');
          },
          onArrive: (info, t, facing) => game.dispatch([{ do: 'enter', map: info.id, tile: t, facing, district: info.district || undefined }]),
          onDoor: (door) => {
            const s = game.current();
            if (!s) return;
            const r = throughDoor(door, s);
            if (r.open) world.current?.travel(r.to);
            else setNote(r.why);
          },
          onEdge: (to) => world.current?.travel(to),
          onTalk: (npc) => {
            const s = game.current();
            if (!s) return;
            const c = contentRef.current;
            const card = c.npcs.find((n) => n.id === npc) ?? null;
            const scene = sceneFor(c.scenes, s, { npc }) ?? smallTalk(npc, card);
            talkRef.current.start(scene, card, lookOf(card, npc), s);
          },
          onLook: (o: MapObject) => setNote(o.kind === 'sign' ? o.text : 'Nothing written here.'),
          // Tab (the companion) is the page's own key, so it works in a conversation too.
          onKey: (k) => k !== 'companion' && setPanel(k),
          isBusy: () => busy.current,
        };
        const { startWorld } = await import('../../world/engine/boot');
        if (gone) return;
        const w = await startWorld(el, {
          map,
          time: start.time,
          hero: tile,
          facing: start.place.facing,
          host,
          onReady: () => !gone && setState('ready'),
        }, !!frame);
        if (gone) {
          w.destroy();
          return;
        }
        world.current = w;
        (window as unknown as { __world?: RunningWorld }).__world = w;
      } catch {
        if (!gone) setState('failed');
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
      minutes += 1;
      setMinutes(minutes);
      if (minutes - told >= 10) {
        told = minutes;
        game.dispatch([{ do: 'tick', minutes }], 'walk');
      }
      const now = partOfDay(minutes);
      if (now !== part) {
        part = now;
        world.current?.setTime(now);
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
  const hintNow = talk.view?.scene.nodes.find((n) => n.id === talk.view?.state.node)?.hint;
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
    const id = window.setInterval(() => {
      const s = game.current();
      if (!s || busy.current || document.visibilityState === 'hidden') {
        lastActive.current = Date.now();
        return;
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
  // A full-screen panel stops the world: no drawing, no clock (D7).
  useEffect(() => {
    world.current?.setPaused(panel !== null);
  }, [panel]);
  useEffect(() => {
    if (!panel) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [panel]);
  const lastLine = talk.view ? [...talk.view.history].reverse().find((h) => h.who === 'npc' && h.line)?.line : undefined;
  const lastNode = talk.view && lastLine ? talk.view.scene.nodes.find((n) => n.id === lastLine.node) : undefined;

  const setPinyin = (on: boolean) => void game.dispatch([{ do: 'settings', patch: { pinyin: on } }]);

  return (
    <div className="world-shell" data-state={state} data-textsize={game.save?.settings.textSize ?? 'm'} data-framed={frame ? '' : undefined}>
      <div
        className="world-canvas"
        ref={box}
        style={frame ? { width: Number(frame[1]), height: Number(frame[2]) } : undefined}
      />
      {game.save && state === 'ready' && <TopBar district={game.save.district} minutes={minutes} open={setPanel} />}
      {panel && game.save && (
        <Panels
          tab={panel}
          setTab={setPanel}
          save={game.save}
          content={content}
          pinyin={game.save.settings.pinyin}
          onClose={() => setPanel(null)}
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
          pinyin={game.save.settings.pinyin}
          setPinyin={setPinyin}
          onProceed={talk.proceed}
          onClose={talk.close}
        >
          <InputBar
            onSend={talk.reply}
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
          onHint={() => setHint({ at: talkAt, step: hintStep + 1 })}
          now={() => {
            const s = game.current();
            return s ? whatNow(s, contentRef.current.quests) : '';
          }}
          lex={lex}
          talking={!!talk.view}
        />
      )}
      {game.save?.settings.joystick && state === 'ready' && !talk.view && !panel && (
        <Joystick onStick={(f, run) => world.current?.stick(f, run)} onAct={() => world.current?.act()} />
      )}
      {note !== null && (
        <button type="button" className="world-note" onClick={() => setNote(null)}>
          {note}
        </button>
      )}
      {state !== 'ready' && (
        <div className="world-loading small">{state === 'failed' ? 'The game could not start. Reload to try again.' : 'Opening Beijing…'}</div>
      )}
    </div>
  );
}

