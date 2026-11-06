// Adapted from math-tank src/game/createGame.ts.
/**
 * Phaser 4 game setup (research R2). The canvas draws a fixed world of 1600 by 1000 units (contracts/screens.md) and
 * is scaled to fit its parent with the aspect ratio kept (`Scale.FIT`). The background is transparent so the page
 * color shows around the letterbox. Phaser's own sound system is off: sounds come from src/audio/sfx.ts.
 *
 * A ResizeObserver on the parent fits the canvas whenever the parent changes size; Chrome on iOS can send no resize
 * event after the device turns (math-tank Phase 24).
 *
 * Until MatchScene exists (T033), the game shows BackdropScene: the night sky, the stands, the pitch and the goal
 * frame.
 */
import Phaser from 'phaser';
import { GOAL_RECT, STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import { ensureTextures } from './textures';

export interface GameHandle {
  game: Phaser.Game;
  destroy(): void;
}

export function createGame(parent: HTMLElement, scene: Phaser.Scene = new BackdropScene()): GameHandle {
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

/** The empty stadium: night sky, stands, pitch and goal frame. */
export class BackdropScene extends Phaser.Scene {
  constructor() {
    super('backdrop');
  }

  create(): void {
    ensureTextures(this);
    const g = this.add.graphics();
    g.fillStyle(0x0f1d2b, 1);
    g.fillRect(0, 0, WORLD_WIDTH, STANDS_BOTTOM);
    for (let row = 0; row < 4; row++) {
      g.fillStyle(row % 2 ? 0x22384c : 0x1d3044, 1);
      g.fillRect(0, 60 + row * 48, WORLD_WIDTH, 44);
    }
    g.fillStyle(0x2f7a3c, 1);
    g.fillRect(0, STANDS_BOTTOM, WORLD_WIDTH, WORLD_HEIGHT - STANDS_BOTTOM);
    g.fillStyle(0x0e1a14, 1);
    g.fillRect(GOAL_RECT.x, GOAL_RECT.y, GOAL_RECT.width, GOAL_RECT.height);
    g.fillStyle(0xf4f6ef, 1);
    g.fillRect(GOAL_RECT.x - 14, GOAL_RECT.y - 14, 14, GOAL_RECT.height + 14);
    g.fillRect(GOAL_RECT.x + GOAL_RECT.width, GOAL_RECT.y - 14, 14, GOAL_RECT.height + 14);
    g.fillRect(GOAL_RECT.x - 14, GOAL_RECT.y - 14, GOAL_RECT.width + 28, 14);
  }
}
