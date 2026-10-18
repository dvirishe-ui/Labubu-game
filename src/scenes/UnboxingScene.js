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
import { RARITY_TIERS, SERIES_NAME, PACKS, describePerks } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { chooseCost, pullBlindBox } from '../systems/GachaSystem.js';
import { bakeCharacterFrame, bakePlayerTextures, previewLoadoutFor } from '../art/CharacterRenderer.js';
import { CurrencyBar, makeButton, makePanel, outlinedText, textStyle } from '../ui/UIKit.js';
import { uiImage, buttonKey, shineKey } from '../ui/Skin.js';

/** Legacy `source` values still used by quests: ticket -> Classic, key -> Sparkle. */
const LEGACY_SOURCE = { ticket: ['classic', 'blindBoxTickets'], key: ['sparkle', 'goldenKeys'] };
const RIBBON_SKIN = { common: 'gray', rare: 'green', epic: 'purple', legendary: 'yellow', secret: 'pink' };

const FOIL_W = 196; // foil texture width
const FOIL_SCALE = 0.77; // scaled to span the box's front-top edge
const FOIL_Y = -62; // relative to the box centre

const SLOT_LABEL = { doll: 'Figure', outfit: 'Outfit', headwear: 'Headwear', tail: 'Tail', shoes: 'Shoes' };

export class UnboxingScene extends Phaser.Scene {
  constructor() {
    super('Unboxing');
  }

  init(data) {
    const legacy = LEGACY_SOURCE[data?.source];
    this.packId = data?.packId || legacy?.[0] || 'classic';
    this.currency = data?.currency || legacy?.[1] || null;
    this.source = this.packId;
    this.phase = 'drop';
    this.tearProgress = 0;
    this.lastTearSfx = 0;
  }

  create() {
    // Roll first: the outcome is committed before the show starts.
    this.result = pullBlindBox(Services.save, this.packId, this.currency);
    if (!this.result.ok) {
      Services.bus.emit('ui:toast', { text: 'Not enough to open this box', sub: 'Get more in the Shop', color: COLORS.pink });
      this.scene.start('Shop', { tab: 'boxes' });
      return;
    }
    this.tier = RARITY_TIERS[this.result.rarity];

    const equippedDoll = Services.save.data.equipped.baseDoll;
    bakeCharacterFrame(this, 'reveal_art', previewLoadoutFor(this.result.itemId, equippedDoll), 'wave', 2);

    Services.audio.stopMusic();
    this.portrait = HEIGHT > WIDTH;
    this.BX = WIDTH / 2;
    this.BY = this.portrait ? Math.round(HEIGHT * 0.42) : 400;
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
    this.add.image(0, 0, 'sky3d').setOrigin(0).setDisplaySize(WIDTH, HEIGHT).setTint(0x6b4f8a);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x1a1024, 0.72);
    // Spotlight
    this.spot = this.add.image(this.BX, this.BY, 'fx_glow').setScale(3.2).setAlpha(0.25).setTint(0xffe3ec);
    this.shadow = this.add.ellipse(this.BX, this.BY + 140, 300, 50, 0x000000, 0.35);

    this.rays = this.add.image(this.BX, this.BY - 40, 'fx_rays').setAlpha(0).setScale(0.4).setBlendMode(Phaser.BlendModes.ADD);
    this.glow = this.add.image(this.BX, this.BY - 20, 'fx_glow').setAlpha(0).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD);

    // The box is a container: body + foil strip so they shake together.
    this.box = this.add.container(this.BX, -260);
    this.boxImg = this.add.image(0, 0, `box_closed_${this.packId}`);
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
    await this.tween({ targets: this.box, y: this.BY, duration: 900, ease: 'Bounce.easeOut' });
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
    this.hint = outlinedText(this, this.BX - 90, this.BY + FOIL_Y - 46, '➜', 54, '#ff8fb1');
    this.tweens.add({ targets: this.hint, x: this.BX + 60, duration: 900, repeat: -1, ease: 'Sine.easeInOut', repeatDelay: 300 });

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
    this.input.keyboard?.on('keydown-SPACE', () => this.phase === 'tear' && this.advanceTear(0.25, this.BX, this.BY + FOIL_Y));
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
        x: { from: this.BX - 6 * level, to: this.BX + 6 * level },
        yoyo: true,
        repeat: 2,
        duration: 55
      });
      this.box.setAngle(0).setX(this.BX);
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
    this.boxImg.setTexture(`box_open_${this.packId}`);
    const lid = this.add.image(this.box.x, this.box.y - 115, `box_lid_${this.packId}`);
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
    const counts = { common: 24, rare: 45, epic: 80, legendary: 110, secret: 150 };
    const tints = {
      common: [0xd7dade, 0xffffff, 0x9aa0a6],
      rare: [0x3ecf6b, 0xb8ffd0, 0xffffff],
      epic: [0xa45cff, 0xd4b0ff, 0xff8fb1],
      legendary: [0xffc93c, 0xfff1b8, 0xffffff, 0xffe066],
      secret: [0xff4fa3, 0xffd23f, 0x6ee7a8, 0x59b8ff, 0xb07cff, 0xffffff]
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

    const big = tier.rank >= RARITY_TIERS.epic.rank;
    if (big) {
      // Confetti rain (gold for Secret Chase)
      const rain = this.add.particles(0, -20, 'p_confetti', {
        x: { min: 0, max: WIDTH },
        lifespan: 3200,
        speedY: { min: 160, max: 320 },
        speedX: { min: -60, max: 60 },
        rotate: { start: 0, end: 540 },
        tint: tints[rarity],
        frequency: 18,
        quantity: 2
      });
      this.time.delayedCall(tier.rank >= 3 ? 3000 : 1500, () => rain.stop());
    }

    // Figure rises
    this.figure = this.add.image(this.box.x, this.box.y - 60, 'reveal_art').setScale(0.25).setAlpha(0);
    this.tweens.add({ targets: this.box, y: this.BY + 260, alpha: 0, duration: 700, delay: 250, ease: 'Cubic.easeIn' });
    const figY = this.portrait ? this.BY - 30 : 360;
    await this.tween({ targets: this.figure, y: figY, scale: 1.25, alpha: 1, duration: 750, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.figure, y: figY - 15, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    if (tier.rank >= RARITY_TIERS.legendary.rank) {
      const text = rarity === 'secret' ? '★ MYSTERY LABUBU ★' : '★ LEGENDARY ★';
      const banner = outlinedText(this, WIDTH / 2, this.portrait ? 150 : 90, text, Math.min(52, WIDTH / 13), rarity === 'secret' ? '#ff8fd0' : '#ffc93c').setScale(0);
      this.banner = banner;
      this.tweens.add({ targets: banner, scale: 1, duration: 500, ease: 'Back.easeOut' });
      this.tweens.add({ targets: banner, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 400 });
      this.cameras.main.shake(400, 0.01);
    }

    Services.bus.emit(EVENTS.BOX_OPENED, { itemId: this.result.itemId, rarity, isNew: this.result.isNew, source: this.source });
    await this.wait(tier.rank >= 3 ? 1200 : 500);
    this.showCard();
  }

  /** Phase 5: stats card and the two decision buttons. */
  showCard() {
    this.phase = 'card';
    const { item, isNew, refund, pityTriggered } = this.result;
    const tier = this.tier;

    // Slide the figure left to make room for the card.
    const slideLeft = [this.figure, this.rays, this.glow, this.spot, this.banner].filter(Boolean);
    let cardX = WIDTH - 580;
    let cardY = 0;
    if (this.portrait) {
      // Portrait: figure moves up, card slides in underneath.
      const topY = Math.round(HEIGHT * 0.25);
      this.tweens.killTweensOf(this.figure);
      this.tweens.add({ targets: [this.figure, this.rays, this.glow, this.spot], y: topY, duration: 450, ease: 'Cubic.easeInOut' });
      this.tweens.add({ targets: this.figure, scale: 0.95, duration: 450 });
      cardX = (WIDTH - 520) / 2;
      cardY = Math.round(HEIGHT * 0.43) - 90;
    } else {
      this.tweens.add({ targets: slideLeft, x: (WIDTH - 580) / 2 + 30, duration: 450, ease: 'Cubic.easeInOut' });
    }

    const card = this.add.container(WIDTH + 400, cardY);
    const x0 = 0;
    const panel = makePanel(this, x0, 90, 520, 560, { radius: 26, header: tier.color, headerH: 74 });
    card.add(panel);
    card.add(outlinedText(this, x0 + 260, 127, tier.label.toUpperCase(), 38, '#ffffff'));
    card.add(this.add.text(x0 + 260, 196, item.name, textStyle(34, COLORS.text, { align: 'center', wordWrap: { width: 470 } })).setOrigin(0.5));
    card.add(this.add.text(x0 + 260, 234, `${SERIES_NAME} · ${SLOT_LABEL[item.slot]}`, textStyle(17, '#8a7a9a')).setOrigin(0.5));
    card.add(this.add.text(x0 + 40, 258, item.description, textStyle(19, '#5a4a6a', { wordWrap: { width: 440 }, lineSpacing: 4 })));

    // Skins carry a run multiplier - show it big, like a power stat.
    let perkY = 352;
    if (item.slot === 'doll' && tier.multiplier > 1) {
      card.add(uiImage(this, x0 + 130 - 6, 336 - 4, buttonKey(this, 260, 48, RIBBON_SKIN[item.rarity], false)));
      card.add(outlinedText(this, x0 + 260, 358, `x${tier.multiplier} SCORE & COINS`, 24));
      perkY = 400;
    }
    const perkLines = describePerks(item.perks);
    card.add(this.add.text(x0 + 40, perkY, perkLines.map((l) => `• ${l}`).join('\n'), textStyle(19, '#2f9a7a', { lineSpacing: 6, wordWrap: { width: 440 } })));

    const extras = [refund.coins && `+${refund.coins} coins`, refund.gems && `+${refund.gems} gems`, refund.keys && `+${refund.keys} key${refund.keys > 1 ? 's' : ''}`].filter(Boolean);
    const status = isNew ? 'NEW! Added to your collection' : `Duplicate · converted to ${extras.join(' & ')}`;
    card.add(this.add.text(x0 + 260, 494, status, textStyle(19, isNew ? '#e0567f' : '#c98a00', { align: 'center', wordWrap: { width: 470 } })).setOrigin(0.5));
    if (pityTriggered) {
      const name = { epic: 'Epic+', legendary: 'Legendary+', secret: 'Mystery' }[pityTriggered];
      card.add(this.add.text(x0 + 260, 520, `Pity guarantee: ${name}`, textStyle(16, '#8a7a9a')).setOrigin(0.5));
    }

    // Shine sweep across the card for Epic and better
    if (tier.rank >= RARITY_TIERS.epic.rank) {
      const shine = uiImage(this, x0 + 10, 96, shineKey(this)).setAlpha(0);
      shine.setDisplaySize(44, 548);
      card.add(shine);
      const sweep = { delay: 700, repeat: -1, repeatDelay: 1800 };
      this.tweens.add({ targets: shine, x: x0 + 466, duration: 1000, ease: 'Sine.easeInOut', ...sweep });
      this.tweens.add({ targets: shine, alpha: 0.55, duration: 500, yoyo: true, ...sweep, repeatDelay: 1800 });
    }

    const equipBtn = makeButton(this, x0 + 140, 590, 'Equip Now', () => this.equipNow(), { w: 220, h: 66, fontSize: 26, skin: 'yellow' });
    const storeBtn = makeButton(this, x0 + 385, 590, 'Store', () => this.leave('MainMenu'), { w: 220, h: 66, fontSize: 26, skin: 'green' });
    card.add([equipBtn, storeBtn]);

    // Same box again, if the player can still pay for it.
    const again = chooseCost(Services.save, this.packId, this.currency) || chooseCost(Services.save, this.packId);
    if (again) {
      const icon = { blindBoxTickets: 'ticket', goldenKeys: 'key', gems: 'gem', popCoins: 'coin' }[again.currency];
      card.add(
        makeButton(this, x0 + 260, 682, `Open another  ${again.amount}`, () => this.scene.restart({ packId: this.packId, currency: again.currency }), {
          w: 340,
          h: 54,
          fontSize: 22,
          skin: 'pink',
          icon,
          iconScale: 0.5
        })
      );
    }
    this.tweens.add({ targets: card, x: cardX, duration: 500, ease: 'Back.easeOut' });
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
      this.box.setPosition(this.BX, this.BY);
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
