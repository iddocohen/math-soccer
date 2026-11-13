// Adapted from math-tank src/game/createGame.ts.
/**
 * Phaser 4 game setup (research R2). The canvas draws a fixed world of 1600 by 1000 units (contracts/screens.md) and
 * is scaled to fit its parent with the aspect ratio kept (`Scale.FIT`). The background is transparent so the page
 * color shows around the letterbox. Phaser's own sound system is off: sounds come from src/audio/sfx.ts.
 *
 * A ResizeObserver on the parent fits the canvas whenever the parent changes size; Chrome on iOS can send no resize
 * event after the device turns (math-tank Phase 24).
 *
 * One game for the whole session (refactor R3): the app creates it the first time the match screen shows and keeps it,
 * with its canvas, its WebGL context and the textures the scenes generate, until the app goes away. Each match gets a
 * new MatchScene (T033) over the match controller (`enter`), so no state of the last round is carried over; leaving the
 * match screen removes the scene and puts the game loop to sleep (`leave`), so the start screen, the locker room and
 * the bracket draw no frames.
 */
import Phaser from 'phaser';
import type { MatchController } from '../core/match/MatchController';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import { MatchScene, type MatchSceneOptions } from './MatchScene';

/** The key of the one match scene. */
const MATCH = 'match';

export interface GameHandle {
  game: Phaser.Game;
  /** Starts a new match scene over the controller's round and wakes the game loop. The game starts in a match. */
  enter(): void;
  /** Removes the match scene and puts the game loop to sleep; textures and the canvas stay. */
  leave(): void;
  /** Shows the look chosen in the locker room at once (FR-049). */
  showLook(): void;
  destroy(): void;
}

export function createGame(parent: HTMLElement, controller: MatchController, options: MatchSceneOptions): GameHandle {
  let scene = new MatchScene(controller, options);
  // True while the match screen shows.
  let active = true;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    },
    scene,
  });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit(game, parent)) : null;
  observer?.observe(parent);

  const removeScene = () => {
    if (game.scene.getScene(MATCH)) game.scene.remove(MATCH);
  };
  const sleep = () => {
    removeScene();
    game.loop.sleep();
  };
  // The game boots after a frame; a match left before it ran is put to sleep after its first frame. Not in POST_STEP:
  // the scene manager is still processing then, so the removal would be queued and would remove the next match's
  // scene when the loop wakes.
  const sleepIfLeft = () => {
    if (!active) sleep();
  };

  return {
    game,
    enter() {
      if (active) return;
      active = true;
      if (!game.isRunning) return;
      removeScene();
      scene = new MatchScene(controller, options);
      game.scene.add(MATCH, scene, true);
      // The parent may have been out of the page: fit the canvas before the first frame.
      fit(game, parent);
      game.loop.wake();
    },
    leave() {
      if (!active) return;
      active = false;
      if (game.isRunning) sleep();
      else game.events.once(Phaser.Core.Events.POST_RENDER, sleepIfLeft);
    },
    showLook: () => {
      if (active) scene.showLook();
    },
    destroy: () => {
      observer?.disconnect();
      game.destroy(true);
    },
  };
}

function fit(game: Phaser.Game, parent: HTMLElement): void {
  const scale = game.scale;
  // Before boot the scale manager has no canvas yet; it fits the canvas itself when it starts. A parent out of the
  // page has no size: the canvas is fitted when it comes back.
  if (!scale?.canvas || !parent.isConnected) return;
  scale.getParentBounds();
  scale.refresh();
}
