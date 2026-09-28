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
  const busy = useRef(false);
  busy.current = note !== null || talk.view !== null;

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
        let { map, tile } = start.asked && index[start.asked] ? { map: start.asked, tile: null as Tile | null } : start.place;
        if (!index[map]) ({ map, tile } = FALLBACK);
        if (!tile) tile = map === FALLBACK.map ? FALLBACK.tile : [Math.floor(index[map]!.width / 2), index[map]!.height - 4];
        const host: WorldHost = {
          onStep: (t, facing) => game.dispatch([{ do: 'move', tile: t, facing }], 'walk'),
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
          onKey: () => undefined,
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

  const setPinyin = (on: boolean) => void game.dispatch([{ do: 'settings', patch: { pinyin: on } }]);

  return (
    <div className="world-shell" data-state={state} data-framed={frame ? '' : undefined}>
      <div
        className="world-canvas"
        ref={box}
        style={frame ? { width: Number(frame[1]), height: Number(frame[2]) } : undefined}
      />
      {game.save && state === 'ready' && <TopBar district={game.save.district} minutes={minutes} open={() => undefined} />}
      {talk.view && game.save && (
        <Dialogue
          view={talk.view}
          pinyin={game.save.settings.pinyin}
          setPinyin={setPinyin}
          onProceed={talk.proceed}
          onClose={talk.close}
        >
          <ReplyField onSend={(t) => talk.reply(t, 'keyboard')} />
        </Dialogue>
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

/** Until the full input bar (E3): a plain field; the system Chinese keyboard works in it. */
function ReplyField({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="wd-reply"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text);
        setText('');
      }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Answer in Chinese…"
        lang="zh"
        autoComplete="off"
        autoFocus
      />
      <button type="submit" className="wd-go" disabled={!text.trim()}>
        ➤
      </button>
    </form>
  );
}
