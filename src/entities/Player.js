/**
 * Player.js
 * The 3D lane runner's character, seen from behind.
 *
 * State machine:
 *   RUN --jump--> JUMP --apex--> FALL --land--> RUN
 *    |       ^------ air jumps (double for all, triple with the Beaver Tail)
 *    \--duck--> DUCK (roll) --timer / release--> RUN
 *   any --hit--> CRASH (terminal unless revived)
 *
 * Simulation is in world metres (lane x, height y); RunnerScene projects the
 * result onto the screen and calls render(). Visual juice (squash & stretch,
 * lane-change lean, cartwheel on air jumps, star rainbow, after-images) lives
 * entirely on the sprite and never affects collisions.
 */
import Phaser from 'phaser';
import { RUNNER, RES } from '../config/GameConfig.js';
import { BACK_FRAMES } from '../art/CharacterRenderer.js';
import { depthFor } from './World3D.js';

export const PlayerState = Object.freeze({
  RUN: 'RUN',
  JUMP: 'JUMP',
  FALL: 'FALL',
  DUCK: 'DUCK',
  CRASH: 'CRASH'
});

const BACK_TEX_RES = RES * 1.25; // matches bakeBackSheet() in bakePlayerTextures
const DRAW_HEIGHT_M = 2.05; // on-screen height of a 176 px frame, in metres
const JUMP_BUFFER_MS = 140;
const AFTERIMAGES = 6;
const RUN_FRAMES = ['run0', 'run1', 'run2', 'run3'];

export class Player {
  /**
   * @param {Phaser.Scene} scene  RunnerScene (provides gameTime and project())
   * @param {object} perks        output of computePerks()
   */
  constructor(scene, perks) {
    this.scene = scene;
    this.perks = perks;
    this.state = PlayerState.RUN;
    this.lane = 1;
    this.x = RUNNER.LANES[1];
    this.y = 0;
    this.vy = 0;
    this.jumpsUsed = 0;
    this.jumpHeld = false;
    this.jumpBufferedAt = -Infinity;
    this.duckHeld = false;
    this.duckUntil = 0;
    this.duckOnLand = false;
    this.shieldCharges = perks.shieldCharges;
    this.invulnerableUntil = 0;
    this.starUntil = 0;
    this.boosting = false;
    this.runPhase = 0;
    this.squash = { x: 1, y: 1 };
    this.spin = 0;
    this.flying = false; // Head Start rocket ride

    this.shadow = scene.add.image(0, 0, 'fx_shadow').setDepth(5000);
    this.afterimages = Array.from({ length: AFTERIMAGES }, () => scene.add.image(0, 0, 'player_back', 'run0').setOrigin(0.5, 1).setVisible(false).setDepth(5001));
    this.nextAfterimageAt = 0;
    this.afterimageIndex = 0;
    this.sprite = scene.add.image(0, 0, 'player_back', 'run0').setOrigin(0.5, 1).setDepth(5002);
    this.rocket = scene.add.image(0, 0, 'hs_rocket').setOrigin(0.5, 0.35).setVisible(false);
    this.shieldFx = scene.add.image(0, 0, 'fx_shield').setDepth(5003).setVisible(this.shieldCharges > 0);
    scene.tweens.add({ targets: this.shieldFx, alpha: { from: 0.6, to: 1 }, yoyo: true, repeat: -1, duration: 600 });
  }

  get now() {
    return this.scene.gameTime;
  }

  get isGrounded() {
    return !this.flying && this.y <= 0.0001 && this.vy <= 0;
  }

  get isCrashed() {
    return this.state === PlayerState.CRASH;
  }

  get maxJumps() {
    return this.perks.maxJumps ?? 2;
  }

  /** Current collision height (metres). */
  get height() {
    return this.state === PlayerState.DUCK ? RUNNER.DUCK_HEIGHT : RUNNER.PLAYER_HEIGHT;
  }

  /** True while sliding sideways between lanes. */
  get isChangingLane() {
    return Math.abs(RUNNER.LANES[this.lane] - this.x) > 0.25;
  }

  get hasStar() {
    return this.now < this.starUntil;
  }

  /** Squash & stretch: snap to (sx, sy) then spring back. */
  punch(sx, sy, duration = 130) {
    this.scene.tweens.killTweensOf(this.squash);
    this.squash.x = sx;
    this.squash.y = sy;
    this.scene.tweens.add({ targets: this.squash, x: 1, y: 1, duration: duration * 2.4, ease: 'Elastic.easeOut', easeParams: [1.1, 0.5] });
  }

  // -------------------------------------------------------------------------- input

  /** Swipe left (-1) / right (+1). Returns false at the edge of the road. */
  moveLane(dir) {
    if (this.isCrashed) return false;
    const next = Phaser.Math.Clamp(this.lane + dir, 0, RUNNER.LANES.length - 1);
    if (next === this.lane) return false;
    this.prevLane = this.lane;
    this.lane = next;
    this.punch(0.86, 1.1, 90);
    this.scene.events.emit('player-lane', { dir });
    return true;
  }

  /** Snaps back to the previous lane (bumped into the side of a wall). */
  bounceBack() {
    if (this.prevLane === undefined) return;
    this.lane = this.prevLane;
    this.punch(1.2, 0.8, 120);
  }

  /** Tap / swipe up. Ground jump, then air jumps (double; triple with Beaver Tail). */
  jump() {
    if (this.isCrashed || this.flying) return false;
    if (this.isGrounded || this.state === PlayerState.DUCK) {
      this.vy = RUNNER.JUMP_VELOCITY * Math.sqrt(this.perks.jumpMultiplier);
      this.y = 0.001;
      this.jumpsUsed = 1;
      this.duckHeld = false;
      this.state = PlayerState.JUMP;
      this.punch(0.78, 1.25, 120);
      this.scene.events.emit('player-jump', { double: false, count: 1 });
      return true;
    }
    if (this.jumpsUsed < this.maxJumps) {
      this.jumpsUsed += 1;
      this.vy = RUNNER.AIR_JUMP_VELOCITY * Math.sqrt(this.perks.jumpMultiplier);
      this.duckOnLand = false;
      this.state = PlayerState.JUMP;
      this.punch(0.8, 1.2, 110);
      this.scene.tweens.killTweensOf(this);
      this.spin = 0;
      this.scene.tweens.add({ targets: this, spin: 360 * (this.jumpsUsed % 2 ? -1 : 1), duration: 380, ease: 'Cubic.easeOut', onComplete: () => (this.spin = 0) });
      this.scene.events.emit('player-jump', { double: true, count: this.jumpsUsed });
      return true;
    }
    this.jumpBufferedAt = this.now; // fires on landing
    return false;
  }

  /** Spring pad: launches the runner high (air jumps are restored). */
  bounce(velocity) {
    if (this.isCrashed || this.flying) return;
    this.vy = velocity;
    this.y = Math.max(this.y, 0.001);
    this.jumpsUsed = 1;
    this.state = PlayerState.JUMP;
    this.punch(0.7, 1.35, 140);
    this.scene.events.emit('player-jump', { double: false, count: 1, spring: true });
  }

  /** Head Start: ride a rocket high above the track. */
  startFlying() {
    this.flying = true;
    this.state = PlayerState.JUMP;
    this.vy = 0;
    this.rocket.setVisible(true);
  }

  stopFlying() {
    this.flying = false;
    this.state = PlayerState.FALL;
    this.vy = 2;
    this.jumpsUsed = 1;
    this.invulnerableUntil = this.now + 1800;
    this.rocket.setVisible(false);
  }

  /** Swipe down / hold down: roll under gates. In the air it slams down first. */
  duck(held = false) {
    if (this.isCrashed || this.flying) return;
    this.duckHeld = held;
    this.duckUntil = this.now + RUNNER.ROLL_MS;
    if (this.isGrounded) {
      if (this.state !== PlayerState.DUCK) {
        this.state = PlayerState.DUCK;
        this.punch(1.2, 0.8, 100);
        this.scene.events.emit('player-duck');
      }
    } else {
      this.vy = Math.min(this.vy, RUNNER.FAST_FALL_VELOCITY);
      this.duckOnLand = true;
    }
  }

  releaseDuck() {
    this.duckHeld = false;
  }

  setJumpHeld(held) {
    this.jumpHeld = held;
  }

  // -------------------------------------------------------------------------- damage

  /**
   * Obstacle contact. Returns 'smash' (star / boost plows through), 'shield'
   * if absorbed, 'ignored' during invulnerability, or 'crash'.
   */
  hit() {
    if (this.isCrashed) return 'ignored';
    if (this.hasStar || this.boosting) return 'smash';
    if (this.now < this.invulnerableUntil) return 'ignored';
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.invulnerableUntil = this.now + RUNNER.INVULNERABLE_AFTER_SHIELD_MS;
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
    this.state = PlayerState.CRASH;
    this.vy = 7;
    // Turn round to face the camera, dazed (front-view crash frame).
    this.sprite.setTexture('player_sheet', 'crash');
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, spin: 25, duration: 500, ease: 'Quad.easeOut' });
  }

  revive() {
    this.scene.tweens.killTweensOf(this);
    this.state = PlayerState.FALL;
    this.spin = 0;
    this.y = 3;
    this.vy = 0;
    this.jumpsUsed = 1;
    this.invulnerableUntil = this.now + 2500;
    this.sprite.setTexture('player_back', 'fall');
  }

  // -------------------------------------------------------------------------- tick

  /** Integrates lane movement, gravity and state timers. */
  update(dt, speed) {
    const now = this.now;

    // Smooth lane slide (exponential approach so it feels snappy).
    const target = RUNNER.LANES[this.lane];
    const k = 1 - Math.exp((-dt * 1000) / (RUNNER.LANE_SWITCH_MS / 3));
    this.x += (target - this.x) * k;

    if (this.isCrashed) {
      this.vy -= RUNNER.GRAVITY * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      return;
    }

    if (this.flying) {
      // Glide up to rocket height and bob there.
      const targetY = (this.scene.flyHeight ?? 3.2) + Math.sin(now * 0.004) * 0.15;
      this.y += (targetY - this.y) * Math.min(1, dt * 4);
      this.state = PlayerState.JUMP;
      return;
    }

    if (!this.isGrounded) {
      // Zones (Low Gravity) scale gravity for everyone.
      let g = RUNNER.GRAVITY * this.perks.gravityMultiplier * (this.scene.gravityScale ?? 1);
      if (this.perks.floatyFall && this.jumpHeld && this.vy < 0) g *= RUNNER.FLOATY_GRAVITY_FACTOR;
      this.vy -= g * dt;
      this.y += this.vy * dt;
      if (this.vy < 0 && this.state === PlayerState.JUMP) this.state = PlayerState.FALL;
      if (this.y <= 0) this.land();
    } else if (this.state === PlayerState.DUCK && !this.duckHeld && now >= this.duckUntil) {
      this.state = PlayerState.RUN;
      this.punch(0.88, 1.12, 100);
    }

    // Run cycle speed follows the world speed.
    if (this.state === PlayerState.RUN) this.runPhase += dt * (6 + speed * 0.32);
  }

  land() {
    this.y = 0;
    this.vy = 0;
    this.jumpsUsed = 0;
    this.spin = 0;
    this.punch(1.3, 0.72, 110);
    this.scene.events.emit('player-land');
    if (this.duckOnLand || this.duckHeld) {
      this.duckOnLand = false;
      this.state = PlayerState.DUCK;
      this.duckUntil = Math.max(this.duckUntil, this.now + RUNNER.ROLL_MS * 0.7);
      this.scene.events.emit('player-duck');
      return;
    }
    this.state = PlayerState.RUN;
    if (this.now - this.jumpBufferedAt <= JUMP_BUFFER_MS) {
      this.jumpBufferedAt = -Infinity;
      this.jump();
    }
  }

  /** Projects the runner onto the screen using the scene's camera. */
  render(scene) {
    const z = RUNNER.PLAYER_Z;
    const feet = scene.project(this.x, this.y, z);
    const ground = scene.project(this.x, 0, z);
    const now = this.now;

    if (!this.isCrashed) {
      let frame;
      if (this.state === PlayerState.DUCK) frame = 'duck';
      else if (this.state === PlayerState.JUMP) frame = 'jump';
      else if (this.state === PlayerState.FALL) frame = 'fall';
      else frame = RUN_FRAMES[Math.floor(this.runPhase) % RUN_FRAMES.length];
      if (BACK_FRAMES.includes(frame)) this.sprite.setFrame(frame);
    }

    const texRes = this.isCrashed ? RES : BACK_TEX_RES;
    const base = (DRAW_HEIGHT_M * feet.s) / (176 * texRes);
    this.sprite.setPosition(feet.x, feet.y);
    this.sprite.setScale(base * this.squash.x, base * this.squash.y);
    const lean = Phaser.Math.Clamp((RUNNER.LANES[this.lane] - this.x) * 9, -16, 16);
    this.sprite.setAngle(lean + this.spin);

    if (this.hasStar) this.sprite.setTint(Phaser.Display.Color.HSVToRGB((now / 280) % 1, 0.55, 1).color);
    else this.sprite.clearTint();
    this.sprite.setAlpha(!this.hasStar && now < this.invulnerableUntil ? (Math.floor(now / 80) % 2 ? 0.35 : 1) : 1);

    // Rainbow / boost after-images trail behind (toward the camera).
    if ((this.boosting || this.hasStar) && now > this.nextAfterimageAt && !this.isCrashed) {
      this.nextAfterimageAt = now + 40;
      const ghost = this.afterimages[this.afterimageIndex++ % AFTERIMAGES];
      this.scene.tweens.killTweensOf(ghost);
      ghost
        .setTexture(this.sprite.texture.key, this.sprite.frame.name)
        .setPosition(this.sprite.x, this.sprite.y)
        .setScale(this.sprite.scaleX, this.sprite.scaleY)
        .setAngle(this.sprite.angle)
        .setVisible(true)
        .setAlpha(0.5)
        .setTintFill(Phaser.Display.Color.HSVToRGB((now / 200) % 1, 0.7, 1).color);
      this.scene.tweens.add({ targets: ghost, alpha: 0, scaleX: ghost.scaleX * 1.25, scaleY: ghost.scaleY * 1.25, y: ghost.y + 30, duration: 300, onComplete: () => ghost.setVisible(false) });
    }

    const lift = Phaser.Math.Clamp(1 - this.y / 3, 0.35, 1);
    const shadowScale = (2.1 * ground.s * lift) / 128;
    this.shadow.setPosition(ground.x, ground.y).setScale(shadowScale, shadowScale).setAlpha(this.isCrashed ? 0.3 : 0.6 * lift);
    const d = depthFor(z);
    this.shadow.setDepth(d + 0.1);
    this.sprite.setDepth(d + 0.3);
    this.shieldFx.setDepth(d + 0.4);
    this.afterimages.forEach((a) => a.setDepth(d + 0.2));
    this.shieldFx.setPosition(feet.x, feet.y - DRAW_HEIGHT_M * feet.s * 0.45).setScale((2.1 * feet.s) / 150);
    if (this.flying) {
      this.rocket.setPosition(feet.x, feet.y - 0.15 * feet.s).setScale((1.5 * feet.s) / 160).setDepth(d + 0.25).setAngle(Math.sin(now * 0.01) * 4);
      this.sprite.setFrame('fall');
    }
  }

  destroy() {
    this.rocket.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
    this.shieldFx.destroy();
    this.afterimages.forEach((a) => a.destroy());
  }
}
