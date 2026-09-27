import { useState } from 'react';
import { personaOf } from '../../../shared/personas';
import { wordId } from '../../domain/ids';
import type { Backdrop, Scene } from '../../domain/story';
import { Photo } from '../../games/kit/Photo';
import { useOpenItem } from '../../navigation/itemDrawer';
import { Portrait } from '../pinyin/Portrait';
import '../../games/kit/kit.css';

/**
 * A scene beside a paragraph, drawn by the app out of its own parts: a room in
 * ink, the passage's things as their photos where the writer put them, and
 * its people as faces.
 *
 * Every thing is a word: tap it for the word. When the writer asked a
 * question ("猫在哪儿？"), the answer is a tap on the right thing. Nothing
 * here is scored — a scene is for looking at.
 */
export function SceneView({ scene }: { scene: Scene }) {
  const open = useOpenItem();
  const [answered, setAnswered] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const tap = (w: string) => {
    if (scene.ask && answered !== scene.ask.w) {
      if (w === scene.ask.w) setAnswered(w);
      else {
        setWrong(w);
        window.setTimeout(() => setWrong(null), 700);
      }
      return;
    }
    open(wordId(w));
  };
  return (
    <figure className="scene no-print">
      <div className="scene-stage">
        <Room bg={scene.bg} />
        {scene.people.map((p, i) => {
          const persona = personaOf(p.who);
          return (
            <span key={i} className="scene-person" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
              <Portrait voice={persona?.id ?? `speaker-${p.who}`} gender={persona?.gender} size="sm" still />
              <span className="scene-name hanzi">{persona ? '' : p.who}</span>
            </span>
          );
        })}
        {scene.things.map((t, i) => (
          <button
            key={i}
            type="button"
            className="scene-thing"
            data-state={answered === t.w ? 'right' : wrong === t.w ? 'wrong' : undefined}
            style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, width: `${13 * t.s}%` }}
            onClick={() => tap(t.w)}
            aria-label={t.w}
            title={t.w}
          >
            <Photo word={t.w} />
          </button>
        ))}
      </div>
      {scene.ask && (
        <figcaption className="scene-ask">
          <span className="hanzi">{scene.ask.q}</span>
          <span className="tiny muted">
            {answered ? `对 — ${scene.ask.w}. Tap anything for its word.` : 'Tap the answer in the picture.'}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** The rooms, in ink: a wall, a floor, and the one or two things that say which room it is. */
function Room({ bg }: { bg: Backdrop }) {
  return (
    <svg className="scene-room" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden>
      <rect className="scene-wall" x={0} y={0} width={400} height={240} />
      <rect className="scene-floor" x={0} y={240} width={400} height={60} />
      <line className="scene-ink" x1={0} y1={240} x2={400} y2={240} />
      {bg === 'home' && (
        <g className="scene-ink">
          <rect x={40} y={50} width={70} height={60} />
          <line x1={75} y1={50} x2={75} y2={110} />
          <path d="M150 190h120M160 190v50M260 190v50" />
        </g>
      )}
      {bg === 'bedroom' && (
        <g className="scene-ink">
          <rect x={290} y={50} width={70} height={60} />
          <path d="M30 170v70M30 200h170v40M200 200v40M40 188h40" />
        </g>
      )}
      {bg === 'classroom' && (
        <g className="scene-ink">
          <rect className="scene-board" x={90} y={40} width={220} height={100} />
          <path d="M60 210h80M70 210v30M130 210v30M260 210h80M270 210v30M330 210v30" />
        </g>
      )}
      {bg === 'shop' && (
        <g className="scene-ink">
          <path d="M20 60h140M20 110h140M20 160h140M20 40v200M160 40v200M240 150h140v90M240 150v90" />
        </g>
      )}
      {bg === 'restaurant' && (
        <g className="scene-ink">
          <path d="M40 200h100M60 200v40M120 200v40M260 200h100M280 200v40M340 200v40" />
          <path d="M180 40v30M170 70h20l-10 20z" />
        </g>
      )}
      {bg === 'street' && (
        <g className="scene-ink">
          <path d="M20 240V90h80v150M120 240V60h70v180M300 240V110h80v130M40 110h15M70 110h15M140 90h15M165 90h15" />
        </g>
      )}
      {bg === 'park' && (
        <g className="scene-ink">
          <path d="M70 240v-60M330 240v-70M150 300l40-60M250 300l-40-60" />
          <circle cx={70} cy={150} r={40} />
          <circle cx={330} cy={140} r={45} />
        </g>
      )}
      {bg === 'hospital' && (
        <g className="scene-ink">
          <path d="M180 50h40M200 30v40" />
          <path d="M40 190h150v50M40 170v70M40 180h30" />
        </g>
      )}
      {bg === 'station' && (
        <g className="scene-ink">
          <path d="M0 200h400M0 215h400" />
          <rect x={60} y={110} width={260} height={80} rx={16} />
          <path d="M90 130h40v30h-40zM150 130h40v30h-40zM210 130h40v30h-40z" />
        </g>
      )}
      {bg === 'office' && (
        <g className="scene-ink">
          <path d="M40 200h120M50 200v40M150 200v40M240 200h120M250 200v40M350 200v40" />
          <rect x={80} y={165} width={40} height={30} />
          <rect x={280} y={165} width={40} height={30} />
        </g>
      )}
    </svg>
  );
}
