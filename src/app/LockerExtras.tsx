/**
 * The locker room's pictures and preview for the ball trails, goal effects and mascots (amendment 20, FR-139). The
 * shapes and the motion are the match's own (src/game/effects.ts, particles.ts, mascot.ts), drawn here as SVG.
 *
 * - Each item button shows a small picture: the ball with its trail, the effect, or the animal's head.
 * - The preview ("Vorschau") is a small stadium in world units with the chosen mascot beside the goal. A tap on an item
 *   plays it there, also before it is bought, as a celebration plays on the player (FR-113): a trail follows a shot
 *   to the goal, an effect plays over the stands with the mascot cheering, and a mascot appears and cheers.
 * - For tests: `data-testid="extras-preview"` with `data-mascot` (the mascot shown) and `data-playing` (the item id
 *   while it plays, empty otherwise).
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { createRng } from '../core/rng';
import { CHART_RECT, GOAL_FRAME, KICK_SPOT, STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import { BALL_COLORS, type BallDesign, type GoalEffect, type Mascot, type Trail } from '../core/rewards/items';
import { BEAM_SIZE, goalEffectParticles, PARTICLE_TEXTURE_SIZE, PIECE_SIZE, TRAIL_FADE_MS, TRAIL_STYLE, trailParticle } from '../game/effects';
import { ARM_LENGTH, ARM_WIDTH, MASCOT_ART, MASCOT_CHEER_MS, MASCOT_FEET, MASCOT_SCALE, mascotPose, PAW_RADIUS, SHOULDER, type MascotPose, type MascotShape, type ShownMascot } from '../game/mascot';
import { particleAt, particleEnd, type ParticleInit } from '../game/particles';
import { css } from '../game/palette';

/** What a tap plays on the preview. `n` counts the taps, so a second tap on the same item plays it again. */
export type ExtrasPlay = { kind: 'trail'; name: Trail; n: number } | { kind: 'goalEffect'; name: GoalEffect; n: number } | { kind: 'mascot'; name: Mascot; n: number };

/** The shot in the preview: as in the match (BallView), from the kick spot to a square in the chart. */
const SHOT = { to: { x: 1010, y: 420 }, ms: 800, arc: 120, size: 40, endSize: 22 } as const;

function ballAt(ms: number): { x: number; y: number; size: number } {
  const k = Math.min(1, ms / SHOT.ms);
  const e = 1 - (1 - k) * (1 - k);
  const ground = KICK_SPOT.y + (SHOT.to.y - KICK_SPOT.y) * e;
  return { x: KICK_SPOT.x + (SHOT.to.x - KICK_SPOT.x) * e, y: ground - Math.sin(Math.PI * k) * SHOT.arc, size: SHOT.size + (SHOT.endSize - SHOT.size) * e };
}

/** A particle with the time it was spawned in the preview. */
interface Timed {
  at: number;
  p: ParticleInit;
  /** Drawn over the goal and the mascot; otherwise behind the goal, over the stands. */
  front: boolean;
}

/** The particles of a play and when it ends. */
function particlesOf(play: ExtrasPlay): { timed: Timed[]; ms: number } {
  const rng = createRng(7 + play.n);
  const rand = () => rng.next();
  if (play.kind === 'trail') {
    const timed: Timed[] = [];
    if (play.name !== 'none') {
      const every = 1000 / TRAIL_STYLE[play.name].rate;
      for (let at = 0, n = 0; at <= SHOT.ms; at += every, n++) {
        const b = ballAt(at);
        timed.push({ at, p: trailParticle(play.name, b.x, b.y, b.size, n, rand), front: true });
      }
    }
    return { timed, ms: SHOT.ms + TRAIL_FADE_MS };
  }
  if (play.kind === 'goalEffect' && play.name !== 'none') {
    const { back, front } = goalEffectParticles(play.name, rand);
    const timed = [...back.map((p) => ({ at: 0, p, front: false })), ...front.map((p) => ({ at: 0, p, front: true }))];
    return { timed, ms: Math.max(MASCOT_CHEER_MS, ...timed.map((t) => particleEnd(t.p))) };
  }
  return { timed: [], ms: MASCOT_CHEER_MS };
}

/** Milliseconds since `play` started, while it runs; null otherwise. */
function usePlayClock(play: ExtrasPlay | null, ms: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (play === null) return;
    const started = performance.now();
    let frame = 0;
    const step = () => {
      const t = performance.now() - started;
      if (t >= ms) {
        setNow(null);
        return;
      }
      setNow(t);
      frame = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(frame);
  }, [play, ms]);
  return now;
}

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 0.5 : 0.2;
  const a = (i * Math.PI) / 5 - Math.PI / 2;
  return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
}).join(' ');

const deg = (rad: number) => (rad * 180) / Math.PI;

/** One particle at one moment, in world units. */
function ParticleSvg({ p, ms }: { p: ParticleInit; ms: number }): ReactElement | null {
  const s = particleAt(p, ms);
  if (s === null) return null;
  const fill = css(p.tint);
  const size = s.scale * PARTICLE_TEXTURE_SIZE;
  switch (p.shape) {
    case 'dot':
      return <circle cx={s.x} cy={s.y} r={size * 0.38} fill={fill} opacity={s.alpha} />;
    case 'star':
      return <polygon points={STAR_POINTS} fill={fill} opacity={s.alpha} transform={`translate(${s.x} ${s.y}) rotate(${deg(s.rotation)}) scale(${size})`} />;
    case 'piece':
      return (
        <rect
          x={-PIECE_SIZE.width / 2}
          y={-PIECE_SIZE.height / 2}
          width={PIECE_SIZE.width}
          height={PIECE_SIZE.height}
          fill={fill}
          opacity={s.alpha}
          transform={`translate(${s.x} ${s.y}) rotate(${deg(s.rotation)}) scale(${s.scale})`}
        />
      );
    case 'beam': {
      const { width: w, height: h } = BEAM_SIZE;
      return (
        <polygon
          points={`-8,0 ${-w / 2},${-h} ${w / 2},${-h} 8,0`}
          fill={fill}
          opacity={s.alpha * 0.6}
          transform={`translate(${s.x} ${s.y}) rotate(${deg(s.rotation)}) scale(${s.scale})`}
        />
      );
    }
  }
}

function ShapeSvg({ s }: { s: MascotShape }): ReactElement {
  switch (s.type) {
    case 'circle':
      return <circle cx={s.x} cy={s.y} r={s.r} fill={css(s.color)} />;
    case 'ellipse':
      return <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={css(s.color)} />;
    case 'triangle':
      return <polygon points={s.points.join(' ')} fill={css(s.color)} />;
    case 'smile': {
      const a0 = Math.PI * 0.15;
      const a1 = Math.PI * 0.85;
      const d = `M ${s.x + Math.cos(a0) * s.r} ${s.y + Math.sin(a0) * s.r} A ${s.r} ${s.r} 0 0 1 ${s.x + Math.cos(a1) * s.r} ${s.y + Math.sin(a1) * s.r}`;
      return <path d={d} fill="none" stroke={css(s.color)} strokeWidth={s.width} strokeLinecap="round" />;
    }
  }
}

/** A mascot in art units (feet at 0, 0) in a pose. */
export function MascotFigure({ mascot, pose }: { mascot: ShownMascot; pose: MascotPose }): ReactElement {
  const art = MASCOT_ART[mascot];
  return (
    <g transform={`translate(0 ${-pose.lift})`}>
      {art.shapes.map((s, i) => (
        <ShapeSvg key={i} s={s} />
      ))}
      {([-1, 1] as const).map((side) => (
        <g key={side} transform={`translate(${side * SHOULDER.x} ${SHOULDER.y}) rotate(${deg(side < 0 ? pose.left : pose.right)})`}>
          <line x1={0} y1={0} x2={0} y2={ARM_LENGTH} stroke={css(art.arm.color)} strokeWidth={ARM_WIDTH} strokeLinecap="round" />
          <circle cx={0} cy={ARM_LENGTH} r={PAW_RADIUS} fill={css(art.arm.paw)} />
        </g>
      ))}
    </g>
  );
}

const IDLE = mascotPose('idle', 0);

interface PreviewProps {
  /** The chosen mascot and ball. */
  mascot: Mascot;
  ball: BallDesign;
  play: ExtrasPlay | null;
  label: string;
}

/** The small stadium where a tapped trail, goal effect or mascot plays (FR-139). */
export function ExtrasPreview({ mascot, ball, play, label }: PreviewProps): ReactElement {
  const { timed, ms } = useMemo(() => (play ? particlesOf(play) : { timed: [], ms: 0 }), [play]);
  const t = usePlayClock(play, ms);
  const playing = t !== null && play !== null ? play : null;
  const shown: Mascot = playing?.kind === 'mascot' ? playing.name : mascot;
  const cheering = playing !== null && playing.kind !== 'trail';
  const pose = cheering ? mascotPose('cheer', t!) : IDLE;
  const shot = playing?.kind === 'trail' ? ballAt(t!) : null;
  return (
    <figure className="locker-extras-preview" data-testid="extras-preview" data-mascot={shown} data-playing={playing ? `${playing.kind}.${playing.name}` : ''} aria-label={label}>
      <svg width="320" height="200" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} aria-hidden="true">
        <rect x={0} y={0} width={WORLD_WIDTH} height={STANDS_BOTTOM + 30} fill="#13263a" />
        {[0, 1, 2, 3].map((row) => (
          <rect key={row} x={0} y={74 + row * 48} width={WORLD_WIDTH} height={44} fill={row % 2 ? '#22384c' : '#1d3044'} />
        ))}
        <rect x={0} y={STANDS_BOTTOM + 30} width={WORLD_WIDTH} height={WORLD_HEIGHT - STANDS_BOTTOM - 30} fill="#2c6b37" />
        {t !== null && timed.filter((x) => !x.front).map((x, i) => <ParticleSvg key={`b${i}`} p={x.p} ms={t - x.at} />)}
        <rect x={GOAL_FRAME.x} y={GOAL_FRAME.y} width={GOAL_FRAME.width} height={GOAL_FRAME.height} fill="#0e1a14" stroke="#f4f6ef" strokeWidth={22} />
        <rect x={CHART_RECT.x} y={CHART_RECT.y} width={CHART_RECT.width} height={CHART_RECT.height} fill="#f4f6ef" opacity={0.85} rx={12} />
        {shown !== 'none' && (
          <g transform={`translate(${MASCOT_FEET.x} ${MASCOT_FEET.y}) scale(${MASCOT_SCALE})`}>
            <MascotFigure mascot={shown} pose={pose} />
          </g>
        )}
        {t !== null && timed.filter((x) => x.front).map((x, i) => <ParticleSvg key={`f${i}`} p={x.p} ms={t - x.at} />)}
        {shot && t! < SHOT.ms && <circle cx={shot.x} cy={shot.y} r={shot.size / 2} fill={css(BALL_COLORS[ball].fill)} stroke="#12202c" strokeWidth={3} />}
      </svg>
    </figure>
  );
}

/** A ball with its trail, for the item button. */
export function TrailIcon({ trail }: { trail: Trail }): ReactElement {
  const dots = trail === 'none' ? [] : Array.from({ length: 6 }, (_, i) => ({ x: 6 + i * 3.6, y: 34 - i * 3.4, r: 2 + i * 0.5, color: TRAIL_STYLE[trail].colors[i % TRAIL_STYLE[trail].colors.length]! }));
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
      {dots.map((d, i) =>
        trail === 'stars' ? (
          <polygon key={i} points={STAR_POINTS} fill={css(d.color)} transform={`translate(${d.x} ${d.y}) scale(${d.r * 2.6})`} />
        ) : (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={css(d.color)} opacity={0.5 + i * 0.08} />
        ),
      )}
      <circle cx={30} cy={12} r={7} fill="#ffffff" stroke="rgb(0 0 0 / 30%)" />
    </svg>
  );
}

/** A small picture of a goal effect, for the item button. */
export function GoalEffectIcon({ effect }: { effect: GoalEffect }): ReactElement {
  const colors = ['#f2c230', '#e74c3c', '#3498db', '#2ecc71', '#e07fb0'];
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
      {effect === 'none' && <rect x={6} y={14} width={28} height={18} fill="none" stroke="#f4f6ef" strokeWidth={3} />}
      {effect === 'confetti' &&
        Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={4 + ((i * 13) % 30)} y={4 + ((i * 7) % 30)} width={4} height={7} fill={colors[i % colors.length]} transform={`rotate(${i * 37} ${6 + ((i * 13) % 30)} ${8 + ((i * 7) % 30)})`} />
        ))}
      {effect === 'fireworks' &&
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={20 + Math.cos(a) * 13} cy={20 + Math.sin(a) * 13} r={2.4} fill={colors[i % 3]} />;
        })}
      {effect === 'lightShow' &&
        ['#ff4fd8', '#4fd8ff', '#ffe14f'].map((c, i) => <polygon key={c} points={`${10 + i * 10},38 ${2 + i * 12},4 ${14 + i * 10},4`} fill={c} opacity={0.75} />)}
    </svg>
  );
}

/** The animal's head and shoulders, for the item button; an empty circle for none. */
export function MascotIcon({ mascot }: { mascot: Mascot }): ReactElement {
  return (
    <svg width={40} height={40} viewBox="-80 -215 160 160" aria-hidden="true">
      {mascot === 'none' ? <circle cx={0} cy={-135} r={50} fill="none" stroke="#f4f6ef" strokeWidth={8} strokeDasharray="16 12" /> : <MascotFigure mascot={mascot} pose={IDLE} />}
    </svg>
  );
}
