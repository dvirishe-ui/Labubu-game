/**
 * World3D.js
 * Shared helpers for the pseudo-3D lane runner: depth sorting and billboard
 * placement. RunnerScene.project(x, y, z) maps world metres to the screen and
 * returns { x, y, s } where s = screen pixels per metre at that depth.
 */

import { RUNNER } from '../config/GameConfig.js';

/** Nearer objects draw on top. */
export const depthFor = (z) => 10000 - z * 50;

/**
 * Places an upright billboard image (origin bottom-centre) so it stands at
 * world (x, y, z) and is `heightM` metres tall.
 * @returns {boolean} false when the object is behind the camera.
 */
export function placeBillboard(scene, img, x, y, z, heightM, texHeight) {
  if (z < 0.6) {
    img.setVisible(false);
    return false;
  }
  const p = scene.project(x, y, z);
  const scale = (heightM * p.s) / texHeight;
  img.setPosition(p.x, p.y).setScale(scale).setDepth(depthFor(z)).setVisible(true);
  // Fade in from the haze near the horizon, and fade out once an object has
  // passed the runner so it never blocks the view of Labubu.
  const far = scene.drawDistance;
  let alpha = Math.min(1, (far - z) / 18);
  if (z < RUNNER.PLAYER_Z) alpha *= Math.max(0, (z - 1.2) / (RUNNER.PLAYER_Z - 1.2));
  img.setAlpha(alpha);
  return true;
}
