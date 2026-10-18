/**
 * RunnerScene.js
 * Pseudo-3D, three-lane endless runner (the camera chases Labubu from behind).
 *
 *  - World units are metres. project(x, y, z) maps a point on the track onto
 *    the screen with a perspective divide; the road is redrawn every frame as
 *    ~60 colour-striped slabs (rainbow kerbs, lane dashes, haze toward the
 *    horizon) and gently curves left and right.
 *  - Everything adapts to the viewport, so the game is full screen in BOTH
 *    portrait and landscape and re-lays itself out live when the phone rotates.
 *  - Speed ramps with distance (fast from the start); a score multiplier grows
 *    every 300 m. Kid-friendly juice: praise pop-ups, confetti, rainbow
 *    after-images, coin combos, close calls, L-A-B-U-B-U letters.
 *  - Mario Kart-style extras: 3-2-1-GO with a rocket start, item boxes and a
 *    roulette, boost pads, and a one-ticket revive.
 *  - Controls: swipe left/right = change lane, tap or swipe up = jump (tap
 *    again in the air = double jump), swipe down / hold = roll. Arrow keys,
 *    WASD and Space work on desktop.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, RUNNER, COLORS, EVENTS, WORD_HUNT } from '../config/GameConfig.js';
import { Services } from '../systems/Services.js';
import { computePerks } from '../systems/PerkCalculator.js';
import { RUN_ITEMS, ITEM_ORDER, rollRunItem } from '../systems/RunnerItems.js';
import { wordHuntState, nextLetterIndex, collectLetter } from '../systems/DailyRewards.js';
import { Player } from '../entities/Player.js';
import { ObstaclePool, OBSTACLE_TYPES } from '../entities/ObstaclePool.js';
import { CollectiblePool } from '../entities/CollectiblePool.js';
import { placeBillboard } from '../entities/World3D.js';
import { pointerPos, setupCamera } from '../ui/Display.js';
import { makeButton, makeIconButton, makeProgressBar, Modal, outlinedText, textStyle, floatText } from '../ui/UIKit.js';

const SWIPE = 26; // logical px for a swipe
const TAP_MS = 280;
const ROAD_HALF = 3.5; // metres from centre to the outer kerb edge
const STRIPE_M = 3.2;
const SLABS = 60;

const GRASS = [0x6ad86f, 0x55c75f];
// Candy-coloured road sections (peach, pink, mint, lavender) and rainbow kerbs.
const ROADS = [
  [0xffe0b5, 0xffd29c],
  [0xffd6e8, 0xffc2dc],
  [0xd4f7e6, 0xbff0d8],
  [0xe6dcff, 0xd6c8ff]
];
const KERB = [0xff5a6e, 0xff9f43, 0xffd23f, 0x6ee7a8, 0x59b8ff, 0xb07cff];
const HAZE = 0xffe3f2;

/** Roadside scenery: [texture, height m, weight, distance-from-road range]. */
const SCENERY = [
  ['sc_pine', 6.5, 3, [1.2, 9]],
  ['sc_oak', 6.2, 3, [1.5, 10]],
  ['sc_lolli', 3.4, 2, [0.8, 5]],
  ['sc_shroom', 2.3, 2, [0.6, 6]],
  ['sc_flower', 0.95, 4, [0.2, 2.5]],
  ['sc_bush', 1.3, 3, [0.3, 4]]
];

const PRAISE = ['NICE!', 'GREAT!', 'AWESOME!', 'AMAZING!', 'INCREDIBLE!', 'UNSTOPPABLE!', 'LEGENDARY!'];
const PRAISE_COLORS = ['#6ee7a8', '#59b8ff', '#ffc93c', '#ff8fb1', '#b07cff', '#ff7a1a', '#ffe066'];

/** Linear blend of two 0xRRGGBB colours. */
function lerpColor(a, b, t) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (r << 16) | (g << 8) | bl;
}

export class RunnerScene extends Phaser.Scene {
  constructor() {
    super('Runner');
  }

  init() {
    this.gameTime = 0; // ms of gameplay clock (advances with the capped delta)
    this.distance = 0; // metres
    this.score = 0;
    this.multiplier = 1;
    this.speed = 0;
    this.baseSpeed = RUNNER.BASE_SPEED;
    this.drawDistance = RUNNER.PLAYER_Z + RUNNER.DRAW_DISTANCE;
    this.coinBank = 0;
    this.coinCount = 0;
    this.ticketsFound = 0;
    this.nextTickAt = RUNNER.DISTANCE_TICK_METERS;
    this.nextRowAt = RUNNER.PLAYER_Z + 22; // first row a short way ahead
    this.lastItemBoxAt = 60;
    this.nextLetterAt = 120;
    this.curve = 0;
    this.curveTarget = 0;
    this.nextCurveAt = 150;
    this.camX = 0;
    this.magnetUntil = 0;
    this.boostUntil = 0;
    this.boostTarget = 1;
    this.boostMult = 1;
    this.heldItem = null;
    this.rolling = false;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastCoinAt = -Infinity;
    this.streak = 0;
    this.praiseLevel = 0;
    this.closeCalls = 0;
    this.started = false;
    this.goAt = Infinity;
    this.rocketTried = false;
    this.isOver = false;
    this.isPaused = false;
    this.revived = false;
    this.gesture = null;
    this.keyHeld = false;
  }

  create() {
    this.perks = computePerks(Services.save.data.equipped);
    wordHuntState(Services.save);

    this.computeView();
    this.createBackground();
    this.roadG = this.add.graphics().setDepth(2);
    this.createScenery();

    this.player = new Player(this, this.perks);
    this.obstacles = new ObstaclePool(this);
    this.pickups = new CollectiblePool(this);
    this.createFx();
    this.createHud();
    this.createInput();
    this.bindPlayerEvents();

    Services.bus.on('app:pause', this.onAppPause, this);
    this.events.once('shutdown', () => {
      Services.bus.offContext(this);
      this.events.off('player-jump');
      this.events.off('player-land');
      this.events.off('player-duck');
      this.events.off('player-lane');
    });

    this.cameras.main.fadeIn(250, 43, 29, 58);
    this.updateSpawner(); // pre-fill the road to the horizon
    this.renderWorld(0, 0);
    this.startCountdown();
  }

  // -------------------------------------------------------------------------- 3D view

  /** Camera parameters derived from the current viewport (portrait or landscape). */
  computeView() {
    const portrait = HEIGHT > WIDTH;
    const pxPerM = portrait ? WIDTH / 6.1 : Math.min(HEIGHT / 5.4, WIDTH / 8.5);
    const horizonY = HEIGHT * (portrait ? 0.33 : 0.36);
    const feetY = HEIGHT * (portrait ? 0.84 : 0.88);
    this.view = {
      portrait,
      cx: WIDTH / 2,
      horizonY,
      f: pxPerM * RUNNER.PLAYER_Z,
      camH: (feetY - horizonY) / pxPerM
    };
  }

  /** Horizontal bend of the track at depth z (metres), relative to the runner. */
  curveOffset(z) {
    return this.curve * (z * z - RUNNER.PLAYER_Z * RUNNER.PLAYER_Z) * 0.0026;
  }

  /** World (metres) -> screen. s = pixels per metre at that depth. */
  project(x, y, z) {
    const v = this.view;
    const zz = Math.max(0.3, z);
    const s = v.f / zz;
    return { x: v.cx + (x - this.camX + this.curveOffset(zz)) * s, y: v.horizonY + (v.camH - y) * s, s };
  }

  /** Called by main.js when the phone rotates: re-project, re-layout, keep running. */
  onViewportChange() {
    setupCamera(this);
    this.computeView();
    this.layoutBackground();
    this.layoutHud();
    this.renderWorld(0, 0);
  }

  // -------------------------------------------------------------------------- setup

  createBackground() {
    this.sky = this.add.image(0, 0, 'sky3d').setOrigin(0).setDepth(0);
    this.sun = this.add.image(0, 0, 'sun').setDepth(0.1);
    this.bgClouds = this.add.tileSprite(0, 0, WIDTH, 260, 'bg_clouds').setOrigin(0.5, 1).setDepth(0.2);
    this.bgMountains = this.add.tileSprite(0, 0, WIDTH, 300, 'bg_mountains').setOrigin(0.5, 1).setDepth(0.3);
    this.bgHills = this.add.tileSprite(0, 0, WIDTH, 260, 'bg_hills').setOrigin(0.5, 1).setDepth(0.4);
    this.bgForest = this.add.tileSprite(0, 0, WIDTH * 2, 400, 'bg_canopy').setOrigin(0.5, 1).setDepth(0.5);
    this.tint = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xff7b54, 0).setOrigin(0).setDepth(19000);
    this.layoutBackground();
  }

  layoutBackground() {
    const h = this.view.horizonY;
    this.sky.setDisplaySize(WIDTH, h + 40);
    this.sun.setPosition(WIDTH * 0.74, h * 0.38).setScale(Math.max(0.8, WIDTH / 1200));
    const s = this.view.portrait ? 0.75 : 1;
    this.bgClouds.setPosition(WIDTH / 2, h * 0.55).setSize(WIDTH, 260).setScale(s);
    this.bgMountains.setPosition(WIDTH / 2, h + 6).setSize(WIDTH / s, 300).setScale(s);
    this.bgHills.setPosition(WIDTH / 2, h + 8).setSize(WIDTH / s, 260).setScale(s * 0.8);
    this.bgForest.setPosition(WIDTH / 2, h + 10).setSize((WIDTH / 0.42) * 1.1, 400).setScale(0.42);
    this.tint.setSize(WIDTH, HEIGHT);
  }

  createScenery() {
    this.scenery = [];
    const total = SCENERY.reduce((s, t) => s + t[2], 0);
    const pick = () => {
      let r = Math.random() * total;
      for (const t of SCENERY) {
        r -= t[2];
        if (r <= 0) return t;
      }
      return SCENERY[0];
    };
    const count = 44;
    for (let i = 0; i < count; i++) {
      const img = this.add.image(0, 0, 'sc_pine').setOrigin(0.5, 1);
      const item = { img, pick };
      this.respawnScenery(item, 1.5 + (i / count) * (this.drawDistance - 2));
      this.scenery.push(item);
    }
  }

  respawnScenery(item, z) {
    const [tex, h, , [near, far]] = item.pick();
    const side = Math.random() < 0.5 ? -1 : 1;
    item.img.setTexture(tex);
    item.h = h;
    item.x = side * (ROAD_HALF + near + Math.random() * (far - near));
    item.z = z;
  }

  createFx() {
    this.sparkle = this.add
      .particles(0, 0, 'p_spark', {
        lifespan: 450,
        speed: { min: 80, max: 260 },
        scale: { start: 1, end: 0 },
        tint: [0xffe066, 0xffffff, 0xffc93c],
        blendMode: 'ADD',
        emitting: false
      })
      .setDepth(15000);
    this.dust = this.add
      .particles(0, 0, 'p_dust', {
        lifespan: 380,
        speed: { min: 40, max: 160 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xe9c79a,
        emitting: false
      })
      .setDepth(14000);
    this.confetti = this.add
      .particles(0, 0, 'p_confetti', {
        x: { min: 0, max: WIDTH },
        y: -10,
        lifespan: 1800,
        speedY: { min: 250, max: 520 },
        speedX: { min: -120, max: 120 },
        rotate: { start: 0, end: 720 },
        scale: { min: 0.9, max: 1.6 },
        tint: [0xff5a6e, 0xffc93c, 0x6ee7a8, 0x59b8ff, 0xb07cff, 0xff8fb1],
        emitting: false
      })
      .setDepth(16000);
    // Warp stars stream out of the vanishing point while boosting.
    this.warp = this.add
      .particles(0, 0, 'p_spark', {
        lifespan: 520,
        speed: { min: 500, max: 1100 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.2, end: 1.6 },
        alpha: { start: 0.2, end: 0.9 },
        tint: [0xffffff, 0xffe066, 0x8fd3ff, 0xff8fb1],
        blendMode: 'ADD',
        frequency: 14,
        quantity: 2,
        emitting: false
      })
      .setDepth(3);
  }

  bindPlayerEvents() {
    const feet = () => this.project(this.player.x, 0, RUNNER.PLAYER_Z);
    this.events.on('player-jump', ({ double, count }) => {
      Services.audio.play(double ? 'doubleJump' : 'jump');
      const f = feet();
      this.dust.explode(double ? 4 : 10, f.x, f.y);
      if (double) this.sparkle.explode(8, f.x, f.y - this.player.y * f.s - 60);
      if (count === 3) this.popText('TRIPLE JUMP!', '#6ee7a8');
    });
    this.events.on('player-land', () => {
      Services.audio.play('land');
      const f = feet();
      this.dust.explode(10, f.x, f.y);
    });
    this.events.on('player-duck', () => Services.audio.play('slide'));
    this.events.on('player-lane', () => Services.audio.play('lane'));
  }

  // -------------------------------------------------------------------------- HUD

  createHud() {
    const hudDepth = 20000;
    this.hud = {};
    const h = this.hud;
    h.scoreBg = this.add.graphics().setDepth(hudDepth);
    h.score = this.add.text(0, 0, '0', textStyle(48, '#ffffff', { stroke: '#3d2a52', strokeThickness: 8, fontStyle: 'bold italic' })).setDepth(hudDepth + 1);
    h.mult = outlinedText(this, 0, 0, 'x1', 30, '#ffe066').setDepth(hudDepth + 1).setOrigin(0, 0.5);
    h.dist = this.add.text(0, 0, '0 m', textStyle(20, '#ffffff', { stroke: '#3d2a52', strokeThickness: 4 })).setDepth(hudDepth + 1);
    h.coinIcon = this.add.image(0, 0, 'coin').setScale(0.85).setDepth(hudDepth + 1);
    h.coins = this.add.text(0, 0, '0', textStyle(36, '#ffe066', { stroke: '#3d2a52', strokeThickness: 7, fontStyle: 'bold italic' })).setOrigin(1, 0.5).setDepth(hudDepth + 1);
    h.letters = WORD_HUNT.WORD.split('').map((ch) => this.add.image(0, 0, `letter_${ch}`).setScale(0.36).setDepth(hudDepth + 1));
    h.combo = outlinedText(this, 0, 0, '', 28, '#6ee7a8').setAlpha(0).setDepth(hudDepth + 1);

    // Item slot (tap to fire the held item)
    h.item = this.add.container(0, 0).setDepth(hudDepth + 2);
    const ring = this.add.graphics();
    ring.fillStyle(0x000000, 0.35).fillCircle(0, 0, 46);
    ring.lineStyle(5, 0xffffff, 0.95).strokeCircle(0, 0, 44);
    h.itemIcon = this.add.image(0, 0, 'item_box').setScale(0.8).setAlpha(0.25);
    h.itemLabel = this.add.text(0, 56, '', textStyle(16, '#ffffff', { stroke: '#3d2a52', strokeThickness: 3 })).setOrigin(0.5, 0);
    h.item.add([ring, h.itemIcon, h.itemLabel]);
    h.item.setSize(100, 100).setInteractive({ useHandCursor: true });
    h.item.on('pointerdown', () => this.useItem());

    h.magnetBar = makeProgressBar(this, 0, 0, 160, 14, { fill: 0x3fa9f5 });
    h.magnetBar.graphics.setDepth(hudDepth).setVisible(false);

    h.pause = makeIconButton(this, 0, 0, 'II', () => this.pauseGame(), { size: 60 }).setDepth(hudDepth + 2);
    this.layoutHud();
    this.refreshLetters();
  }

  /** Positions every HUD element for the current orientation. */
  layoutHud() {
    const h = this.hud;
    const W = WIDTH;
    h.scoreBg.clear();
    h.scoreBg.fillStyle(0x000000, 0.3).fillRoundedRect(14, 12, 300, 96, 26);
    h.scoreBg.fillStyle(0x000000, 0.3).fillRoundedRect(W - 230, 12, 140, 60, 30);
    h.score.setPosition(30, 14);
    h.mult.setPosition(232, 42);
    h.dist.setPosition(32, 76);
    h.coinIcon.setPosition(W - 200, 42);
    h.coins.setPosition(W - 104, 42);
    h.pause.setPosition(W - 46, 44);
    h.letters.forEach((l, i) => l.setPosition(36 + i * 38, 136));
    h.combo.setPosition(W / 2, this.view.portrait ? 190 : 120);
    h.item.setPosition(W - 70, this.view.portrait ? 160 : 150);
    h.magnetBar.graphics.setPosition(W - 230, 82);
  }

  refreshLetters() {
    const st = wordHuntState(Services.save);
    this.hud.letters.forEach((l, i) => {
      if (st.collected[i]) l.clearTint().setAlpha(1);
      else l.setTintFill(0x3d2a52).setAlpha(0.35);
    });
  }

  updateHud() {
    const h = this.hud;
    const sc = Math.floor(this.score);
    if (sc !== this._shownScore) {
      this._shownScore = sc;
      h.score.setText(sc.toLocaleString('en-US'));
    }
    const m = Math.floor(this.distance);
    if (m !== this._shownM) {
      this._shownM = m;
      h.dist.setText(`${m.toLocaleString('en-US')} m`);
    }
    const coins = Math.floor(this.coinBank);
    if (coins !== this._shownCoins) {
      this._shownCoins = coins;
      h.coins.setText(String(coins));
      this.tweens.killTweensOf(h.coinIcon);
      h.coinIcon.setScale(1.15);
      this.tweens.add({ targets: h.coinIcon, scale: 0.85, duration: 160 });
    }
    const magnet = this.gameTime < this.magnetUntil;
    h.magnetBar.graphics.setVisible(magnet);
    if (magnet) h.magnetBar.set((this.magnetUntil - this.gameTime) / RUNNER.SUPER_MAGNET_DURATION_MS);
  }

  // -------------------------------------------------------------------------- input

  /**
   * Swipes fire as soon as the finger has travelled SWIPE px; a quick tap
   * (no travel) jumps on release. A second tap in the air = double jump.
   */
  createInput() {
    this.input.on('pointerdown', (pointer, over) => {
      if (over.length || this.isPaused) return;
      if (!this.started) {
        this.tryRocketStart();
        return;
      }
      if (this.isOver) return;
      const { x, y } = pointerPos(pointer);
      this.gesture = { x, y, t: this.time.now, fired: false, id: pointer.id };
      this.player.setJumpHeld(true);
    });
    this.input.on('pointermove', (pointer) => {
      const g = this.gesture;
      if (!g || g.fired || g.id !== pointer.id || !pointer.isDown || this.isOver || this.isPaused) return;
      const { x, y } = pointerPos(pointer);
      const dx = x - g.x;
      const dy = y - g.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      g.fired = true;
      if (Math.abs(dx) > Math.abs(dy)) this.player.moveLane(dx > 0 ? 1 : -1);
      else if (dy < 0) this.player.jump();
      else {
        this.player.setJumpHeld(false);
        this.player.duck(true);
        g.duck = true;
      }
    });
    const release = (pointer) => {
      const g = this.gesture;
      if (!g || g.id !== pointer.id) return;
      this.gesture = null;
      if (g.duck) this.player.releaseDuck();
      if (!g.fired && !this.isOver && !this.isPaused && this.time.now - g.t < TAP_MS) this.player.jump();
      if (!this.keyHeld) this.player.setJumpHeld(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    const kb = this.input.keyboard;
    if (!kb) return;
    const live = () => this.started && !this.isOver && !this.isPaused;
    const jumpDown = (e) => {
      if (e.repeat) return;
      if (!this.started) return this.tryRocketStart();
      if (!live()) return;
      this.keyHeld = true;
      this.player.setJumpHeld(true);
      this.player.jump();
    };
    const jumpUp = () => {
      this.keyHeld = false;
      this.player.setJumpHeld(false);
    };
    for (const key of ['SPACE', 'UP', 'W']) {
      kb.on(`keydown-${key}`, jumpDown);
      kb.on(`keyup-${key}`, jumpUp);
    }
    for (const key of ['LEFT', 'A']) kb.on(`keydown-${key}`, (e) => !e.repeat && live() && this.player.moveLane(-1));
    for (const key of ['RIGHT', 'D']) kb.on(`keydown-${key}`, (e) => !e.repeat && live() && this.player.moveLane(1));
    for (const key of ['DOWN', 'S']) {
      kb.on(`keydown-${key}`, (e) => !e.repeat && live() && this.player.duck(true));
      kb.on(`keyup-${key}`, () => this.player.releaseDuck());
    }
    for (const key of ['E', 'SHIFT', 'ENTER']) kb.on(`keydown-${key}`, () => this.useItem());
    for (const key of ['ESC', 'P']) kb.on(`keydown-${key}`, () => (this.isPaused ? this.resumeGame() : this.pauseGame()));
  }

  // -------------------------------------------------------------------------- countdown

  startCountdown() {
    Services.audio.stopMusic();
    const step = RUNNER.COUNTDOWN_STEP_MS;
    const hint = this.add
      .text(WIDTH / 2, HEIGHT * 0.5, 'Swipe ← → to switch lanes\nTap to jump · swipe ↓ to roll\nTap on GO! for a rocket start', textStyle(26, '#ffffff', { stroke: '#3d2a52', strokeThickness: 6, align: 'center', lineSpacing: 6 }))
      .setOrigin(0.5)
      .setDepth(21000);
    const show = (label, color, big) => {
      const t = outlinedText(this, WIDTH / 2, HEIGHT * 0.3, label, big ? 140 : 120, color).setDepth(21000).setScale(0.3);
      this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, scale: 1.5, delay: step - 120, duration: 200, onComplete: () => t.destroy() });
    };
    ['3', '2', '1'].forEach((n, i) =>
      this.time.delayedCall(250 + i * step, () => {
        show(n, ['#ff5a6e', '#ffc93c', '#59b8ff'][i]);
        Services.audio.play('countdown');
        if (i === 2) this.goAt = this.time.now + step;
      })
    );
    this.time.delayedCall(250 + 3 * step, () => {
      show('GO!', '#6ee7a8', true);
      this.goAt = this.time.now;
      Services.audio.play('go');
      this.tweens.add({ targets: hint, alpha: 0, duration: 400, delay: 600, onComplete: () => hint.destroy() });
      this.started = true;
      Services.audio.playMusic('run');
      Services.bus.emit(EVENTS.RUN_STARTED, { perks: this.perks });
    });
  }

  tryRocketStart() {
    if (this.rocketTried) return;
    const delta = this.time.now - this.goAt;
    if (Math.abs(delta) <= RUNNER.ROCKET_WINDOW_MS) {
      this.rocketTried = true;
      this.startBoost(RUNNER.ROCKET_BOOST);
      Services.audio.play('rocket');
      this.popText('ROCKET START!', '#ffc93c');
      this.cameras.main.flash(120, 255, 240, 180);
    } else if (delta < -RUNNER.ROCKET_WINDOW_MS && delta > -RUNNER.COUNTDOWN_STEP_MS * 1.5) {
      this.rocketTried = true;
      floatText(this, WIDTH / 2, HEIGHT * 0.45, 'Too early!', '#ffffff', 30);
    }
  }

  // -------------------------------------------------------------------------- loop

  update(_realTime, delta) {
    if (this.isPaused) return;
    const dt = Math.min(delta, 100) / 1000;
    this.gameTime += dt * 1000;

    if (this.gameTime > this.boostUntil) this.boostTarget = 1;
    const target = Math.max(this.boostTarget, this.player.hasStar ? RUNNER.STAR_SPEED_MULT : 1);
    this.boostMult += (target - this.boostMult) * Math.min(1, dt * (target > this.boostMult ? 10 : 3));
    this.player.boosting = this.boostTarget > 1.01 && !this.isOver;

    if (!this.started) this.speed = 0;
    else if (!this.isOver) {
      this.baseSpeed = Math.min(RUNNER.MAX_SPEED, RUNNER.BASE_SPEED + this.distance * RUNNER.SPEED_PER_METER);
      this.speed = this.baseSpeed * this.boostMult;
    } else this.speed = Math.max(0, this.speed - 40 * dt);
    const dz = this.speed * dt;

    // Curving track
    if (this.distance > this.nextCurveAt) {
      this.nextCurveAt = this.distance + Phaser.Math.Between(120, 260);
      this.curveTarget = Math.random() < 0.3 ? 0 : Phaser.Math.FloatBetween(-1, 1);
    }
    this.curve += (this.curveTarget - this.curve) * Math.min(1, dt * 0.6);

    this.player.update(dt, this.speed);
    this.camX += (this.player.x * 0.55 - this.camX) * Math.min(1, dt * 8);
    this.warp.emitting = this.boostMult > 1.05 && !this.isOver;
    this.warp.setPosition(this.view.cx, this.view.horizonY);

    if (this.started && !this.isOver) {
      this.distance += dz;
      this.multiplier = Math.min(RUNNER.MAX_MULTIPLIER, 1 + Math.floor(this.distance / RUNNER.MULTIPLIER_EVERY_M)) + (this.player.hasStar ? 1 : 0);
      this.score += dz * 10 * this.multiplier;
    }

    this.renderWorld(dz, dt);

    if (this.isOver || !this.started) return;
    this.checkCollisions();
    this.updateSpawner();
    this.emitDistanceTicks();
    this.updateHud();
    this.updateMultiplierBadge();
    if (this.combo && this.gameTime - this.lastCoinAt > RUNNER.COMBO_WINDOW_MS) this.endCombo();

    const d = this.distance;
    if (d > 2000 && d < 4000) this.tint.setFillStyle(0xff7b54, Math.min(0.2, (d - 2000) / 4000));
    else if (d >= 4000) this.tint.setFillStyle(0x2a1a6a, Math.min(0.32, (d - 4000) / 3000));
  }

  /** Moves the world by dz metres and draws it. */
  renderWorld(dz, dt) {
    this.drawRoad();
    const par = this.curve * this.speed * dt;
    this.bgClouds.tilePositionX += par * 1 + dt * 4;
    this.bgMountains.tilePositionX += par * 2;
    this.bgHills.tilePositionX += par * 4;
    this.bgForest.tilePositionX += par * 9;

    for (const item of this.scenery) {
      item.z -= dz;
      if (item.z < 1) this.respawnScenery(item, item.z + this.drawDistance - 1);
      placeBillboard(this, item.img, item.x, 0, item.z, item.h, item.img.height);
    }

    this.obstacles.update(dz, dt, (o) => this.onObstaclePassed(o));
    const magnet = this.gameTime < this.magnetUntil;
    const reach = { coin: Math.max(1.1, this.perks.attractRadius), magnet: magnet ? RUNNER.SUPER_MAGNET_RANGE : 0 };
    this.pickups.update(dz, dt, this.player, reach, (p) => !this.isOver && this.onPickup(p));
    this.player.render(this);
  }

  /** Paints the striped road, rainbow kerbs, lane dashes and grass. */
  drawRoad() {
    const g = this.roadG;
    g.clear();
    const zNear = 0.9;
    const zFar = this.drawDistance;
    const v = this.view;
    let prev = null;
    for (let i = 0; i <= SLABS; i++) {
      const z = zNear * Math.pow(zFar / zNear, i / SLABS);
      const curve = this.curveOffset(z);
      const s = v.f / z;
      const cur = {
        z,
        y: v.horizonY + v.camH * s,
        cx: v.cx + (curve - this.camX) * s,
        s
      };
      if (prev) {
        const stripe = Math.floor((this.distance + prev.z) / STRIPE_M);
        const fog = Math.min(1, Math.pow(prev.z / zFar, 1.2)) * 0.8;
        const top = cur.y;
        const bottom = prev.y + 1;
        g.fillStyle(lerpColor(GRASS[stripe & 1], HAZE, fog), 1);
        g.fillRect(0, top, WIDTH, bottom - top);
        const quad = (x0, x1, color) => {
          g.fillStyle(lerpColor(color, HAZE, fog), 1);
          g.fillPoints(
            [
              { x: prev.cx + x0 * prev.s, y: bottom },
              { x: prev.cx + x1 * prev.s, y: bottom },
              { x: cur.cx + x1 * cur.s, y: top },
              { x: cur.cx + x0 * cur.s, y: top }
            ],
            true
          );
        };
        quad(-ROAD_HALF, ROAD_HALF, ROADS[Math.floor(stripe / 30) % ROADS.length][stripe & 1]);
        quad(-ROAD_HALF, -ROAD_HALF + 0.45, KERB[stripe % KERB.length]);
        quad(ROAD_HALF - 0.45, ROAD_HALF, KERB[(stripe + 3) % KERB.length]);
        if (stripe % 2 === 0) {
          quad(-1.12, -0.98, 0xffffff);
          quad(0.98, 1.12, 0xffffff);
        }
      }
      prev = cur;
    }
  }

  // -------------------------------------------------------------------------- collisions

  checkCollisions() {
    const p = this.player;
    if (p.isCrashed) return;
    for (const o of this.obstacles.active) {
      if (o.hitDone || (o.ignoreUntil && this.gameTime < o.ignoreUntil)) continue;
      const def = o.def;
      // Slightly forgiving boxes: brushing an edge doesn't count.
      if (Math.abs(o.z - RUNNER.PLAYER_Z) > def.d / 2 + 0.25) continue;
      if (Math.abs(o.x - p.x) > def.w / 2 + 0.18) continue;
      let hit;
      if (def.kind === 'duck') hit = p.y + p.height > def.clear && p.y < def.top;
      else hit = p.y < def.h;
      if (!hit) continue;

      // Swerving into the side of a wall just bumps you back (kid-friendly).
      if (def.kind === 'wall' && p.isChangingLane && o.lane === p.lane && p.prevLane !== o.lane) {
        p.bounceBack();
        o.ignoreUntil = this.gameTime + 350;
        this.stumble();
        continue;
      }
      this.onObstacleHit(o);
    }
  }

  stumble() {
    Services.audio.play('bump');
    this.cameras.main.shake(140, 0.006);
    this.streak = 0;
    this.praiseLevel = 0;
    floatText(this, WIDTH / 2, HEIGHT * 0.45, 'BONK!', '#ffffff', 34);
  }

  onObstacleHit(o) {
    if (this.isOver || o.hitDone || !this.started) return;
    const result = this.player.hit();
    const f = this.project(o.x, 1, o.z);
    if (result === 'smash') {
      this.obstacles.smash(o);
      Services.audio.play('smash');
      this.sparkle.explode(18, f.x, f.y);
      this.cameras.main.shake(100, 0.005);
      this.coinBank += 3;
      floatText(this, f.x, f.y - 40, 'SMASH +3', '#ffe066', 30);
    } else if (result === 'shield') {
      this.obstacles.smash(o);
      Services.audio.play('shieldBreak');
      this.sparkle.explode(24, f.x, f.y);
      this.cameras.main.shake(150, 0.007);
      this.popText('SHIELD SAVE!', '#8fd3ff');
    } else if (result === 'crash') {
      o.hitDone = true;
      this.onCrash(o.type);
    }
  }

  /** Obstacle passed the runner: dodge event, streak praise and close calls. */
  onObstaclePassed(o) {
    if (this.isOver || o.hitDone) return;
    Services.bus.emit(EVENTS.OBSTACLE_DODGED, { type: o.type });
    const p = this.player;
    const overlapping = Math.abs(o.x - p.x) < o.def.w / 2 + 0.3;
    if (!overlapping) return;
    let gap = Infinity;
    if (o.def.kind === 'jump') gap = p.y - o.def.h;
    else if (o.def.kind === 'duck') gap = o.def.clear - (p.y + p.height);
    if (gap >= 0 && gap < RUNNER.CLOSE_CALL_M) {
      this.closeCalls += 1;
      this.coinBank += 2;
      Services.audio.play('closeCall');
      floatText(this, WIDTH / 2, HEIGHT * 0.5, 'CLOSE CALL! +2', '#6ee7a8', 30);
    }
    this.streak += 1;
    if (this.streak % 6 === 0) this.praise();
  }

  // -------------------------------------------------------------------------- spawning

  /**
   * Keeps the track filled up to the draw distance. Rows are placed at
   * absolute track positions, so the very first frame already shows a full
   * road of coins and hazards stretching to the horizon.
   */
  updateSpawner() {
    while (this.nextRowAt < this.distance + this.drawDistance) {
      const gap = Phaser.Math.Clamp(Math.max(this.speed, RUNNER.BASE_SPEED) * 0.95, 15, 32);
      this.spawnRow(this.nextRowAt - this.distance, gap);
      this.nextRowAt += gap;
    }
  }

  /** Lays out one "row" at depth z: obstacles, coins, items, letters. */
  spawnRow(z, gap) {
    const m = this.distance + z; // track position of this row (difficulty)
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]);
    const P = this.pickups;

    // Warm-up: coins only.
    if (m < 35) {
      P.spawnLine(lanes[0], z, 6);
      return;
    }

    const roll = Math.random();
    let free = [];
    if (roll < 0.14) {
      // Breather: zig-zag coin trail (+ boost pad)
      P.spawnLine(lanes[0], z, 4);
      P.spawnLine(lanes[1], z + 9, 4);
      if (Math.random() < 0.5) P.spawn('boost', RUNNER.LANES[lanes[2]], 0, z + 4);
      free = [lanes[2]];
    } else if (roll < 0.42 || m < 150) {
      // One hazard; coins in another lane or arcing over it
      const type = this.obstacles.randomType(m);
      this.obstacles.spawn(type, lanes[0], z);
      if (OBSTACLE_TYPES[type].kind === 'jump' && Math.random() < 0.55) P.spawnArc(lanes[0], z, 7, 9, 1.9);
      else P.spawnLine(lanes[1], z - 6, 6);
      free = [lanes[1], lanes[2]];
    } else if (roll < 0.66) {
      // Two hazards, one open lane full of coins
      this.obstacles.spawn(this.obstacles.randomType(m), lanes[0], z);
      this.obstacles.spawn(this.obstacles.randomType(m, ['jump', 'duck']), lanes[1], z);
      P.spawnLine(lanes[2], z - 7, 7);
      free = [lanes[2]];
    } else if (roll < 0.8 && m > 220) {
      // Full-width jump row (everyone must hop) with a coin arc
      for (const l of lanes) this.obstacles.spawn(this.obstacles.randomType(m, ['jump']), l, z);
      P.spawnArc(lanes[0], z, 7, 9, 2.1);
    } else if (roll < 0.9 && m > 200) {
      // Gates in every lane: roll under!
      for (const l of lanes) this.obstacles.spawn('gate', l, z);
      P.spawnLine(lanes[1], z - 2, 4, 1.6, 0.35);
    } else {
      // Two toadstool houses: find the gap
      this.obstacles.spawn('tower', lanes[0], z);
      this.obstacles.spawn('tower', lanes[1], z);
      P.spawnLine(lanes[2], z - 10, 8);
      free = [lanes[2]];
    }

    const lane = free.length ? free[Math.floor(Math.random() * free.length)] : lanes[2];
    const ahead = z + gap * 0.5;
    if (m - this.lastItemBoxAt > 200) {
      this.lastItemBoxAt = m;
      for (const l of [0, 1, 2]) P.spawn('itembox', RUNNER.LANES[l], 0.6, ahead);
    } else if (m >= this.nextLetterAt && !this.pickups.active.some((p) => p.kind === 'letter' && !p.collected)) {
      const idx = nextLetterIndex(Services.save);
      this.nextLetterAt = m + RUNNER.LETTER_EVERY_M * Phaser.Math.FloatBetween(0.7, 1.2);
      if (idx >= 0) {
        P.spawn('letter', RUNNER.LANES[lane], 0.7, ahead, { letter: WORD_HUNT.WORD[idx], index: idx });
      }
    } else if (Math.random() < 0.12) {
      P.spawn('boost', RUNNER.LANES[lane], 0, ahead);
    } else if (m > 150 && this.ticketsFound < 3 && Math.random() < 0.04 * (1 + this.perks.ticketLuck)) {
      P.spawn('ticket', RUNNER.LANES[lane], 1.9, ahead);
    } else if (Math.random() < 0.05) {
      P.spawn('magnet', RUNNER.LANES[lane], 0.7, ahead);
    }
  }

  emitDistanceTicks() {
    while (this.distance >= this.nextTickAt) {
      Services.bus.emit(EVENTS.DISTANCE_TICK, { meters: RUNNER.DISTANCE_TICK_METERS, runDistance: Math.floor(this.nextTickAt) });
      this.nextTickAt += RUNNER.DISTANCE_TICK_METERS;
    }
  }

  updateMultiplierBadge() {
    if (this.multiplier !== this._shownMult) {
      const up = this._shownMult !== undefined && this.multiplier > this._shownMult;
      this._shownMult = this.multiplier;
      this.hud.mult.setText(`x${this.multiplier}`);
      if (up) {
        this.tweens.add({ targets: this.hud.mult, scale: 1.8, yoyo: true, duration: 180 });
        this.popText(`SCORE x${this.multiplier}!`, '#ffe066');
        this.confetti.explode(40);
      }
    }
  }

  // -------------------------------------------------------------------------- juice

  /** Big bouncy rainbow text in the middle of the screen. */
  popText(text, color = '#ffffff') {
    const t = outlinedText(this, WIDTH / 2, HEIGHT * (this.view.portrait ? 0.24 : 0.3), text, this.view.portrait ? 52 : 58, color).setDepth(21000).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 60, delay: 650, duration: 300, onComplete: () => t.destroy() });
  }

  /** Escalating praise for streaks (kids love being told they're awesome). */
  praise() {
    const i = Math.min(this.praiseLevel, PRAISE.length - 1);
    this.praiseLevel += 1;
    this.popText(PRAISE[i], PRAISE_COLORS[i]);
    this.confetti.explode(20 + i * 8);
    Services.audio.play('praise', i);
  }

  // -------------------------------------------------------------------------- items & boosts

  startBoost({ ms, mult }) {
    this.boostUntil = Math.max(this.boostUntil, this.gameTime + ms);
    this.boostTarget = Math.max(this.boostTarget, mult);
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    this.tweens.add({ targets: cam, zoom: RES * 1.05, duration: 120, yoyo: true, ease: 'Quad.easeOut', onComplete: () => cam.setZoom(RES) });
  }

  startRoulette() {
    if (this.heldItem || this.rolling) {
      this.coinBank += 5;
      floatText(this, WIDTH / 2, HEIGHT * 0.5, '+5', '#ffe066', 30);
      return;
    }
    this.rolling = true;
    const h = this.hud;
    h.itemIcon.setAlpha(1);
    let i = 0;
    const spins = 16;
    this.time.addEvent({
      delay: 70,
      repeat: spins - 1,
      callback: () => {
        i++;
        h.itemIcon.setTexture(RUN_ITEMS[ITEM_ORDER[i % ITEM_ORDER.length]].icon).setScale(0.9);
        Services.audio.play('roulette');
        if (i === spins) {
          const key = rollRunItem();
          this.heldItem = key;
          this.rolling = false;
          h.itemIcon.setTexture(RUN_ITEMS[key].icon).setScale(0.9);
          h.itemLabel.setText('TAP!');
          Services.audio.play('itemGet');
          this.tweens.add({ targets: h.item, scale: 1.2, yoyo: true, repeat: 3, duration: 140 });
        }
      }
    });
  }

  useItem() {
    if (!this.heldItem || this.isOver || this.isPaused || !this.started) return;
    const key = this.heldItem;
    this.heldItem = null;
    const h = this.hud;
    h.itemIcon.setTexture('item_box').setAlpha(0.25).setScale(0.8);
    h.itemLabel.setText('');
    switch (key) {
      case 'mushroom':
        this.startBoost(RUNNER.MUSHROOM_BOOST);
        Services.audio.play('boost');
        this.popText('DASH!', '#ff8fb1');
        break;
      case 'star':
        this.player.starUntil = this.gameTime + RUNNER.STAR_MS;
        Services.audio.play('star');
        this.popText('SUPER STAR!', '#ffe066');
        this.confetti.explode(50);
        this.cameras.main.flash(150, 255, 245, 180);
        break;
      case 'magnet':
        this.magnetUntil = this.gameTime + RUNNER.SUPER_MAGNET_DURATION_MS;
        Services.audio.play('powerup');
        this.popText('MAGNET!', '#8fd3ff');
        break;
      case 'coins':
        Services.audio.play('powerup');
        this.popText('COIN RAIN!', '#ffe066');
        for (const l of [0, 1, 2]) this.pickups.spawnLine(l, 40 + l * 3, 12, 2.4);
        break;
      case 'shield':
        this.player.addShield();
        Services.audio.play('itemGet');
        this.popText('BUBBLE SHIELD!', '#8fd3ff');
        break;
      default:
        break;
    }
  }

  onPickup(p) {
    const f = this.project(p.x, p.y, p.z);
    if (p.kind === 'coin') {
      const now = this.gameTime;
      this.combo = now - this.lastCoinAt <= RUNNER.COMBO_WINDOW_MS ? this.combo + 1 : 1;
      this.lastCoinAt = now;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.coinCount += 1;
      this.coinBank += RUNNER.COIN_VALUE * this.perks.coinMultiplier;
      this.score += 5 * this.multiplier;
      Services.audio.play('coin');
      this.sparkle.explode(3, f.x, f.y);
      if (this.combo >= 3) {
        const c = this.hud.combo;
        this.tweens.killTweensOf(c);
        c.setText(`COMBO x${this.combo}`).setAlpha(1).setScale(1.3);
        this.tweens.add({ targets: c, scale: 1, duration: 140 });
      }
      if (this.combo % 10 === 0) {
        this.coinBank += 3;
        Services.audio.play('combo');
        this.praise();
      }
      Services.bus.emit(EVENTS.COIN_COLLECTED, { amount: 1, runCoins: this.coinCount });
    } else if (p.kind === 'ticket') {
      this.ticketsFound += 1;
      Services.audio.play('ticket');
      this.sparkle.explode(16, f.x, f.y);
      this.popText('+1 TICKET!', '#ff8fb1');
      Services.bus.emit(EVENTS.TICKET_COLLECTED, { amount: 1 });
    } else if (p.kind === 'magnet') {
      this.magnetUntil = this.gameTime + RUNNER.SUPER_MAGNET_DURATION_MS;
      Services.audio.play('powerup');
      this.popText('MAGNET!', '#8fd3ff');
    } else if (p.kind === 'itembox') {
      Services.audio.play('itemBox');
      this.sparkle.explode(14, f.x, f.y);
      this.startRoulette();
    } else if (p.kind === 'boost') {
      this.startBoost(RUNNER.PAD_BOOST);
      Services.audio.play('boost');
      this.popText('BOOST!', '#ffb347');
    } else if (p.kind === 'letter') {
      const { complete, reward } = collectLetter(Services.save, p.index);
      this.refreshLetters();
      const icon = this.hud.letters[p.index];
      this.tweens.add({ targets: icon, scale: 0.7, yoyo: true, duration: 200 });
      Services.audio.play('letter');
      this.sparkle.explode(20, f.x, f.y);
      if (complete && reward) {
        Services.audio.play('wordComplete');
        this.popText('L-A-B-U-B-U!', '#ff8fb1');
        this.confetti.explode(120);
        this.time.delayedCall(900, () => this.popText(`+${reward.popCoins} COINS +${reward.blindBoxTickets} TICKET`, '#ffe066'));
      } else {
        this.popText(`Letter ${p.letter}!`, '#b07cff');
      }
    }
  }

  endCombo() {
    this.combo = 0;
    this.tweens.add({ targets: this.hud.combo, alpha: 0, duration: 250 });
  }

  // -------------------------------------------------------------------------- pause / revive / end

  onAppPause() {
    if (!this.isOver && !this.isPaused) this.pauseGame();
  }

  pauseGame() {
    if (this.isOver || this.isPaused) return;
    this.isPaused = true;
    this.time.paused = true;
    this.warp.emitting = false;
    this.player.setJumpHeld(false);
    this.player.releaseDuck();
    this.gesture = null;
    this.pauseModal = new Modal(this, { width: 520, height: 360, title: 'Paused', closable: false, depth: 30000 });
    this.pauseModal.add([
      makeButton(this, 260, 120, 'Resume', () => this.resumeGame(), { w: 280, h: 70, color: COLORS.gold, colorDark: COLORS.goldDark }),
      makeButton(
        this,
        260,
        230,
        'Quit run',
        () => {
          this.pauseModal.close();
          this.isPaused = false;
          this.time.paused = false;
          this.onCrash('quit');
        },
        { w: 280, h: 64, fontSize: 24, color: COLORS.pink, colorDark: COLORS.pinkDark }
      ),
      this.add.text(260, 310, 'Quitting keeps the coins you collected', textStyle(18, '#7a6a8a')).setOrigin(0.5)
    ]);
  }

  resumeGame() {
    if (!this.isPaused || this.isOver) return;
    this.pauseModal?.close();
    this.pauseModal = null;
    this.isPaused = false;
    this.time.paused = false;
  }

  onCrash(cause) {
    if (this.isOver) return;
    this.isOver = true;
    this.warp.emitting = false;
    this.gesture = null;
    if (cause !== 'quit') {
      if (!this.player.isCrashed) this.player.crash();
      Services.audio.play('crash');
      this.cameras.main.shake(320, 0.014);
      this.cameras.main.flash(140, 255, 255, 255);
    }
    Services.audio.stopMusic();
    const tickets = Services.save.data.currencies.blindBoxTickets;
    if (!this.revived && cause !== 'quit' && tickets >= RUNNER.REVIVE_TICKET_COST) this.time.delayedCall(650, () => this.offerRevive());
    else this.finishRun(cause);
  }

  offerRevive() {
    const modal = new Modal(this, { width: 560, height: 360, title: 'Second Chance?', closable: false, depth: 30000 });
    let decided = false;
    const timer = makeProgressBar(this, 70, 222, 420, 18, { fill: COLORS.pink });
    timer.set(1);
    const decline = () => {
      if (decided) return;
      decided = true;
      modal.close();
      this.finishRun('crash');
    };
    modal.add([
      this.add.text(280, 72, `Score ${Math.floor(this.score).toLocaleString('en-US')} · ${Math.floor(this.coinBank)} coins`, textStyle(22, '#7a6a8a')).setOrigin(0.5),
      makeButton(
        this,
        280,
        150,
        `Keep running · ${RUNNER.REVIVE_TICKET_COST}`,
        () => {
          if (decided) return;
          if (!Services.save.spendCurrency('blindBoxTickets', RUNNER.REVIVE_TICKET_COST, 'revive')) return decline();
          decided = true;
          modal.close();
          this.revive();
        },
        { w: 380, h: 72, fontSize: 28, icon: 'ticket', iconScale: 0.6, color: COLORS.gold, colorDark: COLORS.goldDark }
      ),
      timer.graphics,
      makeButton(this, 280, 296, 'No thanks', decline, { w: 220, h: 50, fontSize: 20, color: 0xc9bfd6, colorDark: 0x9a8fab })
    ]);
    const start = this.time.now;
    const tick = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const left = 1 - (this.time.now - start) / RUNNER.REVIVE_PROMPT_MS;
        timer.set(left);
        if (decided) tick.remove();
        else if (left <= 0) {
          tick.remove();
          decline();
        }
      }
    });
  }

  revive() {
    this.revived = true;
    this.obstacles.clearNear(RUNNER.PLAYER_Z + 45);
    this.player.revive();
    this.isOver = false;
    this.speed = this.baseSpeed;
    Services.audio.playMusic('run');
    Services.audio.play('powerup');
    this.popText('KEEP GOING!', '#6ee7a8');
  }

  finishRun(cause) {
    const coins = Math.floor(this.coinBank);
    const distance = Math.floor(this.distance);
    const score = Math.floor(this.score);
    const prevBest = Services.save.data.stats.highScore;
    const { isHighScore } = Services.save.recordRun({ distance, coins, tickets: this.ticketsFound, score });
    Services.bus.emit(EVENTS.RUN_ENDED, { distance, coins, score, tickets: this.ticketsFound, cause });
    this.time.delayedCall(cause === 'quit' ? 100 : 500, () => this.showResults({ coins, distance, score, isHighScore, prevBest }));
  }

  showResults({ coins, distance, score, isHighScore, prevBest }) {
    if (isHighScore) {
      Services.audio.play('highScore');
      this.confetti.explode(120);
    }
    const modal = new Modal(this, { width: 640, height: 600, title: isHighScore ? 'NEW BEST!' : 'Great Run!', closable: false, depth: 30000 });
    modal.add(outlinedText(this, 320, 92, score.toLocaleString('en-US'), 64, '#ffe066'));
    const lines = [
      ['Distance', `${distance.toLocaleString('en-US')} m`],
      ['Pop Coins', `+${coins}`],
      ['Best combo · close calls', `x${this.maxCombo} · ${this.closeCalls}`],
      ['Best score', `${Math.max(prevBest, score).toLocaleString('en-US')}`]
    ];
    lines.forEach(([label, value], i) => {
      const y = 170 + i * 48;
      modal.add([
        this.add.text(70, y, label, textStyle(23, '#7a6a8a')).setOrigin(0, 0.5),
        this.add.text(570, y, value, textStyle(26, i === 1 ? '#c98a00' : COLORS.text)).setOrigin(1, 0.5)
      ]);
    });
    const st = wordHuntState(Services.save);
    WORD_HUNT.WORD.split('').forEach((ch, i) => {
      const img = this.add.image(200 + i * 48, 375, `letter_${ch}`).setScale(0.42);
      if (!st.collected[i]) img.setTintFill(0x3d2a52).setAlpha(0.3);
      modal.add(img);
    });
    const leave = (key, data) => {
      this.input.enabled = false;
      this.cameras.main.fadeOut(200, 43, 29, 58);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
    };
    modal.add(makeButton(this, 320, 458, 'PLAY AGAIN', () => leave('Runner'), { w: 340, h: 80, fontSize: 34, color: COLORS.gold, colorDark: COLORS.goldDark }));
    modal.add(makeButton(this, 180, 548, 'Menu', () => leave('MainMenu'), { w: 230, h: 58, fontSize: 24, color: COLORS.mint, colorDark: 0x4fb594 }));
    const boxBtn = makeButton(this, 460, 548, 'Open Box', () => leave('Unboxing', { source: 'ticket' }), { w: 230, h: 58, fontSize: 24, icon: 'ticket', iconScale: 0.5 });
    boxBtn.setEnabled(Services.save.data.currencies.blindBoxTickets > 0);
    modal.add(boxBtn);
  }
}

