/**
 * RunnerScene.js
 * The endless-runner core loop.
 *
 *  - Arcade physics (gravity 1200) for the player; the world scrolls past a
 *    fixed-x runner. Speed ramps with distance:
 *        speed = min(MAX_SPEED, BASE_SPEED + distanceMeters * 0.15)
 *  - 3-layer parallax: sky/clouds, forest canopy, running surface.
 *  - Obstacles and pickups come from object pools and are recycled once they
 *    leave the screen on the left.
 *  - Equipment perks (double jump, floaty fall, magnet radius, shield, coin
 *    bonus...) come from PerkCalculator.
 *  - Gameplay events go onto the shared bus for QuestManager.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, RUNNER, PARALLAX, COLORS, EVENTS } from '../config/GameConfig.js';
import { Services } from '../systems/Services.js';
import { computePerks } from '../systems/PerkCalculator.js';
import { Player, PlayerState } from '../entities/Player.js';
import { ObstaclePool, OBSTACLE_TYPES } from '../entities/ObstaclePool.js';
import { CollectiblePool } from '../entities/CollectiblePool.js';
import { makeButton, makeIconButton, makeProgressBar, Modal, outlinedText, textStyle, floatText } from '../ui/UIKit.js';

const SWIPE_THRESHOLD = 35; // px
const HOLD_TO_JUMP_MS = 140; // a press held this long without moving = jump

export class RunnerScene extends Phaser.Scene {
  constructor() {
    super('Runner');
  }

  init() {
    this.distance = 0; // meters
    this.speed = RUNNER.BASE_SPEED;
    this.coinBank = 0; // fractional coin value (perk multipliers)
    this.coinCount = 0; // physical coins picked up (quests)
    this.ticketsFound = 0;
    this.nextTickAt = RUNNER.DISTANCE_TICK_METERS;
    this.spawnCooldownPx = WIDTH * 0.25; // first coin trail arrives quickly
    this.magnetUntil = 0;
    this.isOver = false;
    this.isPaused = false;
    this.inPit = false;
    this.gesture = null;
    this.keyHeld = false;
    this.hitbox = new Phaser.Geom.Rectangle();
    this.offscreenRect = new Phaser.Geom.Rectangle(-9999, -9999, 0, 0);
  }

  create() {
    const save = Services.save.data;
    this.perks = computePerks(save.equipped);
    this.groundY = RUNNER.GROUND_Y;

    Services.audio.playMusic('run');
    this.createAnimations();
    this.createParallax();
    this.createWorld();
    this.createFx();
    this.createHud();
    this.createInput();

    Services.bus.on('app:pause', this.onAppPause, this);
    this.events.once('shutdown', () => Services.bus.offContext(this));

    Services.bus.emit(EVENTS.RUN_STARTED, { perks: this.perks });
    this.cameras.main.fadeIn(250, 43, 29, 58);
    const go = outlinedText(this, WIDTH / 2, HEIGHT / 2 - 80, 'GO!', 96, '#ffc93c').setDepth(200).setScale(0.2);
    this.tweens.add({ targets: go, scale: 1, duration: 300, ease: 'Back.easeOut', yoyo: true, hold: 300, onComplete: () => go.destroy() });
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
    this.add.image(WIDTH / 2, HEIGHT / 2, 'bg_sky').setScrollFactor(0);
    this.layerClouds = this.add.tileSprite(WIDTH / 2, 150, WIDTH, 260, 'bg_clouds');
    this.layerCanopy = this.add.tileSprite(WIDTH / 2, this.groundY - 190, WIDTH, 400, 'bg_canopy');
    this.layerGround = this.add.tileSprite(WIDTH / 2, this.groundY - 12, WIDTH, 130, 'ground').setOrigin(0.5, 0).setDepth(5);
    // Time-of-day tint deepens with distance (sunset at 1.5 km, night at 3 km).
    this.skyTint = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xff7b54, 0).setDepth(4);
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

    this.events.on('player-jump', ({ double }) => {
      Services.audio.play(double ? 'doubleJump' : 'jump');
      this.dustBurst.explode(double ? 10 : 6, this.player.x, this.player.y);
    });
    this.events.on('player-land', () => {
      Services.audio.play('land');
      this.dustBurst.explode(5, this.player.x, this.groundY);
    });
    this.events.on('player-slide', () => Services.audio.play('slide'));
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
        speed: { min: 40, max: 160 },
        angle: { min: 180, max: 360 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xd9b48a,
        emitting: false
      })
      .setDepth(19);

    this.sparkle = this.add
      .particles(0, 0, 'p_spark', {
        lifespan: 450,
        speed: { min: 60, max: 220 },
        scale: { start: 0.9, end: 0 },
        tint: [0xffe066, 0xffffff, 0xffc93c],
        blendMode: 'ADD',
        emitting: false
      })
      .setDepth(30);

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
      .setDepth(3);
  }

  createHud() {
    const hud = this.add.container(0, 0).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28).fillRoundedRect(16, 14, 250, 84, 22);
    g.fillStyle(0x000000, 0.28).fillRoundedRect(WIDTH / 2 - 150, 14, 300, 56, 28);
    hud.add(g);
    this.distanceText = this.add.text(36, 22, '0 m', textStyle(40, '#ffffff', { stroke: '#3d2a52', strokeThickness: 6 }));
    this.bestText = this.add.text(38, 68, `Best ${Services.save.data.stats.highScore} m`, textStyle(18, '#ffe9c7', { stroke: '#3d2a52', strokeThickness: 3 }));
    const coinIcon = this.add.image(WIDTH / 2 - 118, 42, 'coin').setScale(0.75);
    this.coinText = this.add.text(WIDTH / 2 - 92, 42, '0', textStyle(30, '#ffe066', { stroke: '#3d2a52', strokeThickness: 5 })).setOrigin(0, 0.5);
    const ticketIcon = this.add.image(WIDTH / 2 + 50, 42, 'ticket').setScale(0.6);
    this.ticketText = this.add.text(WIDTH / 2 + 76, 42, '0', textStyle(30, '#ff8fb1', { stroke: '#3d2a52', strokeThickness: 5 })).setOrigin(0, 0.5);
    hud.add([this.distanceText, this.bestText, coinIcon, this.coinText, ticketIcon, this.ticketText]);

    // Active perks summary (helps players understand their loadout).
    const perkBits = [];
    if (this.perks.doubleJump) perkBits.push('Double Jump');
    if (this.perks.floatyFall) perkBits.push('Glide');
    if (this.perks.attractRadius > RUNNER.BASE_ATTRACT_RADIUS) perkBits.push(`Magnet ${this.perks.attractRadius}px`);
    if (this.perks.shieldCharges) perkBits.push('Shield');
    if (this.perks.coinMultiplier > 1) perkBits.push(`Coins +${Math.round((this.perks.coinMultiplier - 1) * 100)}%`);
    if (perkBits.length) hud.add(this.add.text(38, 104, perkBits.join(' · '), textStyle(16, '#ffffff', { stroke: '#3d2a52', strokeThickness: 3 })));

    // Super Magnet timer
    this.magnetIcon = this.add.image(WIDTH / 2 - 118, 92, 'magnet').setScale(0.5).setVisible(false);
    this.magnetBar = makeProgressBar(this, WIDTH / 2 - 95, 84, 190, 16, { fill: 0x3fa9f5 });
    this.magnetBar.graphics.setVisible(false);
    hud.add([this.magnetIcon, this.magnetBar.graphics]);
    this.magnetRing = this.add.image(0, 0, 'fx_ring').setDepth(17).setVisible(false).setTint(0x8fd3ff);

    this.pauseBtn = makeIconButton(this, WIDTH - 48, 46, 'II', () => this.pauseGame(), { size: 60 });
    this.pauseBtn.setDepth(101);

    const hint = this.add
      .text(WIDTH / 2, HEIGHT - 40, 'Tap / swipe ↑ to jump  ·  swipe ↓ to slide  ·  hold to glide', textStyle(22, '#ffffff', { stroke: '#3d2a52', strokeThickness: 4 }))
      .setOrigin(0.5)
      .setDepth(100);
    this.tweens.add({ targets: hint, alpha: 0, delay: 3500, duration: 800, onComplete: () => hint.destroy() });
  }

  /**
   * Touch: tap / swipe up = jump, swipe down = slide, press & hold = jump +
   * glide (floaty fall with the Beaver Tail). Keyboard: Space/Up/W, Down/S, Esc/P.
   */
  createInput() {
    this.input.on('pointerdown', (pointer, over) => {
      if (over.length || this.isOver || this.isPaused) return; // tapped a button
      this.gesture = { x: pointer.x, y: pointer.y, t: this.time.now, fired: false, pointer };
      this.player.setJumpHeld(true);
    });
    this.input.on('pointermove', (pointer) => {
      const g = this.gesture;
      if (!g || g.fired || g.pointer !== pointer) return;
      const dy = pointer.y - g.y;
      if (dy < -SWIPE_THRESHOLD) {
        g.fired = true;
        this.player.jump();
      } else if (dy > SWIPE_THRESHOLD) {
        g.fired = true;
        this.player.setJumpHeld(false);
        this.player.slide();
      }
    });
    this.input.on('pointerup', (pointer) => {
      const g = this.gesture;
      if (g && g.pointer === pointer) {
        if (!g.fired && !this.isOver && !this.isPaused) this.player.jump(); // quick tap
        this.gesture = null;
      }
      if (!this.keyHeld) this.player.setJumpHeld(false);
    });

    const kb = this.input.keyboard;
    if (!kb) return;
    const jumpDown = (e) => {
      if (e.repeat || this.isOver || this.isPaused) return;
      this.keyHeld = true;
      this.player.setJumpHeld(true);
      this.player.jump();
    };
    const jumpUp = () => {
      this.keyHeld = false;
      if (!this.gesture) this.player.setJumpHeld(false);
    };
    for (const key of ['SPACE', 'UP', 'W']) {
      kb.on(`keydown-${key}`, jumpDown);
      kb.on(`keyup-${key}`, jumpUp);
    }
    for (const key of ['DOWN', 'S']) kb.on(`keydown-${key}`, () => !this.isOver && !this.isPaused && this.player.slide());
    for (const key of ['ESC', 'P']) kb.on(`keydown-${key}`, () => (this.isPaused ? this.resumeGame() : this.pauseGame()));
  }

  // -------------------------------------------------------------------------- loop

  update(time, delta) {
    if (this.isPaused) return;
    const dt = Math.min(delta, 100) / 1000; // same cap as the game loop (fps.min = 10)

    // Speed ramp (decelerates to a stop after a crash).
    if (!this.isOver) {
      this.speed = Math.min(RUNNER.MAX_SPEED, RUNNER.BASE_SPEED + this.distance * RUNNER.SPEED_PER_METER);
    } else {
      this.speed = Math.max(0, this.speed - 900 * dt);
    }
    const dx = this.speed * dt;

    // Parallax
    this.layerClouds.tilePositionX += dx * PARALLAX.SKY;
    this.layerCanopy.tilePositionX += dx * PARALLAX.CANOPY;
    this.layerGround.tilePositionX += dx * PARALLAX.GROUND;

    // Hold-to-jump gesture
    const g = this.gesture;
    if (g && !g.fired && g.pointer.isDown && time - g.t > HOLD_TO_JUMP_MS && !this.isOver) {
      g.fired = true;
      this.player.jump();
    }

    // Slides cover a fixed distance so low branches are always clearable.
    this.player.slideDurationMs = Math.max(RUNNER.SLIDE_DURATION_MS, (RUNNER.SLIDE_DISTANCE_PX / Math.max(this.speed, 1)) * 1000);
    this.player.update(time);
    this.updateHitbox();
    this.obstacles.update(dx, this.player.x, (type) => this.onDodged(type));
    const magnetActive = time < this.magnetUntil;
    const radius = magnetActive ? Math.max(RUNNER.SUPER_MAGNET_RADIUS, this.perks.attractRadius) : this.perks.attractRadius;
    if (!this.isOver) this.pickups.update(dx, dt, this.hitbox, radius, time, (p) => this.onPickup(p));
    else this.pickups.update(dx, dt, this.offscreenRect, 0, time);

    if (this.isOver) return;

    this.updatePits();
    this.distance += dx / RUNNER.PIXELS_PER_METER;
    this.updateSpawner(dx);
    this.emitDistanceTicks();
    this.updateHud(time, magnetActive);

    // Running dust only while grounded and upright.
    this.dustTrail.emitting = this.player.state === PlayerState.RUN || this.player.state === PlayerState.SLIDE;

    // Sky tint: sunset from 1.5 km, night from 3 km.
    const d = this.distance;
    if (d > 1500 && d < 3000) {
      this.skyTint.setFillStyle(0xff7b54, Math.min(0.22, (d - 1500) / 3000));
    } else if (d >= 3000) {
      this.skyTint.setFillStyle(0x1a1446, Math.min(0.38, (d - 3000) / 2500));
    }
  }

  updateHitbox() {
    const b = this.player.body;
    this.hitbox.setTo(b.x, b.y, b.width, b.height);
  }

  /** Pit traps: drop the floor under the runner; shield bounces you out. */
  updatePits() {
    const p = this.player;
    const pit = this.obstacles.pitAt(p.body.center.x);
    const below = p.y > this.groundY + 4;
    this.floorCollider.active = !pit && !below;

    if (below && !this.inPit) {
      this.inPit = true;
      if (pit) pit.fellIn = true;
      p.setDepth(4); // drop behind the ground strip: swallowed by the hole
    }
    if (this.inPit && !below) {
      this.inPit = false;
      p.setDepth(20);
    }
    if (this.inPit && p.y > this.groundY + 110 && !p.isCrashed) {
      const result = p.hit();
      if (result === 'crash') {
        this.endRun('pit');
      } else {
        // Shield (or invulnerability) springs you back out of the hole. Snap to
        // the surface first: rising up through the floor collider would make
        // Arcade separate the body downwards and trap it under the ground.
        p.body.reset(p.x, this.groundY - 2);
        p.body.setVelocityY(-1000);
        p.setStateTo(PlayerState.JUMP);
        p.setDepth(20);
        this.inPit = false;
        Services.audio.play('shieldBreak');
        this.sparkle.explode(20, p.x, this.groundY);
      }
    }
  }

  /**
   * Distance-based spawner. Each "beat" places one obstacle plus optional coin
   * patterns and rare pickups. Gaps widen with speed so reaction time stays fair.
   */
  updateSpawner(dx) {
    this.spawnCooldownPx -= dx;
    if (this.spawnCooldownPx > 0) return;

    const meters = this.distance;
    const x = WIDTH + 140;
    const speedFactor = Math.pow(this.speed / RUNNER.BASE_SPEED, 0.6);
    const gap = Phaser.Math.Between(RUNNER.MIN_OBSTACLE_GAP, RUNNER.MIN_OBSTACLE_GAP * 1.6) * speedFactor;

    // The first stretch only has coins so new players can learn the controls.
    if (meters < 40) {
      this.pickups.spawnLine(x, this.groundY - 34, 6);
      this.spawnCooldownPx = 6 * 52 + gap * 0.6;
      return;
    }

    const type = this.obstacles.randomType(meters);
    const spot = this.obstacles.spawn(type, x);
    const width = spot ? spot.width : 120;
    const kind = OBSTACLE_TYPES[type].kind;
    const centerX = spot ? (spot.left + spot.right) / 2 : x;

    if (spot) {
      if (kind === 'ground' && Math.random() < 0.55) {
        this.pickups.spawnArc(centerX, this.groundY, 7, 240 + this.speed * 0.25, 130);
      } else if (kind === 'overhead' && Math.random() < 0.7) {
        this.pickups.spawnLine(centerX - 78, this.groundY - 26, 4);
      } else if (kind === 'pit' && Math.random() < 0.6) {
        this.pickups.spawnArc(centerX, this.groundY, 6, 260 + this.speed * 0.2, 150);
      }
    }

    const midX = x + width / 2 + gap / 2;
    // Ground coin trail between obstacles.
    if (Math.random() < 0.45) this.pickups.spawnLine(x + width / 2 + gap * 0.2, this.groundY - 34, Phaser.Math.Between(3, 6));
    // Rare: Blind Box Ticket placed high (needs a jump).
    const ticketChance = 0.035 * (1 + this.perks.ticketLuck);
    if (meters > 150 && this.ticketsFound < 3 && Math.random() < ticketChance) {
      this.pickups.spawn('ticket', midX, this.groundY - 200);
    } else if (meters > 100 && this.time.now > this.magnetUntil && Math.random() < 0.04) {
      this.pickups.spawn('magnet', midX, this.groundY - 120);
    }

    // Past 800 m, sometimes chain a quick second obstacle for rhythm.
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
        floatText(this, 150, 140, 'NEW BEST!', '#ffc93c', 30);
        Services.audio.play('highScore');
      }
    }
    const coins = Math.floor(this.coinBank);
    if (coins !== this._shownCoins) {
      this._shownCoins = coins;
      this.coinText.setText(String(coins));
    }
    this.ticketText.setText(String(this.ticketsFound));

    this.magnetIcon.setVisible(magnetActive);
    this.magnetBar.graphics.setVisible(magnetActive);
    this.magnetRing.setVisible(magnetActive);
    if (magnetActive) {
      this.magnetBar.set((this.magnetUntil - time) / RUNNER.SUPER_MAGNET_DURATION_MS);
      this.magnetRing.setPosition(this.hitbox.centerX, this.hitbox.centerY).setAngle(time * 0.1);
      this.magnetRing.setScale(0.9 + Math.sin(time * 0.01) * 0.08);
    }
  }

  // -------------------------------------------------------------------------- events

  onObstacleHit(o) {
    if (this.isOver || o.hitDone || this.player.isCrashed) return;
    const result = this.player.hit();
    if (result === 'shield') {
      this.obstacles.smash(o);
      Services.audio.play('shieldBreak');
      this.sparkle.explode(24, o.x, o.y - 30);
      this.cameras.main.shake(150, 0.006);
      floatText(this, this.player.x, this.player.y - 140, 'SHIELD!', '#ffc93c');
    } else if (result === 'crash') {
      o.hitDone = true;
      this.endRun(o.obstacleType);
    }
  }

  onDodged(type) {
    if (this.isOver) return;
    Services.bus.emit(EVENTS.OBSTACLE_DODGED, { type });
  }

  onPickup(p) {
    if (p.kind === 'coin') {
      this.coinCount += 1;
      this.coinBank += RUNNER.COIN_VALUE * this.perks.coinMultiplier;
      Services.audio.play('coin');
      this.sparkle.explode(3, p.x, p.y);
      Services.bus.emit(EVENTS.COIN_COLLECTED, { amount: 1, runCoins: this.coinCount });
    } else if (p.kind === 'ticket') {
      this.ticketsFound += 1;
      Services.audio.play('ticket');
      this.sparkle.explode(16, p.x, p.y);
      floatText(this, p.x, p.y - 30, '+1 TICKET!', '#ff8fb1');
      Services.bus.emit(EVENTS.TICKET_COLLECTED, { amount: 1 });
    } else if (p.kind === 'magnet') {
      this.magnetUntil = this.time.now + RUNNER.SUPER_MAGNET_DURATION_MS;
      Services.audio.play('powerup');
      floatText(this, p.x, p.y - 30, 'SUPER MAGNET!', '#8fd3ff');
    }
  }

  // -------------------------------------------------------------------------- pause / end

  onAppPause() {
    if (!this.isOver && !this.isPaused) this.pauseGame();
  }

  pauseGame() {
    if (this.isOver || this.isPaused) return;
    this.isPaused = true;
    this.physics.pause();
    this.anims.pauseAll();
    this.dustTrail.emitting = false;
    this.player.setJumpHeld(false);
    this.gesture = null;
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
          this.physics.resume();
          this.anims.resumeAll();
          this.endRun('quit');
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
    this.physics.resume();
    this.anims.resumeAll();
  }

  /** Crash / quit: commit the run, fire events, then show the results card. */
  endRun(cause) {
    if (this.isOver) return;
    this.isOver = true;
    this.dustTrail.emitting = false;
    this.gesture = null;
    if (cause !== 'quit') {
      if (!this.player.isCrashed) this.player.crash();
      Services.audio.play('crash');
      this.cameras.main.shake(300, 0.012);
      this.cameras.main.flash(120, 255, 255, 255);
    }
    Services.audio.stopMusic();

    const coins = Math.floor(this.coinBank);
    const distance = Math.floor(this.distance);
    const prevBest = Services.save.data.stats.highScore;
    const { isHighScore } = Services.save.recordRun({ distance, coins, tickets: this.ticketsFound });
    Services.bus.emit(EVENTS.RUN_ENDED, { distance, coins, tickets: this.ticketsFound, cause });

    this.time.delayedCall(cause === 'quit' ? 100 : 1100, () => this.showResults({ coins, distance, isHighScore, prevBest }));
  }

  showResults({ coins, distance, isHighScore, prevBest }) {
    if (isHighScore) Services.audio.play('highScore');
    const modal = new Modal(this, { width: 640, height: 520, title: isHighScore ? 'NEW BEST!' : 'Run Over', closable: false, depth: 300 });
    const lines = [
      ['Distance', `${distance.toLocaleString('en-US')} m`],
      ['Pop Coins', `+${coins}${this.perks.coinMultiplier > 1 ? `  (x${this.perks.coinMultiplier.toFixed(2)})` : ''}`],
      ['Tickets found', `+${this.ticketsFound}`],
      ['Best', `${Math.max(prevBest, distance).toLocaleString('en-US')} m`]
    ];
    lines.forEach(([label, value], i) => {
      const y = 80 + i * 56;
      modal.add([
        this.add.text(90, y, label, textStyle(26, '#7a6a8a')).setOrigin(0, 0.5),
        this.add.text(550, y, value, textStyle(30, i === 1 ? '#c98a00' : COLORS.text)).setOrigin(1, 0.5)
      ]);
    });
    const claimable = Services.quests.claimableCount();
    if (claimable) modal.add(this.add.text(320, 312, `${claimable} quest reward${claimable > 1 ? 's' : ''} ready to claim!`, textStyle(20, '#3fa9f5')).setOrigin(0.5));

    const leave = (key, data) => {
      this.input.enabled = false;
      this.cameras.main.fadeOut(200, 43, 29, 58);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
    };
    modal.add(makeButton(this, 320, 380, 'Run Again', () => leave('Runner'), { w: 300, h: 74, fontSize: 32, color: COLORS.gold, colorDark: COLORS.goldDark }));
    modal.add(makeButton(this, 175, 465, 'Menu', () => leave('MainMenu'), { w: 230, h: 58, fontSize: 24, color: COLORS.mint, colorDark: 0x4fb594 }));
    const tickets = Services.save.data.currencies.blindBoxTickets;
    const boxBtn = makeButton(this, 465, 465, 'Open Box', () => leave('Unboxing', { source: 'ticket' }), {
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
