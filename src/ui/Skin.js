/**
 * Skin.js
 * Procedural "premium" UI skin: glossy bevelled buttons, textured panels,
 * rarity cards and badges, all painted with the Canvas 2D API at the render
 * resolution (RES) and cached per size. Nothing is stretched, so edges and
 * patterns stay crisp on every phone, and it works with WebGL or Canvas.
 */
import { RES } from '../config/GameConfig.js';
import { RARITY_TIERS } from '../config/GachaDropTable.js';

export const INK = '#2d1b3d'; // outline colour used everywhere

/** Button colour skins: [top, bottom, bevel]. */
export const BUTTON_SKINS = {
  yellow: ['#ffe873', '#ffb400', '#c27a00'],
  green: ['#8ff58a', '#2fc24f', '#1b8a36'],
  blue: ['#8fd2ff', '#2f8cff', '#1c56b8'],
  pink: ['#ffadd2', '#ff4f9a', '#c22f6e'],
  purple: ['#d2a8ff', '#8a4dff', '#5a2bb5'],
  orange: ['#ffc27a', '#ff7a1a', '#c24d00'],
  red: ['#ff9a9a', '#ff3b4f', '#b51e30'],
  gray: ['#e4dff0', '#a99fbf', '#73688c'],
  cream: ['#fffaf2', '#ffe2c2', '#d6a878']
};

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * Returns the key of a cached canvas texture of logical size (w, h) painted
 * by `draw(ctx, w, h)`. The canvas is RES times larger for sharpness; display
 * it with setScale(1 / RES) (the helpers below do that).
 */
export function uiTexture(scene, key, w, h, draw) {
  const fullKey = `${key}@${RES}`;
  if (!scene.textures.exists(fullKey)) {
    const tex = scene.textures.createCanvas(fullKey, Math.ceil(w * RES), Math.ceil(h * RES));
    const ctx = tex.getContext();
    ctx.save();
    ctx.scale(RES, RES);
    ctx.lineJoin = 'round';
    draw(ctx, w, h);
    ctx.restore();
    tex.refresh();
  }
  return fullKey;
}

/** Adds an image of a ui texture at logical (x, y) with origin `ox, oy`. */
export function uiImage(scene, x, y, key, ox = 0, oy = 0) {
  return scene.add.image(x, y, key).setOrigin(ox, oy).setScale(1 / RES);
}

// ---------------------------------------------------------------------------- panels

const PAD = 10; // room for the drop shadow around panels

/**
 * Textured panel: chunky outline, soft vertical gradient, inner highlight,
 * subtle polka-dot pattern, optional coloured header band.
 * @param {object} o { tone: 'cream'|'dark', header: 0xRRGGBB|null, headerH, radius }
 */
export function panelKey(scene, w, h, o = {}) {
  const tone = o.tone || 'cream';
  const header = o.header ?? null;
  const headerH = o.headerH ?? 58;
  const radius = o.radius ?? 28;
  const key = `panel_${tone}_${header ?? 'none'}_${headerH}_${radius}_${w}x${h}`;
  return uiTexture(scene, key, w + PAD * 2, h + PAD * 2 + 4, (ctx) => {
    const x = PAD;
    const y = PAD;
    // drop shadow
    rr(ctx, x + 2, y + 8, w, h, radius);
    ctx.fillStyle = 'rgba(30,10,40,0.35)';
    ctx.fill();
    // body
    rr(ctx, x, y, w, h, radius);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (tone === 'dark') {
      g.addColorStop(0, '#5a3d80');
      g.addColorStop(1, '#2f1f4a');
    } else {
      g.addColorStop(0, '#fffaf2');
      g.addColorStop(1, '#ffe6cc');
    }
    ctx.fillStyle = g;
    ctx.fill();
    // pattern + header, clipped to the body
    ctx.save();
    rr(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.fillStyle = tone === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(214,160,110,0.16)';
    for (let py = y + 10; py < y + h; py += 18) {
      for (let px = x + 10 + ((py / 18) % 2) * 9; px < x + w; px += 18) {
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (header !== null) {
      const hg = ctx.createLinearGradient(0, y, 0, y + headerH);
      const c = hex(header);
      hg.addColorStop(0, c);
      hg.addColorStop(1, c);
      ctx.fillStyle = hg;
      ctx.fillRect(x, y, w, headerH);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x, y, w, headerH * 0.45);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y + headerH - 5, w, 5);
      // diagonal stripes on the header
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 10;
      for (let sx = x - headerH; sx < x + w; sx += 34) {
        ctx.beginPath();
        ctx.moveTo(sx, y + headerH);
        ctx.lineTo(sx + headerH, y);
        ctx.stroke();
      }
    }
    // inner top highlight
    ctx.strokeStyle = tone === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    rr(ctx, x + 5, y + 5, w - 10, h - 10, radius - 5);
    ctx.stroke();
    ctx.restore();
    // outline
    rr(ctx, x, y, w, h, radius);
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });
}

/** Adds a textured panel whose body's top-left corner is at (x, y). */
export function addPanel(scene, x, y, w, h, o) {
  return uiImage(scene, x - PAD, y - PAD, panelKey(scene, w, h, o));
}

// ---------------------------------------------------------------------------- buttons

/** Glossy bevelled button face. `pressed` sinks the face into the bevel. */
export function buttonKey(scene, w, h, skin = 'yellow', pressed = false) {
  const [top, bottom, bevel] = BUTTON_SKINS[skin] || BUTTON_SKINS.yellow;
  const key = `btn_${skin}_${pressed ? 'd' : 'u'}_${w}x${h}`;
  const bevelH = 8;
  return uiTexture(scene, key, w + 12, h + bevelH + 12, (ctx) => {
    const x = 6;
    const y = 4;
    const r = Math.min(h * 0.42, 26);
    const sink = pressed ? bevelH - 3 : 0;
    // ground shadow
    if (!pressed) {
      rr(ctx, x + 1, y + bevelH + 4, w, h, r);
      ctx.fillStyle = 'rgba(30,10,40,0.3)';
      ctx.fill();
    }
    // bevel (the "side" of the 3D button)
    rr(ctx, x, y + bevelH, w, h, r);
    ctx.fillStyle = bevel;
    ctx.fill();
    // face
    rr(ctx, x, y + sink, w, h, r);
    const g = ctx.createLinearGradient(0, y + sink, 0, y + sink + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fill();
    // gloss
    ctx.save();
    rr(ctx, x, y + sink, w, h, r);
    ctx.clip();
    rr(ctx, x + 8, y + sink + 5, w - 16, h * 0.4, r * 0.7);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(x + 16, y + sink + 12, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // outline around face + bevel
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = INK;
    rr(ctx, x, y + sink, w, h + bevelH - sink, r);
    ctx.stroke();
  });
}

/** Round glossy icon-button face. */
export function roundKey(scene, size, skin = 'cream', pressed = false) {
  const [top, bottom, bevel] = BUTTON_SKINS[skin] || BUTTON_SKINS.cream;
  const key = `round_${skin}_${pressed ? 'd' : 'u'}_${size}`;
  return uiTexture(scene, key, size + 12, size + 16, (ctx) => {
    const r = size / 2;
    const cx = 6 + r;
    const cy = 4 + r;
    const sink = pressed ? 3 : 0;
    ctx.fillStyle = bevel;
    ctx.beginPath();
    ctx.arc(cx, cy + 5, r, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy + sink, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + sink - r * 0.45, r * 0.62, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy + sink, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------------------- rarity cards

/** Collectible card: rarity gradient, sun-burst, stripes and a name band. */
export function cardKey(scene, w, h, rarity, locked = false) {
  const tier = RARITY_TIERS[rarity] || RARITY_TIERS.common;
  const key = `card_${rarity}_${locked ? 'l' : 'o'}_${w}x${h}`;
  return uiTexture(scene, key, w + 12, h + 16, (ctx) => {
    const x = 6;
    const y = 4;
    const r = 18;
    rr(ctx, x + 1, y + 7, w, h, r);
    ctx.fillStyle = 'rgba(30,10,40,0.35)';
    ctx.fill();
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (locked) {
      g.addColorStop(0, '#6f6585');
      g.addColorStop(1, '#3d3452');
    } else {
      g.addColorStop(0, hex(tier.glow));
      g.addColorStop(0.45, hex(tier.color));
      g.addColorStop(1, hex(tier.dark));
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // sunburst behind the figure
    ctx.save();
    ctx.translate(x + w / 2, y + h * 0.42);
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.fillStyle = `rgba(255,255,255,${locked ? 0.04 : 0.13})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, -h);
      ctx.lineTo(10, -h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (rarity === 'secret' && !locked) {
      // rainbow sheen for Mystery cards
      const rg = ctx.createLinearGradient(x, y, x + w, y + h);
      ['#ff5a6e', '#ffd23f', '#6ee7a8', '#59b8ff', '#b07cff'].forEach((c, i) => rg.addColorStop(i / 4, c));
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = rg;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }
    // name band
    ctx.fillStyle = 'rgba(20,8,30,0.45)';
    ctx.fillRect(x, y + h - 30, w, 30);
    ctx.restore();
    // inner + outer border
    rr(ctx, x + 4, y + 4, w - 8, h - 8, r - 4);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
    rr(ctx, x, y, w, h, r);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });
}

/** Diagonal shine bar used for sweep animations. */
export function shineKey(scene) {
  return uiTexture(scene, 'shine', 80, 300, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 80, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 80, 300);
  });
}

/** Screen vignette (darkened corners) for depth. */
export function vignetteKey(scene) {
  return uiTexture(scene, 'vignette', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 185);
    g.addColorStop(0, 'rgba(20,6,30,0)');
    g.addColorStop(1, 'rgba(20,6,30,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

/** Small rounded "pill" (currency bar, badges). */
export function pillKey(scene, w, h, fill = 'rgba(25,10,40,0.55)') {
  return uiTexture(scene, `pill_${w}x${h}_${fill}`, w + 4, h + 6, (ctx) => {
    rr(ctx, 2, 4, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    rr(ctx, 2, 2, w, h, h / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
  });
}
