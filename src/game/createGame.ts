// Adapted from math-tank src/game/createGame.ts.
/**
 * Phaser 4 game setup (research R2). The canvas draws a fixed world of 1600 by 1000 units (contracts/screens.md) and
 * is scaled to fit its parent with the aspect ratio kept (`Scale.FIT`). The background is transparent so the page
 * color shows around the letterbox. Phaser's own sound system is off: sounds come from src/audio/sfx.ts.
 *
 * A ResizeObserver on the parent fits the canvas whenever the parent changes size; Chrome on iOS can send no resize
 * event after the device turns (math-tank Phase 24).
 *
 * The game runs one MatchScene (T033) over the match controller.
 */
import Phaser from 'phaser';
import type { MatchController } from '../core/match/MatchController';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import { MatchScene, type MatchSceneOptions } from './MatchScene';

export interface GameHandle {
  game: Phaser.Game;
  /** Shows the look chosen in the locker room at once (FR-049). */
  showLook(): void;
  destroy(): void;
}

export function createGame(parent: HTMLElement, controller: MatchController, options: MatchSceneOptions): GameHandle {
  const scene = new MatchScene(controller, options);
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
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit(game)) : null;
  observer?.observe(parent);
  return {
    game,
    showLook: () => scene.showLook(),
    destroy: () => {
      observer?.disconnect();
      game.destroy(true);
    },
  };
}

function fit(game: Phaser.Game): void {
  const scale = game.scale;
  // Before boot the scale manager has no canvas yet; it fits the canvas itself when it starts.
  if (!scale?.canvas) return;
  scale.getParentBounds();
  scale.refresh();
}
