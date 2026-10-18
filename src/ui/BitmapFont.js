/**
 * BitmapFont.js
 * Bakes the chunky display font (Lilita One, white fill + ink outline + drop
 * shadow) into a bitmap-font atlas at boot. In-run text (score, coins, combo,
 * pop-ups) uses BitmapText with this font: changing the text or spawning a
 * new label costs nothing, whereas canvas Text redraws and re-uploads a
 * texture on every change - the main source of hitches during a run.
 * Tint a BitmapText to colour it (the outline stays dark).
 */
import Phaser from 'phaser';
import { RES, FONT_DISPLAY } from '../config/GameConfig.js';

export const HUD_FONT = 'lilita';
const SIZE = 72; // logical glyph size; the atlas is drawn at SIZE * RES pixels
const CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + '·×←→↓▸✓⇈•';

export function makeBitmapFont(scene, key = HUD_FONT) {
  if (scene.cache.bitmapFont.exists(key)) return;
  buildFont(scene, `${key}_outline`, 'outline');
  buildFont(scene, key, 'fill');
}

/** One layer of the font: 'outline' (ink stroke + drop shadow) or 'fill' (white). */
function buildFont(scene, key, layer) {
  const px = Math.round(SIZE * RES);
  const stroke = Math.round(px / 6);
  const shadow = Math.round(px / 16);
  const pad = stroke + 2;
  const font = `${px}px ${FONT_DISPLAY}`;

  // Measure every glyph and pack them into rows.
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const cellH = Math.ceil(px * 1.25) + pad * 2 + shadow;
  const maxW = 2048;
  const glyphs = [];
  let x = 0;
  let y = 0;
  for (const ch of CHARS) {
    const adv = Math.ceil(probe.measureText(ch).width);
    const w = adv + pad * 2;
    if (x + w > maxW) {
      x = 0;
      y += cellH;
    }
    glyphs.push({ ch, adv, x, y, w });
    x += w + 2;
  }
  const texW = maxW;
  const texH = y + cellH;
  const texKey = `${key}_atlas`;
  if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
  const tex = scene.textures.createCanvas(texKey, texW, texH);
  const ctx = tex.getContext();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const baseline = pad + Math.round(px * 0.95);
  for (const g of glyphs) {
    const gx = g.x + pad;
    const gy = g.y + baseline;
    if (layer === 'outline') {
      ctx.fillStyle = '#2d1b3d';
      ctx.strokeStyle = '#2d1b3d';
      ctx.lineWidth = stroke * 2;
      ctx.strokeText(g.ch, gx, gy + shadow);
      ctx.fillText(g.ch, gx, gy + shadow);
      ctx.strokeText(g.ch, gx, gy);
      ctx.fillText(g.ch, gx, gy);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(g.ch, gx, gy);
    }
  }
  tex.refresh();

  // Bitmap-font data in the same shape Phaser's XML parser produces.
  const chars = {};
  const spacing = Math.round(stroke * 0.25); // outlines live on their own layer, so letters can sit close
  for (const g of glyphs) {
    const code = g.ch.charCodeAt(0);
    chars[code] = {
      x: g.x,
      y: g.y,
      width: g.w,
      height: cellH,
      centerX: Math.floor(g.w / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: -pad,
      yOffset: 0,
      xAdvance: g.adv + spacing,
      data: {},
      kerning: {},
      u0: g.x / texW,
      v0: g.y / texH,
      u1: (g.x + g.w) / texW,
      v1: (g.y + cellH) / texH
    };
    tex.add(g.ch, 0, g.x, g.y, g.w, cellH);
  }
  scene.cache.bitmapFont.add(key, {
    data: { font: key, size: px, lineHeight: Math.round(px * 1.15), chars },
    texture: texKey,
    frame: null
  });
}

/**
 * Outlined bitmap text: an outline layer under a tintable fill layer (so
 * neighbouring letters' outlines never cover a fill). Behaves like a Text for
 * the calls the game uses: setText, setOrigin, setTint, setColor + all the
 * Container transforms (position, scale, alpha, depth, tweens).
 */
export class HudText extends Phaser.GameObjects.Container {
  constructor(scene, x, y, str, size, color) {
    super(scene, x, y);
    this.outline = scene.add.bitmapText(0, 0, `${HUD_FONT}_outline`, str, size).setOrigin(0.5);
    this.fill = scene.add.bitmapText(0, 0, HUD_FONT, str, size).setOrigin(0.5);
    this.add([this.outline, this.fill]);
    scene.add.existing(this);
    this.setColor(color);
  }

  get text() {
    return this.fill.text;
  }

  setText(str) {
    if (str !== this.fill.text) {
      this.outline.setText(str);
      this.fill.setText(str);
    }
    return this;
  }

  setOrigin(x = 0.5, y = x) {
    this.outline.setOrigin(x, y);
    this.fill.setOrigin(x, y);
    return this;
  }

  setColor(color = '#ffffff') {
    if (color && color !== '#ffffff') this.fill.setTint(Phaser.Display.Color.HexStringToColor(color).color);
    else this.fill.clearTint();
    return this;
  }

  setTint(tint) {
    this.fill.setTint(tint);
    return this;
  }

  get width() {
    return this.fill.width;
  }
}

/** Outlined bitmap text centred at (x, y), `size` logical px tall, coloured `color`. */
export function hudText(scene, x, y, str, size = 32, color = '#ffffff') {
  return new HudText(scene, x, y, String(str), size, color);
}
