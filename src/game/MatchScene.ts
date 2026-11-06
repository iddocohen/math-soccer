/**
 * The match scene (FR-001, FR-003, FR-012, FR-021, FR-022; contracts/screens.md "Feedback contract"). It only draws
 * MatchController state and tells the controller when an animation has ended; all rules live in src/core.
 *
 * - Composes the views: the stadium backdrop, StandsView, GoalView, HelperView (the row and column helper, amendment 10),
 *   KeeperView, PlayerView and BallView. The look from the locker room (ball design, shirt color, number and name, scarf color)
 *   applies on every draw, so a changed look shows without a new round (FR-043).
 * - Subscribes to the controller in create() and unsubscribes on shutdown.
 * - When the phase becomes `ballInFlight`, the player kicks and the ball flies to the `cellRect` of the typed number.
 *   When it arrives the scene calls `ballLanded()`. A goal sends the ball into the net, the fans cheer, and after
 *   CELEBRATION_MS the scene calls `celebrationDone()`.
 * - The keeper (T054, FR-020): on every shot he leaps toward the ball, timed with its flight. A wrong number lands in
 *   his gloves: he holds it, the ball fades, and the fans slump with a soft "ohhh" and then clap. The correct number
 *   goes past his gloves into the net and he lands on the grass. The keeper's phase goes to `onKeeper`.
 * - Sounds: a kick on every shot, a cheer on a goal, the "ohhh" with clapping on a miss.
 * - While the round is paused the scene's tweens, timers and fans stop, so a flight or a celebration goes on where it
 *   stopped.
 * - The controller's state can be ahead of the scene: a shot typed before the scene was created flies when it starts.
 * - preload() loads the bundled grass texture and the classic ball's rotation sprite (amendment 03, FR-057, FR-058).
 *   A file that fails to load leaves the drawn pitch or the drawn ball in its place.
 */
import Phaser from 'phaser';
import { ballKind, cellRect, layoutChart } from '../core/chart/layout';
import { onlyTimeChanged, type MatchController, type MatchView } from '../core/match/MatchController';
import { helpHint, HINT_STEP, hintsVisible, targetHintDisplay } from '../core/match/help';
import { CHART_RECT, GOAL_FRAME, STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import type { Settings } from '../core/settings/schema';
import { BallView } from './BallView';
import { GoalView } from './GoalView';
import { HelperView } from './HelperView';
import { HOLD_MS, KeeperView, type KeeperPhase } from './KeeperView';
import { squaresToKeepClear } from './keeperDive';
import { lookKey, lookOf, type Look } from '../core/rewards/lockerRoom';
import { emptyLockerRoom } from '../core/storage/schemas';
import { COLOR, css } from './palette';
import { PlayerView } from './PlayerView';
import { StandsView } from './StandsView';
import { ensureTextures } from './textures';
import { ASSET, assetUrl } from '../assets';
import { BALL_SPRITE, SPRITE_FRAME_SIZE } from './ballArt';

/** How long the goal celebration lasts before the next target (game time). */
export const CELEBRATION_MS = 1400;

/** The sounds the scene plays (src/audio/sfx.ts). */
export interface MatchSounds {
  kick(): void;
  cheer(): void;
  ohh(): void;
}

export interface MatchSceneOptions {
  sounds?: MatchSounds;
  /** The parent's settings; the scene reads the hint display ("immer" or "auf Wunsch") and the row and column helper. */
  settings: () => Settings;
  /**
   * The look chosen in the locker room (ball design, shirt, scarves). Read on every draw, so a new look shows at the
   * next change of the match state; the starter look without it.
   */
  look?: () => Look;
  /** Hears the keeper's phase in goalkeeper mode (`data-keeper` for tests). */
  onKeeper?: (phase: KeeperPhase) => void;
}

const BACKDROP_TEXTURE = 'stadium';
const GRASS_TEXTURE = 'grass';
/** The grass tile is drawn at this part of its 512 px, so the blades look small from the stands' view. */
const GRASS_TILE_SCALE = 0.5;

export class MatchScene extends Phaser.Scene {
  private readonly controller: MatchController;
  private readonly options: MatchSceneOptions;
  private unsubscribe: (() => void) | null = null;
  private stands!: StandsView;
  private goal!: GoalView;
  private helper!: HelperView;
  private keeper!: KeeperView;
  private player!: PlayerView;
  private ball!: BallView;
  private prev: MatchView | null = null;
  /** True from the kick until the scene has called `ballLanded()`. */
  private flying = false;
  /** True while the ball of the last goal lies in the net. */
  private ballInNet = false;
  private celebration: Phaser.Time.TimerEvent | null = null;
  private pausedNow = false;
  /** The look the views show, as `lookKey`. */
  private lookKey = '';

  constructor(controller: MatchController, options: MatchSceneOptions) {
    super('match');
    this.controller = controller;
    this.options = options;
  }

  preload(): void {
    if (!this.textures.exists(GRASS_TEXTURE)) this.load.image(GRASS_TEXTURE, assetUrl(ASSET.grass));
    if (!this.textures.exists(BALL_SPRITE)) {
      this.load.spritesheet(BALL_SPRITE, assetUrl(ASSET.ballSprite), { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE });
    }
  }

  create(): void {
    ensureTextures(this);
    this.drawBackdrop();
    const look = this.currentLook();
    this.lookKey = lookKey(look);
    this.stands = new StandsView(this, look.scarfColor);
    this.goal = new GoalView(this);
    this.helper = new HelperView(this);
    this.keeper = new KeeperView(this, this.options.onKeeper);
    this.player = new PlayerView(this, look);
    const s = this.controller.getState();
    this.ball = new BallView(this, ballKind(layoutChart(s.min, s.max)), look.ball);
    this.prev = null;
    this.flying = false;
    this.ballInNet = false;
    this.celebration = null;
    this.pausedNow = false;

    this.unsubscribe = this.controller.subscribe(() => this.draw(this.controller.getState()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
    this.draw(s);
  }

  update(_time: number, delta: number): void {
    if (!this.pausedNow) this.stands.update(delta);
  }

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.celebration?.remove();
    this.celebration = null;
  }

  private draw(s: MatchView): void {
    const prev = this.prev;
    this.prev = s;
    if (!s.started) return;
    // A clock tick changes nothing the scene draws.
    if (prev !== null && onlyTimeChanged(prev, s)) return;
    const layout = layoutChart(s.min, s.max);

    if (prev === null || this.isNewRound(prev, s)) {
      this.celebration?.remove();
      this.celebration = null;
      this.flying = false;
      this.ballInNet = false;
      this.ball.reset();
      this.keeper.reset();
      this.stands.calm();
    }
    // The waiting keeper leaves the target, hint and waiting shape squares visible (FR-064).
    if (s.target) {
      this.keeper.keepClear(squaresToKeepClear(s.target).map((n) => cellRect(layout, CHART_RECT, n)));
    }
    this.refreshLook(s);

    const hintsShown = hintsVisible(targetHintDisplay(this.options.settings(), s.target), s.helpStep);
    const hintFrom = s.helpStep >= HINT_STEP ? (helpHint(layout, s.target)?.from ?? null) : null;
    this.goal.update({ layout, target: s.target, hintsVisible: hintsShown, helpStep: s.helpStep, shown: s.shown?.number ?? null, hintFrom });
    this.helper.update(layout, s.target, s.helpStep, this.options.settings().rowColumnHelper);

    this.setPaused(s.paused);

    if (s.phase === 'ballInFlight' && s.ball && !this.flying) this.kick(s.ball.number);
    // After the celebration the next target shows and the ball waits at the kick spot again.
    if (s.phase === 'aiming' && s.ball === null && this.ballInNet) {
      this.ballInNet = false;
      this.ball.reset();
    }
  }

  private currentLook(): Look {
    return this.options.look?.() ?? lookOf(emptyLockerRoom());
  }

  /**
   * Shows the current look at once, without a state change: after the locker room over the match closes on a round the
   * child paused (FR-049).
   */
  showLook(): void {
    if (!this.player) return;
    this.refreshLook(this.controller.getState());
  }

  /** Shows the current look on the player, the scarves and the ball of the chart size of `s`. */
  private refreshLook(s: MatchView): void {
    const look = this.currentLook();
    this.applyLook(look);
    this.ball.setLook(ballKind(layoutChart(s.min, s.max)), look.ball);
  }

  /** Redraws the shirt and recolors the scarves when the look changed. */
  private applyLook(look: Look): void {
    const key = lookKey(look);
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.player.setLook(look);
    this.stands.setScarfColor(look.scarfColor);
  }

  /** A round started again: from the start screen or with "Nochmal" (the seed can stay the same with `?seed=`). */
  private isNewRound(prev: MatchView, s: MatchView): boolean {
    return prev.seed !== s.seed || s.targetCount < prev.targetCount || (prev.phase === 'roundOver' && s.phase !== 'roundOver');
  }

  private kick(n: number): void {
    const s = this.controller.getState();
    this.flying = true;
    this.ballInNet = false;
    this.options.sounds?.kick();
    this.player.kick();
    const square = cellRect(layoutChart(s.min, s.max), CHART_RECT, n);
    // The same rule as the controller's: the target number scores, any other number is caught.
    this.keeper.dive(square, n === s.target?.number ? 'beaten' : 'catch');
    this.ball.fly(square, () => this.arrived());
  }

  private arrived(): void {
    this.flying = false;
    this.controller.ballLanded();
    const s = this.controller.getState();
    if (s.ball?.outcome === 'goal') {
      this.ballInNet = true;
      this.ball.intoNet();
      this.keeper.beaten();
      this.stands.cheer();
      this.options.sounds?.cheer();
      this.celebration = this.time.delayedCall(CELEBRATION_MS, () => {
        this.celebration = null;
        this.controller.celebrationDone();
      });
    } else if (s.ball?.outcome === 'miss') {
      this.keeper.catchBall();
      this.ball.caught(HOLD_MS);
      this.stands.ohh();
      this.options.sounds?.ohh();
    }
  }

  private setPaused(paused: boolean): void {
    if (paused === this.pausedNow) return;
    this.pausedNow = paused;
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = paused;
  }

  /** The evening stadium behind everything, drawn once: sky, floodlights, stand rows, pitch and chalk lines. */
  private drawBackdrop(): void {
    if (!this.textures.exists(BACKDROP_TEXTURE)) {
      const texture = this.textures.createCanvas(BACKDROP_TEXTURE, WORLD_WIDTH, WORLD_HEIGHT);
      if (texture) {
        const grass = this.textures.exists(GRASS_TEXTURE) ? (this.textures.get(GRASS_TEXTURE).getSourceImage() as CanvasImageSource) : null;
        paintStadium(texture.getContext(), grass);
        texture.refresh();
      }
    }
    this.add.image(0, 0, BACKDROP_TEXTURE).setOrigin(0, 0).setDepth(0);
  }
}

/**
 * Paints the stadium after the prototype (specs/001-math-soccer/prototype/index.html), scaled to the world. The pitch is
 * the tiled grass texture, darkened toward the evening sky, or a drawn green without it (FR-057).
 */
function paintStadium(g: CanvasRenderingContext2D, grassImage: CanvasImageSource | null): void {
  const W = WORLD_WIDTH;
  const H = WORLD_HEIGHT;
  const top = STANDS_BOTTOM + 30;
  const sky = g.createLinearGradient(0, 0, 0, top);
  sky.addColorStop(0, '#0b1622');
  sky.addColorStop(1, '#1b3247');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, top);
  for (const x of [130, W - 130]) {
    g.fillStyle = '#fff8d6';
    g.fillRect(x - 36, 26, 72, 16);
    g.fillStyle = 'rgb(255 248 214 / 6%)';
    g.beginPath();
    g.moveTo(x - 36, 42);
    g.lineTo(x - 230, top);
    g.lineTo(x + 230, top);
    g.lineTo(x + 36, 42);
    g.fill();
  }
  for (let row = 0; row < 4; row++) {
    g.fillStyle = row % 2 ? '#22384c' : '#1d3044';
    g.fillRect(0, 60 + row * 48 + 14, W, 44);
  }
  const pattern = grassImage ? g.createPattern(grassImage, 'repeat') : null;
  if (pattern) {
    pattern.setTransform(new DOMMatrix().scale(GRASS_TILE_SCALE));
    g.fillStyle = pattern;
    g.fillRect(0, top, W, H - top);
    // Darker far away under the evening sky, lighter near the player under the floodlights.
    const dusk = g.createLinearGradient(0, top, 0, H);
    dusk.addColorStop(0, 'rgb(6 20 14 / 62%)');
    dusk.addColorStop(1, 'rgb(6 20 14 / 38%)');
    g.fillStyle = dusk;
    g.fillRect(0, top, W, H - top);
  } else {
    const grass = g.createLinearGradient(0, top, 0, H);
    grass.addColorStop(0, '#24612f');
    grass.addColorStop(1, '#3a8a46');
    g.fillStyle = grass;
    g.fillRect(0, top, W, H - top);
  }
  const stripe = (H - top) / 6;
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? 'rgb(255 255 255 / 3%)' : 'rgb(0 0 0 / 4%)';
    g.fillRect(0, top + i * stripe, W, stripe);
  }
  // The goal line and the sides of the penalty area.
  const line = GOAL_FRAME.y + GOAL_FRAME.height;
  g.strokeStyle = css(COLOR.chalk, 0.7);
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(100, line);
  g.lineTo(W - 100, line);
  g.moveTo(170, line);
  g.lineTo(70, H);
  g.moveTo(W - 170, line);
  g.lineTo(W - 70, H);
  g.stroke();
}
