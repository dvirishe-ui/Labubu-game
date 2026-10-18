/**
 * ObstaclePool.js
 * Object pool for the 3D lane runner's hazards. Every obstacle lives in one
 * lane at a depth z (metres ahead of the camera) and is drawn as a scaled
 * billboard with a soft contact shadow. Obstacles that pass behind the camera
 * are deactivated and reused, never destroyed.
 *
 * Kinds:
 *  - 'jump' : low hazard (stump, rock, bramble, log) - jump over or change lane
 *  - 'duck' : gate with a bar overhead - roll under or change lane
 *  - 'wall' : giant toadstool house - change lane
 *  - 'high' : candy-crate tower, too tall for one jump - DOUBLE JUMP over it
 *  - 'deco' : zone gate arch (no collision)
 * Carts (`speed` > 0) charge toward the runner once they get close.
 */
import { RUNNER } from '../config/GameConfig.js';
import { depthFor, placeBillboard } from './World3D.js';

/**
 * Archetypes in world metres. `w` = collision width, `h` = collision height
 * ('jump'/'wall'), `clear`/`top` = bar span for 'duck', `d` = depth, `drawH` =
 * billboard height, `minMeters` = when it starts appearing.
 */
export const OBSTACLE_TYPES = {
  stump: { texture: 'obs_stump', kind: 'jump', w: 1.4, h: 0.95, d: 0.9, drawH: 1.25, minMeters: 0, weight: 3 },
  rock: { texture: 'obs_rock', kind: 'jump', w: 1.4, h: 0.85, d: 0.9, drawH: 1.1, minMeters: 0, weight: 3 },
  bramble: { texture: 'obs_bramble', kind: 'jump', w: 1.8, h: 0.9, d: 1.0, drawH: 1.0, minMeters: 150, weight: 2 },
  log: { texture: 'obs_log', kind: 'jump', w: 1.9, h: 0.75, d: 1.0, drawH: 0.85, minMeters: 60, weight: 2 },
  gate: { texture: 'obs_gate', kind: 'duck', w: 2.0, clear: 1.05, top: 1.75, d: 0.6, drawH: 2.05, minMeters: 80, weight: 3 },
  tower: { texture: 'obs_tower', kind: 'wall', w: 1.9, h: 3.0, d: 1.6, drawH: 3.0, minMeters: 40, weight: 3 },
  // Placed by stage patterns only (weight 0 = never picked at random).
  crates: { texture: 'obs_crates', kind: 'high', w: 1.8, h: 2.3, d: 1.0, drawH: 2.7, minMeters: 0, weight: 0 },
  cart: { texture: 'obs_cart', kind: 'jump', w: 1.7, h: 1.0, d: 1.4, drawH: 1.3, minMeters: 0, weight: 0, speed: 10, chargeAt: 75 },
  arch: { texture: 'zone_moon', kind: 'deco', w: 9, h: 0, d: 0.5, drawH: 5.2, minMeters: 0, weight: 0 }
};

export class ObstaclePool {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.free = [];
  }

  /** Weighted random type unlocked at `meters`, optionally restricted to kinds. */
  randomType(meters, kinds = null) {
    const types = Object.entries(OBSTACLE_TYPES).filter(([, t]) => t.weight > 0 && meters >= t.minMeters && (!kinds || kinds.includes(t.kind)));
    const total = types.reduce((s, [, t]) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const [key, t] of types) {
      r -= t.weight;
      if (r <= 0) return key;
    }
    return types[0][0];
  }

  /** Activates a pooled obstacle of `type` in `lane` at depth `z`. */
  spawn(type, lane, z, texture = null) {
    const def = OBSTACLE_TYPES[type];
    let o = this.free.pop();
    if (!o) {
      o = {
        img: this.scene.add.image(0, 0, def.texture).setOrigin(0.5, 1),
        shadow: this.scene.add.image(0, 0, 'fx_shadow')
      };
    }
    o.img.setTexture(texture || def.texture).setVisible(true).setAngle(0).setAlpha(1).clearTint();
    o.shadow.setVisible(def.kind !== 'deco');
    const x = def.kind === 'deco' ? 0 : RUNNER.LANES[lane];
    Object.assign(o, { type, def, lane, x, z, hitDone: def.kind === 'deco', passed: false, smashed: false, smashT: 0, charging: false });
    this.active.push(o);
    return o;
  }

  /**
   * Moves obstacles toward the camera by `dz` metres, renders them and fires
   * `onPass(o)` once each obstacle passes the runner. Returns nothing.
   */
  update(dz, dt, onPass) {
    const scene = this.scene;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      o.z -= dz;
      // Carts charge at the runner once they are close (gameplay-clock based).
      if (o.def.speed && !o.smashed && o.z < o.def.chargeAt && scene.started && !scene.isOver) {
        if (!o.charging) {
          o.charging = true;
          scene.onCartCharge?.(o);
        }
        o.z -= o.def.speed * dt;
      }
      if (!o.passed && o.z < RUNNER.PLAYER_Z - o.def.d / 2 - 0.4) {
        o.passed = true;
        onPass?.(o);
      }
      if (o.z < 0.7) {
        this.recycle(i);
        continue;
      }
      let y = 0;
      if (o.smashed) {
        // Smashed obstacles fly up and spin away.
        o.smashT += dt;
        y = o.smashT * 9 - o.smashT * o.smashT * 20;
        o.img.setAngle(o.smashT * 540);
        o.img.setAlpha(Math.max(0, 1 - o.smashT * 1.5));
        o.x += dt * (o.x >= 0 ? 6 : -6);
      }
      if (o.charging) y += Math.abs(Math.sin(scene.gameTime * 0.025)) * 0.06; // rattling cart
      placeBillboard(scene, o.img, o.x, y, o.z, o.def.drawH, o.img.height);
      const g = scene.project(o.x, 0, o.z);
      const sw = ((o.def.w + 0.6) * g.s) / 128;
      o.shadow.setPosition(g.x, g.y).setScale(sw, sw).setDepth(depthFor(o.z) - 0.5).setAlpha(o.smashed ? 0 : o.img.alpha * 0.9);
    }
  }

  /** Plays the "plowed through" animation (star / dash / shield). */
  smash(o) {
    o.hitDone = true;
    o.smashed = true;
    o.smashT = 0;
  }

  recycle(i) {
    const o = this.active[i];
    o.img.setVisible(false);
    o.shadow.setVisible(false);
    this.active.splice(i, 1);
    this.free.push(o);
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this.recycle(i);
  }

  /** Removes obstacles closer than `z` (used by revive to give breathing room). */
  clearNear(z) {
    for (let i = this.active.length - 1; i >= 0; i--) if (this.active[i].z < z) this.recycle(i);
  }
}
