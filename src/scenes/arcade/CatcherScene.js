/**
 * CatcherScene.js
 * Coin Catcher: slide Labubu left and right to catch falling coins, gems and
 * gift boxes for 30 seconds - and dodge the rocks (3 lives). 100 points wins
 * the exclusive Lucky Gift Pack.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../../config/GameConfig.js';
import { Services } from '../../systems/Services.js';
import { catcherReward } from '../../systems/MiniGames.js';
import { pointerPos } from '../../ui/Display.js';
import { floatText, outlinedText } from '../../ui/UIKit.js';
import { hudText } from '../../ui/BitmapFont.js';
import { arcadeBackdrop, showArcadeResult } from './ArcadeUI.js';

const ROUND_MS = 30000;
const DROPS = [
  { kind: 'coin', tex: 'coin', scale: 1.1, points: 1, weight: 58 },
  { kind: 'gem', tex: 'gem', scale: 1.0, points: 5, weight: 12 },
  { kind: 'gift', tex: 'box_icon_classic', scale: 0.45, points: 10, weight: 6 },
  { kind: 'rock', tex: 'obs_rock', scale: 0.28, points: 0, weight: 24 }
];

export class CatcherScene extends Phaser.Scene {
  constructor() {
    super('Catcher');
  }

  create() {
    this._leaving = false;
    arcadeBackdrop(this, 'COIN CATCHER');
    const portrait = HEIGHT > WIDTH;
    this.score = 0;
    this.lives = 3;
    this.timeLeft = ROUND_MS;
    this.items = [];
    this.nextDrop = 600;
    this.over = false;
    this.started = false;

    this.groundY = HEIGHT - (portrait ? 130 : 70);
    this.add.rectangle(WIDTH / 2, this.groundY + 40, WIDTH, 80, 0x5fc24f).setDepth(1);
    this.add.rectangle(WIDTH / 2, this.groundY + 4, WIDTH, 8, 0x3f8f3a).setDepth(1);
    this.player = this.add.image(WIDTH / 2, this.groundY + 6, 'player_preview').setOrigin(0.5, 1).setScale(0.42).setDepth(10);
    this.targetX = WIDTH / 2;

    const hudY = portrait ? 170 : 96;
    this.scoreText = hudText(this, WIDTH / 2 - 150, hudY, '0', 34, '#ffe066').setDepth(50);
    this.timeText = hudText(this, WIDTH / 2, hudY, '30', 34, '#ffffff').setDepth(50);
    this.livesText = hudText(this, WIDTH / 2 + 150, hudY, '♥♥♥', 34, '#ff5a6e').setDepth(50);

    const msg = outlinedText(this, WIDTH / 2, HEIGHT / 2, 'Drag to move · catch coins, dodge rocks!\nTap to start', 28, '#ffffff').setDepth(60);
    msg.setAlign?.('center');
    const startGame = () => {
      if (this.started) return;
      this.started = true;
      msg.destroy();
      Services.audio.play('go');
    };
    this.input.on('pointerdown', (p) => {
      startGame();
      this.targetX = pointerPos(p).x;
    });
    this.input.on('pointermove', (p) => {
      if (p.isDown || !this.sys.game.device.input.touch) this.targetX = pointerPos(p).x;
    });
    this.keys = this.input.keyboard?.addKeys('LEFT,RIGHT,A,D,SPACE');
    this.input.keyboard?.on('keydown-SPACE', startGame);
  }

  spawn() {
    const total = DROPS.reduce((s, d) => s + d.weight, 0);
    let r = Math.random() * total;
    const def = DROPS.find((d) => (r -= d.weight) < 0) || DROPS[0];
    const img = this.add.image(Phaser.Math.Between(40, WIDTH - 40), -40, def.tex).setScale(def.scale).setDepth(5);
    // Falls the screen in ~3 s at the start, ~2 s by the end (any screen size).
    const progress = 1 - this.timeLeft / ROUND_MS;
    const vy = HEIGHT * (0.32 + progress * 0.22) * Phaser.Math.FloatBetween(0.9, 1.15);
    this.items.push({ img, def, vy, spin: Phaser.Math.FloatBetween(-3, 3) });
  }

  update(_t, delta) {
    if (!this.started || this.over) return;
    const dt = Math.min(delta, 50) / 1000;
    this.timeLeft -= delta;
    this.timeText.setText(String(Math.max(0, Math.ceil(this.timeLeft / 1000))));

    // Move Labubu (pointer / keys), smoothly
    if (this.keys) {
      if (this.keys.LEFT.isDown || this.keys.A.isDown) this.targetX -= 620 * dt;
      if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.targetX += 620 * dt;
    }
    this.targetX = Phaser.Math.Clamp(this.targetX, 40, WIDTH - 40);
    const prevX = this.player.x;
    this.player.x += (this.targetX - this.player.x) * Math.min(1, dt * 14);
    this.player.setAngle(Phaser.Math.Clamp((this.player.x - prevX) * 0.8, -12, 12));

    this.nextDrop -= delta;
    if (this.nextDrop <= 0) {
      this.spawn();
      this.nextDrop = Math.max(220, 520 - (ROUND_MS - this.timeLeft) * 0.01);
    }

    const catchY = this.groundY - 110;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.img.y += it.vy * dt;
      it.img.angle += it.spin;
      const caught = it.img.y > catchY && it.img.y < this.groundY - 20 && Math.abs(it.img.x - this.player.x) < 64;
      if (caught) {
        this.collect(it);
        it.img.destroy();
        this.items.splice(i, 1);
      } else if (it.img.y > this.groundY + 30) {
        it.img.destroy();
        this.items.splice(i, 1);
      }
    }
    if (this.timeLeft <= 0 || this.lives <= 0) this.end();
  }

  collect(it) {
    if (it.def.kind === 'rock') {
      this.lives -= 1;
      this.livesText.setText('♥'.repeat(Math.max(0, this.lives)) || '-');
      Services.audio.play('bump');
      this.cameras.main.shake(160, 0.01);
      this.tweens.add({ targets: this.player, alpha: 0.3, yoyo: true, repeat: 2, duration: 80 });
      return;
    }
    this.score += it.def.points;
    this.scoreText.setText(String(this.score));
    Services.audio.play(it.def.kind === 'coin' ? 'coin' : 'itemGet');
    floatText(this, it.img.x, it.img.y - 20, `+${it.def.points}`, it.def.kind === 'coin' ? '#ffe066' : '#ff9ef0', 26);
    if (this.score >= 100 && !this.hit100) {
      this.hit100 = true;
      floatText(this, WIDTH / 2, HEIGHT / 2, '100! PRIZE UNLOCKED!', '#6ee7a8', 40);
      Services.audio.play('praise', 4);
    }
  }

  end() {
    this.over = true;
    this.items.forEach((it) => it.img.destroy());
    this.items = [];
    const { rewards } = catcherReward(Services.save, this.score);
    this.time.delayedCall(400, () =>
      showArcadeResult(this, {
        title: this.lives <= 0 ? 'Bonk! Game over' : "Time's up!",
        subtitle: `You scored ${this.score} points${this.score >= 100 ? ' - amazing!' : this.score >= 60 ? ' - a golden key!' : ''}`,
        rewards,
        ribbon: this.score >= 100 ? 'yellow' : 'blue'
      })
    );
  }
}
