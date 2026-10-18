/**
 * BootScene.js
 * Zero-external-asset bootstrap: every texture the game needs is drawn here
 * with Phaser Graphics and the Canvas 2D API, so the game starts instantly and
 * can never show a broken image link. Character sheets (heavier) are baked by
 * the PreloaderScene behind a progress bar.
 */
import Phaser from 'phaser';
import { generateAllTextures } from '../art/ProceduralTextures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    document.getElementById('boot-fallback')?.remove();
    generateAllTextures(this);
    this.scene.start('Preloader');
  }
}
