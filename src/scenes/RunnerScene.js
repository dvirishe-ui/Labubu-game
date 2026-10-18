/**
 * RunnerScene.js
 * The endless-runner core loop.
 *
 *  - Arcade physics (gravity 1200) for the player; the world scrolls past a
 *    fixed-x runner. Speed ramps with distance:
 *        speed = min(MAX_SPEED, BASE_SPEED + distanceMeters * 0.15) x boosts
 *  - 6-layer parallax: sky, clouds, mountains, hills, canopy, path, plus a
 *    foreground grass layer that rushes past in front of the runner.
 *  - Obstacles and pickups come from object pools and are recycled once they
 *    leave the screen on the left.
 *  - Mario Kart-inspired extras: 3-2-1-GO countdown with a rocket start, item
 *    boxes with a roulette (Dash Mushroom, Super Star, Magnet, Coin Rain,
 *    Bubble Shield), boost pads, coin combos, close-call bonuses and a revive.
 *  - Touch controls fire on finger-down: right side = jump (double tap =
 *    double jump), left side = duck while held. Swipes work everywhere too.
 *  - Gameplay events go onto the shared bus for QuestManager.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, RUNNER, COLORS, EVENTS } from '../config/GameConfig.js';
import { Services } from '../systems/Services.js';
import { computePerks } from '../systems/PerkCalculator.js';
import { RUN_ITEMS, ITEM_ORDER, rollRunItem } from '../systems/RunnerItems.js';
import { Player, PlayerState } from '../entities/Player.js';
import { ObstaclePool, OBSTACLE_TYPES } from '../entities/ObstaclePool.js';
import { CollectiblePool } from '../entities/CollectiblePool.js';
import { pointerPos } from '../ui/Display.js';
import { makeButton, makeIconButton, makeProgressBar, Modal, outlinedText, textStyle, floatText } from '../ui/UIKit.js';

const SWIPE_THRESHOLD = 40; // logical px

/** Parallax layers: [texture, y-centre offset from ground, height, scroll factor, depth]. */
const LAYERS = [
  ['bg_clouds', -460, 260, 0.04, 1],
  ['bg_mountains', -280, 300, 0.08, 2],
  ['bg_hills', -230, 260, 0.18, 3],
  ['bg_canopy', -160, 400, 0.38, 4]
];

export class RunnerScene extends Phaser.Scene {
  constructor() {
    super('Runner');
  }

  init() {
    this.distance = 0; // meters
    this.gameTime = 0; // ms, see update()
    this.speed = 0;
    this.baseSpeed = RUNNER.BASE_SPEED;
    this.coinBank = 0; // fractional coin value (perk multipliers)
    this.coinCount = 0; // physical coins picked up (quests)
    this.ticketsFound = 0;
    this.nextTickAt = RUNNER.DISTANCE_TICK_METERS;
    this.spawnCooldownPx = 280; // first coin trail arrives quickly
    this.lastItemBoxAt = -999;
    this.magnetUntil = 0;
    this.boostUntil = 0;
    this.boostTarget = 1;
    this.boostMult = 1;
    this.heldItem = null;
    this.rolling = false;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastCoinAt = -Infinity;
    this.closeCalls = 0;
    this.itemsUsed = 0;
    this.started = false;
    this.goAt = Infinity;
    this.rocketTried = false;
    this.isOver = false;
    this.isPaused = false;
    this.revived = false;
    this.inPit = false;
    this.touches = new Map();
    this.keyHeld = false;
    this.hitbox = new Phaser.Geom.Rectangle();
    this.offscreenRect = new Phaser.Geom.Rectangle(-9999, -9999, 0, 0);
  }

  create() {
    const save = Services.save.data;
    this.perks = computePerks(save.equipped);
    this.groundY = RUNNER.GROUND_Y;

    this.createAnimations();
    this.createParallax();
    this.createWorld();
    this.createFx();
    this.createHud();
    this.createInput();

    Services.bus.on('app:pause', this.onAppPause, this);
    this.events.once('shutdown', () => Services.bus.offContext(this));

    this.cameras.main.fadeIn(250, 43, 29, 58);
    this.startCountdown();
  }

  // -------------------------------------------------------------------------- setup

  createAnimations() {
    if (!this.anims.exists('player_run')) {
      this.anims.create({
        key: 'player_run',
        frames: ['run0', 'run1', 'run2', 'run3'].map((frame) => ({ key: 'player_sheet', frame })),
        frameRate: 12,
        repeat: -1
      });
    }
  }

  createParallax() {
    this.add.image(WIDTH / 2, HEIGHT / 2, 'bg_sky').setDepth(0);
    this.layers = LAYERS.map(([key, dy, h, factor, depth]) => ({
      sprite: this.add.tileSprite(WIDTH / 2, this.groundY + dy, WIDTH, h, key).setDepth(depth),
      factor
    }));
    this.layerGround = this.add.tileSprite(WIDTH / 2, this.groundY - 14, WIDTH, 134, 'ground').setOrigin(0.5, 0).setDepth(5);
    this.layerFg = this.add.tileSprite(WIDTH / 2, HEIGHT - 40, WIDTH, 90, 'fg_grass').setDepth(40).setAlpha(0.95);
    // Time-of-day tint deepens with distance (sunset at 1.5 km, night at 3 km).
    this.skyTint = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xff7b54, 0).setDepth(4.5);
  }

  createWorld() {
    // Invisible static floor; disabled over pits so the runner can fall in.
    this.floor = this.add.zone(WIDTH / 2, this.groundY + 60, WIDTH * 3, 120);
    this.physics.add.existing(this.floor, true);

    this.player = new Player(this, RUNNER.PLAYER_X, this.groundY, this.perks);
    this.floorCollider = this.physics.add.collider(this.player, this.floor);

    this.obstacles = new ObstaclePool(this, this.groundY);
    this.pickups = new CollectiblePool(this);
    this.physics.add.overlap(this.player, this.obstacles.group, (_p, o) => this.onObstacleHit(o));

    this.events.on('player-jump', ({ double, count }) => {
      Services.audio.play(double ? 'doubleJump' : 'jump');
      this.dustBurst.explode(double ? 10 : 6, this.player.x, double ? this.player.y : this.groundY);
      if (double) this.sparkle.explode(6, this.player.x, this.player.y - 30);
      if (count === 3) floatText(this, this.player.x, this.player.y - 150, 'TRIPLE!', '#8fe3c6', 26);
    });
    this.events.on('player-land', () => {
      Services.audio.play('land');
      this.dustBurst.explode(7, this.player.x, this.groundY);
    });
    this.events.on('player-slide', () => {
      Services.audio.play('slide');
      this.dustBurst.explode(5, this.player.x + 20, this.groundY);
    });
    this.events.once('shutdown', () => {
      this.events.off('player-jump');
      this.events.off('player-land');
      this.events.off('player-slide');
    });
  }

  createFx() {
    this.dustTrail = this.add
      .particles(0, 0, 'p_dust', {
        lifespan: 380,
        speedX: { min: -220, max: -90 },
        speedY: { min: -50, max: -5 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.55, end: 0 },
        tint: 0xc99a6a,
        frequency: 60,
        emitting: false
      })
      .setDepth(19);
    this.dustTrail.startFollow(this.player, -14, -4);

    this.dustBurst = this.add
      .particles(0, 0, 'p_dust', {
        lifespan: 420,
        speed: { min: 40, max: 170 },
        angle: { min: 180, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xd9b48a,
        emitting: false
      })
      .setDepth(19);

    this.sparkle = this.add
      .particles(0, 0, 'p_spark', {
        lifespan: 450,
        speed: { min: 60, max: 240 },
        scale: { start: 0.9, end: 0 },
        tint: [0xffe066, 0xffffff, 0xffc93c],
        blendMode: 'ADD',
        emitting: false
      })
      .setDepth(30);

    this.debris = this.add
      .particles(0, 0, 'p_confetti', {
        lifespan: 700,
        speed: { min: 150, max: 380 },
        angle: { min: 200, max: 340 },
        gravityY: 900,
        rotate: { min: 0, max: 360 },
        tint: [0x8a5531, 0x6b4226, 0x3f8f63],
        scale: { min: 0.8, max: 1.4 },
        emitting: false
      })
      .setDepth(30);

    // Speed lines while boosting
    this.speedLines = this.add
      .particles(0, 0, 'fx_speedline', {
        x: { min: WIDTH, max: WIDTH + 100 },
        y: { min: 60, max: HEIGHT - 60 },
        lifespan: 380,
        speedX: { min: -2600, max: -1800 },
        alpha: { start: 0.75, end: 0 },
        scaleX: { min: 0.6, max: 1.6 },
        frequency: 22,
        quantity: 2,
        emitting: false
      })
      .setDepth(35);

    this.leaves = this.add
      .particles(0, 0, 'p_leaf', {
        x: { min: 0, max: WIDTH + 200 },
        y: -20,
        lifespan: 6000,
        speedX: { min: -140, max: -60 },
        speedY: { min: 40, max: 90 },
        rotate: { start: 0, end: 360 },
        tint: [0x6fae4f, 0x8bc34a, 0xd8a24a],
        scale: { min: 0.6, max: 1.1 },
        frequency: 700,
        alpha: 0.85
      })
      .setDepth(4.6);

    this.touchRipple = this.add
      .particles(0, 0, 'fx_touch', {
        lifespan: 320,
        scale: { start: 0.3, end: 1.1 },
        alpha: { start: 0.6, end: 0 },
        emitting: false
      })
      .setDepth(90);
  }

  createHud() {
    const hud = this.add.container(0, 0).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(16, 14, 240, 86, 24);
    g.fillStyle(0x000000, 0.3).fillRoundedRect(WIDTH / 2 - 150, 14, 300, 58, 29);
    hud.add(g);
    this.distanceText = this.add.text(34, 18, '0 m', textStyle(44, '#ffffff', { stroke: '#3d2a52', strokeThickness: 7, fontStyle: 'bold italic' }));
    this.bestText = this.add.text(38, 70, `BEST ${Services.save.data.stats.highScore} m`, textStyle(17, '#ffe9c7', { stroke: '#3d2a52', strokeThickness: 3 }));
    this.coinIcon = this.add.image(WIDTH / 2 - 118, 43, 'coin').setScale(0.8);
    this.coinText = this.add.text(WIDTH / 2 - 90, 43, '0', textStyle(32, '#ffe066', { stroke: '#3d2a52', strokeThickness: 6, fontStyle: 'bold italic' })).setOrigin(0, 0.5);
    const ticketIcon = this.add.image(WIDTH / 2 + 52, 43, 'ticket').setScale(0.6);
    this.ticketText = this.add.text(WIDTH / 2 + 78, 43, '0', textStyle(32, '#ff8fb1', { stroke: '#3d2a52', strokeThickness: 6, fontStyle: 'bold italic' })).setOrigin(0, 0.5);
    this.comboText = outlinedText(this, WIDTH / 2, 92, '', 26, '#8fe3c6').setAlpha(0);
    hud.add([this.distanceText, this.bestText, this.coinIcon, this.coinText, ticketIcon, this.ticketText, this.comboText]);

    // Mario Kart item slot (tap to use)
    this.itemSlot = this.add.container(312, 58).setDepth(101);
    const ring = this.add.graphics();
    ring.fillStyle(0x000000, 0.35).fillCircle(0, 0, 44);
    ring.lineStyle(5, 0xffffff, 0.95).strokeCircle(0, 0, 42);
    this.itemIcon = this.add.image(0, 0, 'item_box').setScale(0.75).setAlpha(0.25);
    this.itemLabel = this.add.text(0, 54, '', textStyle(15, '#ffffff', { stroke: '#3d2a52', strokeThickness: 3 })).setOrigin(0.5, 0);
    this.itemSlot.add([ring, this.itemIcon, this.itemLabel]);
    this.itemSlot.setSize(96, 96).setInteractive({ useHandCursor: true });
    this.itemSlot.on('pointerdown', () => this.useItem());

    // Super Magnet timer
    this.magnetBar = makeProgressBar(this, WIDTH / 2 - 95, 112, 190, 14, { fill: 0x3fa9f5 });
    this.magnetBar.graphics.setVisible(false).setDepth(100);
    this.magnetRing = this.add.image(0, 0, 'fx_ring').setDepth(17).setVisible(false).setTint(0x8fd3ff);

    this.pauseBtn = makeIconButton(this, WIDTH - 48, 46, 'II', () => this.pauseGame(), { size: 62 });
    this.pauseBtn.setDepth(101);

    // Touch zone guides (faint, light up when pressed) on touch devices.
    this.zoneGuides = null;
    if (this.sys.game.device.input.touch) {
      const duckW = WIDTH * RUNNER.DUCK_ZONE;
      const make = (x, w, label) => {
        const c = this.add.container(x, HEIGHT - 70).setDepth(95).setAlpha(0.22);
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 0.35).fillRoundedRect(-w / 2, -34, w, 68, 34);
        c.add([bg, outlinedText(this, 0, 0, label, 24, '#ffffff')]);
        return c;
      };
      this.zoneGuides = {
        duck: make(duckW / 2, Math.min(260, duckW - 40), '▼  HOLD TO DUCK'),
        jump: make(duckW + (WIDTH - duckW) / 2, 320, '▲  TAP · DOUBLE TAP')
      };
    }

    // Active perks summary
    const perkBits = [];
    if (this.perks.maxJumps > 2) perkBits.push('Triple Jump');
    if (this.perks.floatyFall) perkBits.push('Glide');
    if (this.perks.attractRadius > RUNNER.BASE_ATTRACT_RADIUS) perkBits.push(`Magnet ${this.perks.attractRadius}px`);
    if (this.perks.shieldCharges) perkBits.push('Shield');
    if (this.perks.coinMultiplier > 1) perkBits.push(`Coins +${Math.round((this.perks.coinMultiplier - 1) * 100)}%`);
    if (perkBits.length) hud.add(this.add.text(34, 106, perkBits.join(' · '), textStyle(15, '#ffffff', { stroke: '#3d2a52', strokeThickness: 3 })));
  }

  /**
   * Touch: right side = jump on finger-down (tap again in the air = double
   * jump; hold = glide with the Beaver Tail); left side = duck while held.
   * Swipe up / down work anywhere. Keyboard: Space/Up/W, Down/S, E/Shift to
   * use the item, Esc/P to pause.
   */
  createInput() {
    this.input.on('pointerdown', (pointer, over) => {
      if (over.length || this.isPaused) return;
      const { x, y } = pointerPos(pointer);
      this.touchRipple.explode(1, x, y);
      if (!this.started) {
        this.tryRocketStart();
        return;
      }
      if (this.isOver) return;
      const zone = x < WIDTH * RUNNER.DUCK_ZONE ? 'duck' : 'jump';
      this.touches.set(pointer.id, { zone, x, y, swiped: false });
      this.flashZone(zone);
      if (zone === 'jump') {
        this.player.setJumpHeld(true);
        this.player.jump();
      } else {
        this.player.duck(true);
      }
    });
    this.input.on('pointermove', (pointer) => {
      const t = this.touches.get(pointer.id);
      if (!t || t.swiped || !pointer.isDown || this.isOver || this.isPaused) return;
      const dy = pointerPos(pointer).y - t.y;
      if (t.zone === 'duck' && dy < -SWIPE_THRESHOLD) {
        t.swiped = true;
        this.player.releaseDuck();
        this.player.jump();
      } else if (t.zone === 'jump' && dy > SWIPE_THRESHOLD) {
        t.swiped = true;
        this.player.setJumpHeld(false);
        this.player.duck(false);
      }
    });
    const release = (pointer) => {
      const t = this.touches.get(pointer.id);
      if (!t) return;
      this.touches.delete(pointer.id);
      if (t.zone === 'duck' && ![...this.touches.values()].some((o) => o.zone === 'duck')) this.player.releaseDuck();
      if (t.zone === 'jump' && !this.keyHeld && ![...this.touches.values()].some((o) => o.zone === 'jump')) this.player.setJumpHeld(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    const kb = this.input.keyboard;
    if (!kb) return;
    const jumpDown = (e) => {
      if (e.repeat || this.isPaused) return;
      if (!this.started) return this.tryRocketStart();
      if (this.isOver) return;
      this.keyHeld = true;
      this.player.setJumpHeld(true);
      this.player.jump();
    };
    const jumpUp = () => {
      this.keyHeld = false;
      if (![...this.touches.values()].some((o) => o.zone === 'jump')) this.player.setJumpHeld(false);
    };
    for (const key of ['SPACE', 'UP', 'W']) {
      kb.on(`keydown-${key}`, jumpDown);
      kb.on(`keyup-${key}`, jumpUp);
    }
    for (const key of ['DOWN', 'S']) {
      kb.on(`keydown-${key}`, (e) => !e.repeat && this.started && !this.isOver && !this.isPaused && this.player.duck(true));
      kb.on(`keyup-${key}`, () => this.player.releaseDuck());
    }
    for (const key of ['E', 'SHIFT', 'ENTER']) kb.on(`keydown-${key}`, () => this.useItem());
    for (const key of ['ESC', 'P']) kb.on(`keydown-${key}`, () => (this.isPaused ? this.resumeGame() : this.pauseGame()));
  }

  flashZone(zone) {
    const guide = this.zoneGuides?.[zone];
    if (!guide) return;
    this.tweens.killTweensOf(guide);
    guide.setAlpha(0.6);
    this.tweens.add({ targets: guide, alpha: 0.22, duration: 260 });
  }

  // -------------------------------------------------------------------------- countdown

  /** 3 - 2 - 1 - GO! Tap right on GO for a rocket start. */
  startCountdown() {
    Services.audio.stopMusic();
    this.player.anims.pause();
    const step = RUNNER.COUNTDOWN_STEP_MS;
    const hint = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 40, 'Tap on GO! for a rocket start', textStyle(26, '#ffffff', { stroke: '#3d2a52', strokeThickness: 5 }))
      .setOrigin(0.5)
      .setDepth(200);
    const show = (label, color, big) => {
      const t = outlinedText(this, WIDTH / 2, HEIGHT / 2 - 90, label, big ? 130 : 110, color).setDepth(200).setScale(0.3);
      this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, scale: 1.4, delay: step - 120, duration: 200, onComplete: () => t.destroy() });
    };
    ['3', '2', '1'].forEach((n, i) =>
      this.time.delayedCall(250 + i * step, () => {
        show(n, ['#ff5a6e', '#ffc93c', '#ffe066'][i]);
        Services.audio.play('countdown');
        // Anchor the rocket-start window to the scene clock once it is running.
        if (i === 2) this.goAt = this.time.now + step;
      })
    );
    this.time.delayedCall(250 + 3 * step, () => {
      show('GO!', '#6ee7a8', true);
      this.goAt = this.time.now;
      Services.audio.play('go');
      hint.destroy();
      this.started = true;
      this.player.anims.resume();
      Services.audio.playMusic('run');
      Services.bus.emit(EVENTS.RUN_STARTED, { perks: this.perks });
    });
  }

  /** Called for the first tap around "GO!": perfect timing = rocket start. */
  tryRocketStart() {
    if (this.rocketTried) return;
    const delta = this.time.now - this.goAt;
    if (Math.abs(delta) <= RUNNER.ROCKET_WINDOW_MS) {
      this.rocketTried = true;
      this.startBoost(RUNNER.ROCKET_BOOST);
      Services.audio.play('rocket');
      floatText(this, this.player.x + 60, this.player.y - 170, 'ROCKET START!', '#ffc93c', 34);
      this.cameras.main.flash(120, 255, 240, 180);
    } else if (delta < -RUNNER.ROCKET_WINDOW_MS && delta > -RUNNER.COUNTDOWN_STEP_MS * 1.5) {
      this.rocketTried = true;
      floatText(this, this.player.x + 40, this.player.y - 170, 'Too early!', '#ffffff', 26);
    }
  }

  // -------------------------------------------------------------------------- loop

  update(_realTime, delta) {
    if (this.isPaused) return;
    const dt = Math.min(delta, 100) / 1000; // same cap as the game loop (fps.min = 10)
    // Gameplay clock: advances with exactly the same (capped) delta as the
    // scrolling world, so durations like a duck or a boost always cover the
    // same ground even when the phone drops frames.
    this.gameTime += dt * 1000;
    const time = this.gameTime;

    // Boost multiplier eases toward its target (rocket / pads / mushroom / star).
    if (time > this.boostUntil) this.boostTarget = 1;
    const starMult = this.player.hasStar ? RUNNER.STAR_SPEED_MULT : 1;
    const target = Math.max(this.boostTarget, starMult);
    this.boostMult += (target - this.boostMult) * Math.min(1, dt * (target > this.boostMult ? 10 : 3));
    this.player.boosting = this.boostTarget > 1.01 && !this.isOver;

    if (!this.started) {
      this.speed = 0;
    } else if (!this.isOver) {
      this.baseSpeed = Math.min(RUNNER.MAX_SPEED, RUNNER.BASE_SPEED + this.distance * RUNNER.SPEED_PER_METER);
      this.speed = this.baseSpeed * this.boostMult;
    } else {
      this.speed = Math.max(0, this.speed - 1100 * dt);
    }
    const dx = this.speed * dt;

    for (const layer of this.layers) layer.sprite.tilePositionX += dx * layer.factor;
    this.layerGround.tilePositionX += dx;
    this.layerFg.tilePositionX += dx * 1.35;

    // Faster legs at higher speed; speed lines while boosting.
    this.player.anims.timeScale = Phaser.Math.Clamp(this.speed / RUNNER.BASE_SPEED, 1, 2.2);
    this.speedLines.emitting = this.boostMult > 1.05 && !this.isOver;

    this.player.slideDurationMs = Math.max(RUNNER.SLIDE_DURATION_MS, (RUNNER.SLIDE_TAP_PX / Math.max(this.speed, 1)) * 1000);
    this.player.update(time);
    this.updateHitbox();
    this.obstacles.update(
      dx,
      this.player.x,
      (type) => this.onDodged(type),
      (o) => this.onObstaclePassed(o)
    );
    const magnetActive = time < this.magnetUntil;
    const radius = magnetActive ? Math.max(RUNNER.SUPER_MAGNET_RADIUS, this.perks.attractRadius) : this.perks.attractRadius;
    if (!this.isOver) this.pickups.update(dx, dt, this.hitbox, radius, time, (p) => this.onPickup(p));
    else this.pickups.update(dx, dt, this.offscreenRect, 0, time);

    if (this.isOver || !this.started) return;

    this.updatePits();
    this.distance += dx / RUNNER.PIXELS_PER_METER;
    this.updateSpawner(dx);
    this.emitDistanceTicks();
    this.updateHud(time, magnetActive);

    this.dustTrail.emitting = this.player.state === PlayerState.RUN || this.player.state === PlayerState.SLIDE;
    if (this.combo && time - this.lastCoinAt > RUNNER.COMBO_WINDOW_MS) this.endCombo();

    const d = this.distance;
    if (d > 1500 && d < 3000) this.skyTint.setFillStyle(0xff7b54, Math.min(0.22, (d - 1500) / 3000));
    else if (d >= 3000) this.skyTint.setFillStyle(0x1a1446, Math.min(0.38, (d - 3000) / 2500));
  }

  updateHitbox() {
    const b = this.player.body;
    this.hitbox.setTo(b.x, b.y, b.width, b.height);
  }

  /** Pit traps: drop the floor under the runner; shield / star bounce you out. */
  updatePits() {
    const p = this.player;
    const pit = this.obstacles.pitAt(p.body.center.x);
    const below = p.y > this.groundY + 4;
    this.floorCollider.active = !pit && !below;

    if (below && !this.inPit) {
      this.inPit = true;
      if (pit) pit.fellIn = true;
      p.visual.setDepth(4); // drop behind the ground strip: swallowed by the hole
    }
    if (this.inPit && !below) {
      this.inPit = false;
      p.visual.setDepth(20);
    }
    if (this.inPit && p.y > this.groundY + 110 && !p.isCrashed) {
      const result = p.hit();
      if (result === 'crash') {
        this.onCrash('pit');
      } else {
        // Snap to the surface first: rising through the floor collider would
        // make Arcade separate the body downwards and trap it.
        p.body.reset(p.x, this.groundY - 2);
        p.body.setVelocityY(-1000);
        p.setStateTo(PlayerState.JUMP);
        p.visual.setDepth(20);
        this.inPit = false;
        Services.audio.play('shieldBreak');
        this.sparkle.explode(20, p.x, this.groundY);
      }
    }
  }

  /**
   * Distance-based spawner. Each "beat" places one obstacle plus optional coin
   * patterns, item boxes, boost pads and rare pickups.
   */
  updateSpawner(dx) {
    this.spawnCooldownPx -= dx;
    if (this.spawnCooldownPx > 0) return;

    const meters = this.distance;
    const x = WIDTH + 140;
    const speedFactor = Math.pow(this.speed / RUNNER.BASE_SPEED, 0.6);
    const gap = Phaser.Math.Between(RUNNER.MIN_OBSTACLE_GAP, RUNNER.MIN_OBSTACLE_GAP * 1.6) * speedFactor;

    // The first stretch only has coins (and a boost pad) to learn the controls.
    if (meters < 40) {
      this.pickups.spawnLine(x, this.groundY - 34, 6);
      if (meters > 10) this.pickups.spawn('boost', x + 6 * 52 + 120, this.groundY + 2);
      this.spawnCooldownPx = 6 * 52 + gap * 0.6;
      return;
    }

    const type = this.obstacles.randomType(meters);
    const spot = this.obstacles.spawn(type, x);
    const width = spot ? spot.width : 120;
    const kind = OBSTACLE_TYPES[type].kind;
    const centerX = spot ? (spot.left + spot.right) / 2 : x;

    if (spot) {
      if (kind === 'ground' && Math.random() < 0.55) this.pickups.spawnArc(centerX, this.groundY, 7, 240 + this.speed * 0.25, 130);
      else if (kind === 'overhead' && Math.random() < 0.7) this.pickups.spawnLine(centerX - 78, this.groundY - 26, 4);
      else if (kind === 'pit' && Math.random() < 0.6) this.pickups.spawnArc(centerX, this.groundY, 6, 260 + this.speed * 0.2, 150);
    }

    const midX = x + width / 2 + gap / 2;
    const roll = Math.random();
    if (meters - this.lastItemBoxAt > 140 && roll < 0.22) {
      // Row of three item boxes, Mario Kart style
      this.lastItemBoxAt = meters;
      const y = Math.random() < 0.5 ? this.groundY - 60 : this.groundY - 170;
      for (let i = -1; i <= 1; i++) this.pickups.spawn('itembox', midX + i * 80, y);
    } else if (roll < 0.36) {
      this.pickups.spawn('boost', midX, this.groundY + 2);
      this.pickups.spawnLine(midX + 110, this.groundY - 34, 5);
    } else if (roll < 0.75) {
      this.pickups.spawnLine(x + width / 2 + gap * 0.2, this.groundY - 34, Phaser.Math.Between(3, 6));
    }

    const ticketChance = 0.035 * (1 + this.perks.ticketLuck);
    if (meters > 150 && this.ticketsFound < 3 && Math.random() < ticketChance) {
      this.pickups.spawn('ticket', midX + 40, this.groundY - 210);
    }

    const doubleUp = meters > 800 && kind === 'ground' && Math.random() < 0.25;
    this.spawnCooldownPx = width + (doubleUp ? gap * 0.45 : gap);
  }

  emitDistanceTicks() {
    while (this.distance >= this.nextTickAt) {
      Services.bus.emit(EVENTS.DISTANCE_TICK, { meters: RUNNER.DISTANCE_TICK_METERS, runDistance: Math.floor(this.nextTickAt) });
      this.nextTickAt += RUNNER.DISTANCE_TICK_METERS;
    }
  }

  updateHud(time, magnetActive) {
    const m = Math.floor(this.distance);
    if (m !== this._shownMeters) {
      this._shownMeters = m;
      this.distanceText.setText(`${m.toLocaleString('en-US')} m`);
      const best = Services.save.data.stats.highScore;
      if (m === best + 1 && best > 0) {
        floatText(this, 150, 150, 'NEW BEST!', '#ffc93c', 30);
        Services.audio.play('highScore');
      }
    }
    const coins = Math.floor(this.coinBank);
    if (coins !== this._shownCoins) {
      this._shownCoins = coins;
      this.coinText.setText(String(coins));
      this.tweens.killTweensOf(this.coinIcon);
      this.coinIcon.setScale(1);
      this.tweens.add({ targets: this.coinIcon, scale: 0.8, duration: 160 });
    }
    this.ticketText.setText(String(this.ticketsFound));

    this.magnetBar.graphics.setVisible(magnetActive);
    this.magnetRing.setVisible(magnetActive);
    if (magnetActive) {
      this.magnetBar.set((this.magnetUntil - time) / RUNNER.SUPER_MAGNET_DURATION_MS);
      this.magnetRing.setPosition(this.hitbox.centerX, this.hitbox.centerY).setAngle(time * 0.1);
      this.magnetRing.setScale(0.9 + Math.sin(time * 0.01) * 0.08);
    }
  }

  // -------------------------------------------------------------------------- boosts & items

  /** Starts (or extends) a speed boost. While boosting, obstacles are smashed. */
  startBoost({ ms, mult }) {
    this.boostUntil = Math.max(this.boostUntil, this.gameTime + ms);
    this.boostTarget = Math.max(this.boostTarget, mult);
    // FOV-style punch (the camera's resting zoom is RES, see ui/Display.js).
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    this.tweens.add({ targets: cam, zoom: RES * 1.04, duration: 120, yoyo: true, ease: 'Quad.easeOut', onComplete: () => cam.setZoom(RES) });
  }

  /** Item box hit: spin the roulette, then hold the result until used. */
  startRoulette() {
    if (this.heldItem || this.rolling) {
      this.coinBank += 5;
      floatText(this, this.player.x, this.player.y - 160, '+5', '#ffe066', 26);
      return;
    }
    this.rolling = true;
    this.itemIcon.setAlpha(1);
    let i = 0;
    const spins = 16;
    this.time.addEvent({
      delay: 70,
      repeat: spins - 1,
      callback: () => {
        i++;
        this.itemIcon.setTexture(RUN_ITEMS[ITEM_ORDER[i % ITEM_ORDER.length]].icon).setScale(0.85);
        Services.audio.play('roulette');
        if (i === spins) {
          const key = rollRunItem();
          this.heldItem = key;
          this.rolling = false;
          this.itemIcon.setTexture(RUN_ITEMS[key].icon).setScale(0.85);
          this.itemLabel.setText('TAP!');
          Services.audio.play('itemGet');
          this.tweens.add({ targets: this.itemSlot, scale: 1.15, yoyo: true, repeat: 2, duration: 140 });
        }
      }
    });
  }

  /** Fires the held item (item slot tap, or E / Shift / Enter). */
  useItem() {
    if (!this.heldItem || this.isOver || this.isPaused || !this.started) return;
    const key = this.heldItem;
    this.heldItem = null;
    this.itemsUsed += 1;
    this.itemIcon.setTexture('item_box').setAlpha(0.25).setScale(0.75);
    this.itemLabel.setText('');
    const p = this.player;
    const label = (text, color) => floatText(this, p.x + 40, p.y - 170, text, color, 32);
    switch (key) {
      case 'mushroom':
        this.startBoost(RUNNER.MUSHROOM_BOOST);
        Services.audio.play('boost');
        label('DASH!', '#ff8fb1');
        break;
      case 'star':
        p.starUntil = this.gameTime + RUNNER.STAR_MS;
        Services.audio.play('star');
        label('SUPER STAR!', '#ffe066');
        this.cameras.main.flash(150, 255, 245, 180);
        break;
      case 'magnet':
        this.magnetUntil = this.gameTime + RUNNER.SUPER_MAGNET_DURATION_MS;
        Services.audio.play('powerup');
        label('MAGNET!', '#8fd3ff');
        break;
      case 'coins':
        Services.audio.play('powerup');
        label('COIN RAIN!', '#ffe066');
        for (let row = 0; row < 3; row++) this.pickups.spawnLine(WIDTH + 40 + row * 30, this.groundY - 40 - row * 70, 12, 48);
        break;
      case 'shield':
        p.addShield();
        Services.audio.play('itemGet');
        label('SHIELD!', '#8fd3ff');
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------- events

  onObstacleHit(o) {
    if (this.isOver || o.hitDone || this.player.isCrashed || !this.started) return;
    const result = this.player.hit();
    if (result === 'smash') {
      this.obstacles.smash(o);
      Services.audio.play('smash');
      this.debris.explode(16, o.x, o.y - 30);
      this.cameras.main.shake(100, 0.004);
      this.coinBank += 3;
      floatText(this, o.x, o.y - 90, 'SMASH +3', '#ffe066', 26);
    } else if (result === 'shield') {
      this.obstacles.smash(o);
      Services.audio.play('shieldBreak');
      this.sparkle.explode(24, o.x, o.y - 30);
      this.cameras.main.shake(150, 0.006);
      floatText(this, this.player.x, this.player.y - 150, 'SHIELD!', '#ffc93c');
    } else if (result === 'crash') {
      o.hitDone = true;
      this.onCrash(o.obstacleType);
    }
  }

  onDodged(type) {
    if (this.isOver) return;
    Services.bus.emit(EVENTS.OBSTACLE_DODGED, { type });
  }

  /** Close call: cleared a ground obstacle with only a hair of room. */
  onObstaclePassed(o) {
    if (this.isOver || o.hitDone || OBSTACLE_TYPES[o.obstacleType].kind !== 'ground') return;
    const gap = o.body.top - this.hitbox.bottom;
    if (gap >= 0 && gap < RUNNER.CLOSE_CALL_PX) {
      this.closeCalls += 1;
      this.coinBank += 2;
      Services.audio.play('closeCall');
      floatText(this, this.player.x + 30, this.player.y - 150, 'CLOSE CALL! +2', '#8fe3c6', 24);
    }
  }

  onPickup(p) {
    if (p.kind === 'coin') {
      const now = this.gameTime;
      this.combo = now - this.lastCoinAt <= RUNNER.COMBO_WINDOW_MS ? this.combo + 1 : 1;
      this.lastCoinAt = now;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.coinCount += 1;
      this.coinBank += RUNNER.COIN_VALUE * this.perks.coinMultiplier;
      Services.audio.play('coin');
      this.sparkle.explode(3, p.x, p.y);
      if (this.combo >= 3) {
        this.tweens.killTweensOf(this.comboText);
        this.comboText.setText(`COMBO x${this.combo}`).setAlpha(1).setScale(1.25);
        this.tweens.add({ targets: this.comboText, scale: 1, duration: 140 });
      }
      if (this.combo % 10 === 0) {
        this.coinBank += 3;
        Services.audio.play('combo');
        floatText(this, WIDTH / 2, 150, `x${this.combo} COMBO +3`, '#8fe3c6', 28);
      }
      Services.bus.emit(EVENTS.COIN_COLLECTED, { amount: 1, runCoins: this.coinCount });
    } else if (p.kind === 'ticket') {
      this.ticketsFound += 1;
      Services.audio.play('ticket');
      this.sparkle.explode(16, p.x, p.y);
      floatText(this, p.x, p.y - 30, '+1 TICKET!', '#ff8fb1');
      Services.bus.emit(EVENTS.TICKET_COLLECTED, { amount: 1 });
    } else if (p.kind === 'magnet') {
      this.magnetUntil = this.gameTime + RUNNER.SUPER_MAGNET_DURATION_MS;
      Services.audio.play('powerup');
      floatText(this, p.x, p.y - 30, 'SUPER MAGNET!', '#8fd3ff');
    } else if (p.kind === 'itembox') {
      Services.audio.play('itemBox');
      this.sparkle.explode(12, p.x, p.y);
      this.startRoulette();
    } else if (p.kind === 'boost') {
      this.startBoost(RUNNER.PAD_BOOST);
      Services.audio.play('boost');
      floatText(this, this.player.x + 40, this.player.y - 150, 'BOOST!', '#ffb347', 28);
    }
  }

  endCombo() {
    this.combo = 0;
    this.tweens.add({ targets: this.comboText, alpha: 0, duration: 250 });
  }

  // -------------------------------------------------------------------------- pause / revive / end

  onAppPause() {
    if (!this.isOver && !this.isPaused) this.pauseGame();
  }

  pauseGame() {
    if (this.isOver || this.isPaused) return;
    this.isPaused = true;
    this.physics.pause();
    this.anims.pauseAll();
    this.time.paused = true;
    this.dustTrail.emitting = false;
    this.speedLines.emitting = false;
    this.player.setJumpHeld(false);
    this.player.releaseDuck();
    this.touches.clear();
    this.pauseModal = new Modal(this, { width: 520, height: 360, title: 'Paused', closable: false, depth: 300 });
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
          this.physics.resume();
          this.anims.resumeAll();
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
    this.physics.resume();
    this.anims.resumeAll();
  }

  /** Crash: offer one ticket-paid revive per run, otherwise finish the run. */
  onCrash(cause) {
    if (this.isOver) return;
    this.isOver = true;
    this.dustTrail.emitting = false;
    this.speedLines.emitting = false;
    this.touches.clear();
    if (cause !== 'quit') {
      if (!this.player.isCrashed) this.player.crash();
      Services.audio.play('crash');
      this.cameras.main.shake(300, 0.012);
      this.cameras.main.flash(120, 255, 255, 255);
    }
    Services.audio.stopMusic();

    const tickets = Services.save.data.currencies.blindBoxTickets;
    if (!this.revived && cause !== 'quit' && tickets >= RUNNER.REVIVE_TICKET_COST) {
      this.time.delayedCall(700, () => this.offerRevive());
    } else {
      this.finishRun(cause);
    }
  }

  /** "Second Chance?" prompt with a 5 second timer. */
  offerRevive() {
    const modal = new Modal(this, { width: 560, height: 360, title: 'Second Chance?', closable: false, depth: 300 });
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
      this.add.text(280, 72, `${Math.floor(this.distance)} m · ${Math.floor(this.coinBank)} coins so far`, textStyle(22, '#7a6a8a')).setOrigin(0.5),
      makeButton(
        this,
        280,
        150,
        `Revive · ${RUNNER.REVIVE_TICKET_COST}`,
        () => {
          if (decided) return;
          if (!Services.save.spendCurrency('blindBoxTickets', RUNNER.REVIVE_TICKET_COST, 'revive')) return decline();
          decided = true;
          modal.close();
          this.revive();
        },
        { w: 320, h: 72, fontSize: 30, icon: 'ticket', iconScale: 0.6, color: COLORS.gold, colorDark: COLORS.goldDark }
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

  /** Brings the runner back: clears nearby hazards and grants brief invulnerability. */
  revive() {
    this.revived = true;
    this.obstacles.clear();
    this.spawnCooldownPx = 500;
    this.player.revive(this.groundY);
    this.player.visual.setDepth(20);
    this.inPit = false;
    this.isOver = false;
    this.speed = this.baseSpeed;
    Services.audio.playMusic('run');
    Services.audio.play('powerup');
    floatText(this, this.player.x + 40, this.player.y - 260, 'REVIVED!', '#6ee7a8', 36);
  }

  /** Commits the run, fires events, then shows the results card. */
  finishRun(cause) {
    const coins = Math.floor(this.coinBank);
    const distance = Math.floor(this.distance);
    const prevBest = Services.save.data.stats.highScore;
    const { isHighScore } = Services.save.recordRun({ distance, coins, tickets: this.ticketsFound });
    Services.bus.emit(EVENTS.RUN_ENDED, { distance, coins, tickets: this.ticketsFound, cause });
    this.time.delayedCall(cause === 'quit' ? 100 : 500, () => this.showResults({ coins, distance, isHighScore, prevBest }));
  }

  showResults({ coins, distance, isHighScore, prevBest }) {
    if (isHighScore) Services.audio.play('highScore');
    const modal = new Modal(this, { width: 660, height: 560, title: isHighScore ? 'NEW BEST!' : 'Run Over', closable: false, depth: 300 });
    const lines = [
      ['Distance', `${distance.toLocaleString('en-US')} m`],
      ['Pop Coins', `+${coins}${this.perks.coinMultiplier > 1 ? `  (x${this.perks.coinMultiplier.toFixed(2)})` : ''}`],
      ['Tickets found', `+${this.ticketsFound}`],
      ['Best combo · close calls', `x${this.maxCombo} · ${this.closeCalls}`],
      ['Best', `${Math.max(prevBest, distance).toLocaleString('en-US')} m`]
    ];
    lines.forEach(([label, value], i) => {
      const y = 76 + i * 52;
      modal.add([
        this.add.text(80, y, label, textStyle(24, '#7a6a8a')).setOrigin(0, 0.5),
        this.add.text(580, y, value, textStyle(28, i === 1 ? '#c98a00' : COLORS.text)).setOrigin(1, 0.5)
      ]);
    });
    const claimable = Services.quests.claimableCount();
    if (claimable) modal.add(this.add.text(330, 345, `${claimable} quest reward${claimable > 1 ? 's' : ''} ready to claim!`, textStyle(20, '#3fa9f5')).setOrigin(0.5));

    const leave = (key, data) => {
      this.input.enabled = false;
      this.cameras.main.fadeOut(200, 43, 29, 58);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
    };
    modal.add(makeButton(this, 330, 418, 'Run Again', () => leave('Runner'), { w: 300, h: 74, fontSize: 32, color: COLORS.gold, colorDark: COLORS.goldDark }));
    modal.add(makeButton(this, 185, 505, 'Menu', () => leave('MainMenu'), { w: 230, h: 58, fontSize: 24, color: COLORS.mint, colorDark: 0x4fb594 }));
    const tickets = Services.save.data.currencies.blindBoxTickets;
    const boxBtn = makeButton(this, 475, 505, 'Open Box', () => leave('Unboxing', { source: 'ticket' }), {
      w: 230,
      h: 58,
      fontSize: 24,
      icon: 'ticket',
      iconScale: 0.5
    });
    boxBtn.setEnabled(tickets > 0);
    modal.add(boxBtn);
  }
}
