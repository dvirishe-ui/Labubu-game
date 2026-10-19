/**
 * PreloaderScene.js
 * Shows a progress bar while the procedural character art is baked: the
 * player's current loadout sheet, hi-res previews and one icon per catalog
 * item. Work is spread over several frames so the bar actually animates and
 * the browser never freezes. External assets (if you add any later) can be
 * queued in `preload()` and share the same bar.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS } from '../config/GameConfig.js';
import { CATALOG } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { bakePlayerTextures, bakeCharacterFrame, previewLoadoutFor, ICON_RES } from '../art/CharacterRenderer.js';
import { outlinedText, textStyle } from '../ui/UIKit.js';
import { accountReady } from '../systems/Account.js';

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    const oy = (HEIGHT - 720) / 2; // centre the 720-tall layout in portrait
    this.oy = oy;
    this.add.image(0, 0, 'sky3d').setOrigin(0).setDisplaySize(WIDTH, HEIGHT);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.bgDark, 0.55);
    outlinedText(this, WIDTH / 2, oy + 230, 'LABUBU', 96, '#ff8fb1');
    outlinedText(this, WIDTH / 2, oy + 310, 'Blind Box Run & Collect', 34, '#fff4e6');
    this.box = this.add.image(WIDTH / 2, oy + 430, 'box_icon').setScale(0.9);
    this.tweens.add({ targets: this.box, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 300 });

    const barW = Math.min(520, WIDTH - 80);
    this.barBg = this.add.graphics();
    this.barBg.fillStyle(0x000000, 0.35).fillRoundedRect(WIDTH / 2 - barW / 2, oy + 540, barW, 30, 15);
    this.bar = this.add.graphics();
    this.barW = barW;
    this.status = this.add.text(WIDTH / 2, oy + 600, 'Stitching fur…', textStyle(22, '#fff4e6')).setOrigin(0.5);

    // Hook for any future file-based assets: they would report progress here.
    this.load.on('progress', (v) => this.setProgress(v * 0.2));
  }

  setProgress(v) {
    this.bar.clear();
    this.bar.fillStyle(COLORS.pink, 1).fillRoundedRect(WIDTH / 2 - this.barW / 2 + 4, this.oy + 544, Math.max(22, (this.barW - 8) * v), 22, 11);
  }

  create() {
    accountReady(); // start signing in while the art bakes
    const jobs = [
      { label: 'Dressing your Labubu…', run: () => bakePlayerTextures(this, Services.save.data.equipped) },
      ...Object.keys(CATALOG).map((id) => ({
        label: `Packing ${CATALOG[id].name}…`,
        run: () => bakeCharacterFrame(this, `icon_${id}`, previewLoadoutFor(id), 'idle', ICON_RES)
      }))
    ];
    let i = 0;
    // One bake per frame keeps the UI responsive on low-end phones.
    const perTick = 3;
    this.time.addEvent({
      delay: 16,
      repeat: Math.ceil(jobs.length / perTick) - 1,
      callback: () => {
        for (let k = 0; k < perTick && i < jobs.length; k++) {
          const job = jobs[i++];
          this.status.setText(job.label);
          job.run();
        }
        this.setProgress(0.2 + 0.8 * (i / jobs.length));
        if (i === jobs.length) this.time.delayedCall(250, () => this.finish());
      }
    });
  }

  finish() {
    this.scene.launch('UIOverlay');
    this.scene.start('Login');
  }
}
