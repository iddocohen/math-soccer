// Structure adapted from math-tank src/app/Garage.tsx (the star shop), without giving items back or item numbers.
/**
 * The locker room ("Kabine", FR-043, FR-044; contracts/screens.md "Locker room"). Opened from the start screen with
 * the "Kabine" button or K, only when the parent turned the locker room on. It shows a preview of the player and the
 * ball, the star balance, and the groups Ball, Trikot, Nummer und Name, Fans, Jubel and Pokale.
 *
 * - An owned or free item is chosen with one tap, at no cost.
 * - An item not owned shows its price. When the balance reaches it, a tap asks "Für N Sterne kaufen?" with "Ja" and
 *   "Nein"; "Ja" buys and chooses it. Otherwise the item shows "noch N Sterne" and does nothing.
 * - The shirt number takes 1 to 99, the shirt name up to 10 letters; both save as the child types.
 * - Escape goes back (or answers "Nein" while the question shows); "Zurück" goes back.
 *
 * "Jubel" (amendment 13, FR-113): the goal celebrations. A tap on one plays it on the preview player (also before it is
 * bought), besides choosing or buying it as with the other items. The preview shows `data-celebration` while it plays.
 *
 * "Ballspur", "Tor-Effekt" and "Maskottchen" (amendment 20, FR-134, FR-136, FR-137, FR-139): ball trails, goal effects
 * and mascots, bought and chosen like the other items. A tap on one plays it on the small stadium preview beside the
 * player (src/app/LockerExtras.tsx), also before it is bought.
 *
 * "Stadion" and "Wetter" (amendment 20 part 2, FR-135, FR-138, FR-139): the stadium name for the scoreboard (up to 14
 * characters, saved as the child types), the bigger stands, the floodlight colors and the weather, bought and chosen
 * like the other items. A tap on one shows it on the stadium preview (src/app/LockerStadium.tsx), also before it is
 * bought.
 *
 * "Spielarten" (amendment 21, FR-140): the game modes to unlock, "Freistoß mit Mauer" (200), "Selbst ins Tor" (300) and
 * "Elfmeterschießen" (600, only after "Selbst ins Tor"). Each shows a short preview animation (again on every tap), its
 * price or "noch N Sterne", or "Erst Selbst ins Tor freischalten". A tap on an affordable mode asks "Für N Sterne
 * freischalten?"; "Ja" unlocks it for good. Opened from a locked mode on the start screen (`focus="modes"`), the
 * locker room scrolls to this group. For tests: the group `data-testid="locker-modes"`, every mode
 * `data-testid="mode-<mode>"` with `data-unlocked` and `data-lock` (unlocked, needs, affordable, stars).
 *
 * The trophy shelf (amendment 13, FR-111) shows every won cup as "Pokal 1", "Pokal 2" and so on
 * (`data-testid="trophy-shelf"` with `data-trophies`, each cup `data-testid="trophy"`).
 *
 * The app's game keys are off while the locker room shows; this screen has its own key listener for Escape.
 * For tests: `data-testid="locker-room"` with `data-stars`, every item `data-testid="item-<id>"` with `data-owned`,
 * `data-locked` and `data-chosen`.
 */
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { COLOR, css } from '../game/palette';
import { CELEBRATION_MS, poseAt, REST, armPoints, HEART_CENTER, TURN_CENTER_Y, type CelebrationPose } from '../game/celebrationPose';
import {
  BALL_COLORS,
  ballDesign,
  celebrationOf,
  floodlightOf,
  goalEffectOf,
  ITEMS,
  mascotOf,
  standsOf,
  trailOf,
  weatherOf,
  type BallDesign,
  type Celebration,
  type ItemKind,
  type LockerItem,
} from '../core/rewards/items';
import {
  buy,
  canBuy,
  chosen,
  equip,
  isOwned,
  lookOf,
  setShirtName,
  setShirtNumber,
  setStadiumName,
  SHIRT_NAME_MAX,
  STADIUM_NAME_MAX,
  starsNeeded,
  type Look,
} from '../core/rewards/lockerRoom';
import { MODE_OFFERS, modeLock, UNLOCK_MODES, unlockMode, type UnlockMode } from '../core/rewards/modes';
import type { LockerRoom as LockerData } from '../core/storage/schemas';
import { t } from '../i18n';
import { TrophyIcon } from './CupBracket';
import { ExtrasPreview, GoalEffectIcon, MascotIcon, TrailIcon, type ExtrasPlay } from './LockerExtras';
import { FloodlightIcon, StadiumPreview, StandsIcon, WeatherIcon, type StadiumPlay } from './LockerStadium';

interface Props {
  locker: LockerData;
  /** A purchase, a choice, or a new number or name; the app stores it. */
  onChange: (locker: LockerData) => void;
  onBack: () => void;
  /** The won cups for the trophy shelf (amendment 13, FR-111), oldest first. */
  trophies?: ReadonlyArray<{ cup: number }>;
  /** A group to scroll to when the locker room opens: "Spielarten" after a tap on a locked mode (FR-141). */
  focus?: 'modes' | null;
}

/** The question before stars are spent: its text, and the locker room after "Ja". */
interface Question {
  text: string;
  apply: (locker: LockerData) => LockerData;
}

/**
 * A small moving picture of a mode (FR-140): the ball bounces off the wall, the keeper dives to the ball, or the ball
 * goes in and the score circles fill. It plays once when it shows and again when `play` changes.
 */
export function ModePreview({ mode, play }: { mode: UnlockMode; play: number }): ReactElement {
  const chalk = css(COLOR.chalk);
  const kit = css(COLOR.kit);
  return (
    <svg key={play} className={`mode-preview mode-preview-${mode}`} width={64} height={44} viewBox="0 0 64 44" aria-hidden="true">
      <path d="M8 30 V6 H56 V30" fill="none" stroke={chalk} strokeWidth={2.5} />
      {mode === 'wall' &&
        [22, 32, 42].map((x) => (
          <g key={x}>
            <rect x={x - 4} y={26} width={8} height={12} rx={2} fill="#c94f4f" />
            <circle cx={x} cy={23} r={3} fill={css(COLOR.skin)} />
          </g>
        ))}
      {mode === 'keeper' && (
        <g className="mode-preview-keeper">
          <rect x={28} y={16} width={8} height={12} rx={2} fill={kit} />
          <circle cx={32} cy={13} r={3} fill={css(COLOR.skin)} />
        </g>
      )}
      {mode === 'shootout' &&
        [0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle className={`mode-preview-dot mode-preview-dot-${i}`} cx={14 + i * 9} cy={36} r={2.5} fill={kit} />
            <circle className={`mode-preview-dot mode-preview-dot-${i}`} cx={14 + i * 9} cy={42} r={2} fill={chalk} opacity={0.6} />
          </g>
        ))}
      <circle className="mode-preview-ball" cx={32} cy={40} r={3} fill="#ffffff" stroke={css(COLOR.ink)} strokeWidth={0.8} />
    </svg>
  );
}

/** For each celebration's small picture: the moment of its pose that shows it best. */
const ICON_MOMENT: Record<Celebration, number> = { armsUp: 0.3, slide: 0.65, airplane: 0.4, backflip: 0.45, dance: 0.17, heart: 0.45 };

/** The arms of a pose (and the heart of "Herz"), in the figure units of src/game/celebrationPose.ts. */
function PoseArms({ pose, shirt }: { pose: CelebrationPose; shirt: string }): ReactElement {
  const skin = css(COLOR.skin);
  const r = 13 * pose.heart;
  return (
    <g>
      {([-1, 1] as const).map((side) => {
        const p = armPoints(side, side < 0 ? pose.left : pose.right);
        const mid = { x: (p.shoulder.x + p.elbow.x) / 2, y: (p.shoulder.y + p.elbow.y) / 2 };
        return (
          <g key={side} strokeLinecap="round">
            <line x1={p.shoulder.x} y1={p.shoulder.y} x2={mid.x} y2={mid.y} stroke={shirt} strokeWidth={26} />
            <polyline points={`${mid.x},${mid.y} ${p.elbow.x},${p.elbow.y} ${p.hand.x},${p.hand.y}`} fill="none" stroke={skin} strokeWidth={16} />
            <circle cx={p.hand.x} cy={p.hand.y} r={11} fill={skin} />
          </g>
        );
      })}
      {pose.heart > 0.05 && (
        <g fill="#e0344a">
          <circle cx={HEART_CENTER.x - r} cy={HEART_CENTER.y} r={r} />
          <circle cx={HEART_CENTER.x + r} cy={HEART_CENTER.y} r={r} />
          <polygon
            points={`${HEART_CENTER.x - 2 * r},${HEART_CENTER.y + r * 0.35} ${HEART_CENTER.x + 2 * r},${HEART_CENTER.y + r * 0.35} ${HEART_CENTER.x},${HEART_CENTER.y + 2.4 * r}`}
          />
        </g>
      )}
    </g>
  );
}

/** The SVG rotation in degrees of a pose's turn around the figure's middle. */
const degrees = (turn: number) => (turn * 180) / Math.PI;

/** A small figure in one moment of a celebration, for the item button. */
function CelebrationIcon({ celebration, shirt }: { celebration: Celebration; shirt: string }): ReactElement {
  const pose = poseAt(celebration, ICON_MOMENT[celebration]);
  return (
    <svg width={40} height={40} viewBox="-160 -350 320 360" aria-hidden="true">
      <g transform={`translate(${pose.x * 0.3} ${pose.y * 0.3}) rotate(${degrees(pose.turn)} 0 ${TURN_CENTER_Y})`}>
        <rect x={-44} y={-114} width={88} height={60} rx={8} fill={css(COLOR.chalk)} />
        <rect x={-46} y={-200} width={92} height={92} rx={12} fill={shirt} />
        <PoseArms pose={pose} shirt={shirt} />
        <circle cx={0} cy={-237} r={34} fill={css(COLOR.hair)} />
      </g>
    </svg>
  );
}

const GROUP: Record<ItemKind, 'ball' | 'shirt' | 'fans' | 'celebration' | 'trail' | 'goalEffect' | 'mascot' | 'stadium' | 'weather'> = {
  ball: 'ball',
  shirt: 'shirt',
  scarf: 'fans',
  celebration: 'celebration',
  trail: 'trail',
  goalEffect: 'goalEffect',
  mascot: 'mascot',
  stands: 'stadium',
  floodlight: 'stadium',
  weather: 'weather',
};

/** True for colors where dark text reads better than light text. */
function isLight(color: number): boolean {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** The pattern on a ball design's small picture: a star, flames, a center patch, or none on the rainbow ball. */
function markOf(design: BallDesign, fill: string): ReactElement | null {
  switch (design) {
    case 'stars':
      return (
        <text x="20" y="27" textAnchor="middle" fontSize="20" fill={fill}>
          ★
        </text>
      );
    case 'flames':
      return <path d="M8 34 L14 18 L18 28 L20 12 L24 28 L28 18 L32 34 Z" fill={fill} />;
    case 'rainbow':
      return null;
    default:
      return <circle cx="20" cy="20" r="7" fill={fill} />;
  }
}

export function BallIcon({ design, size = 40 }: { design: BallDesign; size?: number }): ReactElement {
  const mark = css(BALL_COLORS[design].mark);
  const gradient = `ball-gradient${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id={gradient}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#3498db" />
          <stop offset="50%" stopColor="#2ecc71" />
          <stop offset="70%" stopColor="#f1c40f" />
          <stop offset="85%" stopColor="#f39c12" />
          <stop offset="100%" stopColor="#e74c3c" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={design === 'rainbow' ? `url(#${gradient})` : css(BALL_COLORS[design].fill)} stroke="rgb(0 0 0 / 30%)" />
      {markOf(design, mark)}
    </svg>
  );
}

/** Plays `celebration` once over CELEBRATION_MS whenever `play` changes; null while nothing plays. */
function useCelebrationPose(play: { celebration: Celebration; n: number } | null): { celebration: Celebration; pose: CelebrationPose } | null {
  const [now, setNow] = useState<{ celebration: Celebration; pose: CelebrationPose } | null>(null);
  useEffect(() => {
    if (play === null) return;
    const started = performance.now();
    let frame = 0;
    const step = () => {
      const t = (performance.now() - started) / CELEBRATION_MS;
      if (t >= 1) {
        setNow(null);
        return;
      }
      setNow({ celebration: play.celebration, pose: poseAt(play.celebration, t) });
      frame = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(frame);
  }, [play]);
  return now;
}

/** Figure units (src/game/celebrationPose.ts) in the preview: the feet below the picture, the shirt top at y 60. */
const PREVIEW_FIGURE = { x: 70, y: 234, scale: 0.87 } as const;

/**
 * The player from behind with the shirt color, the name and the number, and the ball at his feet. While a celebration
 * plays (`play`), he moves and his arms follow its pose. The frame loop runs here, so only the preview redraws per frame.
 */
function Preview({ look, label, play }: { look: Look; label: string; play: { celebration: Celebration; n: number } | null }): ReactElement {
  const playing = useCelebrationPose(play);
  const shirt = css(look.shirtColor);
  const ink = isLight(look.shirtColor) ? css(COLOR.ink) : css(COLOR.chalk);
  const pose = playing?.pose ?? REST;
  const { x, y, scale } = PREVIEW_FIGURE;
  // The preview moves half as far as the game, so a jump stays near the picture.
  const move = `translate(${pose.x * scale * 0.5} ${pose.y * scale * 0.5}) rotate(${degrees(pose.turn)} ${x} ${y + TURN_CENTER_Y * scale})`;
  return (
    <figure
      className="locker-preview"
      data-testid="locker-preview"
      data-ball={`ball.${look.ball}`}
      data-celebration={playing?.celebration ?? ''}
      aria-label={label}
    >
      <svg width="160" height="200" viewBox="0 0 160 200" overflow="visible" aria-hidden="true">
        <g transform={move}>
        {playing === null && (
          <>
            <rect x="20" y="64" width="14" height="30" fill={shirt} />
            <rect x="106" y="64" width="14" height="30" fill={shirt} />
          </>
        )}
        <rect x="30" y="60" width="80" height="80" rx="12" fill={shirt} />
        {playing !== null && (
          <g transform={`translate(${x} ${y}) scale(${scale})`}>
            <PoseArms pose={pose} shirt={shirt} />
          </g>
        )}
        <circle cx="70" cy="34" r="24" fill={css(COLOR.hair)} />
        <text x="70" y="80" textAnchor="middle" fontSize="12" fontWeight="800" fill={ink} data-testid="preview-name">
          {look.shirtName.toUpperCase()}
        </text>
        <text x="70" y="122" textAnchor="middle" fontSize="38" fontWeight="800" fill={ink} data-testid="preview-number">
          {look.shirtNumber}
        </text>
        <rect x="36" y="140" width="30" height="30" fill={css(COLOR.chalk)} />
        <rect x="74" y="140" width="30" height="30" fill={css(COLOR.chalk)} />
        <rect x="40" y="170" width="22" height="26" fill={css(COLOR.skin)} />
        <rect x="78" y="170" width="22" height="26" fill={css(COLOR.skin)} />
        </g>
      </svg>
      <BallIcon design={look.ball} size={48} />
    </figure>
  );
}

function ItemPicture({ item, shirt }: { item: LockerItem; shirt: string }): ReactElement {
  if (item.kind === 'ball') return <BallIcon design={ballDesign(item.id)} />;
  if (item.kind === 'celebration') return <CelebrationIcon celebration={celebrationOf(item.id)} shirt={shirt} />;
  if (item.kind === 'trail') return <TrailIcon trail={trailOf(item.id)} />;
  if (item.kind === 'goalEffect') return <GoalEffectIcon effect={goalEffectOf(item.id)} />;
  if (item.kind === 'mascot') return <MascotIcon mascot={mascotOf(item.id)} />;
  if (item.kind === 'stands') return <StandsIcon stands={standsOf(item.id)} />;
  if (item.kind === 'floodlight') return <FloodlightIcon floodlight={floodlightOf(item.id)} />;
  if (item.kind === 'weather') return <WeatherIcon weather={weatherOf(item.id)} />;
  return <span className={`locker-swatch locker-swatch-${item.kind}`} style={{ background: css(item.color ?? 0) }} aria-hidden="true" />;
}

export function LockerRoom({ locker, onChange, onBack, trophies = [], focus = null }: Props): ReactElement {
  const L = t().lockerRoom;
  const [question, setQuestion] = useState<Question | null>(null);
  const [modePlay, setModePlay] = useState<Record<UnlockMode, number>>({ wall: 0, keeper: 0, shootout: 0 });
  const modesGroup = useRef<HTMLElement>(null);
  const [numberText, setNumberText] = useState(String(locker.shirtNumber));
  const [play, setPlay] = useState<{ celebration: Celebration; n: number } | null>(null);
  const [extrasPlay, setExtrasPlay] = useState<ExtrasPlay | null>(null);
  const [stadiumPlay, setStadiumPlay] = useState<StadiumPlay | null>(null);
  const look = lookOf(locker);
  const latest = useRef({ question, onBack });
  latest.current = { question, onBack };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (latest.current.question) setQuestion(null);
      else latest.current.onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Opened from a locked mode on the start screen: "Spielarten" shows first.
  useEffect(() => {
    if (focus === 'modes') modesGroup.current?.scrollIntoView?.({ block: 'start' });
  }, [focus]);

  const choose = (item: LockerItem) => {
    // A celebration plays on the preview with every tap, also before it is bought (FR-113).
    if (item.kind === 'celebration') setPlay((p) => ({ celebration: celebrationOf(item.id), n: (p?.n ?? 0) + 1 }));
    // A trail, a goal effect or a mascot plays on the small stadium, also before it is bought (FR-139).
    const n = (extrasPlay?.n ?? 0) + 1;
    if (item.kind === 'trail') setExtrasPlay({ kind: 'trail', name: trailOf(item.id), n });
    if (item.kind === 'goalEffect') setExtrasPlay({ kind: 'goalEffect', name: goalEffectOf(item.id), n });
    if (item.kind === 'mascot') setExtrasPlay({ kind: 'mascot', name: mascotOf(item.id), n });
    // Stands, a floodlight color or a weather shows on the stadium preview, also before it is bought (FR-139).
    const m = (stadiumPlay?.n ?? 0) + 1;
    if (item.kind === 'stands') setStadiumPlay({ kind: 'stands', name: standsOf(item.id), n: m });
    if (item.kind === 'floodlight') setStadiumPlay({ kind: 'floodlight', name: floodlightOf(item.id), n: m });
    if (item.kind === 'weather') setStadiumPlay({ kind: 'weather', name: weatherOf(item.id), n: m });
    if (isOwned(locker, item.id)) onChange(equip(locker, item.kind, item.id));
    else if (canBuy(locker, item.id)) setQuestion({ text: L.buyQuestion(item.price), apply: (l) => buy(l, item.id) });
  };

  const chooseMode = (mode: UnlockMode) => {
    setModePlay((p) => ({ ...p, [mode]: p[mode] + 1 }));
    const lock = modeLock(locker, mode);
    if (lock.kind === 'affordable') setQuestion({ text: L.unlockQuestion(lock.price), apply: (l) => unlockMode(l, mode) });
  };

  const answer = (yes: boolean) => {
    if (yes && question) onChange(question.apply(locker));
    setQuestion(null);
  };

  const typeNumber = (typed: string) => {
    const digits = typed.replace(/\D/g, '').slice(0, 2);
    setNumberText(digits);
    const next = setShirtNumber(locker, Number(digits));
    if (next !== locker) onChange(next);
  };

  const items = (kind: ItemKind) => (
    <div className="locker-items">
      {ITEMS.filter((i) => i.kind === kind).map((item) => {
        const owned = isOwned(locker, item.id);
        const open = owned || canBuy(locker, item.id);
        const isChosen = chosen(locker, kind) === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className="locker-item"
            data-testid={`item-${item.id}`}
            data-owned={String(owned)}
            data-locked={String(!open)}
            data-chosen={String(isChosen)}
            aria-disabled={open ? undefined : 'true'}
            aria-pressed={owned ? isChosen : undefined}
            onClick={() => choose(item)}
          >
            <ItemPicture item={item} shirt={css(look.shirtColor)} />
            <span className="locker-item-name">{L.items[item.id]}</span>
            {!owned && <span className="locker-item-price">{open ? L.price(item.price) : L.stillNeeded(starsNeeded(locker, item.id))}</span>}
            {isChosen && <span className="locker-item-chosen">{L.chosen}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="locker-room" lang="de" data-testid="locker-room" data-stars={locker.stars} aria-label={L.title}>
      <header className="locker-header">
        <h1>{L.title}</h1>
        <span className="star-total" data-testid="locker-stars">
          {t().start.stars(locker.stars)}
        </span>
        <button type="button" onClick={onBack}>
          {L.back}
        </button>
      </header>
      <div className="locker-body">
        <div className="locker-previews">
          <Preview look={look} label={L.preview} play={play} />
          <ExtrasPreview mascot={look.mascot} ball={look.ball} play={extrasPlay} label={L.extrasPreview} />
          <StadiumPreview
            stands={look.stands}
            floodlight={look.floodlight}
            weather={look.weather}
            name={look.stadiumName}
            play={stadiumPlay}
            label={L.stadiumPreview}
          />
        </div>
        <div className="locker-groups">
          {(['ball', 'shirt'] as const).map((kind) => (
            <section key={kind} className="locker-group" aria-label={L.groups[GROUP[kind]]}>
              <h2>{L.groups[GROUP[kind]]}</h2>
              {items(kind)}
            </section>
          ))}
          <section className="locker-group" aria-label={L.groups.numberName}>
            <h2>{L.groups.numberName}</h2>
            <div className="locker-fields">
              <label>
                {L.shirtNumber}
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid="shirt-number"
                  value={numberText}
                  maxLength={2}
                  aria-describedby="shirt-number-hint"
                  onChange={(e) => typeNumber(e.target.value)}
                  onBlur={() => setNumberText(String(locker.shirtNumber))}
                />
                <span id="shirt-number-hint" className="hint">
                  {L.shirtNumberHint}
                </span>
              </label>
              <label>
                {L.shirtName}
                <input
                  type="text"
                  data-testid="shirt-name"
                  value={locker.shirtName}
                  maxLength={SHIRT_NAME_MAX}
                  autoComplete="off"
                  aria-describedby="shirt-name-hint"
                  onChange={(e) => onChange(setShirtName(locker, e.target.value))}
                />
                <span id="shirt-name-hint" className="hint">
                  {L.shirtNameHint}
                </span>
              </label>
            </div>
          </section>
          <section className="locker-group" aria-label={L.groups.fans}>
            <h2>{L.groups.fans}</h2>
            {items('scarf')}
          </section>
          <section className="locker-group" aria-label={L.groups.celebration}>
            <h2>{L.groups.celebration}</h2>
            {items('celebration')}
          </section>
          {(['trail', 'goalEffect', 'mascot'] as const).map((kind) => (
            <section key={kind} className="locker-group" aria-label={L.groups[GROUP[kind]]}>
              <h2>{L.groups[GROUP[kind]]}</h2>
              {items(kind)}
            </section>
          ))}
          <section className="locker-group" aria-label={L.groups.stadium}>
            <h2>{L.groups.stadium}</h2>
            <div className="locker-fields">
              <label>
                {L.stadiumName}
                <input
                  type="text"
                  data-testid="stadium-name"
                  value={locker.stadiumName}
                  maxLength={STADIUM_NAME_MAX}
                  autoComplete="off"
                  aria-describedby="stadium-name-hint"
                  onChange={(e) => onChange(setStadiumName(locker, e.target.value))}
                />
                <span id="stadium-name-hint" className="hint">
                  {L.stadiumNameHint}
                </span>
              </label>
            </div>
            <h3>{L.stands}</h3>
            {items('stands')}
            <h3>{L.floodlight}</h3>
            {items('floodlight')}
          </section>
          <section className="locker-group" aria-label={L.groups.weather}>
            <h2>{L.groups.weather}</h2>
            {items('weather')}
          </section>
          <section className="locker-group" aria-label={L.groups.modes} data-testid="locker-modes" ref={modesGroup}>
            <h2>{L.groups.modes}</h2>
            <div className="locker-items">
              {UNLOCK_MODES.map((mode) => {
                const lock = modeLock(locker, mode);
                // A locked mode shows its price, and what is still missing (FR-140).
                let missing: string | null = null;
                if (lock.kind === 'needs') missing = L.needsFirst(L.modes[lock.mode]);
                else if (lock.kind === 'stars') missing = L.stillNeeded(lock.needed);
                return (
                  <button
                    key={mode}
                    type="button"
                    className="locker-item locker-mode"
                    data-testid={`mode-${mode}`}
                    data-unlocked={String(lock.kind === 'unlocked')}
                    data-lock={lock.kind}
                    data-locked={String(lock.kind === 'needs' || lock.kind === 'stars')}
                    aria-disabled={lock.kind === 'needs' || lock.kind === 'stars' ? 'true' : undefined}
                    onClick={() => chooseMode(mode)}
                  >
                    <ModePreview mode={mode} play={modePlay[mode]} />
                    <span className="locker-item-name">{L.modes[mode]}</span>
                    {lock.kind === 'unlocked' ? (
                      <span className="locker-item-chosen">{L.unlocked}</span>
                    ) : (
                      <span className="locker-item-price">{L.price(MODE_OFFERS[mode].price)}</span>
                    )}
                    {missing !== null && <span className="locker-item-price">{missing}</span>}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="locker-group" aria-label={L.groups.trophies}>
            <h2>{L.groups.trophies}</h2>
            <ul className="trophy-shelf" data-testid="trophy-shelf" data-trophies={trophies.length}>
              {trophies.length === 0 && <li className="trophy-empty">{L.emptyShelf}</li>}
              {trophies.map((trophy) => (
                <li key={trophy.cup} className="trophy" data-testid="trophy">
                  <TrophyIcon size={56} />
                  <span>{L.trophy(trophy.cup)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      {question && (
        <div className="parent-menu-backdrop">
          <div className="parent-menu" role="dialog" aria-modal="true" data-testid="buy-question" aria-labelledby="buy-question-text">
            <p id="buy-question-text">{question.text}</p>
            <div className="round-end-buttons">
              <button type="button" className="primary" onClick={() => answer(true)}>
                {L.yes}
              </button>
              <button type="button" onClick={() => answer(false)}>
                {L.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
