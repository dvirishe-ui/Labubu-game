/**
 * UIKit.js
 * Reusable UI widgets: glossy buttons, textured panels, modals, progress bars,
 * the currency bar and a drag-scroll list. Visuals come from ui/Skin.js
 * (canvas-painted, cached, crisp at any resolution) so every screen shares
 * one polished look.
 */
import Phaser from 'phaser';
import { COLORS, FONT, FONT_DISPLAY, WIDTH, HEIGHT, EVENTS, RES } from '../config/GameConfig.js';
import { Services } from '../systems/Services.js';
import { INK, uiImage, addPanel, buttonKey, roundKey, pillKey } from './Skin.js';
import { HUD_FONT, hudText } from './BitmapFont.js';

/** Body text style (Fredoka). Text is rasterised at RES so it stays crisp. */
export function textStyle(size = 24, color = COLORS.text, extra = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: '600', resolution: RES, ...extra };
}

/** Chunky display style (Lilita One) for titles, numbers and buttons. */
export function displayStyle(size = 32, color = '#ffffff', extra = {}) {
  return { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color, fontStyle: 'normal', resolution: RES, ...extra };
}

/** Outlined display text with a drop shadow - titles and HUD numbers. */
export function outlinedText(scene, x, y, str, size = 32, color = '#ffffff', stroke = INK) {
  const t = scene.add.text(x, y, str, displayStyle(size, color, { stroke, strokeThickness: Math.max(5, size / 5.5) })).setOrigin(0.5);
  t.setShadow(0, Math.max(3, size / 14), stroke, 0, true, false);
  return t;
}

/** Textured panel (top-left at x, y). Returns an Image. */
export function makePanel(scene, x, y, w, h, opts = {}) {
  return addPanel(scene, x, y, w, h, opts);
}

/** Maps legacy colour numbers used around the codebase to button skins. */
const SKIN_BY_COLOR = {
  [COLORS.gold]: 'yellow',
  [COLORS.mint]: 'green',
  [COLORS.pink]: 'pink',
  [COLORS.rare]: 'blue',
  [COLORS.epic]: 'purple',
  0xe8324b: 'red',
  0xc9bfd6: 'gray',
  0x8d7aa3: 'gray',
  0x9aa0a6: 'gray',
  0x3fa9f5: 'blue'
};

/** True when `obj` sits in a ScrollList and the pointer is outside its window. */
function outsideScroll(obj, p) {
  for (let n = obj.parentContainer; n; n = n.parentContainer) {
    if (n.scrollList) return !n.scrollList.contains(p);
  }
  return false;
}

/**
 * Glossy bevelled 3D button with press animation and click sound.
 * Options: w, h, skin ('yellow'|'green'|'blue'|'pink'|'purple'|'orange'|'red'|'gray')
 * or legacy `color`, fontSize, icon, iconScale, sound.
 * Returns a Container with `.setEnabled(bool)` and `.setLabel(str)`.
 */
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const { w = 220, h = 70, fontSize = 28, textColor = '#ffffff', icon = null, iconScale = 0.7, sound = 'click' } = opts;
  const w2 = Math.round(w);
  const h2 = Math.round(h);
  const skin = opts.skin || SKIN_BY_COLOR[opts.color] || 'yellow';
  const c = scene.add.container(x, y);
  const up = buttonKey(scene, w2, h2, skin, false);
  const down = buttonKey(scene, w2, h2, skin, true);
  const off = buttonKey(scene, w2, h2, 'gray', false);
  const bg = uiImage(scene, -w2 / 2 - 6, -h2 / 2 - 4, up);
  c.add(bg);

  let iconImg = null;
  const txt = scene.add.text(0, -2, label, displayStyle(fontSize, textColor, { stroke: INK, strokeThickness: Math.max(4, fontSize / 5), align: 'center' })).setOrigin(0.5);
  txt.setShadow(0, 3, INK, 0, true, false);
  if (icon) {
    iconImg = scene.add.image(0, -2, icon).setScale(iconScale);
    c.add(iconImg);
  }
  c.add(txt);
  const layout = () => {
    if (!iconImg) return;
    const total = iconImg.displayWidth + 8 + txt.width;
    iconImg.x = -total / 2 + iconImg.displayWidth / 2;
    txt.x = iconImg.x + iconImg.displayWidth / 2 + 8 + txt.width / 2;
  };
  layout();

  c.setSize(w2, h2 + 8);
  c.setInteractive({ useHandCursor: true });
  let enabled = true;
  let pressed = false;
  let downAt = null;
  const setFace = (isDown) => {
    bg.setTexture(enabled ? (isDown ? down : up) : off);
    const dy = isDown ? 3 : -2;
    txt.y = dy;
    if (iconImg) iconImg.y = dy;
  };

  c.on('pointerdown', (p) => {
    if (!enabled) return;
    pressed = true;
    downAt = { x: p.x / RES, y: p.y / RES };
    setFace(true);
    scene.tweens.add({ targets: c, scaleX: 0.97, scaleY: 0.97, duration: 60 });
  });
  const release = () => {
    pressed = false;
    setFace(false);
    c.setScale(1);
  };
  c.on('pointerout', release);
  c.on('pointerup', (p) => {
    if (!enabled || !pressed) return release();
    const moved = downAt ? Phaser.Math.Distance.Between(p.x / RES, p.y / RES, downAt.x, downAt.y) : 0;
    release();
    if (moved > 14) return; // it was a scroll drag, not a tap
    if (outsideScroll(c, p)) return; // tapped where the list is clipped
    if (sound) Services.audio?.play(sound);
    scene.tweens.add({ targets: c, scaleX: 1.06, scaleY: 1.06, duration: 90, yoyo: true });
    onClick?.(c);
  });

  c.setEnabled = (on) => {
    enabled = on;
    release();
    c.setAlpha(on ? 1 : 0.85);
    return c;
  };
  c.setLabel = (str) => {
    txt.setText(str);
    layout();
    return c;
  };
  c.setIcon = (key) => {
    iconImg?.setTexture(key);
    layout();
    return c;
  };
  c.label = txt;
  return c;
}

/** Round glossy icon button (close, mute, leaderboard...). */
export function makeIconButton(scene, x, y, glyph, onClick, { size = 56, skin = 'cream', textColor = COLORS.text, color } = {}) {
  const sk = color !== undefined ? SKIN_BY_COLOR[color] || skin : skin;
  const c = scene.add.container(x, y);
  const up = roundKey(scene, size, sk, false);
  const down = roundKey(scene, size, sk, true);
  const bg = uiImage(scene, -size / 2 - 6, -size / 2 - 4, up);
  const light = sk !== 'cream' && sk !== 'gray';
  const t = scene.add.text(0, -1, glyph, displayStyle(size * 0.46, light ? '#ffffff' : textColor, light ? { stroke: INK, strokeThickness: 4 } : {})).setOrigin(0.5);
  c.add([bg, t]);
  c.setSize(size, size);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    bg.setTexture(down);
    t.y = 2;
  });
  const reset = () => {
    bg.setTexture(up);
    t.y = -1;
  };
  c.on('pointerout', reset);
  c.on('pointerup', () => {
    reset();
    Services.audio?.play('click');
    scene.tweens.add({ targets: c, scale: 1.12, duration: 80, yoyo: true });
    onClick?.(c);
  });
  c.glyph = t;
  return c;
}

/** Glossy horizontal progress bar. Returns an object with `set(ratio)`. */
export function makeProgressBar(scene, x, y, w, h, { fill = COLORS.mint, back = 0x3a2650, radius } = {}) {
  const g = scene.add.graphics({ x, y });
  const r = radius ?? h / 2;
  const bar = {
    graphics: g,
    set(ratio) {
      const v = Phaser.Math.Clamp(ratio, 0, 1);
      g.clear();
      g.fillStyle(back, 0.85);
      g.fillRoundedRect(0, 0, w, h, r);
      g.fillStyle(0x000000, 0.25);
      g.fillRoundedRect(2, 2, w - 4, h * 0.4, r / 2);
      if (v > 0) {
        const fw = Math.max(h, w * v);
        g.fillStyle(fill, 1);
        g.fillRoundedRect(0, 0, fw, h, r);
        g.fillStyle(0x000000, 0.15);
        g.fillRoundedRect(0, h * 0.55, fw, h * 0.45, { tl: 0, tr: 0, bl: r, br: r });
        g.fillStyle(0xffffff, 0.45);
        g.fillRoundedRect(4, 3, Math.max(h - 8, fw - 8), h * 0.3, r / 2);
      }
      g.lineStyle(3, 0x2d1b3d, 1);
      g.strokeRoundedRect(0, 0, w, h, r);
      return bar;
    }
  };
  return bar.set(0);
}

/**
 * Modal dialog: dims the screen, blocks input underneath, pops a textured
 * panel in with a glossy title ribbon. `content` is a Container positioned at
 * the panel's top-left corner. Auto-scales to fit narrow (portrait) screens.
 */
export class Modal {
  constructor(scene, { width = 720, height = 480, title = '', onClose = null, closable = true, depth = 1000, ribbon = 'pink' } = {}) {
    this.scene = scene;
    this.onClose = onClose;
    this.width = width;
    this.height = height;
    this.root = scene.add.container(0, 0).setDepth(depth);

    this.blocker = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x14081f, 0.7).setInteractive();
    this.root.add(this.blocker);

    this.panel = scene.add.container(WIDTH / 2, HEIGHT / 2);
    this.panel.add(addPanel(scene, -width / 2, -height / 2, width, height, { radius: 32 }));

    if (title) {
      const rw = Math.min(width - 60, Math.max(300, title.length * 22 + 80));
      this.panel.add(uiImage(scene, -rw / 2 - 6, -height / 2 - 34, buttonKey(scene, rw, 60, ribbon, false)));
      this.panel.add(outlinedText(scene, 0, -height / 2 - 6, title, 34));
    }

    this.content = scene.add.container(-width / 2, -height / 2);
    this.panel.add(this.content);

    if (closable) {
      this.closeBtn = makeIconButton(scene, width / 2 - 8, -height / 2 + 8, '✕', () => this.close(), { size: 54, skin: 'red' });
      this.panel.add(this.closeBtn);
    }
    this.root.add(this.panel);

    this.fit = Math.min(1, (WIDTH - 24) / width, (HEIGHT - 80) / (height + 50));
    this.panel.fitScale = this.fit;
    this.panel.setScale(0.6 * this.fit).setAlpha(0);
    scene.tweens.add({ targets: this.panel, scale: this.fit, alpha: 1, duration: 280, ease: 'Back.easeOut' });
    this.blocker.setAlpha(0);
    scene.tweens.add({ targets: this.blocker, alpha: 1, duration: 200 });
  }

  /** Adds game objects to the panel content (coordinates from panel top-left). */
  add(objs) {
    this.content.add(objs);
    return this;
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.scene.tweens.add({
      targets: this.panel,
      scale: 0.7 * this.fit,
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.root.destroy();
        this.onClose?.();
      }
    });
  }
}

/**
 * Vertical drag/wheel scroll area. Add children to `.inner` and call
 * `.setContentHeight(h)`.
 */
export class ScrollList {
  constructor(scene, parent, x, y, w, h) {
    this.scene = scene;
    this.viewH = h;
    this.contentH = h;
    this.inner = scene.add.container(x, y);
    parent.add(this.inner);

    // Geometry masks live in world space. Sum the container offsets (ignoring
    // the modal's pop-in scale tween) to get the final on-screen rectangle.
    let wx = x;
    let wy = y;
    let ws = 1;
    for (let p = parent; p; p = p.parentContainer) {
      const sc = p.fitScale ?? p.scaleX;
      wx = p.x + wx * sc;
      wy = p.y + wy * sc;
      ws *= sc;
    }
    const shape = scene.make.graphics({}, false);
    shape.fillStyle(0xffffff);
    shape.fillRect(wx, wy, w * ws, h * ws);
    this.inner.setMask(shape.createGeometryMask());
    this.maskShape = shape;
    this.top = y;
    this.contentScale = ws;

    // World-space view rectangle (for drag start and tap guarding).
    this.view = new Phaser.Geom.Rectangle(wx, wy, w * ws, h * ws);
    this.inner.scrollList = this;

    // Drags may start anywhere inside the view - even on a button.
    const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    parent.add(zone);
    parent.sendToBack?.(zone);
    let startY = 0;
    let startScroll = 0;
    this.scroll = 0;
    this._onDown = (p) => {
      if (!this.contains(p)) return;
      startY = p.y / RES;
      startScroll = this.scroll;
      this.dragging = true;
    };
    this._onMove = (p) => {
      if (!this.dragging || !p.isDown) return;
      this.setScroll(startScroll + (startY - p.y / RES) / this.contentScale);
    };
    this._onUp = () => (this.dragging = false);
    scene.input.on('pointerdown', this._onDown);
    scene.input.on('pointermove', this._onMove);
    scene.input.on('pointerup', this._onUp);
    zone.on('wheel', (_p, _dx, dy) => this.setScroll(this.scroll + dy * 0.6));
    this.zone = zone;
  }

  /** True when a pointer is inside the visible scroll window. */
  contains(p) {
    return this.view.contains(p.x / RES, p.y / RES);
  }

  setContentHeight(h) {
    this.contentH = h;
    this.setScroll(this.scroll);
  }

  setScroll(v) {
    this.scroll = Phaser.Math.Clamp(v, 0, Math.max(0, this.contentH - this.viewH));
    this.inner.y = this.top - this.scroll;
    // Hide rows that are fully scrolled out (they also stop taking input).
    for (const child of this.inner.list) {
      const h = child.rowHeight ?? 0;
      if (!h) continue;
      const top = child.y - this.scroll;
      child.setVisible(top + h > 0 && top < this.viewH);
    }
  }

  destroy() {
    this.scene.input.off('pointerdown', this._onDown);
    this.scene.input.off('pointermove', this._onMove);
    this.scene.input.off('pointerup', this._onUp);
    this.maskShape.destroy();
  }
}

/**
 * Currency bar (coins, gems, tickets, keys): dark glass pills with the icon
 * overlapping the left edge and a green "+" that opens the shop. Live-updates
 * from SAVE_CHANGED and animates count changes.
 */
export class CurrencyBar {
  constructor(scene, x, y, { compact = WIDTH < 1000, shop = true } = {}) {
    this.scene = scene;
    this.root = scene.add.container(x, y).setDepth(50);
    this.values = {};
    const defs = [
      ['popCoins', 'coin', 0.66],
      ['gems', 'gem', 0.62],
      ['blindBoxTickets', 'ticket', 0.58],
      ['goldenKeys', 'key', 0.62]
    ];
    const pillW = compact ? 156 : 160;
    const gap = compact ? 8 : 18;
    defs.forEach(([key, tex, scale], i) => {
      const cx = i * (pillW + gap);
      const pill = uiImage(scene, cx + 14, 2, pillKey(scene, pillW - 14, 40));
      const icon = scene.add.image(cx + 18, 24, tex).setScale(scale);
      const label = scene.add.text(cx + 40, 24, '0', displayStyle(24, '#ffffff', { stroke: INK, strokeThickness: 5 })).setOrigin(0, 0.5);
      this.root.add([pill, icon, label]);
      if (shop && (key === 'popCoins' || key === 'gems')) {
        const plus = makeIconButton(scene, cx + pillW - 16, 24, '+', () => scene.scene.start('Shop', { tab: key === 'gems' ? 'gems' : 'deals' }), { size: 30, skin: 'green' });
        this.root.add(plus);
      }
      this.values[key] = { label, icon, shown: Services.save.getCurrency(key) };
      label.setText(this._fmt(this.values[key].shown));
    });
    this._onChange = () => this.refresh();
    Services.bus.on(EVENTS.SAVE_CHANGED, this._onChange, this);
    scene.events.once('shutdown', () => Services.bus.off(EVENTS.SAVE_CHANGED, this._onChange, this));
  }

  _fmt(n) {
    return n >= 100000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString('en-US');
  }

  /** Tweens each label from its shown value to the saved value. */
  refresh() {
    for (const [key, v] of Object.entries(this.values)) {
      const target = Services.save.getCurrency(key);
      if (target === v.shown) continue;
      const from = v.shown;
      v.shown = target;
      const counter = { val: from };
      this.scene.tweens.add({
        targets: counter,
        val: target,
        duration: 600,
        ease: 'Cubic.easeOut',
        onUpdate: () => v.label.setText(this._fmt(Math.round(counter.val)))
      });
      const base = v.icon.scale;
      this.scene.tweens.add({ targets: v.icon, scale: base * 1.35, yoyo: true, duration: 140 });
    }
  }

  /** World position of a currency icon (fly-to-bar effects). */
  iconPosition(key) {
    const icon = this.values[key]?.icon;
    if (!icon) return { x: 0, y: 0 };
    return { x: this.root.x + icon.x, y: this.root.y + icon.y };
  }
}

/** Rising, fading floating label ("+25", "NEW!"). Bitmap text: no hitch. */
export function floatText(scene, x, y, str, color = '#ffe066', size = 30) {
  const t = (scene.cache.bitmapFont.exists(HUD_FONT) ? hudText(scene, x, y, str, size, color) : outlinedText(scene, x, y, str, size, color)).setDepth(21000);
  scene.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  return t;
}

/** Flies `count` coin sprites from (x,y) to a target point, then calls `done`. */
export function flyCoins(scene, from, to, count = 10, texture = 'coin', done) {
  let arrived = 0;
  for (let i = 0; i < count; i++) {
    const c = scene.add.image(from.x + Phaser.Math.Between(-40, 40), from.y + Phaser.Math.Between(-30, 30), texture).setScale(0.7).setDepth(3000);
    scene.tweens.add({
      targets: c,
      x: to.x,
      y: to.y,
      scale: 0.4,
      delay: i * 45,
      duration: 550,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        c.destroy();
        arrived++;
        if (i % 3 === 0) Services.audio?.play('coin');
        if (arrived === count) done?.();
      }
    });
  }
}

/**
 * Shared decorative forest backdrop for the hub scenes (sky, drifting clouds,
 * canopy, ground). Returns the tile sprites so callers can animate them.
 */
export function addForestBackdrop(scene, { dim = 0 } = {}) {
  scene.add.image(0, 0, 'sky3d').setOrigin(0).setDisplaySize(WIDTH, HEIGHT);
  scene.add.image(WIDTH * 0.78, HEIGHT * 0.16, 'sun').setScale(1.1);
  const clouds = scene.add.tileSprite(WIDTH / 2, Math.min(150, HEIGHT * 0.2), WIDTH, 260, 'bg_clouds');
  scene.add.tileSprite(WIDTH / 2, HEIGHT - 330, WIDTH, 300, 'bg_mountains').setAlpha(0.95);
  const canopy = scene.add.tileSprite(WIDTH / 2, HEIGHT - 200 - 40, WIDTH, 400, 'bg_canopy');
  const ground = scene.add.tileSprite(WIDTH / 2, HEIGHT - 45, WIDTH, 130, 'ground');
  if (dim > 0) scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.bgDark, dim);
  const drift = (_t, dt) => {
    clouds.tilePositionX += dt * 0.006;
  };
  scene.events.on('update', drift);
  scene.events.once('shutdown', () => scene.events.off('update', drift));
  return { clouds, canopy, ground };
}
