/**
 * ArcadeScene.js
 * The Arcade hub: three mini-games with exclusive prizes, free daily plays
 * and extra plays for a ticket or gems.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS } from '../../config/GameConfig.js';
import { CATALOG } from '../../config/GachaDropTable.js';
import { Services } from '../../systems/Services.js';
import { ARCADE, GAMES, arcadeState, freePlaysLeft, playsLeft, usePlay, buyPlay } from '../../systems/MiniGames.js';
import { ICON_RES } from '../../art/CharacterRenderer.js';
import { CurrencyBar, makeButton, ScrollList, outlinedText, textStyle, floatText } from '../../ui/UIKit.js';
import { addPanel, cardKey, uiImage, INK } from '../../ui/Skin.js';
import { arcadeBackdrop, leaveTo } from './ArcadeUI.js';

const HEADER = { claw: 0xff4fa3, memory: 0x2f8cff, catcher: 0xffa000 };

export class ArcadeScene extends Phaser.Scene {
  constructor() {
    super('Arcade');
  }

  create() {
    this._leaving = false;
    Services.audio.playMusic('menu');
    arcadeBackdrop(this, 'ARCADE', 'MainMenu');
    const portrait = HEIGHT > WIDTH;
    new CurrencyBar(this, portrait ? 20 : WIDTH - 740, portrait ? HEIGHT - 60 : 16, { shop: false });

    this.CW = Math.min(WIDTH - 24, 1100);
    this.top = portrait ? 150 : 90;
    this.page = this.add.container(0, 0);
    this.build();
  }

  build() {
    const scroll = this.list?.scroll ?? 0;
    this.list?.destroy();
    this.page.removeAll(true);
    const portrait = HEIGHT > WIDTH;
    const x0 = (WIDTH - this.CW) / 2;
    this.list = new ScrollList(this, this.page, x0, this.top, this.CW, HEIGHT - this.top - (portrait ? 80 : 10));
    const inner = this.list.inner;
    const save = Services.save;
    const a = arcadeState(save);

    // Plays bar
    const bar = this.add.container(0, 0);
    bar.rowHeight = 110;
    inner.add(bar);
    bar.add(outlinedText(this, this.CW / 2, 24, `Plays left: ${playsLeft(save)}  (${freePlaysLeft(save)}/${ARCADE.FREE_PLAYS} free today${a.extra ? ` + ${a.extra} extra` : ''})`, 24, '#ffffff'));
    bar.add(this.add.text(this.CW / 2 - 150, 72, 'Get a play:', textStyle(20, '#fff4e6', { stroke: INK, strokeThickness: 4 })).setOrigin(0.5));
    bar.add(makeButton(this, this.CW / 2 + 10, 72, '1', () => this.buy('blindBoxTickets'), { w: 110, h: 48, fontSize: 22, skin: 'pink', icon: 'ticket', iconScale: 0.5 }));
    bar.add(makeButton(this, this.CW / 2 + 140, 72, `${ARCADE.PLAY_COST.gems}`, () => this.buy('gems'), { w: 120, h: 48, fontSize: 22, skin: 'purple', icon: 'gem', iconScale: 0.55 }));

    // Game cards
    const W = 340;
    const H = 430;
    const gap = 20;
    const keys = Object.keys(GAMES);
    const cols = Math.max(1, Math.min(keys.length, Math.floor((this.CW + gap) / (W + gap))));
    const rowW = cols * (W + gap) - gap;
    keys.forEach((key, i) => {
      const g = GAMES[key];
      const cx = (this.CW - rowW) / 2 + (i % cols) * (W + gap);
      const cy = 120 + Math.floor(i / cols) * (H + gap);
      const c = this.add.container(cx, cy);
      c.rowHeight = H;
      inner.add(c);
      c.add(addPanel(this, 0, 0, W, H, { header: HEADER[key], headerH: 58, radius: 26 }));
      c.add(outlinedText(this, W / 2, 30, g.name.toUpperCase(), 26));
      // Exclusive prize showcase
      const prize = CATALOG[g.prize];
      const won = a.won.includes(g.prize) || save.hasItem(g.prize);
      c.add(uiImage(this, W / 2 - 75 - 6, 76 - 4, cardKey(this, 150, 180, prize.rarity)));
      const icon = this.add.image(W / 2, 156, `icon_${prize.id}`).setScale((1.0 * 0.75) / ICON_RES);
      this.tweens.add({ targets: icon, y: 148, yoyo: true, repeat: -1, duration: 900 + i * 120, ease: 'Sine.easeInOut' });
      c.add(icon);
      c.add(outlinedText(this, W / 2 + 62, 86, won ? 'WON ✓' : 'WIN!', 18, won ? '#6ee7a8' : '#ffe066').setAngle(12));
      c.add(this.add.text(W / 2, 278, prize.name, textStyle(19, COLORS.text)).setOrigin(0.5));
      c.add(this.add.text(W / 2, 318, g.blurb, textStyle(16, '#7a6a8a', { align: 'center', wordWrap: { width: W - 40 } })).setOrigin(0.5));
      const best = a.best[key];
      if (best) c.add(this.add.text(W / 2, 352, key === 'memory' ? `Best: ${'★'.repeat(best)}` : `Best: ${best}`, textStyle(15, '#c98a00')).setOrigin(0.5));
      const btn = makeButton(this, W / 2, 392, 'PLAY', () => this.play(key), { w: 200, h: 56, fontSize: 28, skin: 'yellow' });
      this.tweens.add({ targets: btn, scale: 1.05, yoyo: true, repeat: -1, duration: 600 + i * 80 });
      c.add(btn);
    });
    const rows = Math.ceil(keys.length / cols);
    this.list.setContentHeight(120 + rows * (H + gap) + 20);
    this.list.setScroll(scroll);
  }

  buy(currency) {
    if (!buyPlay(Services.save, currency)) {
      Services.audio.play('error');
      Services.bus.emit('ui:toast', { text: currency === 'gems' ? 'Not enough gems' : 'No tickets left', color: COLORS.pink });
      return;
    }
    Services.audio.play('cash');
    floatText(this, WIDTH / 2, HEIGHT / 2, '+1 play', '#6ee7a8', 36);
    this.build();
  }

  play(key) {
    if (!usePlay(Services.save)) {
      Services.audio.play('error');
      Services.bus.emit('ui:toast', { text: 'No plays left today', sub: 'Get one with a ticket or gems', color: COLORS.pink });
      return;
    }
    this.list?.destroy();
    leaveTo(this, GAMES[key].scene);
  }
}
