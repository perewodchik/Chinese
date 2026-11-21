import { useEffect, useRef, useState } from "react";
import type { NarratorDto, TextNarrationDto } from "../../../shared/narration";
import type { NarratorVoice } from "../../../shared/narration";
import {
  adoptNarrator,
  chooseNarrator,
  chosenNarrator,
  listNarrators,
  narrationOf,
  narrationStatus,
  narratorVoices,
  previewNarrator,
  saveNarrationKey,
} from "../../api/narration";
import { Icon } from "../../ui/Icon";

/**
 * A narrator for the text, from Listen's menu: one of the learner's
 * narrators, or one of MiniMax's own voices taken on as a new narrator right
 * here (heard first on the text's first line), reads the whole text in one go
 * with the learner's own key — asked for here when there is none. The reading
 * is kept, so it is never paid for twice, and plays above with a slider.
 */
export function Narrate({
  lines,
  onMade,
  embedded = false,
}: {
  lines: string[];
  onMade: (n: TextNarrationDto, name: string) => void;
  /** shown open inside another menu (Listen's), with no + of its own */
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(embedded);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [narratorId, setNarratorId] = useState<string | null>(chosenNarrator);
  const [kept, setKept] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // MiniMax's own voices, offered as new narrators right here: Speak, where
  // narrators were made, may be switched off.
  const [stock, setStock] = useState<NarratorVoice[] | null>(null);
  const [stockId, setStockId] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [sample, setSample] = useState<string | null>(null);
  const narrator = stockId
    ? null
    : (narrators?.find((n) => n.id === narratorId) ?? narrators?.[0] ?? null);
  const stockVoice = stockId ? (stock?.find((v) => v.id === stockId) ?? null) : null;
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // A dropdown: a tap anywhere else, or Escape, closes it.
  useEffect(() => {
    if (!open || embedded) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !toggle.current?.contains(t))
        setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, embedded]);

  // Asked only once the panel is opened: most visits to Listen never need MiniMax.
  useEffect(() => {
    if (!open || hasKey !== null) return;
    let live = true;
    narrationStatus().then(
      (s) => live && setHasKey(s.key.set),
      (err: Error) => {
        if (!live) return;
        setHasKey(false);
        setMessage(err.message);
      },
    );
    return () => {
      live = false;
    };
  }, [open, hasKey]);

  useEffect(() => {
    if (!hasKey || narrators) return;
    let live = true;
    listNarrators().then(
      (list) => live && setNarrators(list),
      (err: Error) => live && setMessage(err.message),
    );

    return () => {
      live = false;
    };
  }, [hasKey, narrators]);

  // MiniMax's own voices, once there is a key to ask with.
  useEffect(() => {
    if (!hasKey || stock) return;
    let live = true;
    narratorVoices().then(
      (list) => live && setStock(list),
      () => live && setStock([]),
    );
    return () => {
      live = false;
    };
  }, [hasKey, stock]);

  // Has the narrator, as it sounds now, read this text already?
  useEffect(() => {
    if (!narrator) {
      setKept(stockId ? false : null);
      return;
    }
    let live = true;
    setKept(null);
    narrationOf(narrator.id, lines).then(
      (n) => live && setKept(n !== null),
      () => live && setKept(null),
    );
    return () => {
      live = false;
    };
  }, [narrator, lines, stockId]);

  /** The chosen voice as a narrator of the learner's: MiniMax's own voice taken on first, when that is what was chosen. */
  async function narratorToUse() {
    if (narrator) return narrator;
    if (!stockVoice) return null;
    const made = await adoptNarrator(stockVoice.name.replace(/\s*\((Fe)?[Mm]ale\)\s*$/, ""), stockVoice.id);
    setNarrators((list) => [...(list ?? []), made]);
    setNarratorId(made.id);
    chooseNarrator(made.id);
    setStockId(null);
    return made;
  }

  async function hear() {
    setBusy(true);
    setMessage(null);
    try {
      const n = await narratorToUse();
      if (!n) return;
      const url = await previewNarrator(n.id, lines[0] ?? "你好。");
      if (sample) URL.revokeObjectURL(sample);
      setSample(url);
      void new Audio(url).play().catch(() => undefined);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "MiniMax did not answer.");
    } finally {
      setBusy(false);
    }
  }

  async function saveKey() {
    setBusy(true);
    setMessage(null);
    try {
      const s = await saveNarrationKey(key);
      setKey("");
      setHasKey(s.key.set);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "MiniMax did not take the key.");
    } finally {
      setBusy(false);
    }
  }

  async function read(again = false) {
    setBusy(true);
    setMessage(null);
    try {
      const narrator = await narratorToUse();
      if (!narrator) return;
      const n = await narrationOf(
        narrator.id,
        lines,
        again ? { again: true } : { generate: true },
      );
      if (!n) throw new Error("MiniMax sent nothing back.");
      setKept(true);
      onMade(n, narrator.name);
      setMessage(
        `${narrator.name} has read the text. It is kept: playing it costs nothing.`,
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "MiniMax did not answer.",
      );
    } finally {
      setBusy(false);
    }
  }

  const mine = new Set((narrators ?? []).map((n) => n.voiceId));
  const fresh = (stock ?? []).filter((v) => !mine.has(v.id));
  const who = narrator?.name ?? stockVoice?.name ?? "";

  return (
    <>
      {!embedded && (
        <button
          ref={toggle}
          className="chip rd-natural-add"
          aria-expanded={open}
          aria-label="A narrator for this text"
          title="A narrator for this text"
          data-busy={busy || undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="plus" size={18} />
        </button>
      )}
      {open && (
        <div
          className={embedded ? "rd-natural-inline" : "rd-natural-panel"}
          ref={panel}
        >
          {!embedded && <b className="small">A narrator for this text</b>}
          {hasKey === false ? (
            <form
              className="rd-natural-key"
              onSubmit={(e) => {
                e.preventDefault();
                if (key.trim()) void saveKey();
              }}
            >
              <p className="small" style={{ margin: 0 }}>
                A natural voice reads the text with your own MiniMax key (platform.minimax.io › API Keys); a chapter costs a few cents, once.
              </p>
              <div className="rd-natural-row">
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Your MiniMax API key"
                  aria-label="MiniMax API key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button className="btn tonal sm" type="submit" disabled={busy || !key.trim()}>
                  {busy ? "Checking…" : "Save the key"}
                </button>
              </div>
              {message && <p className="tiny muted rd-natural-msg">{message}</p>}
            </form>
          ) : (
            <>
              <div className="rd-natural-row">
                <label className="rd-natural-pick">
                  <span className="tiny muted">Voice</span>
                  <select
                    value={stockId ? `v:${stockId}` : `n:${narrator?.id ?? ""}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith("v:")) setStockId(v.slice(2));
                      else {
                        setStockId(null);
                        setNarratorId(v.slice(2));
                        chooseNarrator(v.slice(2));
                      }
                      setMessage(null);
                    }}
                    disabled={!narrators || busy}
                  >
                    {!narrators && <option value="n:">Loading…</option>}
                    {narrators && narrators.length > 0 && (
                      <optgroup label="Your narrators">
                        {narrators.map((n) => (
                          <option key={n.id} value={`n:${n.id}`}>
                            {n.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {narrators && narrators.length === 0 && !stockId && <option value="n:">Choose a voice</option>}
                    {fresh.length > 0 && (
                      <optgroup label="A new voice">
                        {fresh.map((v) => (
                          <option key={v.id} value={`v:${v.id}`}>
                            {v.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                <button
                  className="btn quiet sm"
                  onClick={() => void hear()}
                  disabled={busy || (!narrator && !stockVoice)}
                  title="Its first line, read in this voice"
                >
                  Hear it
                </button>
              </div>
              {stockVoice && <p className="tiny muted rd-natural-msg">{stockVoice.description}</p>}
              <div className="rd-natural-read">
                {kept ? (
                  <button
                    className="btn quiet sm rd-natural-go"
                    onClick={() => void read(true)}
                    disabled={busy}
                  >
                    {busy ? "Reading…" : "Read it again"}
                  </button>
                ) : (
                  <button
                    className="btn tonal sm rd-natural-go"
                    onClick={() => void read()}
                    disabled={(!narrator && !stockVoice) || busy || kept === null}
                  >
                    {busy ? "Reading… up to a minute" : `Read the whole text${who ? ` as ${who}` : ""}`}
                  </button>
                )}
              </div>
              <p className="tiny muted rd-natural-msg">
                {message ??
                  (kept
                    ? `${who} has read this text; it plays above. Read it again only after changing the voice.`
                    : "One request for the whole text, kept on the server: it is paid for once.")}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
