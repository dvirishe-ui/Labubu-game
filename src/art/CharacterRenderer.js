/**
 * CharacterRenderer.js
 * Procedural Canvas-2D renderer for Labubu dolls and their accessories.
 *
 * A character is drawn in a 128 x 176 "frame space" (feet at y = 172), then
 * scaled by `res` for hi-res previews. Because every accessory is drawn in the
 * same transformed context as the body, hats / vests / tails automatically
 * follow every pose (run cycle, jump tuck, duck crouch, crash spin).
 *
 * Exported bake helpers turn drawings into Phaser textures:
 *   bakeCharacterSheet(scene, key, loadout, res)  -> multi-frame sheet for the runner
 *   bakeCharacterFrame(scene, key, loadout, pose, res) -> single frame (icons, previews)
 */
import { CATALOG } from '../config/GachaDropTable.js';
import { RES } from '../config/GameConfig.js';
import * as W from './Wardrobe.js';

/** Sleeve colour for the worn outfit (null = bare fur arms). */
function sleeveFor(outfit) {
  const look = W.lookOf(outfit);
  if (look) return W.sleeveOf(look);
  return outfit === 'raincoat' ? '#ffd23f' : null;
}

/** Resolution of the per-item icons (displayed at ICON_SCALE / ICON_RES). */
export const ICON_RES = 0.75 * RES;

export const FRAME_W = 128;
export const FRAME_H = 176;
/** Vertical offset applied to every drawing so the tall ears fit in the frame. */
export const DRAW_OFFSET_Y = 16;

/** Poses baked into every runner sheet, in order. */
export const POSES = {
  run0: { legF: 0.55, legB: -0.55, arm: -0.6, bob: 0, ear: 0.12 },
  run1: { legF: 0.15, legB: -0.15, arm: -0.2, bob: -3, ear: 0.2 },
  run2: { legF: -0.55, legB: 0.55, arm: 0.6, bob: 0, ear: 0.12 },
  run3: { legF: -0.15, legB: 0.15, arm: 0.2, bob: -3, ear: 0.2 },
  jump: { legF: -0.9, legB: 0.5, arm: -2.2, bob: -2, ear: 0.45, tuck: 6 },
  fall: { legF: 0.35, legB: -0.25, arm: -1.2, bob: 0, ear: -0.15 },
  // Compact crouch: head tucked down onto the body, ears swept flat behind.
  slide: { legF: 1.0, legB: -0.9, arm: -1.1, bob: 0, ear: 0, duck: true },
  crash: { legF: 0.8, legB: -0.9, arm: -2.6, bob: 0, ear: -0.5, crash: true },
  idle: { legF: 0.05, legB: -0.05, arm: 0.15, bob: 0, ear: 0 },
  wave: { legF: 0.05, legB: -0.05, arm: -2.4, bob: -2, ear: 0.1, happy: true }
};
export const SHEET_FRAMES = ['run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'slide', 'crash', 'idle'];

// ---------------------------------------------------------------------------- helpers

/** Deterministic PRNG so fur speckles look identical on every bake. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fills the current clip region with a tartan/plaid pattern. */
function plaid(ctx, x, y, w, h, base, stripeA, stripeB) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = stripeA;
  for (let i = x - 4; i < x + w; i += 12) ctx.fillRect(i, y, 5, h);
  for (let j = y - 4; j < y + h; j += 12) ctx.fillRect(x, j, w, 5);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = stripeB;
  for (let i = x + 2; i < x + w; i += 12) ctx.fillRect(i, y, 1.5, h);
  for (let j = y + 2; j < y + h; j += 12) ctx.fillRect(x, j, w, 1.5);
  ctx.globalAlpha = 1;
}

/** Fluffy fur outline: a circle with small scalloped bumps. */
function furCircle(ctx, cx, cy, r, bumps = 18, depth = 2.2) {
  ctx.beginPath();
  for (let i = 0; i <= bumps * 4; i++) {
    const a = (i / (bumps * 4)) * Math.PI * 2;
    const rr = r + Math.sin(a * bumps) * depth;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const OUTLINE = '#2b1a24';

// ---------------------------------------------------------------------------- parts

function drawEar(ctx, baseX, baseY, angle, pal, inner = true) {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.bezierCurveTo(-12, -22, -6, -40, 0, -46);
  ctx.bezierCurveTo(6, -40, 12, -22, 9, 0);
  ctx.closePath();
  ctx.fillStyle = pal.fur;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (inner) {
    ctx.beginPath();
    ctx.moveTo(-4.5, -4);
    ctx.bezierCurveTo(-6, -20, -3, -32, 0, -37);
    ctx.bezierCurveTo(3, -32, 6, -20, 4.5, -4);
    ctx.closePath();
    ctx.fillStyle = pal.ear;
    ctx.fill();
  }
  ctx.restore();
}

function drawLeg(ctx, hipX, hipY, angle, pal, shoes) {
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(angle);
  roundRect(ctx, -7, -2, 14, 24, 6);
  ctx.fillStyle = pal.shade;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // Foot / shoe
  const shoeLook = W.lookOf(shoes);
  if (shoeLook) {
    W.drawShoeFront(ctx, shoeLook);
  } else if (shoes === 'canvas_sneakers') {
    roundRect(ctx, -8, 15, 20, 10, 4);
    ctx.fillStyle = '#4b7bd6';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, 22, 20, 3);
    ctx.fillStyle = '#e94b4b';
    ctx.fillRect(-8, 24, 20, 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, 16, 6, 1.5);
  } else {
    ellipse(ctx, 2, 21, 9, 5);
    ctx.fillStyle = pal.fur;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawArm(ctx, sx, sy, angle, pal, sleeve) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  roundRect(ctx, -5, -2, 10, 20, 5);
  ctx.fillStyle = sleeve || pal.fur;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ellipse(ctx, 0, 19, 5.5, 5);
  ctx.fillStyle = pal.fur;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTail(ctx, loadout, pal) {
  const doll = loadout.baseDoll;
  const tail = loadout.tail;
  const tailLook = W.lookOf(tail);
  if (tailLook) {
    W.drawTailFront(ctx, tailLook);
    return;
  }
  // Beaver paddle tail (accessory) or the secret doll's built-in quilted tail.
  if (tail === 'beaver_paddle_tail' || doll === 'beaver_labubu_secret') {
    ctx.save();
    ctx.translate(40, 128);
    ctx.rotate(0.55);
    ellipse(ctx, -16, 6, 20, 10);
    ctx.fillStyle = '#6b4226';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    // Quilted crosshatch
    ctx.save();
    ellipse(ctx, -16, 6, 20, 10);
    ctx.clip();
    ctx.strokeStyle = 'rgba(30,15,5,0.55)';
    ctx.lineWidth = 1.2;
    for (let i = -40; i < 10; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, -6);
      ctx.lineTo(i + 14, 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 14, -6);
      ctx.lineTo(i, 18);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  } else if (doll === 'zimomo_king') {
    // Zimomo's long tufted tail
    ctx.save();
    ctx.strokeStyle = pal.shade;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(44, 128);
    ctx.bezierCurveTo(24, 132, 20, 112, 16, 102);
    ctx.stroke();
    furCircle(ctx, 15, 97, 8, 8, 2);
    ctx.fillStyle = pal.fur;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
  }
}

/** Torso + outfit layer. */
function drawBody(ctx, loadout, pal) {
  const doll = loadout.baseDoll;
  const outfit = loadout.outfit;
  ctx.save();
  // Royal cape (behind the torso)
  if (doll === 'zimomo_king') {
    ctx.beginPath();
    ctx.moveTo(48, 98);
    ctx.quadraticCurveTo(28, 128, 34, 146);
    ctx.lineTo(70, 140);
    ctx.lineTo(76, 98);
    ctx.closePath();
    ctx.fillStyle = '#c4202a';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }

  // Base torso
  ellipse(ctx, 64, 120, 23, 21);
  const g = ctx.createLinearGradient(0, 100, 0, 142);
  g.addColorStop(0, pal.fur);
  g.addColorStop(1, pal.shade);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // Built-in doll outfits
  ctx.save();
  ellipse(ctx, 64, 120, 22, 20);
  ctx.clip();
  if (doll === 'beaver_labubu_secret' && !outfit) {
    plaid(ctx, 40, 98, 48, 46, '#b8312c', '#1f1a24', '#f2d16b'); // plaid flannel
    ctx.fillStyle = '#e9c9a3';
    ctx.beginPath();
    ctx.moveTo(58, 99);
    ctx.lineTo(64, 112);
    ctx.lineTo(70, 99);
    ctx.fill();
  } else if (doll === 'space_explorer' && !outfit) {
    ctx.fillStyle = '#f7f9fc';
    ctx.fillRect(40, 98, 48, 46);
    roundRect(ctx, 56, 108, 18, 14, 3);
    ctx.fillStyle = '#4f7cff';
    ctx.fill();
    ctx.fillStyle = '#ff5a6e';
    ctx.fillRect(59, 111, 4, 4);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(66, 111, 4, 4);
  } else if (doll === 'zimomo_king' && !outfit) {
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(40, 101, 48, 4);
    ctx.fillStyle = '#ffffff';
    for (let i = 44; i < 88; i += 8) {
      ctx.beginPath();
      ctx.arc(i, 103, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Fur belly patch
  if (!outfit && doll !== 'space_explorer') {
    ellipse(ctx, 67, 126, 11, 10);
    ctx.fillStyle = doll === 'beaver_labubu_secret' ? 'rgba(0,0,0,0)' : pal.face;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Accessory outfits
  const outfitLook = W.lookOf(outfit);
  if (outfitLook) {
    W.drawOutfit(ctx, outfitLook, true);
  } else if (outfit === 'lumberjack_vest') {
    plaid(ctx, 40, 98, 48, 46, '#c7362f', '#2a1414', '#f4c26b');
    // open front shows fur
    ctx.beginPath();
    ctx.moveTo(62, 98);
    ctx.lineTo(70, 98);
    ctx.lineTo(72, 142);
    ctx.lineTo(64, 142);
    ctx.closePath();
    ctx.fillStyle = pal.fur;
    ctx.fill();
    ctx.fillStyle = '#e8c15a';
    [108, 118, 128].forEach((y) => {
      ctx.beginPath();
      ctx.arc(61, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (outfit === 'raincoat') {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(40, 98, 48, 46);
    ctx.fillStyle = '#e8b400';
    ctx.fillRect(40, 136, 48, 8);
    ctx.fillStyle = '#ffffff';
    [106, 116, 126].forEach((y) => {
      ctx.beginPath();
      ctx.arc(68, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    roundRect(ctx, 46, 120, 10, 8, 2);
    ctx.strokeStyle = '#c99400';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  if (outfit) {
    ellipse(ctx, 64, 120, 23, 21);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  if (outfitLook) W.drawOutfitExtras(ctx, outfitLook, true);
  const backLook = W.lookOf(loadout.back);
  if (backLook) W.drawBackItemFront(ctx, backLook);
  ctx.restore();
}

/** Fluffy head: a cloud of overlapping tufts with shading, strands and rim light. */
function drawFurBall(ctx, cx, cy, pal) {
  // Head fur: a cloud of overlapping tufts, outlined by drawing the same
  // cloud slightly larger in the outline colour first.
  const tufts = [];
  const TUFTS = 22;
  for (let i = 0; i < TUFTS; i++) {
    const a = (i / TUFTS) * Math.PI * 2;
    tufts.push([cx + Math.cos(a) * 31, cy + Math.sin(a) * 31, 8.5 + (i % 3) * 0.8]);
  }
  ctx.fillStyle = OUTLINE;
  for (const [x, y, r] of tufts) {
    ctx.beginPath();
    ctx.arc(x, y, r + 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 33, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - 12, cy - 16, 4, cx + 4, cy + 6, 46);
  g.addColorStop(0, shade(pal.fur, 34));
  g.addColorStop(0.45, pal.fur);
  g.addColorStop(1, pal.shade);
  ctx.fillStyle = g;
  for (const [x, y, r] of tufts) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 33, 0, Math.PI * 2);
  ctx.fill();
  // Fur strands + rim light give the plush texture.
  ctx.strokeStyle = shade(pal.fur, 40);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.6;
  const rndF = seeded(11);
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.95 + rndF() * 1.1);
    const r = 24 + rndF() * 12;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 2, y - 4, x + 5 * Math.cos(a + 1.2), y + 5 * Math.sin(a + 1.2));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (0.05 + rndF() * 0.85);
    const r = 26 + rndF() * 9;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------- skin features

/**
 * Extra procedural details for premium skins (palette.features).
 * layer 'back' = behind the body (wings, mane), 'head' = on the head after the
 * face (eyepatch, bandana, horns, tiara...), 'body' = sparkles over everything.
 * `front` is false for the over-the-shoulder runner view.
 */
function drawFeatures(ctx, pal, layer, front = true) {
  const f = pal.features;
  if (!f?.length) return;
  const cx = front ? 66 : 64;
  const cy = 66;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  const has = (k) => f.includes(k);

  if (layer === 'back') {
    if (has('dragon')) {
      // Little bat wings behind the shoulders
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(64 + s * 10, 104);
        ctx.quadraticCurveTo(64 + s * 46, 74, 64 + s * 56, 92);
        ctx.lineTo(64 + s * 46, 100);
        ctx.lineTo(64 + s * 44, 112);
        ctx.lineTo(64 + s * 32, 110);
        ctx.lineTo(64 + s * 26, 120);
        ctx.closePath();
        ctx.fillStyle = shade(pal.shade, -10);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(64 + s * 14, 104);
        ctx.lineTo(64 + s * 44, 86);
        ctx.stroke();
        ctx.strokeStyle = OUTLINE;
      }
    }
    if (has('mane')) {
      const colors = ['#ff6fae', '#ffd23f', '#6ee7a8', '#59b8ff', '#b07cff'];
      colors.forEach((c, i) => {
        ctx.beginPath();
        ctx.ellipse(cx - 30 + i * 3, cy - 18 + i * 12, 11, 8, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
        ctx.stroke();
      });
    }
  }

  if (layer === 'head') {
    if (has('metallic')) {
      // Polished-gold glints on the fur
      const g = ctx.createLinearGradient(cx - 30, cy - 30, cx + 20, cy + 10);
      g.addColorStop(0, 'rgba(255,255,255,0.65)');
      g.addColorStop(0.4, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.fill();
    }
    if (has('frost')) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const rnd = seeded(23);
      for (let i = 0; i < 10; i++) {
        const a = Math.PI * (1.05 + rnd() * 0.9);
        const r = 26 + rnd() * 8;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5 + rnd() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (has('seeds')) {
      ctx.fillStyle = '#ffe27a';
      const rnd = seeded(5);
      for (let i = 0; i < 16; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 18 + rnd() * 12;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (front && Math.abs(x - cx - 5) < 26 && Math.abs(y - cy - 8) < 20) continue; // not on the face
        ctx.beginPath();
        ctx.ellipse(x, y, 1.6, 2.6, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (has('leafcap')) {
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(cx, cy - 30);
        ctx.rotate(i * 0.5);
        ctx.beginPath();
        ctx.ellipse(0, -9, 6, 12, 0, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#3f9e3a' : '#5fc24f';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#2f7a2a';
      ctx.fillRect(cx - 2, cy - 50, 4, 10);
    }
    if (has('bandana')) {
      ctx.beginPath();
      ctx.moveTo(cx - 33, cy - 8);
      ctx.quadraticCurveTo(cx, cy - 50, cx + 33, cy - 8);
      ctx.quadraticCurveTo(cx, cy - 30, cx - 33, cy - 8);
      ctx.closePath();
      ctx.fillStyle = pal.accent;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (const [dx, dy] of [[-14, -20], [0, -27], [14, -20]]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // knot tails
      const kx = front ? cx - 32 : cx + 32;
      ctx.fillStyle = pal.accent;
      for (const a of [0.5, 1.1]) {
        ctx.beginPath();
        ctx.ellipse(kx + Math.cos(a) * 8 * (front ? -1 : 1), cy - 6 + Math.sin(a) * 8, 8, 4, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (has('eyepatch') && front) {
      ctx.strokeStyle = '#160f0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 12);
      ctx.lineTo(cx + 34, cy + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 16, cy + 2, 9, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#160f0b';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
    }
    if (has('dragon')) {
      // Two curved horns + back spikes
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 12, cy - 28);
        ctx.quadraticCurveTo(cx + s * 22, cy - 50, cx + s * 30, cy - 54);
        ctx.quadraticCurveTo(cx + s * 22, cy - 40, cx + s * 22, cy - 26);
        ctx.closePath();
        ctx.fillStyle = pal.ear;
        ctx.fill();
        ctx.stroke();
      }
      if (!front) {
        for (let i = 0; i < 4; i++) {
          const y = cy - 6 + i * 16;
          ctx.beginPath();
          ctx.moveTo(cx - 6, y);
          ctx.lineTo(cx, y - 10);
          ctx.lineTo(cx + 6, y);
          ctx.closePath();
          ctx.fillStyle = pal.accent;
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    if (has('horn')) {
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 28);
      ctx.lineTo(cx + 1, cy - 66);
      ctx.lineTo(cx + 9, cy - 28);
      ctx.closePath();
      const g = ctx.createLinearGradient(cx - 7, 0, cx + 9, 0);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(1, '#ffb800');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(160,100,0,0.6)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - 7 + i * 1.8, cy - 28 - i * 9);
        ctx.lineTo(cx + 9 - i * 2.2, cy - 33 - i * 9);
        ctx.stroke();
      }
      ctx.strokeStyle = OUTLINE;
    }
    if (has('tiara')) {
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - 26);
      ctx.lineTo(cx - 14, cy - 42);
      ctx.lineTo(cx - 6, cy - 32);
      ctx.lineTo(cx, cy - 50);
      ctx.lineTo(cx + 6, cy - 32);
      ctx.lineTo(cx + 14, cy - 42);
      ctx.lineTo(cx + 20, cy - 26);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, cy - 50, 0, cy - 26);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#8fd3ff');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#59b8ff';
      ctx.beginPath();
      ctx.arc(cx, cy - 34, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (layer === 'body') {
    if (has('sparkles') || has('stars')) {
      ctx.fillStyle = has('stars') ? '#fff6c2' : '#ffffff';
      const rnd = seeded(has('stars') ? 31 : 17);
      for (let i = 0; i < (has('stars') ? 12 : 7); i++) {
        const x = 30 + rnd() * 70;
        const y = 34 + rnd() * 120;
        const r = 2.5 + rnd() * 3;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr2 = k % 2 ? r * 0.35 : r;
          const a = (k * Math.PI) / 4;
          ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Head, face, teeth, eyes. */
function drawHead(ctx, loadout, pal, pose) {
  const doll = loadout.baseDoll;
  const cx = 66;
  const cy = 66;

  drawFurBall(ctx, cx, cy, pal);

  // Speckled fur (Sesame colorway)
  if (pal.speckle) {
    const rnd = seeded(7);
    ctx.fillStyle = 'rgba(40,35,30,0.35)';
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 32;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.9 + rnd(), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Face plate
  ellipse(ctx, cx + 5, cy + 8, 26, 21);
  ctx.fillStyle = pal.face;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(40,24,30,0.35)';
  ctx.stroke();

  // Eyes
  const eyeY = cy + 2;
  const eyes = [cx - 6, cx + 16];
  if (pose.crash) {
    ctx.strokeStyle = pal.eye;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const ex of eyes) {
      ctx.beginPath();
      ctx.moveTo(ex - 5, eyeY - 5);
      ctx.lineTo(ex + 5, eyeY + 5);
      ctx.moveTo(ex + 5, eyeY - 5);
      ctx.lineTo(ex - 5, eyeY + 5);
      ctx.stroke();
    }
  } else if (pose.happy) {
    ctx.strokeStyle = pal.eye;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const ex of eyes) {
      ctx.beginPath();
      ctx.arc(ex, eyeY + 3, 6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    for (const ex of eyes) {
      ellipse(ctx, ex, eyeY, 6.5, 8);
      ctx.fillStyle = pal.eye;
      ctx.fill();
      ellipse(ctx, ex + 2, eyeY - 3, 2.6, 3.2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex - 2, eyeY + 3, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Blush
  ctx.fillStyle = 'rgba(255,120,140,0.35)';
  ellipse(ctx, cx - 14, cy + 12, 5, 3);
  ctx.fill();
  ellipse(ctx, cx + 26, cy + 12, 5, 3);
  ctx.fill();

  // Mouth
  if (doll === 'beaver_labubu_secret') {
    // Beaver nose, small smile, whiskers and two big buck teeth
    ellipse(ctx, cx + 5, cy + 11, 4.5, 3.2);
    ctx.fillStyle = '#3a2216';
    ctx.fill();
    ctx.strokeStyle = '#3a2216';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 15);
    ctx.quadraticCurveTo(cx + 5, cy + 21, cx + 14, cy + 15);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cx - 1, cy + 17, 6, 10, 1.5);
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, cx + 5, cy + 17, 6, 10, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + 5 + s * 12, cy + 13 + k * 3);
        ctx.lineTo(cx + 5 + s * 22, cy + 11 + k * 5);
        ctx.stroke();
      }
    }
  } else if (pose.crash) {
    ellipse(ctx, cx + 5, cy + 19, 6, 5);
    ctx.fillStyle = '#5a1a24';
    ctx.fill();
  } else {
    // The signature wide grin with nine serrated teeth
    const mx0 = cx - 11;
    const mx1 = cx + 21;
    const my = cy + 13;
    ctx.beginPath();
    ctx.moveTo(mx0, my);
    ctx.quadraticCurveTo(cx + 5, my + 17, mx1, my);
    ctx.quadraticCurveTo(cx + 5, my + 5, mx0, my);
    ctx.closePath();
    ctx.fillStyle = '#7a1f2e';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    const teeth = 9;
    ctx.beginPath();
    ctx.moveTo(mx0, my - 2);
    for (let i = 0; i <= teeth; i++) {
      const tx = mx0 + ((mx1 - mx0) * i) / teeth;
      ctx.lineTo(tx, my - 2);
      if (i < teeth) ctx.lineTo(tx + (mx1 - mx0) / teeth / 2, my + 7 + Math.sin((i / teeth) * Math.PI) * 3);
    }
    ctx.lineTo(mx1, my - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(mx0, my);
    ctx.quadraticCurveTo(cx + 5, my + 17, mx1, my);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function drawHeadwear(ctx, loadout, pal) {
  const doll = loadout.baseDoll;
  const hw = loadout.headwear;
  const cx = 66;
  const cy = 66;
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;

  const hwLook = W.lookOf(hw);
  if (hwLook) {
    W.drawHeadwear(ctx, hwLook, cx, cy, true);
  } else if (hw === 'beanie') {
    ctx.beginPath();
    ctx.moveTo(cx - 33, cy - 12);
    ctx.bezierCurveTo(cx - 30, cy - 44, cx + 30, cy - 44, cx + 33, cy - 12);
    ctx.closePath();
    ctx.fillStyle = '#5bb381';
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, cx - 35, cy - 18, 70, 11, 5);
    ctx.fillStyle = '#3f8f63';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let x = cx - 30; x < cx + 32; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, cy - 17);
      ctx.lineTo(x, cy - 8);
      ctx.stroke();
    }
  } else if (hw === 'beaver_cap') {
    ctx.beginPath();
    ctx.moveTo(cx - 32, cy - 14);
    ctx.bezierCurveTo(cx - 28, cy - 46, cx + 28, cy - 46, cx + 32, cy - 14);
    ctx.closePath();
    ctx.fillStyle = '#7a4a2a';
    ctx.fill();
    ctx.stroke();
    // little round beaver ears on the cap
    for (const ex of [cx - 20, cx + 20]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 36, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#7a4a2a';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, cy - 36, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#d99a7a';
      ctx.fill();
    }
    // brim
    ctx.beginPath();
    ctx.ellipse(cx + 22, cy - 14, 18, 5, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#5c361d';
    ctx.fill();
    ctx.stroke();
  } else if (doll === 'zimomo_king') {
    // Built-in crown (only when no headwear is equipped)
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy - 30);
    ctx.lineTo(cx - 16, cy - 46);
    ctx.lineTo(cx - 8, cy - 38);
    ctx.lineTo(cx, cy - 50);
    ctx.lineTo(cx + 8, cy - 38);
    ctx.lineTo(cx + 16, cy - 46);
    ctx.lineTo(cx + 16, cy - 30);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, cy - 50, 0, cy - 30);
    g.addColorStop(0, '#fff2a6');
    g.addColorStop(1, '#e0a800');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d4252f';
    ctx.beginPath();
    ctx.arc(cx, cy - 36, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Space helmet bubble + antenna sits on top of everything
  if (doll === 'space_explorer') {
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(170,215,255,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,170,230,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 16, cy - 20, 14, Math.PI * 1.05, Math.PI * 1.45);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    roundRect(ctx, cx - 30, cy + 36, 60, 8, 4);
    ctx.fillStyle = '#c4cdd9';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------- composition

/**
 * Draws a full character into `ctx` at frame-space origin (0,0).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} loadout { baseDoll, outfit, headwear, tail, shoes }
 * @param {object} pose    one of POSES
 */
export function drawCharacter(ctx, loadout, pose = POSES.idle) {
  const dollDef = CATALOG[loadout.baseDoll] || CATALOG.labubu_classic;
  const pal = dollDef.palette;
  const bob = pose.bob || 0;
  const tuck = pose.tuck || 0;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.translate(0, DRAW_OFFSET_Y);

  if (pose.duck) {
    drawDuck(ctx, loadout, pal, pose);
    ctx.restore();
    return;
  }
  if (pose.crash) {
    ctx.translate(64, 100);
    ctx.rotate(0.45);
    ctx.translate(-64, -100);
  }

  // Back limbs
  drawFeatures(ctx, pal, 'back');
  const backLook = W.lookOf(loadout.back);
  if (backLook) W.drawBackItemBehind(ctx, backLook);
  drawTail(ctx, loadout, pal);
  drawLeg(ctx, 56, 134 - tuck, pose.legB, { ...pal, shade: shade(pal.shade, -20) }, loadout.shoes);
  const sleeve = sleeveFor(loadout.outfit);
  drawArm(ctx, 50, 106 + bob, -pose.arm * 0.6, { ...pal, fur: shade(pal.shade, -10) }, sleeve);

  // Torso
  ctx.save();
  ctx.translate(0, bob * 0.5);
  drawBody(ctx, loadout, pal);
  ctx.restore();

  drawLeg(ctx, 70, 134 - tuck, pose.legF, pal, loadout.shoes);

  // Head group (ears, head, face, headwear) bobs together
  ctx.save();
  ctx.translate(0, bob);
  // Ears are drawn before the head (and any hat) so they poke out from behind.
  const earSway = pose.ear || 0;
  drawEar(ctx, 52, 40, -0.32 - earSway, pal);
  drawEar(ctx, 80, 38, 0.18 - earSway * 0.8, pal);
  drawHead(ctx, loadout, pal, pose);
  drawFeatures(ctx, pal, 'head');
  drawHeadwear(ctx, loadout, pal);
  ctx.restore();

  drawArm(ctx, 76, 108 + bob, pose.arm, pal, sleeve);
  drawFeatures(ctx, pal, 'body');
  ctx.restore();
}

/**
 * Duck pose: body squashed into a crouch, head tucked down in front of it and
 * ears swept flat behind, so the doll is compact (about 60% of standing height)
 * without any odd lean.
 */
function drawDuck(ctx, loadout, pal, pose) {
  // Crouched body and bent legs
  ctx.save();
  ctx.translate(64, 156);
  ctx.scale(1.12, 0.72);
  ctx.translate(-64, -156);
  const duckBack = W.lookOf(loadout.back);
  if (duckBack) W.drawBackItemBehind(ctx, duckBack);
  drawTail(ctx, loadout, pal);
  drawLeg(ctx, 54, 134, pose.legB, { ...pal, shade: shade(pal.shade, -20) }, loadout.shoes);
  drawBody(ctx, loadout, pal);
  drawLeg(ctx, 74, 134, pose.legF, pal, loadout.shoes);
  ctx.restore();

  // Head tucked low and slightly forward; ears flattened backwards.
  ctx.save();
  ctx.translate(6, 48);
  drawEar(ctx, 50, 52, -1.38, pal);
  drawEar(ctx, 62, 46, -1.2, pal);
  drawHead(ctx, loadout, pal, pose);
  drawFeatures(ctx, pal, 'head');
  drawHeadwear(ctx, loadout, pal);
  ctx.restore();
}

/**
 * Returns a cleared canvas texture for `key`. An existing texture of the same
 * size is reused and redrawn in place, so sprites and animations that already
 * reference its frames stay valid after a re-bake (e.g. equipping a new hat).
 */
function freshCanvasTexture(scene, key, w, h) {
  if (scene.textures.exists(key)) {
    const existing = scene.textures.get(key);
    if (typeof existing.getContext === 'function' && existing.width === w && existing.height === h) {
      existing.getContext().clearRect(0, 0, w, h);
      return existing;
    }
    scene.textures.remove(key);
  }
  return scene.textures.createCanvas(key, w, h);
}

/**
 * Bakes the full runner sheet (SHEET_FRAMES) horizontally into one texture and
 * registers each pose as a named frame.
 */
export function bakeCharacterSheet(scene, key, loadout, res = 1) {
  const fw = Math.round(FRAME_W * res);
  const fh = Math.round(FRAME_H * res);
  const tex = freshCanvasTexture(scene, key, fw * SHEET_FRAMES.length, fh);
  const ctx = tex.getContext();
  SHEET_FRAMES.forEach((name, i) => {
    ctx.save();
    ctx.translate(i * fw, 0);
    ctx.scale(res, res);
    drawCharacter(ctx, loadout, POSES[name]);
    ctx.restore();
    if (!tex.has(name)) tex.add(name, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
  return tex;
}

/** Bakes a single pose (icons, reveal art, showroom preview). */
export function bakeCharacterFrame(scene, key, loadout, poseName = 'idle', res = 1) {
  const fw = Math.round(FRAME_W * res);
  const fh = Math.round(FRAME_H * res);
  const tex = freshCanvasTexture(scene, key, fw, fh);
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(res, res);
  drawCharacter(ctx, loadout, POSES[poseName] || POSES.idle);
  ctx.restore();
  tex.refresh();
  return tex;
}

/**
 * Loadout used to preview a catalog item: dolls are shown bare, accessories
 * are shown worn by `baseDoll` (classic by default).
 */
export function previewLoadoutFor(itemId, baseDoll = 'labubu_classic') {
  const item = CATALOG[itemId];
  const loadout = { baseDoll, outfit: null, headwear: null, tail: null, shoes: null, back: null };
  if (!item) return loadout;
  if (item.slot === 'doll') loadout.baseDoll = item.id;
  else loadout[item.slot] = item.id;
  return loadout;
}

/** Converts save.equipped into a renderer loadout. */
export function loadoutFromEquipped(equipped) {
  return {
    baseDoll: equipped.baseDoll || 'labubu_classic',
    outfit: equipped.outfit || null,
    headwear: equipped.headwear || null,
    tail: equipped.tail || null,
    shoes: equipped.shoes || null,
    back: equipped.back || null
  };
}

/**
 * (Re)bakes every texture that shows the player's current loadout:
 *   player_sheet   - runner frames (1x)
 *   player_preview - hi-res idle pose for menu / showroom
 *   player_wave    - hi-res waving pose
 */
export function bakePlayerTextures(scene, equipped) {
  const loadout = loadoutFromEquipped(equipped);
  bakeCharacterSheet(scene, 'player_sheet', loadout, RES); // crisp on high-DPI screens
  bakeBackSheet(scene, 'player_back', loadout, RES * 1.25); // 3D runner (drawn larger)
  bakeCharacterFrame(scene, 'player_preview', loadout, 'idle', 2);
  bakeCharacterFrame(scene, 'player_wave', loadout, 'wave', 2);
}

// ============================================================================
// Back view (3D lane runner): the camera follows Labubu from behind.
// ============================================================================

/** Back-view poses: per-leg lift (0..1), arm swing, bounce. */
export const BACK_POSES = {
  run0: { liftL: 1, liftR: 0, armL: 0.7, armR: -0.5, bob: -2 },
  run1: { liftL: 0.35, liftR: 0.1, armL: 0.2, armR: 0, bob: 0 },
  run2: { liftL: 0, liftR: 1, armL: -0.5, armR: 0.7, bob: -2 },
  run3: { liftL: 0.1, liftR: 0.35, armL: 0, armR: 0.2, bob: 0 },
  jump: { liftL: 1, liftR: 1, armL: 1.9, armR: 1.9, bob: -4, ears: 0.25 },
  fall: { liftL: 0.3, liftR: 0.5, armL: 1.2, armR: 1.2, bob: 0, ears: -0.15 },
  duck: { liftL: 0, liftR: 0, armL: 0.4, armR: 0.4, bob: 0, duck: true },
  idle: { liftL: 0, liftR: 0, armL: 0.1, armR: 0.1, bob: 0 }
};
export const BACK_FRAMES = Object.keys(BACK_POSES);

function backLeg(ctx, x, lift, pal, shoes) {
  const footY = 166 - lift * 16;
  roundRect(ctx, x - 7, 128, 14, footY - 128, 6);
  ctx.fillStyle = pal.shade;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  const shoeLook = W.lookOf(shoes);
  if (shoeLook) {
    W.drawShoeBack(ctx, shoeLook, x, footY, lift);
    return;
  }
  // The lifted foot shows its sole to the camera.
  const sole = shoes === 'canvas_sneakers' ? '#ffffff' : shade(pal.shade, -25);
  ellipse(ctx, x, footY + 2, 9, lift > 0.5 ? 7 : 5);
  ctx.fillStyle = shoes === 'canvas_sneakers' ? '#4b7bd6' : pal.fur;
  ctx.fill();
  ctx.stroke();
  if (lift > 0.5) {
    ellipse(ctx, x, footY + 3, 6, 4);
    ctx.fillStyle = sole;
    ctx.fill();
    if (shoes === 'canvas_sneakers') {
      ctx.strokeStyle = '#e94b4b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 5, footY + 3);
      ctx.lineTo(x + 5, footY + 3);
      ctx.stroke();
    }
  }
}

function backArm(ctx, x, swing, pal, sleeve, side) {
  ctx.save();
  ctx.translate(x, 108);
  ctx.rotate(side * (0.25 + swing * 0.6));
  roundRect(ctx, -5, -2, 10, 22, 5);
  ctx.fillStyle = sleeve || pal.fur;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ellipse(ctx, 0, 21, 5.5, 5);
  ctx.fillStyle = pal.fur;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function backTorso(ctx, loadout, pal) {
  const doll = loadout.baseDoll;
  const outfit = loadout.outfit;
  ellipse(ctx, 64, 120, 24, 21);
  const g = ctx.createLinearGradient(0, 100, 0, 142);
  g.addColorStop(0, pal.fur);
  g.addColorStop(1, pal.shade);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  ctx.save();
  ellipse(ctx, 64, 120, 23, 20);
  ctx.clip();
  const outfitLook = W.lookOf(outfit);
  if (outfitLook) {
    W.drawOutfit(ctx, outfitLook, false);
  } else if (outfit === 'lumberjack_vest' || (doll === 'beaver_labubu_secret' && !outfit)) {
    plaid(ctx, 38, 98, 52, 46, outfit ? '#c7362f' : '#b8312c', '#1f1a24', '#f2d16b');
  } else if (outfit === 'raincoat') {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(38, 98, 52, 46);
    ctx.fillStyle = '#e8b400';
    ctx.fillRect(38, 136, 52, 8);
  } else if (doll === 'space_explorer') {
    ctx.fillStyle = '#f7f9fc';
    ctx.fillRect(38, 98, 52, 46);
  }
  ctx.restore();

  // Back details over the torso
  if (outfitLook) {
    ellipse(ctx, 64, 120, 24, 21);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    W.drawOutfitExtras(ctx, outfitLook, false);
  }
  const backLook = W.lookOf(loadout.back);
  if (backLook) W.drawBackItemBack(ctx, backLook);
  if (outfit === 'raincoat') {
    // Hood folded at the neck
    ellipse(ctx, 64, 101, 16, 7);
    ctx.fillStyle = '#f2c200';
    ctx.fill();
    ctx.stroke();
  }
  if (doll === 'space_explorer' && !outfit) {
    // Little jet-pack
    roundRect(ctx, 50, 104, 28, 30, 6);
    ctx.fillStyle = '#c4cdd9';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4f7cff';
    ctx.fillRect(55, 110, 18, 4);
    ctx.fillStyle = '#ff5a6e';
    ctx.fillRect(55, 118, 18, 4);
  }
  if (doll === 'zimomo_king' && !outfit) {
    // Royal cape flowing down the back
    ctx.beginPath();
    ctx.moveTo(44, 100);
    ctx.lineTo(84, 100);
    ctx.quadraticCurveTo(94, 128, 90, 150);
    ctx.lineTo(38, 150);
    ctx.quadraticCurveTo(34, 128, 44, 100);
    ctx.closePath();
    ctx.fillStyle = '#c4202a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(44, 100, 40, 5);
  }
}

function backTail(ctx, loadout, pal) {
  const doll = loadout.baseDoll;
  const tailLook = W.lookOf(loadout.tail);
  if (tailLook) {
    W.drawTailBack(ctx, tailLook);
    return;
  }
  if (loadout.tail === 'beaver_paddle_tail' || doll === 'beaver_labubu_secret') {
    ctx.save();
    ellipse(ctx, 64, 150, 14, 22);
    ctx.fillStyle = '#6b4226';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ellipse(ctx, 64, 150, 14, 22);
    ctx.clip();
    ctx.strokeStyle = 'rgba(30,15,5,0.55)';
    ctx.lineWidth = 1.2;
    for (let i = 120; i < 180; i += 6) {
      ctx.beginPath();
      ctx.moveTo(48, i);
      ctx.lineTo(80, i + 14);
      ctx.moveTo(80, i);
      ctx.lineTo(48, i + 14);
      ctx.stroke();
    }
    ctx.restore();
  } else if (doll === 'zimomo_king') {
    ctx.strokeStyle = pal.shade;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(64, 136);
    ctx.bezierCurveTo(64, 160, 96, 160, 100, 132);
    ctx.stroke();
    furCircle(ctx, 101, 128, 8, 8, 2);
    ctx.fillStyle = pal.fur;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

function backHeadwear(ctx, loadout) {
  const doll = loadout.baseDoll;
  const hw = loadout.headwear;
  const cx = 64;
  const cy = 66;
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  const hwLook = W.lookOf(hw);
  if (hwLook) {
    W.drawHeadwear(ctx, hwLook, cx, cy, false);
  } else if (hw === 'beanie') {
    ctx.beginPath();
    ctx.moveTo(cx - 33, cy - 6);
    ctx.bezierCurveTo(cx - 30, cy - 44, cx + 30, cy - 44, cx + 33, cy - 6);
    ctx.closePath();
    ctx.fillStyle = '#5bb381';
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, cx - 35, cy - 12, 70, 12, 6);
    ctx.fillStyle = '#3f8f63';
    ctx.fill();
    ctx.stroke();
  } else if (hw === 'beaver_cap') {
    ctx.beginPath();
    ctx.moveTo(cx - 32, cy - 8);
    ctx.bezierCurveTo(cx - 28, cy - 46, cx + 28, cy - 46, cx + 32, cy - 8);
    ctx.closePath();
    ctx.fillStyle = '#7a4a2a';
    ctx.fill();
    ctx.stroke();
    for (const ex of [cx - 20, cx + 20]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 36, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#7a4a2a';
      ctx.fill();
      ctx.stroke();
    }
  } else if (doll === 'zimomo_king') {
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy - 30);
    ctx.lineTo(cx - 16, cy - 46);
    ctx.lineTo(cx - 8, cy - 38);
    ctx.lineTo(cx, cy - 50);
    ctx.lineTo(cx + 8, cy - 38);
    ctx.lineTo(cx + 16, cy - 46);
    ctx.lineTo(cx + 16, cy - 30);
    ctx.closePath();
    ctx.fillStyle = '#ffc93c';
    ctx.fill();
    ctx.stroke();
  }
  if (doll === 'space_explorer') {
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(170,215,255,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,170,230,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 20, cy - 38);
    ctx.lineTo(cx + 28, cy - 54);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 28, cy - 56, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5a6e';
    ctx.fill();
  }
}

/** Draws Labubu seen from behind (for the 3D runner). */
export function drawCharacterBack(ctx, loadout, pose = BACK_POSES.idle) {
  const dollDef = CATALOG[loadout.baseDoll] || CATALOG.labubu_classic;
  const pal = dollDef.palette;
  const sleeve = sleeveFor(loadout.outfit);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.translate(0, DRAW_OFFSET_Y);

  if (pose.duck) {
    // Tucked roll: squashed body with the fluffy head pulled down over it.
    ctx.save();
    ctx.translate(64, 156);
    ctx.scale(1.15, 0.65);
    ctx.translate(-64, -156);
    backLeg(ctx, 52, 0, pal, loadout.shoes);
    backLeg(ctx, 76, 0, pal, loadout.shoes);
    backTorso(ctx, loadout, pal);
    ctx.restore();
    ctx.save();
    ctx.translate(0, 54);
    drawEar(ctx, 46, 52, -1.25, pal, false);
    drawEar(ctx, 82, 52, 1.25, pal, false);
    drawFurBall(ctx, 64, 66, pal);
    drawFeatures(ctx, pal, 'head', false);
    backHeadwear(ctx, loadout);
    ctx.restore();
    backTail(ctx, loadout, pal);
    ctx.restore();
    return;
  }

  const bob = pose.bob || 0;
  backLeg(ctx, 52, pose.liftL, pal, loadout.shoes);
  drawFeatures(ctx, pal, 'back', false);
  backLeg(ctx, 76, pose.liftR, pal, loadout.shoes);
  backArm(ctx, 40, pose.armL, pal, sleeve, 1);
  backArm(ctx, 88, pose.armR, pal, sleeve, -1);
  ctx.save();
  ctx.translate(0, bob * 0.5);
  backTorso(ctx, loadout, pal);
  ctx.restore();

  ctx.save();
  ctx.translate(0, bob);
  const ears = pose.ears || 0;
  drawEar(ctx, 50, 40, -0.28 - ears, pal, false);
  drawEar(ctx, 78, 40, 0.28 + ears, pal, false);
  drawFurBall(ctx, 64, 66, pal);
  // A little cowlick swirl on the back of the head
  ctx.strokeStyle = shade(pal.shade, -15);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(64, 72, 7, Math.PI * 0.2, Math.PI * 1.7);
  ctx.stroke();
  drawFeatures(ctx, pal, 'head', false);
  backHeadwear(ctx, loadout);
  ctx.restore();
  backTail(ctx, loadout, pal);
  drawFeatures(ctx, pal, 'body', false);
  ctx.restore();
}

/** Bakes the back-view runner sheet (BACK_FRAMES) into one texture. */
export function bakeBackSheet(scene, key, loadout, res = 1) {
  const fw = Math.round(FRAME_W * res);
  const fh = Math.round(FRAME_H * res);
  const tex = freshCanvasTexture(scene, key, fw * BACK_FRAMES.length, fh);
  const ctx = tex.getContext();
  BACK_FRAMES.forEach((name, i) => {
    ctx.save();
    ctx.translate(i * fw, 0);
    ctx.scale(res, res);
    drawCharacterBack(ctx, loadout, BACK_POSES[name]);
    ctx.restore();
    if (!tex.has(name)) tex.add(name, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
  return tex;
}
