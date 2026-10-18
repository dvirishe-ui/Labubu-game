/**
 * CollectiblePool.js
 * Object pool for pickups in the 3D lane runner: Pop Coins, Blind Box Tickets,
 * Super Magnets, Mario Kart-style item boxes, boost pads and L-A-B-U-B-U
 * letters. Pickups are pooled billboards; coins spin by squashing their width,
 * boost pads lie flat on the road. Collection uses simple lane/height/depth
 * overlap tests against the runner.
 */
import { RUNNER } from '../config/GameConfig.js';
import { depthFor, placeBillboard } from './World3D.js';

/** Size (metres) and look of each pickup kind. */
export const PICKUP_TYPES = {
  coin: { texture: 'coin', size: 0.62, reach: 0 },
  ticket: { texture: 'ticket', size: 0.75 },
  magnet: { texture: 'magnet', size: 0.9 },
  itembox: { texture: 'item_box', size: 1.0 },
  letter: { texture: 'letter_L', size: 1.25 },
  boost: { texture: 'boost_pad', size: 0.32, flat: true },
  spring: { texture: 'spring', size: 0.75 }
};

const MAGNET_PULL = 32; // m/s at which magnetised coins home in

export class CollectiblePool {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.free = [];
  }

  /**
   * Activates a pickup.
   * @param {string} kind   PICKUP_TYPES key
   * @param {number} x      lane x (metres)
   * @param {number} y      height above the road (metres)
   * @param {number} z      depth from the camera (metres)
   * @param {object} [extra] e.g. { letter: 'A', index: 1 }
   */
  spawn(kind, x, y, z, extra = {}) {
    const def = PICKUP_TYPES[kind];
    let p = this.free.pop();
    if (!p) p = { img: this.scene.add.image(0, 0, def.texture) };
    const tex = kind === 'letter' ? `letter_${extra.letter}` : def.texture;
    p.img.setTexture(tex).setOrigin(0.5, def.flat ? 0.5 : 1).setVisible(true).setAngle(0).setAlpha(1).clearTint();
    Object.assign(p, { kind, def, x, y, z, baseY: y, collected: false, attracted: false, used: false, ...extra });
    this.active.push(p);
    return p;
  }

  /** A line of coins down one lane. */
  spawnLine(lane, z, count, spacing = 2.2, y = 0.45) {
    for (let i = 0; i < count; i++) this.spawn('coin', RUNNER.LANES[lane], y, z + i * spacing);
  }

  /** An arc of coins tracing a jump (centred on depth z). */
  spawnArc(lane, z, count = 7, length = 9, height = 1.9) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      this.spawn('coin', RUNNER.LANES[lane], 0.45 + Math.sin(t * Math.PI) * height, z - length / 2 + t * length);
    }
  }

  /**
   * Moves, animates, attracts and collects pickups.
   * @param {number} dz        metres the world moved toward the camera
   * @param {number} dt        seconds
   * @param {object} player    Player (x, y, height)
   * @param {object} reach     { coin: metres sideways, magnet: depth range or 0 }
   * @param {(p) => void} onCollect
   */
  update(dz, dt, player, reach, onCollect) {
    const scene = this.scene;
    const pz = RUNNER.PLAYER_Z;
    const t = scene.gameTime;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (p.collected) {
        // Pop: rise and fade toward the HUD.
        p.popT += dt;
        p.y += dt * 6;
        p.img.setAlpha(Math.max(0, 1 - p.popT * 4));
        placeBillboard(scene, p.img, p.x, p.y, p.z, p.def.size * (1 + p.popT * 2), p.img.height);
        if (p.popT > 0.25) this.recycle(i);
        continue;
      }

      if (p.attracted) {
        // Magnetised coins fly to the runner regardless of lane.
        const tx = player.x;
        const ty = player.y + 0.8;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dzz = pz - p.z;
        const dist = Math.hypot(dx, dy, dzz) || 1;
        const step = Math.min(dist, MAGNET_PULL * dt);
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        p.z += (dzz / dist) * step;
      } else {
        p.z -= dz;
        if (p.kind === 'itembox' || p.kind === 'letter' || p.kind === 'ticket' || p.kind === 'magnet') {
          p.y = p.baseY + Math.sin(t * 0.005 + p.z) * 0.15;
        }
        if (p.kind === 'coin' && reach.magnet > 0 && p.z - pz < reach.magnet && p.z > pz - 0.5) p.attracted = true;
      }

      if (p.z < 0.7) {
        this.recycle(i);
        continue;
      }

      // Render
      if (p.def.flat) {
        // Boost pad lying flat: width from the lane, height squashed by depth.
        const g = scene.project(p.x, 0.02, p.z);
        const w = 1.8 * g.s;
        p.img.setPosition(g.x, g.y).setDisplaySize(w, Math.max(2, w * 0.12 * (1 + 9 / p.z))).setDepth(depthFor(p.z) - 1).setVisible(p.z > 0.6);
        p.img.setAlpha(Math.min(1, (scene.drawDistance - p.z) / 18));
      } else {
        placeBillboard(scene, p.img, p.x, p.y, p.z, p.def.size, p.img.height);
        if (p.kind === 'coin') p.img.scaleX *= Math.max(0.15, Math.abs(Math.cos(t * 0.006 + p.z * 0.4)));
        if (p.kind === 'itembox') p.img.setAngle(Math.sin(t * 0.004 + p.z) * 12);
        if (p.kind === 'letter') p.img.setAngle(Math.sin(t * 0.005) * 10);
      }

      // Collection test
      const dzp = Math.abs(p.z - pz);
      if (p.kind === 'boost' || p.kind === 'spring') {
        if (!p.used && dzp < 1.2 && Math.abs(p.x - player.x) < 1.2 && player.y < (p.kind === 'spring' ? 0.8 : 0.4)) {
          p.used = true;
          p.img.setTint(0xffffff);
          onCollect?.(p);
        }
        continue;
      }
      const sideReach = p.kind === 'coin' ? reach.coin : 1.0;
      const inLane = Math.abs(p.x - player.x) < sideReach;
      const inHeight = p.y > player.y - 0.5 && p.y < player.y + player.height + 0.6;
      const touching = p.attracted ? Math.hypot(p.x - player.x, p.y - player.y - 0.8, p.z - pz) < 0.9 : dzp < 0.9 && inLane && inHeight;
      if (touching) {
        p.collected = true;
        p.popT = 0;
        onCollect?.(p);
      }
    }
  }

  recycle(i) {
    const p = this.active[i];
    p.img.setVisible(false);
    this.active.splice(i, 1);
    this.free.push(p);
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this.recycle(i);
  }
}

