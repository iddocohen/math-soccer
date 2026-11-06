/**
 * The match scene (FR-001, FR-003, FR-012, FR-021, FR-022; contracts/screens.md "Feedback contract"). It only draws
 * MatchController state and tells the controller when an animation has ended; all rules live in src/core.
 *
 * - Composes the views: the stadium backdrop, StandsView, GoalView, PlayerView and BallView.
 * - Subscribes to the controller in create() and unsubscribes on shutdown.
 * - When the phase becomes `ballInFlight`, the player kicks and the ball flies to the `cellRect` of the typed number.
 *   When it arrives the scene calls `ballLanded()`. A goal sends the ball into the net, the fans cheer, and after
 *   CELEBRATION_MS the scene calls `celebrationDone()`. A miss bounces the ball off the board, the fans slump with a
 *   soft "ohhh" and then clap. In line mode a correct square that is not the last of the line lights on the board
 *   (GoalView), the ball bounces off it, and the fans clap (FR-016, FR-021).
 * - Sounds: a kick on every shot, a cheer on a goal, clapping on a correct line square, the "ohhh" with clapping on a
 *   miss.
 * - While the round is paused the scene's tweens, timers and fans stop, so a flight or a celebration goes on where it
 *   stopped.
 * - The controller's state can be ahead of the scene: a shot typed before the scene was created flies when it starts.
 */
import Phaser from 'phaser';
import { ballKind, cellRect, layoutChart } from '../core/chart/layout';
import type { MatchController, MatchState } from '../core/match/MatchController';
import { helpHint, HINT_STEP, hintsVisible, targetHintDisplay } from '../core/match/help';
import { CHART_RECT, GOAL_FRAME, STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import type { Settings } from '../core/settings/schema';
import { BallView } from './BallView';
import { GoalView } from './GoalView';
import { COLOR, css, DEFAULT_LOOK, type Look } from './palette';
import { PlayerView } from './PlayerView';
import { StandsView } from './StandsView';
import { ensureTextures } from './textures';

/** How long the goal celebration lasts before the next target (game time). */
export const CELEBRATION_MS = 1400;

/** The sounds the scene plays (src/audio/sfx.ts). */
export interface MatchSounds {
  kick(): void;
  cheer(): void;
  clap(): void;
  ohh(): void;
}

export interface MatchSceneOptions {
  sounds?: MatchSounds;
  /** The parent's settings; the scene reads the hint display ("immer" or "auf Wunsch"). */
  settings: () => Settings;
  look?: Look;
}

const BACKDROP_TEXTURE = 'stadium';

export class MatchScene extends Phaser.Scene {
  private readonly controller: MatchController;
  private readonly options: MatchSceneOptions;
  private unsubscribe: (() => void) | null = null;
  private stands!: StandsView;
  private goal!: GoalView;
  private player!: PlayerView;
  private ball!: BallView;
  private prev: MatchState | null = null;
  /** True from the kick until the scene has called `ballLanded()`. */
  private flying = false;
  /** True while the ball of the last goal lies in the net. */
  private ballInNet = false;
  private celebration: Phaser.Time.TimerEvent | null = null;
  private pausedNow = false;

  constructor(controller: MatchController, options: MatchSceneOptions) {
    super('match');
    this.controller = controller;
    this.options = options;
  }

  create(): void {
    ensureTextures(this);
    this.drawBackdrop();
    const look = this.options.look ?? DEFAULT_LOOK;
    this.stands = new StandsView(this, look.scarfColor);
    this.goal = new GoalView(this);
    this.player = new PlayerView(this, look);
    const s = this.controller.getState();
    this.ball = new BallView(this, ballKind(layoutChart(s.min, s.max)));
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

  private draw(s: MatchState): void {
    const prev = this.prev;
    this.prev = s;
    if (!s.started) return;
    const layout = layoutChart(s.min, s.max);

    if (prev === null || this.isNewRound(prev, s)) {
      this.celebration?.remove();
      this.celebration = null;
      this.flying = false;
      this.ballInNet = false;
      this.ball.reset();
      this.stands.calm();
    }
    this.ball.setKind(ballKind(layout));

    const hintsShown = hintsVisible(targetHintDisplay(this.options.settings(), s.target), s.helpStep);
    const hintFrom = s.helpStep >= HINT_STEP ? (helpHint(layout, s.target)?.from ?? null) : null;
    this.goal.update({ layout, mode: s.mode, target: s.target, hintsVisible: hintsShown, helpStep: s.helpStep, shown: s.shown?.number ?? null, hintFrom, line: s.line });

    this.setPaused(s.paused);

    if (s.phase === 'ballInFlight' && s.ball && !this.flying) this.kick(s.ball.number);
    // After the celebration the next target shows and the ball waits at the kick spot again.
    if (s.phase === 'aiming' && s.ball === null && this.ballInNet) {
      this.ballInNet = false;
      this.ball.reset();
    }
  }

  /** A round started again: from the start screen or with "Nochmal" (the seed can stay the same with `?seed=`). */
  private isNewRound(prev: MatchState, s: MatchState): boolean {
    return prev.seed !== s.seed || prev.mode !== s.mode || s.targetCount < prev.targetCount || (prev.phase === 'roundOver' && s.phase !== 'roundOver');
  }

  private kick(n: number): void {
    const s = this.controller.getState();
    this.flying = true;
    this.ballInNet = false;
    this.options.sounds?.kick();
    this.player.kick();
    this.ball.fly(cellRect(layoutChart(s.min, s.max), CHART_RECT, n), () => this.arrived());
  }

  private arrived(): void {
    this.flying = false;
    this.controller.ballLanded();
    const s = this.controller.getState();
    if (s.ball?.outcome === 'goal') {
      this.ballInNet = true;
      this.ball.intoNet();
      this.stands.cheer();
      this.options.sounds?.cheer();
      this.celebration = this.time.delayedCall(CELEBRATION_MS, () => {
        this.celebration = null;
        this.controller.celebrationDone();
      });
    } else if (s.ball?.outcome === 'square') {
      this.ball.bounce();
      this.stands.clap();
      this.options.sounds?.clap();
    } else if (s.ball?.outcome === 'miss') {
      this.ball.bounce();
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
        paintStadium(texture.getContext());
        texture.refresh();
      }
    }
    this.add.image(0, 0, BACKDROP_TEXTURE).setOrigin(0, 0).setDepth(0);
  }
}

/** Paints the stadium after the prototype (specs/001-math-soccer/prototype/index.html), scaled to the world. */
function paintStadium(g: CanvasRenderingContext2D): void {
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
  const grass = g.createLinearGradient(0, top, 0, H);
  grass.addColorStop(0, '#24612f');
  grass.addColorStop(1, '#3a8a46');
  g.fillStyle = grass;
  g.fillRect(0, top, W, H - top);
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
