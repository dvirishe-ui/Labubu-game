/**
 * ClawScene.js
 * Claw Machine: the claw swings left and right on its own - tap DROP at the
 * right moment to grab a capsule and carry it to the prize chute. The
 * glowing capsule holds Neon Arcade Labubu, but it is slippery!
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../../config/GameConfig.js';
import { Services } from '../../systems/Services.js';
import { fillClawMachine, clawHolds, clawReward } from '../../systems/MiniGames.js';
import { ICON_RES } from '../../art/CharacterRenderer.js';
import { makeButton, outlinedText, floatText } from '../../ui/UIKit.js';
import { arcadeBackdrop, showArcadeResult } from './ArcadeUI.js';

const R = 34; // capsule radius

export class ClawScene extends Phaser.Scene {
  constructor() {
    super('Claw');
  }

  create() {
    this._leaving = false;
    this.state = 'swing';
    arcadeBackdrop(this, 'CLAW MACHINE');
    const portrait = HEIGHT > WIDTH;
    const MW = Math.min(WIDTH - 40, 660);
    const top = portrait ? Math.max(170, Math.round((HEIGHT - 760) / 2)) : 90; // centre the cabinet on tall phones
    const bottom = Math.min(HEIGHT - (portrait ? 190 : 110), top + 600); // short drop = snappy game
    this.M = { x0: (WIDTH - MW) / 2, x1: (WIDTH + MW) / 2, top, bottom };
    const M = this.M;
    this.chute = { x0: M.x0 + 18, x1: M.x0 + 120 };

    // Machine cabinet + glass
    const g = this.add.graphics();
    g.fillStyle(0x2d1b3d, 1).fillRoundedRect(M.x0 - 14, M.top - 14, MW + 28, M.bottom - M.top + 28, 30);
    g.fillStyle(0xff4fa3, 1).fillRoundedRect(M.x0 - 8, M.top - 8, MW + 16, M.bottom - M.top + 16, 26);
    g.fillGradientStyle(0xbfe9ff, 0xbfe9ff, 0x6b4fa8, 0x6b4fa8, 0.9);
    g.fillRoundedRect(M.x0, M.top, MW, M.bottom - M.top, 20);
    g.fillStyle(0xffffff, 0.12).fillRoundedRect(M.x0 + 16, M.top + 12, 36, M.bottom - M.top - 60, 18);
    // chute
    g.fillStyle(0x1a0f2e, 1).fillRoundedRect(this.chute.x0, M.bottom - 120, this.chute.x1 - this.chute.x0, 120, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.lineStyle(5, 0xffd23f, 1).strokeRoundedRect(this.chute.x0, M.bottom - 120, this.chute.x1 - this.chute.x0, 120, { tl: 12, tr: 12, bl: 0, br: 0 });
    // rail
    g.fillStyle(0xd9dde3, 1).fillRect(M.x0 + 10, M.top + 18, MW - 20, 10);
    outlinedText(this, (this.chute.x0 + this.chute.x1) / 2, M.bottom - 140, 'PRIZE', 20, '#ffe066');
    // marquee lights
    for (let i = 0; i < 12; i++) {
      const dot = this.add.circle(M.x0 + 20 + (i * (MW - 40)) / 11, M.top - 1, 5, [0xffd23f, 0x39e6ff, 0xffffff][i % 3]);
      this.tweens.add({ targets: dot, alpha: 0.3, yoyo: true, repeat: -1, duration: 300, delay: i * 60 });
    }

    // Capsules in the pit
    this.capsules = [];
    const prizes = Phaser.Utils.Array.Shuffle(fillClawMachine(9));
    const pitX0 = this.chute.x1 + R + 10;
    const pitX1 = M.x1 - R - 10;
    prizes.forEach((p, i) => {
      // bottom row of 5, top row of 4 resting in the gaps
      const row = i < 5 ? 0 : 1;
      const k = row === 0 ? i : i - 5 + 0.5;
      const x = pitX0 + (k * (pitX1 - pitX0)) / 4;
      const y = M.bottom - R - 6 - row * (R * 1.6);
      this.capsules.push(this.makeCapsule(x, y, p));
    });

    // Claw
    this.cable = this.add.graphics().setDepth(20);
    this.claw = this.add.container(pitX0, M.top + 60).setDepth(21);
    this.prongs = [this.add.graphics(), this.add.graphics()];
    const head = this.add.graphics();
    head.fillStyle(0xc9d2de, 1).fillRoundedRect(-22, -18, 44, 26, 8);
    head.lineStyle(3, 0x2d1b3d, 1).strokeRoundedRect(-22, -18, 44, 26, 8);
    head.fillStyle(0xff4fa3, 1).fillCircle(0, -5, 6);
    this.claw.add([...this.prongs, head]);
    this.setProngs(0.6);
    this.clawRange = [pitX0, pitX1];
    this.dir = 1;

    const btnY = Math.min(HEIGHT - (portrait ? 100 : 50), bottom + 110);
    this.dropBtn = makeButton(this, WIDTH / 2, btnY, 'DROP!', () => this.drop(), { w: 280, h: 76, fontSize: 38, skin: 'pink' }).setDepth(30);
    this.tweens.add({ targets: this.dropBtn, scale: 1.06, yoyo: true, repeat: -1, duration: 400 });
    this.hint = outlinedText(this, WIDTH / 2, M.top + 110, 'Tap DROP when the claw is over a capsule!', 22, '#ffffff').setDepth(30);
    this.input.keyboard?.on('keydown-SPACE', () => this.drop());
  }

  makeCapsule(x, y, prize) {
    const c = this.add.container(x, y).setDepth(10);
    if (prize.id === 'neon') {
      const glow = this.add.circle(0, 0, R + 12, 0x39e6ff, 0.35);
      this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.1, yoyo: true, repeat: -1, duration: 600 });
      c.add(glow);
    }
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, R);
    g.fillStyle(prize.color, 0.85).slice(0, 0, R, Math.PI, 0, false).fillPath();
    g.lineStyle(4, 0x2d1b3d, 1).strokeCircle(0, 0, R);
    g.lineStyle(2, 0x2d1b3d, 0.4).lineBetween(-R, 0, R, 0);
    g.fillStyle(0xffffff, 0.6).fillEllipse(-12, -16, 14, 8);
    const icon = this.add.image(0, 2, prize.icon);
    if (prize.icon.startsWith('icon_')) icon.setScale((0.42 * 0.75) / ICON_RES);
    else icon.setScale(0.85);
    c.add([g, icon]);
    c.prize = prize;
    return c;
  }

  setProngs(open) {
    // open: 0 closed .. 1 wide
    this.prongs.forEach((p, i) => {
      const s = i ? 1 : -1;
      p.clear();
      p.lineStyle(9, 0x2d1b3d, 1);
      p.beginPath();
      p.moveTo(s * 14, 4);
      p.lineTo(s * (14 + 18 * open), 30);
      p.lineTo(s * (4 + 10 * open), 48);
      p.strokePath();
      p.lineStyle(5, 0xffd23f, 1);
      p.strokePath();
    });
  }

  update(_t, delta) {
    const M = this.M;
    if (this.state === 'swing') {
      this.claw.x += this.dir * 260 * (delta / 1000);
      if (this.claw.x > this.clawRange[1]) this.dir = -1;
      if (this.claw.x < this.clawRange[0]) this.dir = 1;
    }
    this.cable.clear();
    this.cable.lineStyle(4, 0x2d1b3d, 1).lineBetween(this.claw.x, M.top + 24, this.claw.x, this.claw.y - 18);
    if (this.carried) this.carried.setPosition(this.claw.x, this.claw.y + 50 + R * 0.4);
  }

  tween(cfg) {
    return new Promise((resolve) => this.tweens.add({ ...cfg, onComplete: resolve }));
  }

  async drop() {
    if (this.state !== 'swing') return;
    this.state = 'drop';
    this.hint.setVisible(false);
    this.dropBtn.setEnabled(false);
    Services.audio.play('slide');
    const M = this.M;
    this.setProngs(1);
    // Nearest capsule under the claw (top capsules first)
    const target = this.capsules
      .filter((c) => Math.abs(c.x - this.claw.x) < R * 0.9)
      .sort((a, b) => a.y - b.y)[0];
    const downTo = target ? target.y - 50 : M.bottom - 60;
    await this.tween({ targets: this.claw, y: downTo, duration: 900, ease: 'Sine.easeIn' });
    await this.tween({ targets: { v: 1 }, v: 0.15, duration: 250, onUpdate: (tw, o) => this.setProngs(o.v) });
    Services.audio.play('bump');
    let result = null;
    if (target) {
      const holds = clawHolds(target.prize);
      this.carried = target;
      target.setDepth(19);
      this.capsules = this.capsules.filter((c) => c !== target);
      // Lift
      await this.tween({ targets: this.claw, y: M.top + 60, duration: 1000, ease: 'Sine.easeOut' });
      if (!holds) {
        // Slips out halfway!
        this.carried = null;
        this.setProngs(0.8);
        Services.audio.play('error');
        floatText(this, this.claw.x, this.claw.y + 60, 'SO CLOSE!', '#ff8fd0', 36);
        await this.tween({ targets: target, y: M.bottom - R - 6, duration: 600, ease: 'Bounce.easeOut' });
        this.capsules.push(target);
      } else {
        // Carry to the chute and drop it in
        await this.tween({ targets: this.claw, x: (this.chute.x0 + this.chute.x1) / 2, duration: 900, ease: 'Sine.easeInOut' });
        this.setProngs(1);
        this.carried = null;
        await this.tween({ targets: target, y: M.bottom - 40, alpha: 0, scale: 0.6, duration: 450, ease: 'Quad.easeIn' });
        this.cameras.main.flash(200, 255, 240, 200);
        result = clawReward(Services.save, target.prize);
      }
    } else {
      floatText(this, this.claw.x, downTo, 'MISSED!', '#ffffff', 34);
      await this.tween({ targets: this.claw, y: M.top + 60, duration: 800, ease: 'Sine.easeOut' });
    }
    this.state = 'done';
    this.time.delayedCall(400, () =>
      showArcadeResult(this, {
        title: result ? 'You got it!' : 'Oh no!',
        subtitle: result ? '' : 'The claw came up empty. Try again!',
        rewards: result || [],
        ribbon: result ? 'pink' : 'gray'
      })
    );
  }
}
