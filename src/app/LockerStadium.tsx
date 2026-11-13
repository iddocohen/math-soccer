/**
 * The locker room's pictures and preview for the stadium and the weather (amendment 20 part 2, FR-135, FR-138, FR-139).
 * The sky, the light cones, the stand rows and the falling snow or rain are the match's own (src/game/stadium.ts), drawn
 * here as SVG.
 *
 * - Each item button shows a small picture: the stand rows, a lamp with its light, or the weather's sign.
 * - The preview is a small stadium in world units with the scoreboard and the stadium name above the stands. A tap on a
 *   stands, floodlight or weather item shows it there for STADIUM_PLAY_MS, also before it is bought, as a celebration
 *   plays on the player (FR-113); then the chosen stadium shows again.
 * - For tests: `data-testid="stadium-preview"` with `data-weather`, `data-floodlight`, `data-stands` (what shows) and
 *   `data-playing` (the tapped item id while it shows, empty otherwise).
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { createRng } from '../core/rng';
import { CHART_RECT, GOAL_FRAME, STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import { FLOODLIGHT_COLORS, type Floodlight, type Stands, type Weather } from '../core/rewards/items';
import { coneLight, dropAt, FLOODLIGHT_X, makeDrops, standRows, WEATHER_STYLE } from '../game/stadium';
import { css } from '../game/palette';

/** How long a tapped item shows on the preview. */
export const STADIUM_PLAY_MS = 2500;

/** What a tap shows on the preview. `n` counts the taps, so a second tap on the same item shows it again. */
export type StadiumPlay = { kind: 'stands'; name: Stands; n: number } | { kind: 'floodlight'; name: Floodlight; n: number } | { kind: 'weather'; name: Weather; n: number };

/** The scoreboard above the stands, in world units. */
const BOARD = { x: WORLD_WIDTH / 2 - 330, y: 8, width: 660, height: 86 } as const;

/** True for `STADIUM_PLAY_MS` after each new `play`. */
function useShowing(play: StadiumPlay | null): boolean {
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    if (play === null) return;
    setShowing(true);
    const timer = window.setTimeout(() => setShowing(false), STADIUM_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [play]);
  return showing;
}

/** Milliseconds since the snow or the rain started; it runs while the drops show. */
function useFallClock(): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const step = () => {
      setMs(performance.now() - started);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  return ms;
}

interface PreviewProps {
  stands: Stands;
  floodlight: Floodlight;
  weather: Weather;
  /** The name on the scoreboard. */
  name: string;
  play: StadiumPlay | null;
  label: string;
}

/** The small stadium that shows the stands, the floodlights, the weather and the scoreboard (FR-139). */
export function StadiumPreview({ stands, floodlight, weather, name, play, label }: PreviewProps): ReactElement {
  const showing = useShowing(play) && play !== null;
  const shown = {
    stands: showing && play.kind === 'stands' ? play.name : stands,
    floodlight: showing && play.kind === 'floodlight' ? play.name : floodlight,
    weather: showing && play.kind === 'weather' ? play.name : weather,
  };
  const style = WEATHER_STYLE[shown.weather];
  const overlay = style.overlay;
  const cone = coneLight(shown.floodlight, shown.weather);
  const top = STANDS_BOTTOM + 30;
  const rows = standRows(shown.stands);
  return (
    <figure
      className="locker-extras-preview"
      data-testid="stadium-preview"
      data-weather={shown.weather}
      data-floodlight={shown.floodlight}
      data-stands={shown.stands}
      data-playing={showing ? `${play.kind}.${play.name}` : ''}
      aria-label={label}
    >
      <svg width="320" height="200" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} aria-hidden="true">
        <defs>
          <linearGradient id="stadium-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={style.sky[0]} />
            <stop offset="100%" stopColor={style.sky[1]} />
          </linearGradient>
          <linearGradient id="stadium-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={style.grassShade[0]} />
            <stop offset="100%" stopColor={style.grassShade[1]} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={WORLD_WIDTH} height={top} fill="url(#stadium-sky)" />
        {cone &&
          FLOODLIGHT_X.map((x) => <polygon key={x} points={`${x - 50},0 ${x - 230},${top} ${x + 230},${top} ${x + 50},0`} fill={css(cone.color)} opacity={cone.alpha * 2.5} />)}
        {rows.map((row, i) => (
          <g key={i}>
            <rect x={0} y={row.bandTop} width={WORLD_WIDTH} height={row.bandHeight} fill={(rows.length - 1 - i) % 2 ? '#1d3044' : '#22384c'} />
            {Array.from({ length: 24 }, (_, k) => (
              <circle key={k} cx={30 + k * 66 + (i % 2) * 33} cy={row.fanBottom - 12} r={12} fill={['#c94f4f', '#3e6fb0', '#e8b923', '#f4f6ef'][(k + i) % 4]} />
            ))}
          </g>
        ))}
        <rect x={0} y={top} width={WORLD_WIDTH} height={WORLD_HEIGHT - top} fill="#3a8a46" />
        <rect x={0} y={top} width={WORLD_WIDTH} height={WORLD_HEIGHT - top} fill="url(#stadium-shade)" />
        {style.grassWash && <rect x={0} y={top} width={WORLD_WIDTH} height={WORLD_HEIGHT - top} fill={style.grassWash} />}
        {style.snowCover && (
          <g fill="#f0f6fc" opacity={0.6}>
            <rect x={0} y={top} width={WORLD_WIDTH} height={24} />
            <rect x={0} y={top} width={90} height={WORLD_HEIGHT - top} />
            <rect x={WORLD_WIDTH - 90} y={top} width={90} height={WORLD_HEIGHT - top} />
          </g>
        )}
        {overlay !== 'none' && <FallingDrops overlay={overlay} />}
        <rect x={GOAL_FRAME.x} y={GOAL_FRAME.y} width={GOAL_FRAME.width} height={GOAL_FRAME.height} fill="#0e1a14" stroke="#f4f6ef" strokeWidth={22} />
        <rect x={CHART_RECT.x} y={CHART_RECT.y} width={CHART_RECT.width} height={CHART_RECT.height} fill="#f4f6ef" opacity={0.85} rx={12} />
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} rx={14} fill="#0a121b" stroke="#3a4c5e" strokeWidth={6} />
        <text x={WORLD_WIDTH / 2} y={BOARD.y + 62} textAnchor="middle" fontSize={56} fontWeight={800} fill="#ffd75e" letterSpacing={4} data-testid="stadium-preview-name">
          {name.toUpperCase()}
        </text>
      </svg>
    </figure>
  );
}

/**
 * The falling snowflakes or raindrops of the preview. They own the frame clock, so only they draw again on every frame,
 * not the whole stadium.
 */
function FallingDrops({ overlay }: { overlay: 'snow' | 'rain' }): ReactElement {
  const drops = useMemo(() => {
    const rng = createRng(17);
    return makeDrops(overlay, () => rng.next());
  }, [overlay]);
  const ms = useFallClock();
  return (
    <>
      {drops.map((d, i) => {
        const p = dropAt(overlay, d, ms);
        return overlay === 'snow' ? (
          <circle key={i} cx={p.x} cy={p.y} r={14 * d.scale} fill="#ffffff" opacity={d.alpha} />
        ) : (
          <line key={i} x1={p.x} y1={p.y} x2={p.x + Math.sin(p.rotation) * 46} y2={p.y - Math.cos(p.rotation) * 46} stroke="#d2e1f0" strokeWidth={5} opacity={d.alpha} />
        );
      })}
    </>
  );
}

/** The stand rows, four or six, for the item button. */
export function StandsIcon({ stands }: { stands: Stands }): ReactElement {
  const count = stands === 'big' ? 6 : 4;
  const gap = 32 / count;
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
      {Array.from({ length: count }, (_, row) =>
        Array.from({ length: 6 }, (_, k) => <circle key={`${row}-${k}`} cx={5 + k * 6 + (row % 2) * 3} cy={6 + row * gap + gap / 2} r={Math.min(2.6, gap / 2.2)} fill={['#c94f4f', '#3e6fb0', '#e8b923', '#f4f6ef'][(k + row) % 4]} />),
      )}
    </svg>
  );
}

/** A floodlight with its light cone in its color, for the item button. */
export function FloodlightIcon({ floodlight }: { floodlight: Floodlight }): ReactElement {
  const color = css(FLOODLIGHT_COLORS[floodlight]);
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
      <polygon points="15,10 4,38 36,38 25,10" fill={color} opacity={0.45} />
      <rect x={11} y={3} width={18} height={8} rx={2} fill={color} stroke="#12202c" strokeWidth={1.5} />
    </svg>
  );
}

/** The weather's sign: a moon, a sun, a setting sun, a rain cloud or a snowflake, for the item button. */
export function WeatherIcon({ weather }: { weather: Weather }): ReactElement {
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
      {weather === 'evening' && <path d="M26 6 A14 14 0 1 0 34 28 A11 11 0 1 1 26 6 Z" fill="#f4e7a1" />}
      {weather === 'day' && (
        <g fill="#f2c230">
          <circle cx={20} cy={20} r={8} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <circle key={i} cx={20 + Math.cos(a) * 14} cy={20 + Math.sin(a) * 14} r={2.4} />;
          })}
        </g>
      )}
      {weather === 'sunset' && (
        <g>
          <path d="M6 28 A14 14 0 0 1 34 28 Z" fill="#f08a3c" />
          <rect x={2} y={28} width={36} height={3} rx={1.5} fill="#c94f4f" />
          <rect x={8} y={33} width={24} height={3} rx={1.5} fill="#c94f4f" opacity={0.6} />
        </g>
      )}
      {weather === 'rain' && (
        <g>
          <ellipse cx={20} cy={14} rx={14} ry={8} fill="#9aa8b6" />
          {[10, 18, 26].map((x) => (
            <line key={x} x1={x + 3} y1={24} x2={x} y2={36} stroke="#6fb4ff" strokeWidth={2.5} strokeLinecap="round" />
          ))}
        </g>
      )}
      {weather === 'snow' && (
        <g stroke="#f0f6fc" strokeWidth={2.6} strokeLinecap="round">
          {[0, 60, 120].map((deg) => (
            <line key={deg} x1={20} y1={5} x2={20} y2={35} transform={`rotate(${deg} 20 20)`} />
          ))}
        </g>
      )}
    </svg>
  );
}
