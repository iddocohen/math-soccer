/**
 * The match scene (FR-001, FR-003, FR-012, FR-021, FR-022; contracts/screens.md "Feedback contract"). It only draws
 * MatchController state and tells the controller when an animation has ended; all rules live in src/core.
 *
 * - Composes the views: the stadium backdrop, StandsView, GoalView, HelperView (the row and column helper, amendment 10),
 *   KeeperView, PlayerView and BallView. The look from the locker room (ball design, shirt color, number and name, scarf color)
 *   applies on every draw, so a changed look shows without a new round (FR-043).
 * - Subscribes to the controller in create() and unsubscribes on shutdown.
 * - When the phase becomes `ballInFlight`, the player kicks and the ball flies to the `cellRect` of the typed number.
 *   When it arrives the scene calls `ballLanded()`. A goal sends the ball into the net, the net bulges around it
 *   (FR-098), the fans cheer, the player plays the celebration chosen in the locker room (FR-113, FR-114), and after
 *   `celebrationMs` (1.2 s, 0.6 s in the time challenge) the scene calls `celebrationDone()`. A celebration the child
 *   skipped (the controller left `celebrating` first, with Enter or a tap) stops at once. `onCelebration` hears the
 *   celebration that plays and null when it ends (`data-celebration` for tests).
 * - The keeper (T054, FR-020): on every shot he leaps toward the ball, timed with its flight. A wrong number lands in
 *   his gloves: he holds it, the ball fades, and the fans slump with a soft "ohhh" and then clap. The correct number
 *   goes past his gloves into the net and he lands on the grass. The keeper's phase goes to `onKeeper`.
 * - Cutouts (amendment 18, FR-125, FR-126): while a square of a cutout is not its last one (`isCutoutFill`), the keeper
 *   waits aside and does not dive. The ball lands on the square of the typed number and rests there a moment. A correct
 *   number lights the square up with its number (it becomes a hint of the next target) and the fans clap; a wrong one
 *   shows its square with the "ohhh". The last square is a normal keeper shot.
 * - Sounds: a kick on every shot, a cheer on a goal, clapping on a filled square, the "ohhh" with clapping on a miss.
 * - Cup (amendment 13): when a cup round starts, the keeper and some scarves take the opponent's colors and the keeper
 *   shows his quirk (FR-107). The final fills the stand, and the crowd chants the shirt name with clapping; a won final
 *   brings confetti, fireworks over the stands, the player lifting the cup, a cheer and the chant again (FR-110).
 *   `onCupShow` hears what shows (`data-keeper-quirk`, `data-cup-show` for tests).
 * - Amendment 20: the ball trail chosen in the locker room follows the ball on every shot and fades within 0.4 s after
 *   it lands (FR-134). The goal effect plays for about 1 s on every goal with the celebration, in every game type, but
 *   not in the cup final, which has its own show (FR-137, FR-110). The mascot stands left of the goal, cheers on a
 *   goal and covers its eyes on a miss (FR-136). `onExtras` hears what shows (`data-trail`, `data-goal-effect`,
 *   `data-mascot` and their states for tests).
 * - Amendment 20 part 2: the stands (usual or bigger), the floodlights' color and the weather from the locker room
 *   (FR-135, FR-138). The backdrop is painted once per combination and swapped when the look changes; the snow or the
 *   rain falls behind the chart (WeatherView). `onExtras` hears them too (`data-weather`, `data-floodlight`,
 *   `data-stands` for tests).
 * - "Freistoß mit Mauer" (amendment 21, FR-142): WallView draws the wall of the current target (`s.wall`) and shades
 *   the squares behind it. On every shot the defenders jump together. A shot at a number behind the wall flies to the
 *   wall instead of the square; the keeper does not dive, and the "ohhh" plays as after a caught ball. The square of the typed number lights up
 *   from the controller's shown square, as after any miss.
 * - "Selbst ins Tor" (amendment 21, FR-143 to FR-145): the keeper wears the child's kit and shirt number, and the
 *   player at the kick spot is the opponent, drawn in a cup team's colors (`keeperOpponent`). On each new shot he kicks
 *   and the ball rolls slowly on the grass toward the target square, which flashes with a countdown ring (ShotView);
 *   both follow the shot's time left on every frame and stop while help holds the shot. When the shot is decided the
 *   ball flies to the square: on a save the keeper dives there and holds it and the fans cheer; on a wrong number he
 *   dives to the typed square and the ball goes into the net with the "ohhh"; too late, he leaps and falls short.
 * - "Elfmeterschießen" (amendment 21 part 3, FR-147, FR-148): the turns take turns. On the child's turn he stands at
 *   the kick spot in his look and the keeper wears the opponent team's colors, as in a cup match; the kick plays as in
 *   "Spielen". On the opponent's turn the shot plays as in "Selbst ins Tor", with the child in goal in his kit. Each new
 *   turn puts the ball back at the kick spot and the keeper in the middle. A won shootout brings the short trophy
 *   moment: confetti and fireworks (FinalShow), the cup lift, a cheer.
 * - While the round is paused the scene's tweens, timers and fans stop, so a flight or a celebration goes on where it
 *   stopped.
 * - The controller's state can be ahead of the scene: a shot typed before the scene was created flies when it starts.
 * - preload() loads the bundled grass texture and the classic ball's rotation sprite (amendment 03, FR-057, FR-058).
 *   A file that fails to load leaves the drawn pitch or the drawn ball in its place.
 */
import Phaser from 'phaser';
import { ballKind, cellRect, center, layoutChart, type ChartLayout } from '../core/chart/layout';
import { chantSeconds } from '../core/cup/chant';
import type { CupTeam, Quirk } from '../core/cup/teams';
import { cupMatchWon, onlyTimeChanged, type MatchController, type MatchView } from '../core/match/MatchController';
import { isCutoutFill } from '../core/types';
import { wallBlocks } from '../core/match/wall';
import { WallView } from './WallView';
import { ShotView } from './ShotView';
import { keeperOpponent } from '../core/match/keeper';
import { shootoutWinner } from '../core/match/shootout';
import { helpHint, HINT_STEP, hintsVisible, targetHintDisplay } from '../core/match/help';
import { CHART_RECT, GOAL_FRAME, STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import type { Settings } from '../core/settings/schema';
import { BALL_DEPTH, BallView } from './BallView';
import { ensureFxTextures, GoalEffectView, TrailView } from './EffectsView';
import { MascotView } from './MascotView';
import type { MascotMood } from './mascot';
import { GoalView } from './GoalView';
import { HelperView } from './HelperView';
import { FinalShow } from './FinalShow';
import { HOLD_MS, KeeperView, type KeeperPhase } from './KeeperView';
import { squaresToKeepClear } from './keeperDive';
import { lookKey, lookOf, type Look } from '../core/rewards/lockerRoom';
import { emptyLockerRoom } from '../core/storage/schemas';
import type { Celebration, Floodlight, GoalEffect, Mascot, Stands, Trail, Weather } from '../core/rewards/items';
import { backdropKey, coneLight, FLOODLIGHT_X, standRows, WEATHER_STYLE, type StadiumLook } from './stadium';
import { WeatherView } from './WeatherView';
import { celebrationMs } from './celebrationPose';
import { COLOR, css, hexColor } from './palette';
import { PlayerView } from './PlayerView';
import { StandsView } from './StandsView';
import { ensureTextures } from './textures';
import { ASSET, assetUrl } from '../assets';
import { BALL_SPRITE, SPRITE_FRAME_SIZE } from './ballArt';


/** The sounds the scene plays (src/audio/sfx.ts). */
export interface MatchSounds {
  kick(): void;
  cheer(): void;
  ohh(): void;
  /** Clapping for a filled square of a cutout (amendment 18). */
  clap?(): void;
  /** The crowd's chant in the cup final (FR-110). */
  chant?(shirtName: string): void;
  /** Fireworks for a won cup (FR-110). */
  fireworks?(): void;
}

/** The cup match the scene shows (amendment 13): the opponent, and whether it is the final. */
export interface CupScene {
  team: CupTeam;
  final: boolean;
}

/** What the scene shows of the cup, for `data-*` attributes in tests. */
export interface CupShow {
  /** The opponent keeper's quirk; null outside the cup. */
  quirk: Quirk | null;
  team: string | null;
  /** The full stand and the chant of the final. */
  final: boolean;
  /** Confetti, fireworks and the cup lift of a won final. */
  won: boolean;
}

/** What the scene shows of the trail, the goal effect and the mascot (amendment 20), for `data-*` attributes in tests. */
export interface SceneExtras {
  trail: Trail;
  goalEffect: GoalEffect;
  mascot: Mascot;
  /** True while trail particles show. */
  trailShowing: boolean;
  /** True while the goal effect plays. */
  goalEffectPlaying: boolean;
  mascotMood: MascotMood;
  /** The stadium and the weather (amendment 20 part 2). */
  stands: Stands;
  floodlight: Floodlight;
  weather: Weather;
  /** The number of snowflakes or raindrops falling now; 0 without snow or rain. */
  weatherDrops: number;
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
  /** The cup match of the round, read when a round starts; null or missing outside the cup. */
  cup?: () => CupScene | null;
  /** Hears what the scene shows of the cup. */
  onCupShow?: (show: CupShow) => void;
  /** Hears the goal celebration that starts, and null when it ends or is skipped. */
  onCelebration?: (celebration: Celebration | null) => void;
  /** Hears what shows of the trail, the goal effect and the mascot, whenever it changes. */
  onExtras?: (extras: SceneExtras) => void;
}

/** How long the ball rests on a filled square of a cutout before it fades, uncovering the square's number. */
const FILL_REST_MS = 250;

const GRASS_TEXTURE = 'grass';
/** The shirt number of the opponent who shoots in "Selbst ins Tor". */
const OPPONENT_NUMBER = 9;
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
  private finalShow!: FinalShow;
  private trail!: TrailView;
  private goalEffect!: GoalEffectView;
  private mascot!: MascotView;
  private weather!: WeatherView;
  private wall!: WallView;
  private shot!: ShotView;
  /** The target count of the opponent's shot the scene shows; -1 before the first. */
  private shotCount = -1;
  /** The target count of the shootout's kick the scene shows; -1 before the first. */
  private kickCount = -1;
  /** True once the scene played how the current shot was decided. */
  private shotDecided = false;
  /** The part of its way the rolling ball has gone, as drawn: it follows the shot's time left smoothly. */
  private shotK = 0;
  private backdrop!: Phaser.GameObjects.Image;
  private extras: SceneExtras = {
    trail: 'none',
    goalEffect: 'none',
    mascot: 'none',
    trailShowing: false,
    goalEffectPlaying: false,
    mascotMood: 'idle',
    stands: 'normal',
    floodlight: 'white',
    weather: 'evening',
    weatherDrops: 0,
  };
  /** The extras last reported to `onExtras`, as one string. */
  private extrasKey = '';
  /** The cup match of the round; null outside the cup. */
  private cupMatch: CupScene | null = null;
  private prev: MatchView | null = null;
  /** True from the kick until the scene has called `ballLanded()`. */
  private flying = false;
  /** True when the keeper leaps for the ball in flight; false on a square of a cutout that is not its last (FR-126). */
  private keeperInPlay = true;
  /** True while the ball of the last goal lies in the net. */
  private ballInNet = false;
  private celebration: Phaser.Time.TimerEvent | null = null;
  private pausedNow = false;
  /** The look the views show, as `lookKey`. */
  private lookKey = '';
  /** The chart layout of the last range drawn; most draws keep the range, so it is laid out once. */
  private layout: ChartLayout | null = null;

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
    ensureFxTextures(this);
    const look = this.currentLook();
    this.backdrop = this.add.image(0, 0, this.backdropTexture(look)).setOrigin(0, 0).setDepth(0);
    this.weather = new WeatherView(this);
    this.weather.setWeather(look.weather);
    this.lookKey = '';
    this.stands = new StandsView(this, look.scarfColor);
    this.stands.setStands(look.stands);
    this.goal = new GoalView(this);
    this.helper = new HelperView(this);
    this.keeper = new KeeperView(this, this.options.onKeeper);
    this.player = new PlayerView(this, look);
    const s = this.controller.getState();
    this.ball = new BallView(this, ballKind(this.layoutOf(s)), look.ball);
    this.finalShow = new FinalShow(this);
    // Just under the ball, so the trail is drawn behind it.
    this.trail = new TrailView(this, BALL_DEPTH - 0.5);
    this.goalEffect = new GoalEffectView(this);
    this.mascot = new MascotView(this, (mood) => this.setExtras({ mascotMood: mood }));
    this.wall = new WallView(this);
    this.shot = new ShotView(this);
    this.shotCount = -1;
    this.shotDecided = false;
    this.shotK = 0;
    this.extrasKey = '';
    this.cupMatch = null;
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
    if (this.pausedNow) return;
    this.stands.update(delta);
    this.trail.update(delta, this.ball.flightPoint);
    this.goalEffect.update(delta);
    this.mascot.update(delta);
    this.weather.update(delta);
    this.followShot(delta);
    if (this.trail.showing !== this.extras.trailShowing || this.goalEffect.running !== this.extras.goalEffectPlaying) {
      this.setExtras({ trailShowing: this.trail.showing, goalEffectPlaying: this.goalEffect.running });
    }
  }

  /** Changes what shows of the extras and tells `onExtras` when anything changed. */
  private setExtras(change: Partial<SceneExtras>): void {
    this.extras = { ...this.extras, ...change };
    const key = JSON.stringify(this.extras);
    if (key === this.extrasKey) return;
    this.extrasKey = key;
    this.options.onExtras?.(this.extras);
  }

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.celebration?.remove();
    this.celebration = null;
    this.options.onCelebration?.(null);
    this.finalShow?.stop();
  }

  private draw(s: MatchView): void {
    const prev = this.prev;
    this.prev = s;
    if (!s.started) return;
    // A clock tick changes nothing the scene draws.
    if (prev !== null && onlyTimeChanged(prev, s)) return;
    const layout = this.layoutOf(s);

    if (prev === null || this.isNewRound(prev, s)) {
      this.endCelebration();
      this.flying = false;
      this.ballInNet = false;
      this.ball.reset();
      this.keeper.reset();
      this.stands.calm();
      this.trail.clear();
      this.goalEffect.clear();
      this.mascot.calm();
      this.startCup(s);
      this.shotCount = -1;
      this.shot.hide();
      // The keeper's team is set again for the shootout (applyLook), also when the seed stays the same.
      this.lookKey = '';
      this.kickCount = -1;
    }
    if (s.shootout !== null) this.newKick(s);
    // The waiting keeper leaves the target, hint and waiting shape squares visible (FR-064).
    if (s.target) {
      this.keeper.keepClear(squaresToKeepClear(s.target).map((n) => cellRect(layout, CHART_RECT, n)));
    }
    this.refreshLook(layout);
    this.wall.setWall(layout, s.wall, this.currentLook().shirtColor);

    const hintsShown = hintsVisible(targetHintDisplay(this.options.settings(), s.target), s.helpStep);
    const hintFrom = s.helpStep >= HINT_STEP ? (helpHint(layout, s.target)?.from ?? null) : null;
    // A scored target loses its cell panel at once (FR-097, parent feedback).
    const solved = s.ball?.outcome === 'goal';
    this.goal.update({ layout, target: s.target, hintsVisible: hintsShown, helpStep: s.helpStep, shown: s.shown?.number ?? null, hintFrom, solved });
    this.helper.update(layout, s.target, s.helpStep, this.options.settings().rowColumnHelper, solved);

    this.setPaused(s.paused);
    // The child skipped the celebration (Enter or a tap): the controller already went on, so the dance stops here.
    if (this.celebration !== null && s.phase !== 'celebrating') this.endCelebration();

    if (s.phase === 'roundOver' && this.cupMatch?.final && cupMatchWon(s) && !this.finalShow.running) this.cupWon();
    if (s.phase === 'roundOver' && s.shootout !== null && shootoutWinner(s.shootout.kicks) === 0 && !this.finalShow.running) this.shootoutWon();

    if (s.mode === 'keeper' || s.mode === 'shootout') this.drawShot(s, layout);
    else this.shot.hide();
    if (s.phase === 'ballInFlight' && s.ball && !this.flying) this.kick(s.ball.number);
    // After the celebration the next target shows and the ball waits at the kick spot again.
    if (s.phase === 'aiming' && s.ball === null && this.ballInNet) {
      this.ballInNet = false;
      this.ball.reset();
    }
  }

  /**
   * The opponent's shot of "Selbst ins Tor": a new shot is kicked, a decided one plays its end. The rolling ball and the
   * countdown ring follow the time left in `followShot`.
   */
  private drawShot(s: MatchView, layout: ChartLayout): void {
    const shot = s.keeperShot;
    if (shot === null || s.target === null) {
      this.shot.hide();
      return;
    }
    if (this.shotCount !== s.targetCount) {
      this.shotCount = s.targetCount;
      this.shotDecided = false;
      this.shotK = 1 - shot.leftMs / shot.totalMs;
      this.ballInNet = false;
      this.ball.reset();
      this.player.kick();
      this.options.sounds?.kick();
    }
    if (shot.result === null || this.shotDecided) return;
    this.shotDecided = true;
    this.shot.hide();
    const target = cellRect(layout, CHART_RECT, s.target.number);
    const typed = shot.typed !== null ? cellRect(layout, CHART_RECT, shot.typed) : null;
    if (shot.result === 'saved') this.keeper.dive(target, 'catch');
    else if (typed !== null) this.keeper.dive(typed, 'catch');
    else this.keeper.dive(target, 'beaten');
    const saved = shot.result === 'saved';
    this.ball.flyOn(target, () => {
      if (saved) {
        this.keeper.catchBall();
        this.ball.caught(HOLD_MS);
        this.stands.cheer();
        this.options.sounds?.cheer();
        this.mascot.cheer();
        return;
      }
      this.keeper.beaten();
      this.goal.bulge(center(target));
      this.ballInNet = true;
      this.ball.intoNet();
      this.stands.ohh();
      this.options.sounds?.ohh();
      this.mascot.coverEyes();
    });
  }

  /**
   * A new kick of the shootout (a new target): the ball waits at the kick spot and the keeper in the middle. The
   * opponent's shot then kicks off in `drawShot`.
   */
  private newKick(s: MatchView): void {
    if (s.phase === 'roundOver' || this.kickCount === s.targetCount) return;
    this.kickCount = s.targetCount;
    this.flying = false;
    this.ballInNet = false;
    this.ball.reset();
    this.keeper.reset();
  }

  /** The won shootout (FR-148): confetti and fireworks, the cup lift, a cheer. */
  private shootoutWon(): void {
    this.finalShow.start();
    this.player.liftCup();
    this.stands.cheer();
    this.options.sounds?.cheer();
    this.options.sounds?.fireworks?.();
  }

  /** Every frame: the rolling ball and the countdown ring of a shot in flight follow its time left (FR-144). */
  private followShot(delta: number): void {
    const s = this.controller.getState();
    const shot = s.keeperShot;
    if ((s.mode !== 'keeper' && s.mode !== 'shootout') || shot === null || shot.result !== null || s.target === null || this.shotCount !== s.targetCount) return;
    const goal = 1 - shot.leftMs / shot.totalMs;
    // The controller's time moves in steps of a tick; the drawing eases toward it.
    this.shotK += (goal - this.shotK) * Math.min(1, delta / 250);
    const rect = cellRect(this.layoutOf(s), CHART_RECT, s.target.number);
    this.ball.roll(rect, this.shotK);
    this.shot.show(rect, 1 - this.shotK, shot.held || s.helpChartOpen);
    this.shot.update(delta);
  }

  /**
   * A new round: the keeper and the scarves in the cup opponent's colors, or the usual ones outside the cup (FR-107).
   * The final fills the stand and the crowd chants the shirt name (FR-110).
   */
  private startCup(s: MatchView): void {
    this.finalShow.stop();
    this.player.lowerCup();
    const cup = s.roundType === 'cup' ? (this.options.cup?.() ?? null) : null;
    this.cupMatch = cup;
    this.keeper.setTeam(cup ? cup.team : null);
    this.stands.setTeamColor(cup ? hexColor(cup.team.color) : null);
    this.stands.setFinal(cup?.final === true);
    if (cup?.final && s.phase !== 'roundOver') this.chant();
    this.reportCup(false);
  }

  /** The crowd chants the shirt name, and the fans clap along. */
  private chant(): void {
    const name = this.currentLook().shirtName;
    this.options.sounds?.chant?.(name);
    this.stands.chant(chantSeconds(name) * 1000);
  }

  /** The won final: confetti, fireworks over the stands, the cup lift, a cheer and the chant (FR-110). */
  private cupWon(): void {
    this.finalShow.start();
    this.player.liftCup();
    this.stands.cheer();
    this.options.sounds?.cheer();
    this.options.sounds?.fireworks?.();
    this.chant();
    this.reportCup(true);
  }

  private reportCup(won: boolean): void {
    const cup = this.cupMatch;
    this.options.onCupShow?.({ quirk: cup?.team.quirk ?? null, team: cup?.team.id ?? null, final: cup?.final === true, won });
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
    this.refreshLook(this.layoutOf(this.controller.getState()));
  }

  /** Shows the current look on the player, the scarves and the ball of the chart size of `layout`. */
  private refreshLook(layout: ChartLayout): void {
    const look = this.currentLook();
    this.applyLook(look, this.controller.getState());
    this.ball.setLook(ballKind(layout), look.ball);
    this.trail.setTrail(look.trail);
    this.mascot.setMascot(look.mascot);
    this.applyStadium(look);
    this.setExtras({
      trail: look.trail,
      goalEffect: look.goalEffect,
      mascot: look.mascot,
      stands: look.stands,
      floodlight: look.floodlight,
      weather: look.weather,
      weatherDrops: this.weather.falling,
    });
  }

  /** The chart layout of the range of `s`. */
  private layoutOf(s: MatchView): ChartLayout {
    if (this.layout === null || this.layout.min !== s.min || this.layout.max !== s.max) this.layout = layoutChart(s.min, s.max);
    return this.layout;
  }

  /**
   * Redraws the shirt and recolors the scarves when the look changed. In "Selbst ins Tor", and on the opponent's turn of
   * the shootout, the child is the keeper in his kit and the player at the kick spot wears the opponent's colors
   * (amendment 21). On the child's turn of the shootout the keeper wears the opponent team's colors.
   */
  private applyLook(look: Look, s: MatchView): void {
    const shootout = s.started && s.mode === 'shootout';
    const opponentShoots = s.started && (s.mode === 'keeper' || (shootout && s.keeperShot !== null));
    const team = opponentShoots || shootout ? keeperOpponent(s.seed) : null;
    const opponent = opponentShoots ? team : null;
    const key = `${lookKey(look)}|${team?.id ?? ''}|${opponentShoots}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.player.setLook(opponent ? { ...look, shirtColor: hexColor(opponent.color), shirtNumber: OPPONENT_NUMBER, shirtName: opponent.name } : look);
    this.keeper.setKit(opponentShoots ? { color: look.shirtColor, number: look.shirtNumber } : null);
    if (shootout) this.keeper.setTeam(opponentShoots ? null : team);
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
    const layout = this.layoutOf(s);
    // The same rule as the controller's: a number behind the wall hits the wall (FR-142).
    const blocked = wallBlocks(layout, s.wall, n);
    const square = blocked ? this.wall.hitPoint(layout, n) : cellRect(layout, CHART_RECT, n);
    // On a square of a cutout that is not its last one the keeper waits aside (FR-126); a ball the wall stops never
    // reaches him.
    this.keeperInPlay = !isCutoutFill(s.target) && !blocked;
    // The defenders jump on every shot, highest when the ball reaches them (FR-142).
    this.wall.jump(blocked);
    // The same rule as the controller's: the target number scores, any other number is caught.
    if (this.keeperInPlay) this.keeper.dive(square, n === s.target?.number ? 'beaten' : 'catch');
    this.ball.fly(square, () => this.arrived());
  }

  private arrived(): void {
    this.flying = false;
    this.controller.ballLanded();
    const s = this.controller.getState();
    if (s.ball?.outcome === 'goal') {
      // Only a goal moves the net (FR-098); a caught ball never reaches it.
      this.goal.bulge(center(cellRect(this.layoutOf(s), CHART_RECT, s.ball.number)));
      this.ballInNet = true;
      this.ball.intoNet();
      this.keeper.beaten();
      this.stands.cheer();
      this.options.sounds?.cheer();
      // The cup final has its own show instead of the goal effect (FR-137, FR-110).
      if (!this.cupMatch?.final) this.goalEffect.play(this.currentLook().goalEffect);
      this.mascot.cheer();
      this.startCelebration(s.roundType === 'time');
    } else if (s.ball?.outcome === 'filled') {
      // The ball rests on the filled square a moment and fades, so the square's new number shows soon (FR-125).
      this.ball.caught(FILL_REST_MS);
      this.stands.clap();
      this.options.sounds?.clap?.();
    } else if (s.ball?.outcome === 'blocked') {
      // The wall stopped the ball: it rests at the defenders a moment and fades (FR-142).
      this.ball.caught(HOLD_MS);
      this.mascot.coverEyes();
      this.stands.ohh();
      this.options.sounds?.ohh();
    } else if (s.ball?.outcome === 'miss') {
      // Without the keeper the ball rests on the square of the typed number instead of in his gloves.
      if (this.keeperInPlay) this.keeper.catchBall();
      this.ball.caught(HOLD_MS);
      this.mascot.coverEyes();
      this.stands.ohh();
      this.options.sounds?.ohh();
    }
  }

  /** The chosen celebration plays on the player; when it ends the controller gives the next target (FR-114). */
  private startCelebration(timeChallenge: boolean): void {
    const celebration = this.currentLook().celebration;
    const ms = celebrationMs(timeChallenge);
    this.player.celebrate(celebration, ms);
    this.options.onCelebration?.(celebration);
    this.celebration = this.time.delayedCall(ms, () => {
      this.endCelebration();
      this.controller.celebrationDone();
    });
  }

  private endCelebration(): void {
    const running = this.celebration !== null;
    this.celebration?.remove();
    this.celebration = null;
    this.player.stopCelebration();
    if (running) this.options.onCelebration?.(null);
  }

  private setPaused(paused: boolean): void {
    if (paused === this.pausedNow) return;
    this.pausedNow = paused;
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = paused;
  }

  /** The stands, the floodlights' color and the weather of the look (amendment 20 part 2, FR-135, FR-138). */
  private applyStadium(look: Look): void {
    const key = this.backdropTexture(look);
    if (this.backdrop.texture.key !== key) this.backdrop.setTexture(key);
    this.stands.setStands(look.stands);
    this.weather.setWeather(look.weather);
  }

  /**
   * The stadium behind everything for the stands, floodlights and weather of `look`: sky, light cones, stand rows,
   * pitch and chalk lines. Each combination is painted once and kept.
   */
  private backdropTexture(look: StadiumLook): string {
    const key = backdropKey(look);
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, WORLD_WIDTH, WORLD_HEIGHT);
      if (texture) {
        const grass = this.textures.exists(GRASS_TEXTURE) ? (this.textures.get(GRASS_TEXTURE).getSourceImage() as CanvasImageSource) : null;
        paintStadium(texture.getContext(), grass, look);
        texture.refresh();
      }
    }
    return key;
  }
}

/**
 * Paints the stadium after the prototype (specs/001-math-soccer/prototype/index.html), scaled to the world. The pitch is
 * the tiled grass texture, darkened toward the evening sky, or a drawn green without it (FR-057).
 */
function paintStadium(g: CanvasRenderingContext2D, grassImage: CanvasImageSource | null, look: StadiumLook): void {
  const W = WORLD_WIDTH;
  const H = WORLD_HEIGHT;
  const top = STANDS_BOTTOM + 30;
  const style = WEATHER_STYLE[look.weather];
  const sky = g.createLinearGradient(0, 0, 0, top);
  sky.addColorStop(0, style.sky[0]);
  sky.addColorStop(1, style.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, top);
  // The floodlights stand above the top edge, out of view: only their soft light falls in, so no bright lamp shows
  // around the counters and buttons of the top bar (FR-099). The light takes the floodlight color; a day match has none.
  const cone = coneLight(look.floodlight, look.weather);
  if (cone) {
    for (const x of FLOODLIGHT_X) {
      g.fillStyle = css(cone.color, cone.alpha);
      g.beginPath();
      g.moveTo(x - 50, 0);
      g.lineTo(x - 230, top);
      g.lineTo(x + 230, top);
      g.lineTo(x + 50, 0);
      g.fill();
    }
  }
  standRows(look.stands).forEach((row, i, rows) => {
    // The front row keeps its color, so the usual stands look as before.
    g.fillStyle = (rows.length - 1 - i) % 2 ? '#1d3044' : '#22384c';
    g.fillRect(0, row.bandTop, W, row.bandHeight);
    if (style.snowCover) {
      g.fillStyle = 'rgb(240 246 252 / 55%)';
      g.fillRect(0, row.bandTop, W, 3);
    }
  });
  const pattern = grassImage ? g.createPattern(grassImage, 'repeat') : null;
  if (pattern) {
    pattern.setTransform(new DOMMatrix().scale(GRASS_TILE_SCALE));
    g.fillStyle = pattern;
    g.fillRect(0, top, W, H - top);
    // Darker far away under the evening sky, lighter near the player under the floodlights; lighter on a day match.
    const dusk = g.createLinearGradient(0, top, 0, H);
    dusk.addColorStop(0, style.grassShade[0]);
    dusk.addColorStop(1, style.grassShade[1]);
    g.fillStyle = dusk;
    g.fillRect(0, top, W, H - top);
  } else {
    const grass = g.createLinearGradient(0, top, 0, H);
    grass.addColorStop(0, '#24612f');
    grass.addColorStop(1, '#3a8a46');
    g.fillStyle = grass;
    g.fillRect(0, top, W, H - top);
    const shade = g.createLinearGradient(0, top, 0, H);
    shade.addColorStop(0, style.grassShade[0]);
    shade.addColorStop(1, style.grassShade[1]);
    g.fillStyle = shade;
    g.fillRect(0, top, W, H - top);
  }
  if (style.grassWash) {
    g.fillStyle = style.grassWash;
    g.fillRect(0, top, W, H - top);
  }
  if (style.wet) paintWet(g, top);
  if (style.snowCover) paintSnowCover(g, top);
  // Where the cones reach the grass, a soft pool of light in the floodlight color.
  if (cone) {
    for (const x of FLOODLIGHT_X) {
      g.save();
      g.translate(x, top + 120);
      g.scale(2.4, 1);
      const pool = g.createRadialGradient(0, 0, 0, 0, 0, 140);
      pool.addColorStop(0, css(cone.color, cone.alpha * 1.2));
      pool.addColorStop(1, css(cone.color, 0));
      g.fillStyle = pool;
      g.fillRect(-140, -140, 280, 280);
      g.restore();
    }
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

/** Wet grass in the rain: soft, long light streaks where the floodlights shine on the water. */
function paintWet(g: CanvasRenderingContext2D, top: number): void {
  const H = WORLD_HEIGHT;
  const middle = (top + H) / 2;
  const stretch = (H - top) / 2 / 80;
  for (const x of FLOODLIGHT_X) {
    // A soft, tall shine: a round glow stretched downward, so it has no hard edges.
    g.save();
    g.translate(x, middle);
    g.scale(1, stretch);
    const shine = g.createRadialGradient(0, 0, 0, 0, 0, 80);
    shine.addColorStop(0, 'rgb(200 220 240 / 12%)');
    shine.addColorStop(1, 'rgb(200 220 240 / 0%)');
    g.fillStyle = shine;
    g.fillRect(-80, -80, 160, 160);
    g.restore();
  }
}

/** A light white cover of snow on the grass edges: along the stands and at the left and right side of the pitch. */
function paintSnowCover(g: CanvasRenderingContext2D, top: number): void {
  const W = WORLD_WIDTH;
  const H = WORLD_HEIGHT;
  const white = (alpha: number) => `rgb(240 246 252 / ${alpha}%)`;
  const along = g.createLinearGradient(0, top, 0, top + 40);
  along.addColorStop(0, white(55));
  along.addColorStop(1, white(0));
  g.fillStyle = along;
  g.fillRect(0, top, W, 40);
  for (const [from, to] of [
    [0, 130],
    [W, W - 130],
  ] as const) {
    const side = g.createLinearGradient(from, 0, to, 0);
    side.addColorStop(0, white(50));
    side.addColorStop(1, white(0));
    g.fillStyle = side;
    g.fillRect(Math.min(from, to), top, 130, H - top);
  }
}
