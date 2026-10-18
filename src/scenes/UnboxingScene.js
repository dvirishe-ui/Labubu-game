/**
 * UnboxingScene.js
 * Pop Mart-style blind box ritual:
 *   1. The box drops in with a bounce.
 *   2. "Swipe to tear the foil strip" - a real drag gesture peels the foil.
 *   3. The box shakes 3 times with escalating screen-shake; the glow behind it
 *      hints at the tier on the final shake.
 *   4. Burst reveal: lid pops, god rays + particles in the tier colour
 *      (Gray = Common, Blue = Rare, Purple = Epic, Gold sparkle = Secret Chase).
 *   5. Stats card with "Equip Now" / "Store in Collection".
 *
 * The pull is rolled and saved in create() BEFORE any animation, so quitting
 * mid-reveal can never re-roll or lose the item.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS, EVENTS } from '../config/GameConfig.js';
import { RARITY_TIERS, SERIES_NAME, describePerks } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { pullBlindBox } from '../systems/GachaSystem.js';
import { bakeCharacterFrame, bakePlayerTextures, previewLoadoutFor } from '../art/CharacterRenderer.js';
import { CurrencyBar, makeButton, makePanel, outlinedText, textStyle } from '../ui/UIKit.js';

const BOX_X = WIDTH / 2;
const BOX_Y = 400;
const FOIL_W = 196; // foil texture width
const FOIL_SCALE = 0.77; // scaled to span the box's front-top edge
const FOIL_Y = -62; // relative to the box centre

const SLOT_LABEL = { doll: 'Figure', outfit: 'Outfit', headwear: 'Headwear', tail: 'Tail', shoes: 'Shoes' };

export class UnboxingScene extends Phaser.Scene {
  constructor() {
    super('Unboxing');
  }

  init(data) {
    this.source = data?.source || 'ticket';
    this.phase = 'drop';
    this.tearProgress = 0;
    this.lastTearSfx = 0;
  }

  create() {
    // Roll first: the outcome is committed before the show starts.
    this.result = pullBlindBox(Services.save, this.source);
    if (!this.result.ok) {
      Services.bus.emit('ui:toast', { text: 'Not enough tickets', color: COLORS.pink });
      this.scene.start('MainMenu');
      return;
    }
    this.tier = RARITY_TIERS[this.result.rarity];

    const equippedDoll = Services.save.data.equipped.baseDoll;
    bakeCharacterFrame(this, 'reveal_art', previewLoadoutFor(this.result.itemId, equippedDoll), 'wave', 2);

    Services.audio.stopMusic();
    this.buildStage();
    this.currencyBar = new CurrencyBar(this, 20, 16);
    this.cameras.main.fadeIn(200, 20, 12, 30);
    this.wait(250).then(() => this.dropBox());
  }

  // -------------------------------------------------------------------------- helpers

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  tween(config) {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: resolve }));
  }

  // -------------------------------------------------------------------------- stage

  buildStage() {
    this.add.image(WIDTH / 2, HEIGHT / 2, 'bg_sky').setTint(0x6b4f8a);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x1a1024, 0.72);
    // Spotlight
    this.spot = this.add.image(BOX_X, BOX_Y, 'fx_glow').setScale(3.2).setAlpha(0.25).setTint(0xffe3ec);
    this.shadow = this.add.ellipse(BOX_X, BOX_Y + 140, 300, 50, 0x000000, 0.35);

    this.rays = this.add.image(BOX_X, BOX_Y - 40, 'fx_rays').setAlpha(0).setScale(0.4).setBlendMode(Phaser.BlendModes.ADD);
    this.glow = this.add.image(BOX_X, BOX_Y - 20, 'fx_glow').setAlpha(0).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD);

    // The box is a container: body + foil strip so they shake together.
    this.box = this.add.container(BOX_X, -260);
    this.boxImg = this.add.image(0, 0, 'box_closed');
    this.foil = this.add.image(-90, FOIL_Y, 'foil_strip').setOrigin(0, 0.5).setScale(FOIL_SCALE, 0.9);
    this.box.add([this.boxImg, this.foil]);

    this.prompt = outlinedText(this, WIDTH / 2, 120, '', 34, '#fff4e6').setAlpha(0);
    this.subPrompt = this.add.text(WIDTH / 2, 165, '', textStyle(20, '#d9c9e8')).setOrigin(0.5).setAlpha(0);

    this.foilBits = this.add.particles(0, 0, 'p_confetti', {
      lifespan: 700,
      speedX: { min: -60, max: 160 },
      speedY: { min: -180, max: -40 },
      gravityY: 500,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.5, max: 0.9 },
      tint: [0xd9dde3, 0xffffff, 0xaeb6c2],
      emitting: false
    });

    this.skipBtn = makeButton(this, WIDTH - 110, 50, 'Skip', () => this.skip(), { w: 150, h: 52, fontSize: 22, color: 0x8d7aa3, colorDark: 0x5d4d72 }).setDepth(50);
  }

  /** Phase 1: bounce in. */
  async dropBox() {
    await this.tween({ targets: this.box, y: BOX_Y, duration: 900, ease: 'Bounce.easeOut' });
    Services.audio.play('boxDrop');
    this.cameras.main.shake(120, 0.004);
    this.startTearPhase();
  }

  /** Phase 2: tear the foil strip with a horizontal swipe (or repeated taps). */
  startTearPhase() {
    this.phase = 'tear';
    this.prompt.setText('Swipe to tear the foil strip');
    this.subPrompt.setText('drag across the silver strip  ➜');
    this.tweens.add({ targets: [this.prompt, this.subPrompt], alpha: 1, duration: 300 });

    // Animated hint finger
    this.hint = outlinedText(this, BOX_X - 90, BOX_Y + FOIL_Y - 46, '➜', 54, '#ff8fb1');
    this.tweens.add({ targets: this.hint, x: BOX_X + 60, duration: 900, repeat: -1, ease: 'Sine.easeInOut', repeatDelay: 300 });

    let last = null;
    let downAt = null;
    this.input.on('pointerdown', (p) => {
      if (this.phase !== 'tear') return;
      last = { x: p.x, y: p.y };
      downAt = { x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p) => {
      if (this.phase !== 'tear' || !last || !p.isDown) return;
      const dx = Math.abs(p.x - last.x);
      last = { x: p.x, y: p.y };
      this.advanceTear(dx / (FOIL_W * FOIL_SCALE * 1.1), p.x, p.y);
    });
    this.input.on('pointerup', (p) => {
      if (this.phase !== 'tear') return;
      // Accessibility: a plain tap tears a chunk too.
      if (downAt && Phaser.Math.Distance.Between(p.x, p.y, downAt.x, downAt.y) < 10) this.advanceTear(0.22, p.x, p.y);
      last = null;
      downAt = null;
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.phase === 'tear' && this.advanceTear(0.25, BOX_X, BOX_Y + FOIL_Y));
  }

  advanceTear(amount, px, py) {
    if (amount <= 0 || this.phase !== 'tear') return;
    this.hint?.destroy();
    this.hint = null;
    this.tearProgress = Math.min(1, this.tearProgress + amount);
    const torn = this.tearProgress * FOIL_W;
    this.foil.setCrop(torn, 0, FOIL_W - torn, this.foil.height);

    const worldX = this.box.x + this.foil.x + torn * FOIL_SCALE;
    const worldY = this.box.y + this.foil.y;
    this.foilBits.explode(3, worldX, worldY);
    if (this.tearProgress - this.lastTearSfx > 0.08) {
      this.lastTearSfx = this.tearProgress;
      Services.audio.play('tear');
    }
    this.box.setAngle(Phaser.Math.Between(-2, 2));
    if (this.tearProgress >= 0.92) this.finishTear();
  }

  async finishTear() {
    this.phase = 'shake';
    this.foil.setCrop();
    this.foil.setVisible(false);
    this.box.setAngle(0);
    this.foilBits.explode(30, this.box.x, this.box.y + FOIL_Y);
    Services.audio.play('tear');
    this.tweens.add({ targets: [this.prompt, this.subPrompt], alpha: 0, duration: 200 });
    await this.wait(300);
    await this.shakeSequence();
    await this.reveal();
  }

  /** Phase 3: three shakes, each stronger; the glow hints the tier on the last. */
  async shakeSequence() {
    const intensities = [0.004, 0.009, 0.018];
    for (let i = 0; i < 3; i++) {
      const level = i + 1;
      Services.audio.play('shake', level);
      this.cameras.main.shake(260, intensities[i]);
      const glowColor = level === 3 ? this.tier.color : 0xffffff;
      this.glow.setTint(glowColor);
      this.tweens.add({ targets: this.glow, alpha: 0.25 + level * 0.18, scale: 1.4 + level * 0.35, duration: 200 });
      await this.tween({
        targets: this.box,
        angle: { from: -4 * level, to: 4 * level },
        x: { from: BOX_X - 6 * level, to: BOX_X + 6 * level },
        yoyo: true,
        repeat: 2,
        duration: 55
      });
      this.box.setAngle(0).setX(BOX_X);
      await this.wait(level === 3 ? 450 : 380);
    }
  }

  /** Phase 4: lid pops, burst in the tier colour, figure rises out of the box. */
  async reveal() {
    this.phase = 'reveal';
    this.skipBtn.setVisible(false);
    this.tweens.add({ targets: this.shadow, alpha: 0, duration: 400 });
    const tier = this.tier;
    const rarity = this.result.rarity;

    // Lid pops off
    this.boxImg.setTexture('box_open');
    const lid = this.add.image(this.box.x, this.box.y - 115, 'box_lid');
    this.tweens.add({ targets: lid, y: lid.y - 380, x: lid.x + 220, angle: 160, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => lid.destroy() });

    // Lighting
    const rgb = Phaser.Display.Color.IntegerToRGB(tier.glow);
    this.cameras.main.flash(rarity === 'secret' ? 600 : 300, rgb.r, rgb.g, rgb.b);
    Services.audio.play('reveal', rarity);
    this.rays.setTint(tier.color);
    this.tweens.add({ targets: this.rays, alpha: rarity === 'common' ? 0.35 : 0.8, scale: 1.6, duration: 600, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: this.rays, angle: 360, duration: 14000, repeat: -1 });
    this.glow.setTint(tier.color);
    this.tweens.add({ targets: this.glow, alpha: 0.9, scale: 3.2, duration: 500 });

    // Particle burst sized by rarity
    const counts = { common: 24, rare: 45, epic: 80, secret: 140 };
    const tints = {
      common: [0xd7dade, 0xffffff, 0x9aa0a6],
      rare: [0x3fa9f5, 0x9fd6ff, 0xffffff],
      epic: [0xa45cff, 0xd4b0ff, 0xff8fb1],
      secret: [0xffc93c, 0xfff1b8, 0xffffff, 0xffe066]
    };
    const burst = this.add.particles(0, 0, 'p_spark', {
      lifespan: { min: 600, max: 1300 },
      speed: { min: 150, max: rarity === 'secret' ? 650 : 450 },
      scale: { start: 1.2, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: tints[rarity],
      blendMode: 'ADD',
      emitting: false
    });
    burst.explode(counts[rarity], this.box.x, this.box.y - 100);

    if (rarity === 'secret' || rarity === 'epic') {
      // Confetti rain (gold for Secret Chase)
      const rain = this.add.particles(0, -20, 'p_confetti', {
        x: { min: 0, max: WIDTH },
        lifespan: 3200,
        speedY: { min: 160, max: 320 },
        speedX: { min: -60, max: 60 },
        rotate: { start: 0, end: 540 },
        tint: rarity === 'secret' ? [0xffc93c, 0xfff1b8, 0xffe066, 0xffffff] : [0xa45cff, 0xff8fb1, 0x8fe3c6, 0xffffff],
        frequency: 18,
        quantity: 2
      });
      this.time.delayedCall(rarity === 'secret' ? 3000 : 1500, () => rain.stop());
    }

    // Figure rises
    this.figure = this.add.image(this.box.x, this.box.y - 60, 'reveal_art').setScale(0.25).setAlpha(0);
    this.tweens.add({ targets: this.box, y: BOX_Y + 260, alpha: 0, duration: 700, delay: 250, ease: 'Cubic.easeIn' });
    await this.tween({ targets: this.figure, y: 360, scale: 1.25, alpha: 1, duration: 750, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.figure, y: 345, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    if (rarity === 'secret') {
      const banner = outlinedText(this, WIDTH / 2, 90, '★ SECRET CHASE ★', 52, '#ffc93c').setScale(0);
      this.banner = banner;
      this.tweens.add({ targets: banner, scale: 1, duration: 500, ease: 'Back.easeOut' });
      this.tweens.add({ targets: banner, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 400 });
      this.cameras.main.shake(400, 0.01);
    }

    Services.bus.emit(EVENTS.BOX_OPENED, { itemId: this.result.itemId, rarity, isNew: this.result.isNew, source: this.source });
    await this.wait(rarity === 'secret' ? 1200 : 500);
    this.showCard();
  }

  /** Phase 5: stats card and the two decision buttons. */
  showCard() {
    this.phase = 'card';
    const { item, isNew, refund, pityTriggered } = this.result;
    const tier = this.tier;

    // Slide the figure left to make room for the card.
    const slideLeft = [this.figure, this.rays, this.glow, this.spot, this.banner].filter(Boolean);
    this.tweens.add({ targets: slideLeft, x: (WIDTH - 580) / 2 + 30, duration: 450, ease: 'Cubic.easeInOut' });

    const card = this.add.container(WIDTH + 400, 0);
    const x0 = 0;
    const panel = makePanel(this, x0, 90, 520, 560, { radius: 26 });
    const ribbon = this.add.graphics();
    ribbon.fillStyle(tier.color, 1).fillRoundedRect(x0 + 20, 110, 480, 54, 18);
    ribbon.lineStyle(3, COLORS.panelDark, 1).strokeRoundedRect(x0 + 20, 110, 480, 54, 18);
    card.add([panel, ribbon]);
    card.add(outlinedText(this, x0 + 260, 137, tier.label.toUpperCase(), 30, '#ffffff'));
    card.add(this.add.text(x0 + 260, 200, item.name, textStyle(34, COLORS.text, { align: 'center', wordWrap: { width: 470 } })).setOrigin(0.5));
    card.add(this.add.text(x0 + 260, 240, `${SERIES_NAME} · ${SLOT_LABEL[item.slot]}`, textStyle(17, '#8a7a9a')).setOrigin(0.5));
    card.add(this.add.text(x0 + 40, 270, item.description, textStyle(20, '#5a4a6a', { wordWrap: { width: 440 }, fontStyle: 'normal', lineSpacing: 4 })));

    const perkLines = describePerks(item.perks);
    card.add(this.add.text(x0 + 40, 372, 'Perks', textStyle(22, COLORS.text)));
    card.add(this.add.text(x0 + 40, 402, perkLines.map((l) => `• ${l}`).join('\n'), textStyle(19, '#3fa98a', { lineSpacing: 6, wordWrap: { width: 440 } })));

    const status = isNew
      ? 'NEW! Added to your collection'
      : `Duplicate · converted to +${refund.coins} coins${refund.keys ? ` & +${refund.keys} golden key${refund.keys > 1 ? 's' : ''}` : ''}`;
    card.add(this.add.text(x0 + 260, 480, status, textStyle(19, isNew ? '#e0567f' : '#c98a00', { align: 'center', wordWrap: { width: 470 } })).setOrigin(0.5));
    if (pityTriggered) card.add(this.add.text(x0 + 260, 508, `Pity guarantee: ${pityTriggered === 'secret' ? 'Secret Chase' : 'Epic+'}`, textStyle(16, '#8a7a9a')).setOrigin(0.5));

    const equipBtn = makeButton(this, x0 + 140, 590, 'Equip Now', () => this.equipNow(), { w: 220, h: 66, fontSize: 26, color: COLORS.gold, colorDark: COLORS.goldDark });
    const storeBtn = makeButton(this, x0 + 385, 590, 'Store', () => this.leave('MainMenu'), { w: 220, h: 66, fontSize: 26, color: COLORS.mint, colorDark: 0x4fb594 });
    card.add([equipBtn, storeBtn]);
    card.add(this.add.text(x0 + 385, 632, 'in Collection', textStyle(15, '#8a7a9a')).setOrigin(0.5));

    const tickets = Services.save.data.currencies.blindBoxTickets;
    if (tickets > 0) {
      card.add(
        makeButton(this, x0 + 260, 690, `Open another (${tickets} left)`, () => this.scene.restart({ source: 'ticket' }), {
          w: 340,
          h: 50,
          fontSize: 20,
          icon: 'ticket',
          iconScale: 0.45
        })
      );
    }
    this.tweens.add({ targets: card, x: WIDTH - 580, duration: 500, ease: 'Back.easeOut' });
  }

  equipNow() {
    const { item } = this.result;
    if (Services.save.equip(item.slot, item.id)) {
      bakePlayerTextures(this, Services.save.data.equipped);
      Services.bus.emit('ui:toast', { text: `${item.name} equipped!`, color: COLORS.gold });
    }
    this.leave('Showroom');
  }

  leave(key) {
    this.input.enabled = false;
    this.cameras.main.fadeOut(220, 20, 12, 30);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
  }

  /** Fast-forward: jumps straight to the reveal (the result is already saved). */
  skip() {
    if (this.phase === 'drop' || this.phase === 'tear') {
      this.tweens.killTweensOf(this.box);
      this.box.setPosition(BOX_X, BOX_Y);
      this.hint?.destroy();
      this.tweens.killTweensOf([this.prompt, this.subPrompt]);
      this.prompt.setAlpha(0);
      this.subPrompt.setAlpha(0);
      this.foil.setVisible(false);
      this.phase = 'reveal';
      this.time.removeAllEvents();
      this.reveal();
    }
  }
}
