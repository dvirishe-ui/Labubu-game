/**
 * Player.js
 * The runner character: an Arcade-physics sprite driven by a small finite
 * state machine.
 *
 *   RUN  --jump-->  JUMP  --apex-->  FALL  --land-->  RUN
 *    |               |  \--double jump (Beaver Tail)--> DOUBLE_JUMP
 *    \--slide--> SLIDE --timer--> RUN
 *   any --hit--> CRASH (terminal)
 *
 * Feel helpers: coyote time (jump shortly after leaving a ledge), jump
 * buffering (a press just before landing still jumps), fast-fall when you
 * swipe down in mid-air, and a floaty fall while jump is held (Beaver Tail).
 */
import Phaser from 'phaser';
import { RUNNER } from '../config/GameConfig.js';

export const PlayerState = Object.freeze({
  RUN: 'RUN',
  JUMP: 'JUMP',
  DOUBLE_JUMP: 'DOUBLE_JUMP',
  FALL: 'FALL',
  SLIDE: 'SLIDE',
  CRASH: 'CRASH'
});

const SCALE = 0.8;
// Hitboxes in unscaled frame space (frame is 128 x 176, feet at y = 172).
const BODY_STAND = { w: 46, h: 104, x: 42, y: 68 };
const BODY_SLIDE = { w: 64, h: 52, x: 34, y: 120 };
const COYOTE_MS = 90;
const JUMP_BUFFER_MS = 130;

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
    this.usedDoubleJump = false;
    this.lastGroundedAt = 0;
    this.jumpBufferedAt = -Infinity;
    this.slideBuffered = false;
    this.slideTimer = null;
    this.slideDurationMs = RUNNER.SLIDE_DURATION_MS; // RunnerScene scales this with speed
    this.shieldCharges = perks.shieldCharges;
    this.invulnerableUntil = 0;
    this.wasOnGround = true;

    this.setOrigin(0.5, 1).setScale(SCALE).setDepth(20);
    this.body.setCollideWorldBounds(false);
    this.applyHitbox(BODY_STAND);
    this.jumpVelocity = RUNNER.JUMP_VELOCITY * Math.sqrt(perks.jumpMultiplier); // height ∝ v²
    this.doubleJumpVelocity = RUNNER.DOUBLE_JUMP_VELOCITY * Math.sqrt(perks.jumpMultiplier);

    this.play('player_run');

    // Visual shield bubble for the Secret Chase perk.
    this.shieldFx = scene.add.image(x, groundY - 60, 'fx_shield').setDepth(21).setScale(SCALE).setVisible(this.shieldCharges > 0);
    scene.tweens.add({ targets: this.shieldFx, alpha: { from: 0.65, to: 1 }, yoyo: true, repeat: -1, duration: 600 });
  }

  applyHitbox(box) {
    this.body.setSize(box.w, box.h, false);
    this.body.setOffset(box.x, box.y);
  }

  get isGrounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  get isCrashed() {
    return this.state === PlayerState.CRASH;
  }

  /** Transition helper - single place that changes state & visuals. */
  setStateTo(next) {
    if (this.state === next || this.state === PlayerState.CRASH) return;
    const prev = this.state;
    this.state = next;

    if (prev === PlayerState.SLIDE) {
      this.applyHitbox(BODY_STAND);
      this.slideTimer?.remove();
      this.slideTimer = null;
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
        this.applyHitbox(BODY_SLIDE);
        this.slideTimer = this.scene.time.delayedCall(this.slideDurationMs, () => {
          if (this.state === PlayerState.SLIDE) this.setStateTo(PlayerState.RUN);
        });
        break;
      case PlayerState.CRASH:
        this.anims.stop();
        this.setFrame('crash');
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------- input

  /** Jump request (tap / swipe up / space). Handles double jump & buffering. */
  jump() {
    if (this.isCrashed) return false;
    const now = this.scene.time.now;
    const canCoyote = now - this.lastGroundedAt <= COYOTE_MS;

    if (this.state === PlayerState.RUN || this.state === PlayerState.SLIDE || (canCoyote && this.state !== PlayerState.JUMP && this.state !== PlayerState.DOUBLE_JUMP)) {
      this.body.setVelocityY(this.jumpVelocity);
      this.usedDoubleJump = false;
      this.lastGroundedAt = -Infinity;
      this.setStateTo(PlayerState.JUMP);
      this.scene.events.emit('player-jump', { double: false });
      return true;
    }
    if (this.perks.doubleJump && !this.usedDoubleJump) {
      this.body.setVelocityY(this.doubleJumpVelocity);
      this.usedDoubleJump = true;
      this.setStateTo(PlayerState.DOUBLE_JUMP);
      this.scene.tweens.add({ targets: this, angle: -360, duration: 380, onComplete: () => this.setAngle(0) });
      this.scene.events.emit('player-jump', { double: true });
      return true;
    }
    // Airborne without double jump: remember the press for landing.
    this.jumpBufferedAt = now;
    return false;
  }

  /** Slide request (swipe down / arrow down). In the air it fast-falls first. */
  slide() {
    if (this.isCrashed) return;
    if (this.isGrounded) {
      if (this.state !== PlayerState.SLIDE) {
        this.setStateTo(PlayerState.SLIDE);
        this.scene.events.emit('player-slide');
      }
    } else {
      this.body.setVelocityY(RUNNER.FAST_FALL_VELOCITY);
      this.slideBuffered = true;
    }
  }

  setJumpHeld(held) {
    this.jumpHeld = held;
  }

  // -------------------------------------------------------------------------- damage

  /** True while post-shield invulnerability frames are active. */
  isInvulnerable(now = this.scene.time.now) {
    return now < this.invulnerableUntil;
  }

  /**
   * Called on obstacle contact. Returns 'shield' if the hit was absorbed,
   * 'crash' if the run is over, or 'ignored' during invulnerability.
   */
  hit() {
    if (this.isCrashed) return 'ignored';
    const now = this.scene.time.now;
    if (this.isInvulnerable(now)) return 'ignored';
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.invulnerableUntil = now + RUNNER.INVULNERABLE_AFTER_SHIELD_MS;
      this.shieldFx.setVisible(this.shieldCharges > 0);
      this.scene.tweens.add({ targets: this, alpha: 0.35, yoyo: true, repeat: 5, duration: 100, onComplete: () => this.setAlpha(1) });
      return 'shield';
    }
    this.crash();
    return 'crash';
  }

  crash() {
    this.setStateTo(PlayerState.CRASH);
    this.body.setVelocity(0, -420);
    this.body.checkCollision.none = true; // fall through the floor, cartoon style
    this.scene.tweens.add({ targets: this, angle: 200, duration: 900, ease: 'Quad.easeIn' });
  }

  // -------------------------------------------------------------------------- tick

  /** Per-frame update: gravity modifiers, landing detection, state upkeep. */
  update(time) {
    this.shieldFx.setPosition(this.x, this.y - (this.displayHeight * 0.45));
    if (this.isCrashed) return;

    const grounded = this.isGrounded;
    const vy = this.body.velocity.y;

    // Gravity: base modifier (Space Explorer) and floaty fall (Beaver Tail).
    let factor = this.perks.gravityMultiplier;
    if (this.perks.floatyFall && this.jumpHeld && vy > 0 && !grounded) factor *= RUNNER.FLOATY_GRAVITY_FACTOR;
    // body.gravity is ADDED to world gravity, so express the delta.
    this.body.setGravityY(RUNNER.GRAVITY * (factor - 1));

    if (grounded) {
      this.lastGroundedAt = time;
      if (!this.wasOnGround) this.onLand(time);
    } else if (vy > 0 && (this.state === PlayerState.JUMP || this.state === PlayerState.DOUBLE_JUMP || this.state === PlayerState.RUN)) {
      this.setStateTo(PlayerState.FALL);
    }
    this.wasOnGround = grounded;
  }

  onLand(time) {
    this.usedDoubleJump = false;
    this.setAngle(0);
    this.scene.events.emit('player-land');
    if (this.slideBuffered) {
      this.slideBuffered = false;
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

  destroy(fromScene) {
    this.slideTimer?.remove();
    this.shieldFx?.destroy();
    super.destroy(fromScene);
  }
}
