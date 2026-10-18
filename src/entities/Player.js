/**
 * Player.js
 * The runner character: an Arcade-physics sprite driven by a small finite
 * state machine.
 *
 *   RUN  --jump-->  JUMP  --apex-->  FALL  --land-->  RUN
 *    |      ^--------- multi-jump (double for all, triple with Beaver Tail)
 *    \--duck--> SLIDE --release / timer--> RUN
 *   any --hit--> CRASH (terminal)
 *
 * The physics sprite itself is invisible: a separate `visual` sprite mirrors
 * its frame and position every frame and carries all the juice (squash &
 * stretch, run lean, flips, star rainbow, boost after-images) without ever
 * changing the hitbox.
 *
 * Feel helpers: coyote time, jump buffering, fast-fall when ducking in the
 * air, and a floaty glide while jump is held (Beaver Tail).
 */
import Phaser from 'phaser';
import { RUNNER, RES } from '../config/GameConfig.js';

export const PlayerState = Object.freeze({
  RUN: 'RUN',
  JUMP: 'JUMP',
  DOUBLE_JUMP: 'DOUBLE_JUMP',
  FALL: 'FALL',
  SLIDE: 'SLIDE',
  CRASH: 'CRASH'
});

const SCALE = 0.8; // on-screen size of a 128 x 176 frame
const TEX = RES; // the runner sheet is baked at RES for crisp high-DPI art
// Hitboxes in unscaled frame space (frame is 128 x 176, feet at y = 172).
const BODY_STAND = { w: 46, h: 104, x: 42, y: 68 };
const BODY_DUCK = { w: 60, h: 72, x: 40, y: 100 };
const COYOTE_MS = 90;
const JUMP_BUFFER_MS = 140;
const AFTERIMAGES = 5;

export class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} groundY  y of the running surface
   * @param {object} perks    output of computePerks()
   */
  constructor(scene, x, groundY, perks) {
    super(scene, x, groundY, 'player_sheet', 'run0');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.perks = perks;
    this.groundY = groundY;
    this.state = PlayerState.RUN;
    this.jumpHeld = false;
    this.jumpsUsed = 0;
    this.lastGroundedAt = 0;
    this.jumpBufferedAt = -Infinity;
    this.slideBuffered = false;
    this.duckHeld = false;
    this.duckUntil = 0;
    this.slideDurationMs = RUNNER.SLIDE_DURATION_MS; // RunnerScene scales this with speed
    this.shieldCharges = perks.shieldCharges;
    this.invulnerableUntil = 0;
    this.starUntil = 0;
    this.boosting = false;
    this.wasOnGround = true;

    this.setOrigin(0.5, 1).setScale(SCALE / TEX).setDepth(20).setVisible(false);
    this.body.setCollideWorldBounds(false);
    this.applyHitbox(BODY_STAND);
    this.jumpVelocity = RUNNER.JUMP_VELOCITY * Math.sqrt(perks.jumpMultiplier); // height ∝ v²
    this.airJumpVelocity = RUNNER.DOUBLE_JUMP_VELOCITY * Math.sqrt(perks.jumpMultiplier);
    this.play('player_run');

    // ---- visuals (never touch the hitbox)
    this.squash = { x: 1, y: 1 };
    this.spin = 0;
    this.shadow = scene.add.ellipse(x, groundY + 3, 74, 16, 0x2a1830, 0.28).setDepth(14);
    this.afterimages = Array.from({ length: AFTERIMAGES }, () =>
      scene.add.image(x, groundY, 'player_sheet', 'run0').setOrigin(0.5, 1).setDepth(19).setVisible(false).setTintFill(0xfff1b8)
    );
    this.nextAfterimageAt = 0;
    this.afterimageIndex = 0;
    this.visual = scene.add.sprite(x, groundY, 'player_sheet', 'run0').setOrigin(0.5, 1).setDepth(20);
    this.shieldFx = scene.add.image(x, groundY - 60, 'fx_shield').setDepth(21).setScale(SCALE).setVisible(this.shieldCharges > 0);
    scene.tweens.add({ targets: this.shieldFx, alpha: { from: 0.65, to: 1 }, yoyo: true, repeat: -1, duration: 600 });

    // Sync visuals after Arcade has moved the body this frame.
    scene.events.on('postupdate', this.syncVisual, this);
  }

  applyHitbox(box) {
    this.body.setSize(box.w * TEX, box.h * TEX, false);
    this.body.setOffset(box.x * TEX, box.y * TEX);
  }

  /** Gameplay clock (RunnerScene.gameTime), falling back to the scene clock. */
  get now() {
    return this.scene.gameTime ?? this.scene.time.now;
  }

  get isGrounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  get isCrashed() {
    return this.state === PlayerState.CRASH;
  }

  get maxJumps() {
    return this.perks.maxJumps ?? 2;
  }

  /** Transition helper - single place that changes state & visuals. */
  setStateTo(next) {
    if (this.state === next || this.state === PlayerState.CRASH) return;
    const prev = this.state;
    this.state = next;
    if (prev === PlayerState.SLIDE) {
      this.applyHitbox(BODY_STAND);
      this.punch(0.85, 1.18, 120);
    }

    switch (next) {
      case PlayerState.RUN:
        this.play('player_run', true);
        break;
      case PlayerState.JUMP:
      case PlayerState.DOUBLE_JUMP:
        this.anims.stop();
        this.setFrame('jump');
        break;
      case PlayerState.FALL:
        this.anims.stop();
        this.setFrame('fall');
        break;
      case PlayerState.SLIDE:
        this.anims.stop();
        this.setFrame('slide');
        this.applyHitbox(BODY_DUCK);
        this.punch(1.15, 0.85, 110);
        break;
      case PlayerState.CRASH:
        this.anims.stop();
        this.setFrame('crash');
        break;
      default:
        break;
    }
  }

  /** Squash & stretch: snap to (sx, sy) then spring back to 1. */
  punch(sx, sy, duration = 140) {
    this.scene.tweens.killTweensOf(this.squash);
    this.squash.x = sx;
    this.squash.y = sy;
    this.scene.tweens.add({ targets: this.squash, x: 1, y: 1, duration: duration * 2.4, ease: 'Elastic.easeOut', easeParams: [1.1, 0.5] });
  }

  // -------------------------------------------------------------------------- input

  /**
   * Jump request (tap / swipe up / space). Ground jump, then air jumps:
   * everyone gets a double jump, the Beaver Tail adds a third.
   */
  jump() {
    if (this.isCrashed) return false;
    const now = this.now;
    const onGroundish = this.state === PlayerState.RUN || this.state === PlayerState.SLIDE || (now - this.lastGroundedAt <= COYOTE_MS && this.jumpsUsed === 0);

    if (onGroundish) {
      this.duckHeld = false;
      this.body.setVelocityY(this.jumpVelocity);
      this.jumpsUsed = 1;
      this.lastGroundedAt = -Infinity;
      this.setStateTo(PlayerState.JUMP);
      this.punch(0.78, 1.25, 120);
      this.scene.events.emit('player-jump', { double: false, count: 1 });
      return true;
    }
    if (this.jumpsUsed < this.maxJumps) {
      this.jumpsUsed += 1;
      this.body.setVelocityY(this.airJumpVelocity);
      this.slideBuffered = false;
      this.state = PlayerState.JUMP; // allow DOUBLE_JUMP to re-enter on a triple jump
      this.setStateTo(PlayerState.DOUBLE_JUMP);
      this.punch(0.8, 1.2, 110);
      this.scene.tweens.killTweensOf(this);
      this.spin = 0;
      this.scene.tweens.add({ targets: this, spin: -360, duration: 360, ease: 'Cubic.easeOut', onComplete: () => (this.spin = 0) });
      this.scene.events.emit('player-jump', { double: true, count: this.jumpsUsed });
      return true;
    }
    // Out of air jumps: remember the press so it fires on landing.
    this.jumpBufferedAt = now;
    return false;
  }

  /**
   * Duck press (left-side hold, swipe down, arrow down). Ducks for at least
   * `slideDurationMs` and keeps ducking while `held`. In the air it fast-falls
   * and ducks on landing.
   */
  duck(held = false) {
    if (this.isCrashed) return;
    this.duckHeld = held;
    this.duckUntil = this.now + this.slideDurationMs;
    if (this.isGrounded) {
      if (this.state !== PlayerState.SLIDE) {
        this.setStateTo(PlayerState.SLIDE);
        this.scene.events.emit('player-slide');
      }
    } else {
      this.body.setVelocityY(Math.max(this.body.velocity.y, RUNNER.FAST_FALL_VELOCITY));
      this.slideBuffered = true;
    }
  }

  /** Releasing the duck input ends the duck once the minimum time passed. */
  releaseDuck() {
    this.duckHeld = false;
    if (!this.isGrounded) this.slideBuffered = false;
  }

  /** Kept for API compatibility: a one-shot duck. */
  slide() {
    this.duck(false);
  }

  setJumpHeld(held) {
    this.jumpHeld = held;
  }

  // -------------------------------------------------------------------------- damage

  /** True while post-hit invulnerability or a Super Star is active. */
  isInvulnerable(now = this.now) {
    return now < this.invulnerableUntil || now < this.starUntil;
  }

  get hasStar() {
    return this.now < this.starUntil;
  }

  /**
   * Called on obstacle contact. Returns 'smash' (star/boost plows through),
   * 'shield' if the hit was absorbed, 'crash' if the run is over, or
   * 'ignored' during invulnerability frames.
   */
  hit() {
    if (this.isCrashed) return 'ignored';
    const now = this.now;
    if (this.hasStar || this.boosting) return 'smash';
    if (this.isInvulnerable(now)) return 'ignored';
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.invulnerableUntil = now + RUNNER.INVULNERABLE_AFTER_SHIELD_MS;
      this.shieldFx.setVisible(this.shieldCharges > 0);
      return 'shield';
    }
    this.crash();
    return 'crash';
  }

  addShield() {
    this.shieldCharges += 1;
    this.shieldFx.setVisible(true);
  }

  crash() {
    this.setStateTo(PlayerState.CRASH);
    this.body.setVelocity(0, -480);
    this.body.checkCollision.none = true; // fall through the floor, cartoon style
    this.scene.tweens.add({ targets: this, spin: 220, duration: 900, ease: 'Quad.easeIn' });
  }

  /** Brings the runner back after a revive. */
  revive(groundY) {
    this.scene.tweens.killTweensOf(this);
    this.state = PlayerState.FALL;
    this.spin = 0;
    this.body.checkCollision.none = false;
    this.body.reset(this.x, groundY - 240);
    this.body.setVelocity(0, 0);
    this.jumpsUsed = 1;
    this.invulnerableUntil = this.now + 2500;
    this.setFrame('fall');
    this.visual.setAlpha(1);
  }

  // -------------------------------------------------------------------------- tick

  /** Per-frame update: gravity modifiers, landing detection, state upkeep. */
  update(time) {
    if (this.isCrashed) return;

    const grounded = this.isGrounded;
    const vy = this.body.velocity.y;

    // Gravity: base modifier (Space Explorer) and glide (Beaver Tail).
    let factor = this.perks.gravityMultiplier;
    if (this.perks.floatyFall && this.jumpHeld && vy > 0 && !grounded) factor *= RUNNER.FLOATY_GRAVITY_FACTOR;
    this.body.setGravityY(RUNNER.GRAVITY * (factor - 1)); // body gravity is added to world gravity

    if (grounded) {
      this.lastGroundedAt = time;
      if (!this.wasOnGround) this.onLand(time);
      if (this.state === PlayerState.SLIDE && !this.duckHeld && time >= this.duckUntil) this.setStateTo(PlayerState.RUN);
    } else if (vy > 0 && (this.state === PlayerState.JUMP || this.state === PlayerState.DOUBLE_JUMP || this.state === PlayerState.RUN)) {
      this.setStateTo(PlayerState.FALL);
    }
    this.wasOnGround = grounded;
  }

  onLand(time) {
    this.jumpsUsed = 0;
    this.spin = 0;
    this.punch(1.3, 0.72, 110);
    this.scene.events.emit('player-land');
    if (this.slideBuffered || this.duckHeld) {
      this.slideBuffered = false;
      this.duckUntil = Math.max(this.duckUntil, time + this.slideDurationMs * 0.6);
      this.setStateTo(PlayerState.SLIDE);
      this.scene.events.emit('player-slide');
      return;
    }
    this.setStateTo(PlayerState.RUN);
    if (time - this.jumpBufferedAt <= JUMP_BUFFER_MS) {
      this.jumpBufferedAt = -Infinity;
      this.jump();
    }
  }

  /** Mirrors the physics sprite onto the visual sprite with all the juice. */
  syncVisual() {
    if (!this.visual?.active) return;
    const v = this.visual;
    const now = this.now;
    const base = SCALE / TEX;
    v.setFrame(this.frame.name);
    v.setPosition(this.x, this.y);
    v.setScale(base * this.squash.x, base * this.squash.y);
    const lean = this.state === PlayerState.RUN ? 5 : this.state === PlayerState.FALL ? 8 : 0;
    v.setAngle(lean + this.spin);

    // Super Star: cycle rainbow tints. Invulnerability: flicker.
    if (this.hasStar) {
      const hue = (now / 300) % 1;
      v.setTint(Phaser.Display.Color.HSVToRGB(hue, 0.55, 1).color);
    } else {
      v.clearTint();
    }
    v.setAlpha(!this.hasStar && now < this.invulnerableUntil ? (Math.floor(now / 80) % 2 ? 0.35 : 1) : 1);

    // Boost/star after-images
    if ((this.boosting || this.hasStar) && now > this.nextAfterimageAt && !this.isCrashed) {
      this.nextAfterimageAt = now + 45;
      const ghost = this.afterimages[this.afterimageIndex++ % AFTERIMAGES];
      this.scene.tweens.killTweensOf(ghost);
      ghost.setFrame(this.frame.name).setPosition(v.x, v.y).setScale(v.scaleX, v.scaleY).setAngle(v.angle).setVisible(true).setAlpha(0.45);
      ghost.setTintFill(this.hasStar ? Phaser.Display.Color.HSVToRGB((now / 300) % 1, 0.7, 1).color : 0xfff1b8);
      this.scene.tweens.add({ targets: ghost, alpha: 0, x: ghost.x - 60, duration: 260, onComplete: () => ghost.setVisible(false) });
    }

    // Ground shadow shrinks as you rise; hidden over pits / after a crash.
    const height = Math.max(0, this.groundY - this.y);
    const s = Phaser.Math.Clamp(1 - height / 320, 0.25, 1);
    this.shadow.setPosition(this.x, this.groundY + 3).setScale(s, s).setAlpha(this.isCrashed || this.y > this.groundY + 6 ? 0 : 0.28 * s + 0.05);

    this.shieldFx.setPosition(v.x, v.y - 62);
  }

  destroy(fromScene) {
    this.scene?.events.off('postupdate', this.syncVisual, this);
    this.shieldFx?.destroy();
    this.visual?.destroy();
    this.shadow?.destroy();
    this.afterimages?.forEach((a) => a.destroy());
    super.destroy(fromScene);
  }
}
