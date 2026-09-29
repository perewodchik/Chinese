import { useMemo, useState } from "react";
import { itemForToken } from "../../domain/words";
import { useLibrary } from "../../features/shared/library";
import { useOpenItem } from "../../navigation/itemDrawer";
import { directions, journal } from "../core/journal";
import type { WorldSave } from "../core/types";
import type { WorldContent } from "./content";
import { Hearts } from "./Hearts";
import {
  Destination,
  FareNote,
  placeZh,
  QuestSheet,
  RouteStrip,
  useMapIndex,
  type RouteRequest,
} from "./Journal";
import { peopleRows, whereText, type PersonRow } from "./panelRows";
import { pinyinOf } from "./pinyin";
import { Portrait } from "./Portrait";
import { useEscape } from "./useEscape";
import "./journal.css";
import "./people.css";

/**
 * The 👥 朋友 tab (§10 P2): everyone you have met, where they are at this
 * hour, and a drawer each — what they remember of you, which presents
 * they liked, their quests, the 成语 they taught you, the way to them and
 * what to ask them about. Your cat has a card of its own.
 */
export function People({
  save,
  content,
  onTrack,
  onShowRoute,
}: {
  save: WorldSave;
  content: WorldContent;
  onTrack: (quest: string) => void;
  onShowRoute: (r: RouteRequest) => void;
}) {
  const rows = useMemo(() => peopleRows(save, content), [save, content]);
  const [open, setOpen] = useState<string | null>(null);
  const cur = rows.find((r) => r.id === open);
  const cat = save.cat;
  if (!rows.length && !cat.name && !cat.fed)
    return (
      <div className="empty wp-empty">
        <div className="big han">友</div>
        <p className="small muted">Nobody yet. Say 你好 to the neighbours.</p>
      </div>
    );
  return (
    <>
      {save.name && (
        <p className="pp-me small">
          <span className="han">我叫{save.name}</span>{" "}
          <span className="tiny muted">· what the neighbours call you</span>
        </p>
      )}
      {(cat.name || cat.fed > 0) && (
        <div className="pp-cat">
          <span className="pp-cat-face" aria-hidden>
            🐈
          </span>
          <span>
            <b className="han">{cat.name || "小猫"}</b>{" "}
            <span className="tiny muted">· your cat</span>
            <br />
            <span className="small">
              Fed on {cat.fed} {cat.fed === 1 ? "day" : "days"}. It sleeps in
              the courtyard and follows you in{" "}
              <span className="han">帽儿胡同</span>.
            </span>
          </span>
        </div>
      )}
      <ul className="mn-rows pp-rows">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="jn-row"
              onClick={() => setOpen(r.id)}
            >
              <Portrait sprite={r.sprite} scale={2} />
              <span className="jn-row-text">
                <span className="jn-row-top">
                  <b className="han pp-name">{r.name}</b>
                  <Hearts n={r.hearts} />
                  {r.asking && (
                    <span className="pp-ask" title="Asked you for something">
                      !
                    </span>
                  )}
                  <span className="tiny muted jn-one">{r.role}</span>
                </span>
                <span className="tiny muted jn-one">
                  {whereText(r, placeZh)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="tiny muted">
        Friendship grows when you talk (once a day), give something they like,
        or help. At three hearts some people tell you their own story.
      </p>
      {cur && (
        <PersonSheet
          save={save}
          content={content}
          person={cur}
          onClose={() => setOpen(null)}
          onTrack={onTrack}
          onShowRoute={onShowRoute}
        />
      )}
    </>
  );
}

function PersonSheet({
  save,
  content,
  person: p,
  onClose,
  onTrack,
  onShowRoute,
}: {
  save: WorldSave;
  content: WorldContent;
  person: PersonRow;
  onClose: () => void;
  onTrack: (quest: string) => void;
  onShowRoute: (r: RouteRequest) => void;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const index = useMapIndex();
  const [quest, setQuest] = useState<string | null>(null);
  const to = p.now?.map ?? p.usually?.map;
  const dir =
    to && Object.keys(index).length ? directions(save, to, index) : null;
  const j = useMemo(() => journal(save, content), [save, content]);
  const q = quest ? content.quests.find((x) => x.id === quest) : undefined;
  const jq = quest
    ? [j.tracked, ...j.active].find((x) => x?.quest.id === quest)
    : undefined;
  useEscape(onClose);
  return (
    <>
      <div className="w-sheet-scrim" onClick={onClose}>
        <section
          className="w-sheet jn-sheet"
          role="dialog"
          aria-label={p.name}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="w-sheet-head">
            <Portrait sprite={p.sprite} scale={3} />
            <span>
              <b className="han pp-big">{p.name}</b> <Hearts n={p.hearts} />
              <br />
              <span className="tiny muted">
                {pinyinOf(p.name, lib)} · {p.role}
              </span>
            </span>
            <span className="spacer" />
            <button
              type="button"
              className="wd-tool"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>
          <p className="small">{whereText(p, placeZh)}</p>
          {to && <Destination map={to} />}
          {dir && (
            <>
              <RouteStrip dir={dir} />
              <FareNote dir={dir} />
            </>
          )}
          {to && dir?.kind === "ride" && (
            <button
              type="button"
              className="btn sm pp-show"
              onClick={() => onShowRoute({ legs: dir.legs, to })}
            >
              Show on map
            </button>
          )}
          {p.notes.length > 0 && (
            <>
              <h3 className="wp-label">Remembers</h3>
              <ul className="pp-notes small">
                {p.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
          {(p.likes.length > 0 || p.dislikes.length > 0) && (
            <dl className="w-facts small">
              {p.likes.length > 0 && (
                <>
                  <dt className="han">喜欢</dt>
                  <dd className="han">{p.likes.join("、")}</dd>
                </>
              )}
              {p.dislikes.length > 0 && (
                <>
                  <dt className="han">不喜欢</dt>
                  <dd className="han">{p.dislikes.join("、")}</dd>
                </>
              )}
            </dl>
          )}
          {p.quests.length > 0 && (
            <>
              <h3 className="wp-label">Their quests</h3>
              <ul className="mn-rows">
                {p.quests.map((x) => (
                  <li key={x.quest.id}>
                    <button
                      type="button"
                      className="jn-fold small"
                      onClick={() => setQuest(x.quest.id)}
                    >
                      <span className="jn-tag han" data-kind="side">
                        支线
                      </span>{" "}
                      {x.quest.title}{" "}
                      {x.done ? (
                        <span className="jn-ok">✓</span>
                      ) : (
                        <span className="tiny muted">· under way</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {p.idioms.length > 0 && (
            <>
              <h3 className="wp-label">成语 heard from them</h3>
              <p className="pp-chips">
                {p.idioms.map((i) => (
                  <button
                    key={i}
                    type="button"
                    className="pp-chip han"
                    onClick={() => openItem(itemForToken(lib, i))}
                  >
                    {i}
                  </button>
                ))}
              </p>
            </>
          )}
          {p.topics.length > 0 && (
            <>
              <h3 className="wp-label">Ask them about</h3>
              <p className="pp-chips">
                {p.topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="pp-chip han"
                    onClick={() => openItem(itemForToken(lib, t))}
                    title="Say: ……是什么意思？"
                  >
                    {t}
                  </button>
                ))}
              </p>
              <p className="tiny muted">
                Say 「……是什么意思？」 and they explain it in easy Chinese.
              </p>
            </>
          )}
        </section>
      </div>
      {q && (
        <QuestSheet
          save={save}
          content={content}
          quest={q}
          {...(jq ? { jq } : {})}
          index={index}
          onClose={() => setQuest(null)}
          onTrack={onTrack}
          onShowRoute={onShowRoute}
        />
      )}
    </>
  );
}
