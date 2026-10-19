/**
 * Wardrobe.js
 * Data-driven clothing renderer. Catalog items carry a `look` such as
 *   { kind: 'hoodie', color: '#ff8fc8', trim: '#ffffff' }
 * and these functions draw any kind in any colours, from the FRONT (menus,
 * cards) and from BEHIND (the runner camera). Coordinates are the
 * CharacterRenderer frame space (128 x 176): torso centred at (64, 120),
 * head at (66, 66) front / (64, 66) back.
 */
import { CATALOG } from '../config/GachaDropTable.js';

const OUTLINE = '#2b1a24';

export const lookOf = (id) => (id && CATALOG[id]?.look) || null;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
}

function ink(ctx, w = 2.4) {
  ctx.lineWidth = w;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function star(ctx, x, y, r1, r2, n = 5) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i * Math.PI) / n - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

const RAINBOW = ['#ff5a6e', '#ff9f43', '#ffd23f', '#6ee7a8', '#59b8ff', '#b07cff'];

// ---------------------------------------------------------------------------- outfits

/** Sleeve colour for an outfit look (null = bare fur arms). */
export function sleeveOf(look) {
  if (!look) return null;
  if (look.sleeve) return look.sleeve;
  if (['dress', 'tutu'].includes(look.kind)) return null;
  if (look.kind === 'overalls') return look.shirt;
  return look.color;
}

/**
 * Paints an outfit on the torso. Call inside the torso clip; `extras` then
 * draws anything that hangs outside the torso (skirts).
 */
export function drawOutfit(ctx, look, front = true) {
  const c = look.color;
  const x0 = 36;
  const y0 = 96;
  const W = 56;
  const H = 50;
  ctx.fillStyle = c;
  ctx.fillRect(x0, y0, W, H);
  // soft shading
  const g = ctx.createLinearGradient(0, y0, 0, y0 + H);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, W, H);

  switch (look.kind) {
    case 'tee':
      if (front && look.print === 'rainbow') {
        RAINBOW.forEach((col, i) => {
          ctx.beginPath();
          ctx.arc(64, 132, 14 - i * 2, Math.PI, 0);
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
      collar(ctx, look.trim || shade(c, -40));
      break;
    case 'hoodie':
      if (front) {
        rr(ctx, 50, 124, 28, 12, 5);
        ctx.fillStyle = shade(c, -22);
        ctx.fill();
        ctx.strokeStyle = look.trim || '#ffffff';
        ctx.lineWidth = 1.6;
        for (const sx of [60, 68]) {
          ctx.beginPath();
          ctx.moveTo(sx, 100);
          ctx.lineTo(sx, 113);
          ctx.stroke();
        }
      } else {
        ell(ctx, 64, 104, 17, 9);
        ctx.fillStyle = shade(c, -25);
        ctx.fill();
        ink(ctx, 1.6);
      }
      break;
    case 'stripes':
      ctx.fillStyle = look.alt;
      for (let y = y0 + 4; y < y0 + H; y += 10) ctx.fillRect(x0, y, W, 5);
      if (look.print === 'snow') {
        ctx.fillStyle = '#ffffff';
        for (const [x, y] of [[50, 112], [64, 126], [78, 112]]) {
          star(ctx, x, y, 3.2, 1.2, 6);
          ctx.fill();
        }
      }
      collar(ctx, shade(c, -30));
      break;
    case 'overalls':
      ctx.fillStyle = look.shirt;
      ctx.fillRect(x0, y0, W, 14);
      ctx.fillStyle = c;
      if (front) {
        rr(ctx, 50, 106, 28, 40, 4);
        ctx.fill();
        ctx.fillRect(x0, 128, W, 20);
        ctx.strokeStyle = shade(c, -40);
        ctx.lineWidth = 3;
        for (const sx of [52, 76]) {
          ctx.beginPath();
          ctx.moveTo(sx, 96);
          ctx.lineTo(sx, 110);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffd23f';
        for (const sx of [53, 75]) {
          ctx.beginPath();
          ctx.arc(sx, 110, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        rr(ctx, 57, 114, 14, 9, 2);
        ctx.strokeStyle = shade(c, -30);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.fillRect(x0, 124, W, 24);
        ctx.strokeStyle = shade(c, -40);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(48, 98);
        ctx.lineTo(78, 126);
        ctx.moveTo(80, 98);
        ctx.lineTo(50, 126);
        ctx.stroke();
      }
      break;
    case 'dress':
    case 'tutu':
      if (look.dots) {
        ctx.fillStyle = look.dots;
        for (let y = y0 + 6; y < y0 + H; y += 10) {
          for (let x = x0 + ((y / 10) % 2) * 5; x < x0 + W; x += 10) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.fillStyle = shade(c, -30);
      ctx.fillRect(x0, 124, W, 4); // waistband
      break;
    case 'jacket':
      // open front shows the shirt
      if (front) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(59, y0, 10, H);
        ctx.fillStyle = look.trim;
        ctx.fillRect(x0, 138, W, 5);
        ctx.font = '700 11px Trebuchet MS, sans-serif';
        ctx.fillStyle = look.trim;
        ctx.fillText('L', 47, 118);
      } else {
        ctx.fillStyle = look.trim;
        ctx.fillRect(x0, 138, W, 5);
        star(ctx, 64, 118, 9, 4);
        ctx.fill();
      }
      ctx.fillStyle = look.trim;
      ctx.fillRect(x0, y0, W, 4);
      break;
    case 'jersey': {
      ctx.fillStyle = look.trim;
      ctx.fillRect(x0, 108, 6, 30);
      ctx.fillRect(x0 + W - 6, 108, 6, 30);
      ctx.font = `700 ${front ? 13 : 20}px Trebuchet MS, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = look.trim;
      ctx.fillText(look.number || '10', front ? 72 : 64, front ? 116 : 122);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      if (front) collarV(ctx, look.trim);
      break;
    }
    case 'suit':
      if (front) {
        ctx.beginPath();
        ctx.moveTo(56, y0);
        ctx.lineTo(64, 126);
        ctx.lineTo(72, y0);
        ctx.closePath();
        ctx.fillStyle = look.shirt;
        ctx.fill();
        ctx.fillStyle = OUTLINE;
        for (const y of [112, 119]) {
          ctx.beginPath();
          ctx.arc(64, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = shade(c, 40);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(64, 112);
        ctx.lineTo(64, 146);
        ctx.stroke();
      }
      break;
    case 'kimono':
      if (look.print === 'flowers') {
        ctx.fillStyle = '#ffffff';
        for (const [x, y] of [[46, 108], [80, 112], [52, 136], [78, 138]]) {
          star(ctx, x, y, 3.4, 1.6, 5);
          ctx.fill();
        }
      }
      ctx.fillStyle = look.trim;
      ctx.fillRect(x0, 122, W, 9); // obi belt
      if (front) {
        ctx.strokeStyle = look.trim;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(54, y0);
        ctx.lineTo(70, 122);
        ctx.moveTo(74, y0);
        ctx.lineTo(62, 112);
        ctx.stroke();
      }
      break;
    case 'armor': {
      const m = ctx.createLinearGradient(40, 0, 88, 0);
      m.addColorStop(0, '#ffffff');
      m.addColorStop(0.4, c);
      m.addColorStop(1, shade(c, -60));
      ctx.fillStyle = m;
      ctx.fillRect(x0, y0, W, H);
      ctx.strokeStyle = shade(c, -70);
      ctx.lineWidth = 1.4;
      for (const y of [112, 126]) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + W, y);
        ctx.stroke();
      }
      ctx.fillStyle = look.trim;
      for (const x of [46, 64, 82]) {
        ctx.beginPath();
        ctx.arc(x, 105, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (front) {
        ctx.beginPath();
        ctx.moveTo(64, 106);
        ctx.lineTo(70, 116);
        ctx.lineTo(64, 128);
        ctx.lineTo(58, 116);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'hero':
      ctx.fillStyle = look.trim;
      ctx.fillRect(x0, 130, W, 5); // belt
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(61, 129, 6, 7);
      if (front) {
        ctx.beginPath();
        ctx.moveTo(64, 104);
        ctx.lineTo(76, 113);
        ctx.lineTo(64, 126);
        ctx.lineTo(52, 113);
        ctx.closePath();
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        ink(ctx, 1.6);
        ctx.font = '700 12px Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = look.trim;
        ctx.fillText(look.emblem || 'L', 64, 115);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      break;
    default:
      break;
  }
  if (look.sparkle) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y] of [[48, 104], [80, 120], [58, 136], [72, 108]]) {
      star(ctx, x, y, 3, 1, 4);
      ctx.fill();
    }
  }
}

function collar(ctx, color) {
  ctx.beginPath();
  ctx.arc(64, 98, 9, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function collarV(ctx, color) {
  ctx.beginPath();
  ctx.moveTo(56, 98);
  ctx.lineTo(64, 108);
  ctx.lineTo(72, 98);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Things that hang below the torso (skirts). Draw after the torso. */
export function drawOutfitExtras(ctx, look, front = true) {
  if (look.kind === 'dress') {
    ctx.beginPath();
    ctx.moveTo(46, 128);
    ctx.lineTo(82, 128);
    ctx.quadraticCurveTo(94, 146, 96, 152);
    ctx.quadraticCurveTo(64, 160, 32, 152);
    ctx.quadraticCurveTo(34, 146, 46, 128);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 128, 0, 158);
    g.addColorStop(0, look.color);
    g.addColorStop(1, shade(look.color, -30));
    ctx.fillStyle = g;
    ctx.fill();
    ink(ctx);
    if (look.dots) {
      ctx.fillStyle = look.dots;
      for (const [x, y] of [[44, 146], [56, 140], [70, 144], [84, 148], [62, 152]]) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (look.sparkle) {
      ctx.fillStyle = '#ffffff';
      for (const [x, y] of [[40, 150], [64, 146], [86, 150]]) {
        star(ctx, x, y, 3.5, 1.2, 4);
        ctx.fill();
      }
    }
  } else if (look.kind === 'tutu') {
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath();
      const y = 132 + layer * 5;
      const w = 34 - layer * 3;
      for (let i = 0; i <= 10; i++) {
        const x = 64 - w + (i / 10) * w * 2;
        ctx.lineTo(x, y + (i % 2 ? 8 : 0));
      }
      ctx.lineTo(64 + w, y - 6);
      ctx.lineTo(64 - w, y - 6);
      ctx.closePath();
      ctx.fillStyle = layer ? look.color : look.alt;
      ctx.fill();
      ink(ctx, 1.8);
    }
  } else if (look.kind === 'kimono' && !front) {
    // big obi bow on the back
    ctx.fillStyle = look.trim;
    for (const s of [-1, 1]) {
      ell(ctx, 64 + s * 9, 126, 9, 6, s * 0.3);
      ctx.fill();
      ink(ctx, 1.6);
    }
    ell(ctx, 64, 126, 4, 5);
    ctx.fill();
    ink(ctx, 1.6);
  }
}

// ---------------------------------------------------------------------------- headwear

/** Hats and head accessories. `cx, cy` = head centre. */
export function drawHeadwear(ctx, look, cx, cy, front = true) {
  const c = look.color || '#ffffff';
  ctx.lineJoin = 'round';
  switch (look.kind) {
    case 'cap':
      dome(ctx, cx, cy, c, 31);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy - 38, 3, 0, Math.PI * 2);
      ctx.fill();
      if (front) {
        ell(ctx, cx + 10, cy - 10, 26, 6, -0.08);
        ctx.fillStyle = shade(c, -30);
        ctx.fill();
        ink(ctx);
      } else {
        rr(ctx, cx - 8, cy - 14, 16, 7, 3);
        ctx.fillStyle = '#f5e6d0';
        ctx.fill();
        ink(ctx, 1.4);
      }
      break;
    case 'bow': {
      const bx = front ? cx + 16 : cx;
      const by = cy - 32;
      ctx.fillStyle = c;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + s * 20, by - 18, bx + s * 22, by);
        ctx.quadraticCurveTo(bx + s * 20, by + 16, bx, by);
        ctx.fill();
        ink(ctx);
      }
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fillStyle = shade(c, -30);
      ctx.fill();
      ink(ctx);
      break;
    }
    case 'party':
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 26);
      ctx.lineTo(cx + 3, cy - 74);
      ctx.lineTo(cx + 17, cy - 26);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = look.alt;
      ctx.lineWidth = 5;
      for (let y = cy - 70; y < cy - 20; y += 12) {
        ctx.beginPath();
        ctx.moveTo(cx - 20, y + 8);
        ctx.lineTo(cx + 20, y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 26);
      ctx.lineTo(cx + 3, cy - 74);
      ctx.lineTo(cx + 17, cy - 26);
      ctx.closePath();
      ink(ctx);
      ctx.beginPath();
      ctx.arc(cx + 3, cy - 75, 5, 0, Math.PI * 2);
      ctx.fillStyle = look.alt;
      ctx.fill();
      ink(ctx, 1.8);
      break;
    case 'flowers':
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.12 + (i / 6) * 0.76);
        const fx = cx + Math.cos(a) * 30;
        const fy = cy + Math.sin(a) * 30;
        ctx.fillStyle = i % 2 ? c : '#ffffff';
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2;
          ell(ctx, fx + Math.cos(pa) * 3.6, fy + Math.sin(pa) * 3.6, 3, 3);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
      }
      break;
    case 'headphones':
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 37, Math.PI * 1.08, Math.PI * 1.92);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 5;
      ctx.stroke();
      for (const s of [-1, 1]) {
        rr(ctx, cx + s * 36 - 7, cy - 12, 14, 22, 6);
        ctx.fillStyle = c;
        ctx.fill();
        ink(ctx);
        rr(ctx, cx + s * 36 - 3, cy - 7, 6, 12, 3);
        ctx.fillStyle = shade(c, 50);
        ctx.fill();
      }
      break;
    case 'chef':
      rr(ctx, cx - 22, cy - 36, 44, 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ink(ctx);
      for (const [dx, dy, r] of [[-14, -44, 11], [0, -52, 13], [14, -44, 11]]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ink(ctx);
      }
      rr(ctx, cx - 21, cy - 37, 42, 8, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      break;
    case 'cowboy':
      ell(ctx, cx, cy - 26, 46, 9);
      ctx.fillStyle = shade(c, -15);
      ctx.fill();
      ink(ctx);
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 28);
      ctx.quadraticCurveTo(cx - 24, cy - 56, cx - 8, cy - 54);
      ctx.quadraticCurveTo(cx, cy - 48, cx + 8, cy - 54);
      ctx.quadraticCurveTo(cx + 24, cy - 56, cx + 22, cy - 28);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(cx - 21, cy - 35, 42, 5);
      break;
    case 'shades':
      if (front) {
        ctx.fillStyle = 'rgba(30,20,40,0.9)';
        for (const ex of [cx - 6, cx + 16]) {
          rr(ctx, ex - 9, cy - 5, 18, 13, 5);
          ctx.fill();
          ctx.strokeStyle = c;
          ctx.lineWidth = 2.6;
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(ex - 6, cy - 3, 4, 3);
          ctx.fillStyle = 'rgba(30,20,40,0.9)';
        }
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy);
        ctx.lineTo(cx + 7, cy);
        ctx.stroke();
      } else {
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy + 6, 32, Math.PI * 0.05, Math.PI * 0.95);
        ctx.stroke();
      }
      break;
    case 'tophat':
      ell(ctx, cx, cy - 28, 30, 7);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      rr(ctx, cx - 19, cy - 72, 38, 44, 4);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = look.trim;
      ctx.fillRect(cx - 18, cy - 40, 36, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(cx - 14, cy - 70, 6, 28);
      break;
    case 'witch':
      ell(ctx, cx, cy - 26, 44, 9);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - 28);
      ctx.lineTo(cx + 2, cy - 72);
      ctx.quadraticCurveTo(cx + 20, cy - 80, cx + 30, cy - 66);
      ctx.quadraticCurveTo(cx + 14, cy - 66, cx + 20, cy - 28);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = look.trim;
      ctx.fillRect(cx - 19, cy - 37, 39, 6);
      ctx.fillStyle = '#ffe066';
      star(ctx, cx - 4, cy - 52, 5, 2);
      ctx.fill();
      break;
    case 'propeller': {
      dome(ctx, cx, cy, c, 31);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - 31, cy - 8);
      ctx.bezierCurveTo(cx - 28, cy - 46, cx + 28, cy - 46, cx + 31, cy - 8);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = look.alt;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 40);
      ctx.lineTo(cx - 16, cy);
      ctx.lineTo(cx, cy);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 40);
      ctx.lineTo(cx + 30, cy - 6);
      ctx.lineTo(cx + 30, cy);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(cx - 1.5, cy - 48, 3, 10);
      ctx.fillStyle = '#59b8ff';
      ell(ctx, cx - 11, cy - 49, 11, 3.5, -0.1);
      ctx.fill();
      ink(ctx, 1.6);
      ctx.fillStyle = '#ff5a6e';
      ell(ctx, cx + 11, cy - 49, 11, 3.5, 0.1);
      ctx.fill();
      ink(ctx, 1.6);
      break;
    }
    case 'crown': {
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 26);
      const pts = [[-24, -50], [-12, -38], [0, -58], [12, -38], [24, -50], [24, -26]];
      for (const [dx, dy] of pts) ctx.lineTo(cx + dx, cy + dy);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, cy - 58, 0, cy - 26);
      g.addColorStop(0, '#fff6c2');
      g.addColorStop(1, c);
      ctx.fillStyle = g;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = look.gem || '#e8324b';
      ctx.beginPath();
      ctx.arc(cx, cy - 34, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#59b8ff';
      for (const dx of [-14, 14]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy - 32, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'halo': {
      ell(ctx, cx, cy - 48, 22, 6);
      ctx.strokeStyle = 'rgba(255,224,102,0.45)';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = '#fff6c2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    default:
      break;
  }
}

/** Rounded cap dome over the top of the head (ears poke out through holes). */
function dome(ctx, cx, cy, color, r) {
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - 8);
  ctx.bezierCurveTo(cx - r + 3, cy - 46, cx + r - 3, cy - 46, cx + r, cy - 8);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, cy - 40, 0, cy - 8);
  g.addColorStop(0, shade(color, 30));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fill();
  ink(ctx);
}

// ---------------------------------------------------------------------------- shoes

/** Shoe on a front-view leg (leg-local coords: the foot sits at y 15..25). */
export function drawShoeFront(ctx, look) {
  const c = look.color;
  switch (look.kind) {
    case 'boots':
      rr(ctx, -8, 4, 19, 21, 5);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = shade(c, -40);
      ctx.fillRect(-8, 22, 19, 3);
      if (look.trim) {
        ctx.fillStyle = look.trim;
        ctx.fillRect(-8, 6, 19, 3);
      }
      break;
    case 'slippers':
      ell(ctx, 2, 20, 11, 7);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      for (const dx of [-3, 5]) {
        ell(ctx, dx, 11, 2.6, 6, dx < 0 ? -0.3 : 0.3);
        ctx.fillStyle = c;
        ctx.fill();
        ink(ctx, 1.4);
        ell(ctx, dx, 11, 1.2, 4, dx < 0 ? -0.3 : 0.3);
        ctx.fillStyle = look.alt;
        ctx.fill();
      }
      break;
    case 'skates':
      rr(ctx, -8, 12, 20, 12, 4);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      for (const dx of [-3, 7]) {
        ctx.beginPath();
        ctx.arc(dx, 27, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = look.alt;
        ctx.fill();
        ink(ctx, 1.4);
      }
      break;
    case 'rocket':
      rr(ctx, -8, 10, 20, 15, 5);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = look.alt;
      ctx.beginPath();
      ctx.moveTo(-4, 25);
      ctx.lineTo(2, 34);
      ctx.lineTo(8, 25);
      ctx.fill();
      break;
    case 'glass':
      ell(ctx, 2, 20, 10, 6);
      ctx.fillStyle = 'rgba(190,235,255,0.75)';
      ctx.fill();
      ctx.strokeStyle = '#59b8ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      star(ctx, 6, 17, 3, 1, 4);
      ctx.fill();
      break;
    default: // sneakers
      rr(ctx, -8, 15, 20, 10, 4);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, 22, 20, 3);
      ctx.fillStyle = look.trim || '#ffffff';
      ctx.fillRect(-2, 16, 6, 1.6);
      break;
  }
}

/** Shoe on a back-view leg. Returns true when it drew the foot. */
export function drawShoeBack(ctx, look, x, footY, lift) {
  const c = look.color;
  if (look.kind === 'boots') {
    rr(ctx, x - 8, footY - 18, 16, 20, 5);
    ctx.fillStyle = c;
    ctx.fill();
    ink(ctx);
    if (look.trim) {
      ctx.fillStyle = look.trim;
      ctx.fillRect(x - 8, footY - 16, 16, 3);
    }
  }
  ell(ctx, x, footY + 2, 9.5, lift > 0.5 ? 7 : 5.5);
  ctx.fillStyle = look.kind === 'glass' ? 'rgba(190,235,255,0.8)' : c;
  ctx.fill();
  ink(ctx);
  if (look.kind === 'skates') {
    for (const dx of [-4, 4]) {
      ctx.beginPath();
      ctx.arc(x + dx, footY + 8, 3, 0, Math.PI * 2);
      ctx.fillStyle = look.alt;
      ctx.fill();
      ink(ctx, 1.2);
    }
  } else if (look.kind === 'rocket') {
    const g = ctx.createLinearGradient(0, footY + 4, 0, footY + 18);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(1, 'rgba(255,122,26,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 5, footY + 5);
    ctx.lineTo(x, footY + 20);
    ctx.lineTo(x + 5, footY + 5);
    ctx.fill();
  } else if (look.kind === 'slippers') {
    ctx.fillStyle = look.alt;
    ell(ctx, x, footY + 2, 4, 3);
    ctx.fill();
  }
  if (lift > 0.5 && look.kind !== 'glass') {
    ell(ctx, x, footY + 3, 6, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  return true;
}

// ---------------------------------------------------------------------------- tails

/** Tail shape drawn along +x from the origin (callers rotate it into place). */
export function drawTailShape(ctx, look) {
  const c = look.color || '#ffffff';
  switch (look.kind) {
    case 'puff':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(6 + Math.cos(a) * 6, Math.sin(a) * 6, 5, 0, Math.PI * 2);
        ctx.fillStyle = OUTLINE;
        ctx.fill();
      }
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(6 + Math.cos(a) * 6, Math.sin(a) * 6, 3.8, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(6, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cat':
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(14, -4, 22, 10, 30, -6);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 5;
      ctx.stroke();
      break;
    case 'devil':
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(12, 8, 20, -8, 28, 0);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(26, -6);
      ctx.lineTo(38, 0);
      ctx.lineTo(26, 6);
      ctx.lineTo(29, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx, 2);
      break;
    case 'dino':
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(20, -6, 34, 0);
      ctx.quadraticCurveTo(20, 6, 0, 8);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = look.spikes;
      for (const x of [6, 14, 22]) {
        ctx.beginPath();
        ctx.moveTo(x - 3, -6.5 + x * 0.12);
        ctx.lineTo(x + 1, -13 + x * 0.2);
        ctx.lineTo(x + 4, -5.5 + x * 0.12);
        ctx.closePath();
        ctx.fill();
        ink(ctx, 1.6);
      }
      break;
    case 'mermaid':
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(14, -4, 22, 0);
      ctx.quadraticCurveTo(14, 4, 0, 6);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.quadraticCurveTo(30, -16, 38, -12);
      ctx.quadraticCurveTo(32, 0, 38, 12);
      ctx.quadraticCurveTo(30, 16, 20, 0);
      ctx.closePath();
      ctx.fillStyle = look.alt;
      ctx.fill();
      ink(ctx);
      break;
    default: {
      // fox (bushy) - optionally rainbow
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.bezierCurveTo(14, -16, 34, -14, 40, 0);
      ctx.bezierCurveTo(34, 12, 14, 14, 0, 5);
      ctx.closePath();
      if (look.rainbow) {
        const g = ctx.createLinearGradient(0, 0, 40, 0);
        RAINBOW.forEach((col, i) => g.addColorStop(i / (RAINBOW.length - 1), col));
        ctx.fillStyle = g;
      } else ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      if (look.tip) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = look.tip;
        ctx.beginPath();
        ctx.arc(42, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
  }
}

/** Front view: the tail peeks out behind the left hip. */
export function drawTailFront(ctx, look) {
  ctx.save();
  ctx.translate(44, 130);
  ctx.rotate(Math.PI + 0.5);
  drawTailShape(ctx, look);
  ctx.restore();
}

/** Back view: the tail sticks out of the runner's back. */
export function drawTailBack(ctx, look) {
  ctx.save();
  ctx.translate(66, 140);
  ctx.rotate(1.05);
  ctx.scale(1.35, 1.35);
  drawTailShape(ctx, look);
  ctx.restore();
}

// ---------------------------------------------------------------------------- back items (wings, capes, packs)

/** One wing shape pointing to +x from the shoulder. */
function wing(ctx, look) {
  const c = look.color;
  switch (look.kind) {
    case 'butterfly':
      ell(ctx, 18, -12, 18, 14, -0.4);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      ell(ctx, 14, 12, 12, 9, 0.5);
      ctx.fillStyle = look.alt;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(22, -14, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'fairy':
      ell(ctx, 16, -14, 18, 9, -0.6);
      ctx.fillStyle = 'rgba(200,245,255,0.75)';
      ctx.fill();
      ctx.strokeStyle = '#59b8ff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ell(ctx, 13, 6, 12, 6, 0.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      star(ctx, 20, -16, 3, 1, 4);
      ctx.fill();
      break;
    case 'bat':
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(18, -26, 34, -18);
      ctx.lineTo(28, -8);
      ctx.lineTo(32, 2);
      ctx.lineTo(22, -2);
      ctx.lineTo(18, 8);
      ctx.lineTo(10, 2);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      break;
    default: {
      // angel: layered feathers
      for (let i = 0; i < 4; i++) {
        ell(ctx, 10 + i * 6, -14 + i * 7, 14 - i, 6, -0.5 + i * 0.25);
        ctx.fillStyle = i % 2 ? '#f2f6ff' : c;
        ctx.fill();
        ink(ctx, 1.8);
      }
      break;
    }
  }
}

const WING_KINDS = ['angel', 'butterfly', 'fairy', 'bat'];

/** Front view, drawn BEHIND the body: wings poke out at the sides, capes hang behind. */
export function drawBackItemBehind(ctx, look) {
  if (WING_KINDS.includes(look.kind)) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(64 + s * 18, 110);
      ctx.scale(s, 1);
      wing(ctx, look);
      ctx.restore();
    }
  } else if (look.kind === 'cape') {
    ctx.beginPath();
    ctx.moveTo(46, 100);
    ctx.quadraticCurveTo(30, 130, 34, 152);
    ctx.lineTo(94, 152);
    ctx.quadraticCurveTo(98, 130, 82, 100);
    ctx.closePath();
    ctx.fillStyle = shade(look.color, -25);
    ctx.fill();
    ink(ctx);
  } else if (look.kind === 'jetpack') {
    for (const x of [40, 88]) {
      rr(ctx, x - 7, 100, 14, 26, 6);
      ctx.fillStyle = look.color;
      ctx.fill();
      ink(ctx);
      ctx.fillStyle = look.alt;
      ctx.beginPath();
      ctx.moveTo(x - 5, 126);
      ctx.lineTo(x, 138);
      ctx.lineTo(x + 5, 126);
      ctx.fill();
    }
  }
}

/** Front view, drawn OVER the body: backpack straps, cape clasp. */
export function drawBackItemFront(ctx, look) {
  if (look.kind === 'backpack') {
    ctx.strokeStyle = shade(look.color, -30);
    ctx.lineWidth = 4;
    for (const [x0, x1] of [[50, 47], [78, 81]]) {
      ctx.beginPath();
      ctx.moveTo(x0, 100);
      ctx.lineTo(x1, 132);
      ctx.stroke();
    }
  } else if (look.kind === 'cape') {
    ctx.beginPath();
    ctx.arc(64, 101, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ink(ctx, 1.6);
  }
}

/** Back view, drawn over the torso: the item faces the camera. */
export function drawBackItemBack(ctx, look) {
  const c = look.color;
  if (WING_KINDS.includes(look.kind)) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(64 + s * 6, 112);
      ctx.scale(s * 1.3, 1.3);
      wing(ctx, look);
      ctx.restore();
    }
  } else if (look.kind === 'backpack') {
    rr(ctx, 48, 104, 32, 34, 9);
    ctx.fillStyle = c;
    ctx.fill();
    ink(ctx);
    rr(ctx, 53, 120, 22, 13, 5);
    ctx.fillStyle = shade(c, -25);
    ctx.fill();
    ink(ctx, 1.6);
    ctx.fillStyle = '#ffffff';
    star(ctx, 64, 113, 4, 1.8);
    ctx.fill();
  } else if (look.kind === 'cape') {
    ctx.beginPath();
    ctx.moveTo(44, 100);
    ctx.lineTo(84, 100);
    ctx.quadraticCurveTo(96, 130, 92, 156);
    ctx.lineTo(36, 156);
    ctx.quadraticCurveTo(32, 130, 44, 100);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 100, 0, 156);
    g.addColorStop(0, c);
    g.addColorStop(1, shade(c, -35));
    ctx.fillStyle = g;
    ctx.fill();
    ink(ctx);
    ctx.fillStyle = '#ffd23f';
    star(ctx, 64, 124, 9, 4);
    ctx.fill();
  } else if (look.kind === 'jetpack') {
    for (const x of [54, 74]) {
      rr(ctx, x - 9, 102, 18, 32, 7);
      ctx.fillStyle = c;
      ctx.fill();
      ink(ctx);
      const g = ctx.createLinearGradient(0, 134, 0, 152);
      g.addColorStop(0, '#fff6b0');
      g.addColorStop(1, 'rgba(255,122,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 6, 134);
      ctx.lineTo(x, 154);
      ctx.lineTo(x + 6, 134);
      ctx.fill();
    }
    ctx.fillStyle = look.alt;
    ctx.fillRect(48, 112, 32, 5);
  }
}
