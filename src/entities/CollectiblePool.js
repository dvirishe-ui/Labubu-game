/**
 * CollectiblePool.js
 * Object pool for Pop Coins, Blind Box Tickets and the Super Magnet power-up.
 *
 * Pickups are plain pooled Images (no physics bodies): they scroll with the
 * world, spin/bob procedurally (no per-coin tweens), get pulled toward the
 * player inside the attraction radius, and are collected with a cheap
 * circle-vs-rectangle test against the player's hitbox. This keeps 100+ live
 * coins essentially free on low-end phones.
 */
import Phaser from 'phaser';

export const PICKUP_TYPES = {
  coin: { texture: 'coin', scale: 0.8, radius: 16 },
  ticket: { texture: 'ticket', scale: 0.85, radius: 24 },
  magnet: { texture: 'magnet', scale: 0.85, radius: 24 },
  itembox: { texture: 'item_box', scale: 0.85, radius: 28 },
  // Boost pads lie on the path and fire when you run over them (not collected).
  boost: { texture: 'boost_pad', scale: 1, radius: 0, halfWidth: 80, depth: 6 }
};

const MAGNET_PULL_SPEED = 1100; // px/s when a coin homes in on the player

export class CollectiblePool {
  constructor(scene) {
    this.scene = scene;
    this.group = scene.add.group({ classType: Phaser.GameObjects.Image, maxSize: 140 });
  }

  /** Activates a pooled pickup of `kind` at (x, y). */
  spawn(kind, x, y) {
    const def = PICKUP_TYPES[kind];
    const p = this.group.get(x, y, def.texture);
    if (!p) return null; // pool exhausted: skip
    p.setTexture(def.texture).setActive(true).setVisible(true).setScale(def.scale).setDepth(def.depth ?? 18).setAlpha(1).setAngle(0).clearTint();
    p.setPosition(x, y);
    p.kind = kind;
    p.radius = def.radius;
    p.baseY = y;
    p.attracted = false;
    p.collected = false;
    p.used = false;
    return p;
  }

  /** A horizontal line of coins (ground level or floating). */
  spawnLine(x, y, count, spacing = 52) {
    for (let i = 0; i < count; i++) this.spawn('coin', x + i * spacing, y);
  }

  /** A parabolic arc of coins that traces a jump over an obstacle. */
  spawnArc(centerX, groundY, count = 7, width = 300, height = 150) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      this.spawn('coin', centerX - width / 2 + t * width, groundY - 40 - Math.sin(t * Math.PI) * height);
    }
  }

  /**
   * Scrolls, animates, attracts and collects pickups.
   * @param {number} dx            world scroll this frame (px)
   * @param {number} dt            seconds
   * @param {Phaser.Geom.Rectangle} hitbox  player's current hitbox (world space)
   * @param {number} attractRadius coins closer than this fly to the player
   * @param {number} time          ms, drives the spin/bob animation
   * @param {(p) => void} onCollect
   */
  update(dx, dt, hitbox, attractRadius, time, onCollect) {
    const cx = hitbox.centerX;
    const cy = hitbox.centerY;
    const r2 = attractRadius * attractRadius;
    const halfW = hitbox.width / 2;
    const halfH = hitbox.height / 2;

    this.group.children.iterate((p) => {
      if (!p || !p.active || p.collected) return;
      if (p.attracted) {
        const ang = Phaser.Math.Angle.Between(p.x, p.y, cx, cy);
        const step = MAGNET_PULL_SPEED * dt;
        p.x += Math.cos(ang) * step;
        p.y += Math.sin(ang) * step;
      } else {
        p.x -= dx;
        if (p.kind === 'coin') {
          // Fake 3D spin: squash horizontally with |cos| (never mirrored).
          p.scaleX = 0.8 * Math.max(0.15, Math.abs(Math.cos(time * 0.005 + p.baseY * 0.05 + p.x * 0.004)));
          if (attractRadius > 0) {
            const ddx = p.x - cx;
            const ddy = p.y - cy;
            if (ddx * ddx + ddy * ddy < r2) {
              p.attracted = true;
              p.scaleX = 0.8;
            }
          }
        } else if (p.kind === 'itembox') {
          p.y = p.baseY + Math.sin(time * 0.006 + p.x * 0.02) * 6;
          p.angle = Math.sin(time * 0.003 + p.x) * 12;
        } else if (p.kind !== 'boost') {
          p.y = p.baseY + Math.sin(time * 0.005 + p.x * 0.01) * 8;
          p.angle = Math.sin(time * 0.004) * 8;
        }
      }

      // Boost pads: trigger once when the runner's feet pass over them.
      if (p.kind === 'boost') {
        if (!p.used && Math.abs(p.x - cx) < PICKUP_TYPES.boost.halfWidth + halfW && hitbox.bottom >= p.y - 16) {
          p.used = true;
          p.setTint(0xffffff);
          onCollect?.(p);
        }
        if (p.x < -120) this.recycle(p);
        return;
      }

      // Circle vs. rectangle overlap with the player's hitbox.
      const nx = Phaser.Math.Clamp(p.x, cx - halfW, cx + halfW);
      const ny = Phaser.Math.Clamp(p.y, cy - halfH, cy + halfH);
      const ox = p.x - nx;
      const oy = p.y - ny;
      if (ox * ox + oy * oy <= p.radius * p.radius) {
        this.collect(p);
        onCollect?.(p);
        return;
      }
      if (p.x < -60) this.recycle(p);
    });
  }

  /** Plays a quick pop and returns the pickup to the pool. */
  collect(p) {
    p.collected = true;
    p.scaleX = Math.abs(p.scaleY);
    this.scene.tweens.add({
      targets: p,
      scale: p.scaleY * 1.6,
      alpha: 0,
      y: p.y - 30,
      duration: 160,
      onComplete: () => this.recycle(p)
    });
  }

  recycle(p) {
    this.scene.tweens.killTweensOf(p);
    p.collected = false;
    this.group.killAndHide(p);
  }

  clear() {
    this.group.children.iterate((p) => p?.active && this.recycle(p));
  }
}
