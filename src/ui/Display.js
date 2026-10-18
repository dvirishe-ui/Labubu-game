/**
 * Display.js
 * High-DPI rendering support. The canvas is WIDTH x HEIGHT x RES pixels and
 * every scene's main camera zooms by RES, so all scene code keeps working in
 * logical coordinates (0..WIDTH, 0..HEIGHT) while rendering at native sharpness.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, RES } from '../config/GameConfig.js';

/** Points the main camera at the logical play area. */
export function setupCamera(scene) {
  const cam = scene.cameras?.main;
  if (!cam) return;
  cam.setZoom(RES);
  cam.centerOn(WIDTH / 2, HEIGHT / 2);
}

/** Pointer position in logical coordinates (pointer.x/y are canvas pixels). */
export function pointerPos(pointer) {
  return { x: pointer.x / RES, y: pointer.y / RES };
}

/**
 * Scene plugin installed on every scene: re-applies the camera zoom whenever
 * the scene starts or restarts (restarts rebuild the main camera).
 */
export class DisplayPlugin extends Phaser.Plugins.ScenePlugin {
  boot() {
    const events = this.systems.events;
    events.on('start', () => setupCamera(this.scene));
    events.on('create', () => setupCamera(this.scene));
  }
}
