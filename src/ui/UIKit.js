/**
 * UIKit.js
 * Small reusable UI widgets built from Phaser primitives: buttons, panels,
 * modals, progress bars, the currency bar and a drag-scroll list. Keeping them
 * here keeps every scene's layout code short and visually consistent.
 */
import Phaser from 'phaser';
import { COLORS, FONT, WIDTH, HEIGHT, EVENTS, RES } from '../config/GameConfig.js';
import { Services } from '../systems/Services.js';

/** Shared text style factory. */
export function textStyle(size = 24, color = COLORS.text, extra = {}) {
  // Text is rasterised at RES so it stays crisp under the camera zoom.
  return { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', resolution: RES, ...extra };
}

/** Text with a chunky outline - used for titles and HUD numbers. */
export function outlinedText(scene, x, y, str, size = 32, color = '#ffffff', stroke = '#3d2a52') {
  return scene.add.text(x, y, str, textStyle(size, color, { stroke, strokeThickness: Math.max(4, size / 6) })).setOrigin(0.5);
}

/** Draws a rounded panel into a Graphics object (with a soft drop shadow). */
export function drawPanel(g, x, y, w, h, { color = COLORS.panel, alpha = 1, radius = 22, stroke = COLORS.panelDark, strokeWidth = 4, shadow = true } = {}) {
  if (shadow) {
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(x + 4, y + 7, w, h, radius);
  }
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (strokeWidth) {
    g.lineStyle(strokeWidth, stroke, 1);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
  return g;
}

export function makePanel(scene, x, y, w, h, opts) {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, opts);
  return g;
}

/**
 * Pill button with press animation and click sound.
 * Returns a Container with `.setEnabled(bool)`, `.setLabel(str)` helpers.
 */
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const { w = 220, h = 70, color = COLORS.pink, colorDark = COLORS.pinkDark, fontSize = 28, textColor = '#ffffff', icon = null, iconScale = 0.7, sound = 'click' } = opts;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (fill, dark, pressed = false) => {
    g.clear();
    const oy = pressed ? 4 : 0;
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, h / 2.6);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + oy, w, h - 2, h / 2.6);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(-w / 2 + 10, -h / 2 + oy + 6, w - 20, h * 0.28, h / 6);
    g.lineStyle(3, COLORS.panelDark, 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + oy, w, h - 2 + (pressed ? 2 : 6) - oy, h / 2.6);
  };
  draw(color, colorDark);
  c.add(g);

  let iconImg = null;
  const txt = scene.add.text(0, -2, label, textStyle(fontSize, textColor, { stroke: '#3d2a52', strokeThickness: 4, align: 'center' })).setOrigin(0.5);
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

  c.setSize(w, h + 6);
  c.setInteractive({ useHandCursor: true });
  let enabled = true;
  let pressed = false;
  let downAt = null;

  c.on('pointerdown', (p) => {
    if (!enabled) return;
    pressed = true;
    downAt = { x: p.x / RES, y: p.y / RES };
    draw(color, colorDark, true);
    txt.y = 2;
    if (iconImg) iconImg.y = 2;
  });
  const release = () => {
    pressed = false;
    draw(enabled ? color : 0xb9b1c2, enabled ? colorDark : 0x8d8399);
    txt.y = -2;
    if (iconImg) iconImg.y = -2;
  };
  c.on('pointerout', release);
  c.on('pointerup', (p) => {
    if (!enabled || !pressed) return release();
    const moved = downAt ? Phaser.Math.Distance.Between(p.x / RES, p.y / RES, downAt.x, downAt.y) : 0;
    release();
    if (moved > 14) return; // it was a scroll drag, not a tap
    if (sound) Services.audio?.play(sound);
    onClick?.(c);
  });

  c.setEnabled = (on) => {
    enabled = on;
    release();
    c.setAlpha(on ? 1 : 0.75);
    return c;
  };
  c.setLabel = (str) => {
    txt.setText(str);
    layout();
    return c;
  };
  c.label = txt;
  return c;
}

/** Small circular icon button (close, mute, leaderboard...). */
export function makeIconButton(scene, x, y, glyph, onClick, { size = 56, color = COLORS.panel, textColor = COLORS.text } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.2);
  g.fillCircle(2, 4, size / 2);
  g.fillStyle(color, 1);
  g.fillCircle(0, 0, size / 2);
  g.lineStyle(3, COLORS.panelDark, 1);
  g.strokeCircle(0, 0, size / 2);
  const t = scene.add.text(0, 0, glyph, textStyle(size * 0.45, textColor)).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(size, size);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.9));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    Services.audio?.play('click');
    onClick?.(c);
  });
  c.glyph = t;
  return c;
}

/** Horizontal progress bar. Returns an object with `set(ratio)`. */
export function makeProgressBar(scene, x, y, w, h, { fill = COLORS.mint, back = 0xe8dccb, radius } = {}) {
  const g = scene.add.graphics({ x, y });
  const r = radius ?? h / 2;
  const bar = {
    graphics: g,
    set(ratio) {
      const v = Phaser.Math.Clamp(ratio, 0, 1);
      g.clear();
      g.fillStyle(back, 1);
      g.fillRoundedRect(0, 0, w, h, r);
      if (v > 0) {
        g.fillStyle(fill, 1);
        g.fillRoundedRect(0, 0, Math.max(h, w * v), h, r);
        g.fillStyle(0xffffff, 0.3);
        g.fillRoundedRect(3, 2, Math.max(h - 6, w * v - 6), h * 0.35, r / 2);
      }
      g.lineStyle(2, COLORS.panelDark, 1);
      g.strokeRoundedRect(0, 0, w, h, r);
      return bar;
    }
  };
  return bar.set(0);
}

/**
 * Modal dialog: dims the screen, blocks input underneath, pops a panel in.
 * `content` is a Container positioned at the panel's top-left corner.
 */
export class Modal {
  constructor(scene, { width = 720, height = 480, title = '', onClose = null, closable = true, depth = 1000 } = {}) {
    this.scene = scene;
    this.onClose = onClose;
    this.width = width;
    this.height = height;
    this.root = scene.add.container(0, 0).setDepth(depth);

    this.blocker = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x1a1024, 0.65).setInteractive();
    this.root.add(this.blocker);

    this.panel = scene.add.container(WIDTH / 2, HEIGHT / 2);
    const g = scene.add.graphics();
    drawPanel(g, -width / 2, -height / 2, width, height, { radius: 28 });
    this.panel.add(g);

    if (title) {
      const ribbon = scene.add.graphics();
      ribbon.fillStyle(COLORS.pink, 1);
      ribbon.fillRoundedRect(-Math.min(width - 80, 420) / 2, -height / 2 - 26, Math.min(width - 80, 420), 56, 24);
      ribbon.lineStyle(4, COLORS.panelDark, 1);
      ribbon.strokeRoundedRect(-Math.min(width - 80, 420) / 2, -height / 2 - 26, Math.min(width - 80, 420), 56, 24);
      this.panel.add(ribbon);
      this.panel.add(outlinedText(scene, 0, -height / 2 + 2, title, 30));
    }

    this.content = scene.add.container(-width / 2, -height / 2);
    this.panel.add(this.content);

    if (closable) {
      this.closeBtn = makeIconButton(scene, width / 2 - 10, -height / 2 + 10, '✕', () => this.close(), { size: 52, color: COLORS.pink, textColor: '#ffffff' });
      this.panel.add(this.closeBtn);
    }
    this.root.add(this.panel);

    this.panel.setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: this.panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
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
      scale: 0.7,
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
    for (let p = parent; p; p = p.parentContainer) {
      wx += p.x;
      wy += p.y;
    }
    const shape = scene.make.graphics({}, false);
    shape.fillStyle(0xffffff);
    shape.fillRect(wx, wy, w, h);
    this.inner.setMask(shape.createGeometryMask());
    this.maskShape = shape;
    this.top = y;

    const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    parent.add(zone);
    parent.sendToBack?.(zone);
    let startY = 0;
    let startScroll = 0;
    this.scroll = 0;
    zone.on('pointerdown', (p) => {
      startY = p.y / RES;
      startScroll = this.scroll;
      this.dragging = true;
    });
    this._onMove = (p) => {
      if (!this.dragging || !p.isDown) return;
      this.setScroll(startScroll + (startY - p.y / RES));
    };
    this._onUp = () => (this.dragging = false);
    scene.input.on('pointermove', this._onMove);
    scene.input.on('pointerup', this._onUp);
    zone.on('wheel', (_p, _dx, dy) => this.setScroll(this.scroll + dy * 0.6));
    this.zone = zone;
  }

  setContentHeight(h) {
    this.contentH = h;
    this.setScroll(this.scroll);
  }

  setScroll(v) {
    this.scroll = Phaser.Math.Clamp(v, 0, Math.max(0, this.contentH - this.viewH));
    this.inner.y = this.top - this.scroll;
  }

  destroy() {
    this.scene.input.off('pointermove', this._onMove);
    this.scene.input.off('pointerup', this._onUp);
    this.maskShape.destroy();
  }
}

/**
 * Coins / Tickets / Keys bar that live-updates from SAVE_CHANGED events and
 * animates count changes.
 */
export class CurrencyBar {
  constructor(scene, x, y) {
    this.scene = scene;
    this.root = scene.add.container(x, y).setDepth(50);
    this.values = {};
    const defs = [
      ['popCoins', 'coin', 0.62],
      ['blindBoxTickets', 'ticket', 0.6],
      ['goldenKeys', 'key', 0.65]
    ];
    defs.forEach(([key, tex, scale], i) => {
      const cx = i * 190;
      const g = scene.add.graphics();
      g.fillStyle(0x000000, 0.25);
      g.fillRoundedRect(cx, 0, 170, 46, 23);
      g.lineStyle(3, 0xffffff, 0.5);
      g.strokeRoundedRect(cx, 0, 170, 46, 23);
      const icon = scene.add.image(cx + 26, 23, tex).setScale(scale);
      const label = scene.add.text(cx + 54, 23, '0', textStyle(24, '#ffffff', { stroke: '#3d2a52', strokeThickness: 4 })).setOrigin(0, 0.5);
      this.root.add([g, icon, label]);
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
      this.scene.tweens.add({ targets: v.icon, scale: v.icon.scale * 1.3, yoyo: true, duration: 140 });
    }
  }

  /** World position of a currency icon (fly-to-bar effects). */
  iconPosition(key) {
    const icon = this.values[key]?.icon;
    if (!icon) return { x: 0, y: 0 };
    return { x: this.root.x + icon.x, y: this.root.y + icon.y };
  }
}

/** Rising, fading floating label ("+25", "NEW!"). */
export function floatText(scene, x, y, str, color = '#ffe066', size = 30) {
  const t = outlinedText(scene, x, y, str, size, color).setDepth(2000);
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
  scene.add.image(WIDTH / 2, HEIGHT / 2, 'bg_sky');
  const clouds = scene.add.tileSprite(WIDTH / 2, 150, WIDTH, 260, 'bg_clouds');
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
