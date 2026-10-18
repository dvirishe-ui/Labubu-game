/**
 * ObstaclePool.js
 * Object pool for every hazard on the trail. Physical obstacles (stumps,
 * rocks, logs, brambles, roots, low branches) share one Arcade group whose
 * members are recycled; pit traps are plain images (no body) because they are
 * resolved by RunnerScene against the ground collider.
 *
 * Nothing is ever destroyed during a run: when an obstacle scrolls off the
 * left edge it is deactivated, hidden and its body disabled, ready for reuse.
 */
import { WIDTH } from '../config/GameConfig.js';

/**
 * Obstacle archetypes. `hitbox` is in texture pixels (forgiving, smaller than
 * the art). `minMeters` gates when a type may start spawning.
 */
export const OBSTACLE_TYPES = {
  stump: { texture: 'obs_stump', kind: 'ground', hitbox: { w: 50, h: 46, x: 13, y: 20 }, minMeters: 0, weight: 3 },
  rock: { texture: 'obs_rock', kind: 'ground', hitbox: { w: 52, h: 36, x: 9, y: 14 }, minMeters: 0, weight: 3 },
  root: { texture: 'obs_root', kind: 'ground', hitbox: { w: 76, h: 16, x: 10, y: 12 }, minMeters: 0, weight: 2 },
  low_branch: { texture: 'obs_branch', kind: 'overhead', clearance: 64, hitbox: { w: 116, h: 540, x: 22, y: 0 }, minMeters: 120, weight: 2 },
  log: { texture: 'obs_log', kind: 'ground', hitbox: { w: 100, h: 32, x: 14, y: 12 }, minMeters: 250, weight: 2 },
  bramble: { texture: 'obs_bramble', kind: 'ground', hitbox: { w: 90, h: 38, x: 13, y: 18 }, minMeters: 350, weight: 2 },
  pit: { texture: 'obs_pit', kind: 'pit', width: 180, minMeters: 200, weight: 2 }
};

export class ObstaclePool {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} groundY
   */
  constructor(scene, groundY) {
    this.scene = scene;
    this.groundY = groundY;
    this.group = scene.physics.add.group({ allowGravity: false, immovable: true, maxSize: 24 });
    this.pits = [];
    this.pitPool = [];
  }

  /** Picks a weighted random type among those unlocked at `meters`. */
  randomType(meters) {
    const types = Object.entries(OBSTACLE_TYPES).filter(([, t]) => meters >= t.minMeters);
    const total = types.reduce((s, [, t]) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const [key, t] of types) {
      r -= t.weight;
      if (r <= 0) return key;
    }
    return types[0][0];
  }

  /**
   * Activates a pooled obstacle of `type` at screen x.
   * @returns {{ type: string, width: number, left: number, right: number, top: number }} spawn footprint
   */
  spawn(type, x) {
    const def = OBSTACLE_TYPES[type];
    if (def.kind === 'pit') return this.spawnPit(x);

    const sprite = this.group.get(x, this.groundY, def.texture);
    if (!sprite) return null; // pool exhausted: skip this spawn
    sprite.setTexture(def.texture).setOrigin(0.5, 1).setActive(true).setVisible(true).setDepth(15).setAlpha(1).setAngle(0);
    sprite.obstacleType = type;
    sprite.dodged = false;
    sprite.passed = false;
    sprite.hitDone = false;

    let y = this.groundY + 2;
    if (def.kind === 'overhead') {
      // Bottom of the hitbox sits `clearance` px above the ground.
      const below = sprite.height - (def.hitbox.y + def.hitbox.h);
      y = this.groundY - def.clearance + below;
    }
    sprite.setPosition(x, y);
    const body = sprite.body;
    body.enable = true;
    body.moves = false; // we scroll obstacles manually, in sync with the ground
    body.setSize(def.hitbox.w, def.hitbox.h, false);
    body.setOffset(def.hitbox.x, def.hitbox.y);
    body.updateFromGameObject();

    // Soft contact shadow grounds the obstacle on the path.
    if (!sprite.shadowFx) sprite.shadowFx = this.scene.add.ellipse(0, 0, 100, 16, 0x2a1830, 0.28).setDepth(14);
    sprite.shadowFx.setPosition(x, this.groundY + 3).setScale((def.hitbox.w + 24) / 100, 1).setVisible(def.kind === 'ground');
    return { type, width: sprite.width, left: x - sprite.width / 2, right: x + sprite.width / 2, top: y - sprite.height };
  }

  spawnPit(x) {
    const img = this.pitPool.pop() || this.scene.add.image(0, 0, 'obs_pit').setOrigin(0, 0);
    img.setPosition(x, this.groundY - 4).setActive(true).setVisible(true).setDepth(6);
    img.dodged = false;
    img.obstacleType = 'pit';
    this.pits.push(img);
    return { type: 'pit', width: OBSTACLE_TYPES.pit.width, left: x, right: x + OBSTACLE_TYPES.pit.width, top: this.groundY };
  }

  /** Horizontal fall-through zone of a pit (a bit narrower than the art). */
  pitBounds(pit) {
    return { left: pit.x + 18, right: pit.x + OBSTACLE_TYPES.pit.width - 18 };
  }

  /** Returns the pit under `x`, if any. */
  pitAt(x) {
    for (const pit of this.pits) {
      const b = this.pitBounds(pit);
      if (x > b.left && x < b.right) return pit;
    }
    return null;
  }

  /**
   * Scrolls everything left by `dx`, recycles what left the screen and calls
   * `onDodged(type)` once per obstacle that fully passed `playerX`.
   */
  update(dx, playerX, onDodged, onPass) {
    this.group.children.iterate((o) => {
      if (!o || !o.active) return;
      o.x -= dx;
      if (o.shadowFx) o.shadowFx.x = o.x;
      if (!o.passed && !o.hitDone && o.x <= playerX) {
        o.passed = true;
        onPass?.(o);
      }
      if (!o.dodged && !o.hitDone && o.x + o.width / 2 < playerX - 30) {
        o.dodged = true;
        onDodged?.(o.obstacleType);
      }
      if (o.x + o.width / 2 < -40) this.recycle(o);
    });
    for (let i = this.pits.length - 1; i >= 0; i--) {
      const pit = this.pits[i];
      pit.x -= dx;
      if (!pit.dodged && !pit.fellIn && pit.x + OBSTACLE_TYPES.pit.width < playerX - 30) {
        pit.dodged = true;
        onDodged?.('pit');
      }
      if (pit.x + OBSTACLE_TYPES.pit.width < -40) {
        pit.setActive(false).setVisible(false);
        pit.fellIn = false;
        this.pits.splice(i, 1);
        this.pitPool.push(pit);
      }
    }
  }

  /** Returns an obstacle to the pool. */
  recycle(o) {
    o.shadowFx?.setVisible(false);
    o.body.enable = false;
    this.group.killAndHide(o);
  }

  /** Shatters an obstacle that a shield absorbed. */
  smash(o) {
    o.hitDone = true;
    o.shadowFx?.setVisible(false);
    o.body.enable = false;
    this.scene.tweens.add({
      targets: o,
      alpha: 0,
      angle: 40,
      y: o.y - 60,
      duration: 300,
      onComplete: () => this.recycle(o)
    });
  }

  /** Right-most occupied x (used to keep spawns from overlapping). */
  rightEdge() {
    let edge = -Infinity;
    this.group.children.iterate((o) => {
      if (o?.active) edge = Math.max(edge, o.x + o.width / 2);
    });
    for (const pit of this.pits) edge = Math.max(edge, pit.x + OBSTACLE_TYPES.pit.width);
    return edge === -Infinity ? WIDTH : edge;
  }

  clear() {
    this.group.children.iterate((o) => o?.active && this.recycle(o));
    for (const pit of this.pits) pit.setVisible(false).setActive(false);
    this.pitPool.push(...this.pits);
    this.pits = [];
  }
}

