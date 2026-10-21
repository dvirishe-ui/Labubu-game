/**
 * MemoryScene.js
 * Memory Match: 12 face-down cards hide 6 pairs of Labubus. Flip two at a
 * time; finish in few moves for 3 stars (and the exclusive Memory Master
 * Shades the first time).
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../../config/GameConfig.js';
import { CATALOG } from '../../config/GachaDropTable.js';
import { Services } from '../../systems/Services.js';
import { memoryStars, memoryReward } from '../../systems/MiniGames.js';
import { ICON_RES } from '../../art/CharacterRenderer.js';
import { outlinedText } from '../../ui/UIKit.js';
import { hudText } from '../../ui/BitmapFont.js';
import { uiImage, cardKey } from '../../ui/Skin.js';
import { arcadeBackdrop, showArcadeResult } from './ArcadeUI.js';

const PAIRS = 6;

export class MemoryScene extends Phaser.Scene {
  constructor() {
    super('Memory');
  }

  create() {
    this._leaving = false;
    arcadeBackdrop(this, 'MEMORY MATCH');
    const portrait = HEIGHT > WIDTH;
    this.moves = 0;
    this.matched = 0;
    this.open = [];
    this.busy = false;

    const dolls = Object.values(CATALOG).filter((it) => it.slot === 'doll' && !it.exclusive);
    const picks = Phaser.Utils.Array.Shuffle(dolls).slice(0, PAIRS);
    const deck = Phaser.Utils.Array.Shuffle([...picks, ...picks]);

    const cols = portrait ? 3 : 6;
    const rows = Math.ceil(deck.length / cols);
    const top = portrait ? 230 : 130;
    const availH = HEIGHT - top - (portrait ? 60 : 30);
    const CW0 = 130;
    const CH0 = 160;
    const gap = 16;
    const s = Math.min(1, (WIDTH - 40) / (cols * (CW0 + gap)), availH / (rows * (CH0 + gap)));
    this.CW = CW0;
    this.CH = CH0;
    const gridW = cols * (CW0 + gap) * s;
    const grid = this.add.container((WIDTH - gridW) / 2, top).setScale(s);
    deck.forEach((item, i) => {
      const x = (i % cols) * (CW0 + gap) + CW0 / 2;
      const y = Math.floor(i / cols) * (CH0 + gap) + CH0 / 2;
      grid.add(this.makeCard(x, y, item));
    });

    this.movesText = hudText(this, WIDTH / 2, portrait ? 180 : 96, 'Moves: 0  ★★★', 24, '#ffffff').setDepth(50);
  }

  makeCard(x, y, item) {
    const c = this.add.container(x, y);
    c.item = item;
    c.back = [uiImage(this, -this.CW / 2 - 6, -this.CH / 2 - 4, cardKey(this, this.CW, this.CH, 'epic', true)), outlinedText(this, 0, -6, '?', 56, '#ffffff')];
    c.front = [uiImage(this, -this.CW / 2 - 6, -this.CH / 2 - 4, cardKey(this, this.CW, this.CH, item.rarity)), this.add.image(0, -8, `icon_${item.id}`).setScale((0.8 * 0.75) / ICON_RES)];
    c.front.forEach((o) => o.setVisible(false));
    c.add([...c.back, ...c.front]);
    c.setSize(this.CW, this.CH).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.flip(c));
    return c;
  }

  showFace(c, up) {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: c,
        scaleX: 0,
        duration: 110,
        onComplete: () => {
          c.back.forEach((o) => o.setVisible(!up));
          c.front.forEach((o) => o.setVisible(up));
          this.tweens.add({ targets: c, scaleX: 1, duration: 120, onComplete: resolve });
        }
      });
    });
  }

  async flip(c) {
    if (this.busy || c.faceUp || c.done) return;
    c.faceUp = true;
    Services.audio.play('click');
    await this.showFace(c, true);
    this.open.push(c);
    if (this.open.length < 2) return;
    this.busy = true;
    this.moves += 1;
    const [a, b] = this.open;
    this.open = [];
    if (a.item.id === b.item.id) {
      a.done = b.done = true;
      this.matched += 1;
      Services.audio.play('coin');
      for (const card of [a, b]) this.tweens.add({ targets: card, scale: 1.12, yoyo: true, duration: 140 });
    } else {
      Services.audio.play('bump');
      await new Promise((r) => this.time.delayedCall(650, r));
      a.faceUp = b.faceUp = false;
      await Promise.all([this.showFace(a, false), this.showFace(b, false)]);
    }
    this.movesText.setText(`Moves: ${this.moves}  ${'★'.repeat(memoryStars(this.moves, PAIRS))}`);
    this.busy = false;
    if (this.matched === PAIRS) this.finish();
  }

  finish() {
    const { stars, rewards } = memoryReward(Services.save, this.moves, PAIRS);
    this.time.delayedCall(500, () =>
      showArcadeResult(this, {
        title: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
        subtitle: `All pairs found in ${this.moves} moves!`,
        rewards,
        ribbon: stars === 3 ? 'yellow' : 'blue'
      })
    );
  }
}
