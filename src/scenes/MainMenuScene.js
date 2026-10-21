/**
 * MainMenuScene.js
 * The hub: character on a pedestal, PLAY, blind box counter, the idle Pop Bank,
 * quests, leaderboard, settings and the sync status pill. Also shows the
 * "Welcome Back!" offline-earnings dialog once per app session.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS, EVENTS, LUCKY_SPIN } from '../config/GameConfig.js';
import { CATALOG, packSplit } from '../config/GachaDropTable.js';
import { getQuestTemplate, REWARD_LABELS } from '../config/QuestCatalog.js';
import { Services } from '../systems/Services.js';
import { IdleRewardManager } from '../systems/IdleRewardManager.js';
import { msUntilMidnight } from '../systems/QuestManager.js';
import { chooseCost, pityStatus } from '../systems/GachaSystem.js';
import { addXp, levelInfo, claimableCount as passClaimable } from '../systems/Progression.js';
import { XP } from '../config/ProgressionConfig.js';
import { showRewardedAd } from '../systems/AdService.js';
import { bakePlayerTextures, ICON_RES } from '../art/CharacterRenderer.js';
import { askText } from '../ui/TextPrompt.js';
import { exportSaveCode, importSaveCode } from '../systems/SaveCode.js';
import { canFullscreen, toggleFullscreen } from '../ui/Fullscreen.js';
import { canSpin, spinWheel } from '../systems/DailyRewards.js';
import {
  addForestBackdrop,
  CurrencyBar,
  makeButton,
  makeIconButton,
  makePanel,
  makeProgressBar,
  Modal,
  ScrollList,
  outlinedText,
  textStyle,
  displayStyle,
  floatText,
  flyCoins
} from '../ui/UIKit.js';

const REWARD_ICON = { popCoins: 'coin', blindBoxTickets: 'ticket', goldenKeys: 'key', gems: 'gem' };

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    const save = Services.save;
    Services.quests.refreshIfNeeded();
    Services.audio.playMusic('menu');

    addForestBackdrop(this);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffe3ec, 0.18);

    this.L = this.computeLayout();
    this.currencyBar = new CurrencyBar(this, 20, 16);

    this.buildTopRight();
    this.buildCharacter();
    this.buildCenter();
    this.buildBoxPanel();
    this.buildIdleBank();

    // Live refresh when the save changes (claims, cloud restore...).
    const bus = Services.bus;
    bus.on(EVENTS.SAVE_CHANGED, this.refresh, this);
    bus.on(EVENTS.SAVE_REPLACED, this.onSaveReplaced, this);
    bus.on(EVENTS.SYNC_STATUS, this.updateSyncPill, this);
    this.events.once('shutdown', () => bus.offContext(this));

    this.refresh();
    this.updateSyncPill({ status: Services.sync.status, adapter: Services.sync.adapter.kind });

    // Welcome Back dialog: once per launch, after time away.
    if (!Services.welcomeBackShown) {
      Services.welcomeBackShown = true;
      if (Services.idle.shouldShowWelcomeBack()) this.time.delayedCall(400, () => this.showWelcomeBack());
    }
    this.cameras.main.fadeIn(250, 43, 29, 58);
  }

  // -------------------------------------------------------------------------- layout

  /**
   * Layout for the current orientation. Landscape: hero | centre column |
   * panels. Portrait: logo, hero with side buttons, PLAY, and the two panels
   * side by side at the bottom - everything anchored so it fits 9:16 to 9:20.
   */
  computeLayout() {
    const portrait = HEIGHT > WIDTH;
    if (!portrait) {
      const extra = WIDTH - 1280;
      const heroX = 230 + extra * 0.25;
      const cx = 590 + extra * 0.6;
      return {
        portrait,
        iconsY: 39,
        syncX: null,
        hero: { x: heroX, feet: 590, scale: 1.25 },
        heroName: [heroX, 632],
        showroom: [heroX, 684, 210],
        spin: [cx + 125, 490],
        logo: [cx, 130, 92],
        subtitle: [cx, 200],
        play: [cx, 320],
        best: [cx, 410],
        quests: [cx - 125, 490],
        shop: [cx + 125, 572],
        pass: [cx - 125, 572],
        arcade: [cx, 642],
        level: [120, 96],
        collection: [cx, 700],
        box: { x: WIDTH - 400, y: 90, s: 1 },
        bank: { x: WIDTH - 400, y: 430, s: 1 }
      };
    }
    const H = HEIGHT;
    const panelS = 0.88;
    const panelsY = H - 290;
    const feet = panelsY - 330;
    return {
      portrait,
      iconsY: 100,
      syncX: 110,
      hero: { x: WIDTH / 2, feet, scale: Math.min(1.15, (feet - 290) / 352) },
      heroName: [WIDTH / 2, feet + 30],
      showroom: [WIDTH - 110, feet - 150, 180],
      spin: [110, feet - 150],
      shop: [WIDTH - 110, feet - 72],
      pass: [110, feet - 72],
      arcade: [WIDTH - 110, feet - 228],
      level: [258, 100],
      logo: [WIDTH / 2, 190, 84],
      subtitle: [WIDTH / 2, 252],
      play: [WIDTH / 2, panelsY - 225],
      best: [WIDTH / 2, panelsY - 152],
      quests: [WIDTH / 2, panelsY - 88],
      collection: [WIDTH / 2, panelsY - 34],
      box: { x: 12, y: panelsY, s: panelS },
      bank: { x: WIDTH - 12 - 370 * panelS, y: panelsY + 22, s: panelS }
    };
  }

  buildTopRight() {
    const L = this.L;
    const fs = canFullscreen();
    const right = WIDTH - (fs ? 50 : 120);
    const y = L.iconsY;
    // Sync status pill
    this.syncPill = this.add.container(L.syncX ?? right - 335, y);
    this.syncPillBg = this.add.graphics();
    this.syncDot = this.add.circle(-62, 0, 8, 0x9aa0a6);
    this.syncText = this.add.text(-48, 0, '', textStyle(18, '#ffffff', { stroke: '#3d2a52', strokeThickness: 3 })).setOrigin(0, 0.5);
    this.syncPill.add([this.syncPillBg, this.syncDot, this.syncText]);
    this.syncPillBg.fillStyle(0x000000, 0.28).fillRoundedRect(-80, -20, 170, 40, 20);
    this.syncPill.setSize(170, 40).setInteractive({ useHandCursor: true });
    this.syncPill.on('pointerup', () => Services.sync.syncNow({ force: true }));

    makeIconButton(this, right - 210, y, '♛', () => this.showLeaderboard(), { size: 54 });
    this.muteBtn = makeIconButton(this, right - 140, y, '♪', () => this.toggleSound(), { size: 54 });
    makeIconButton(this, right - 70, y, '≡', () => this.showSettings(), { size: 54 });
    if (fs) {
      // True fullscreen (Android / desktop; hidden where unsupported)
      const btn = makeIconButton(this, right, y, '', () => toggleFullscreen(), { size: 54 });
      const g = this.add.graphics();
      g.lineStyle(4, COLORS.panelDark, 1);
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ]) {
        g.beginPath();
        g.moveTo(sx * 12, sy * 4);
        g.lineTo(sx * 12, sy * 12);
        g.lineTo(sx * 4, sy * 12);
        g.strokePath();
      }
      btn.add(g);
    }
    this.updateMuteIcon();
  }

  buildCharacter() {
    const { x, feet, scale } = this.L.hero;
    this.add.image(x, feet - 5, 'pedestal').setScale(scale / 1.25);
    this.hero = this.add.image(x, feet, 'player_preview').setOrigin(0.5, 1).setScale(scale);
    this.tweens.add({ targets: this.hero, scaleY: scale * 1.03, scaleX: scale * 0.98, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hero.setInteractive({ useHandCursor: true });
    this.hero.on('pointerup', () => {
      Services.audio.play('jump');
      this.hero.setTexture('player_wave');
      this.tweens.add({ targets: this.hero, y: feet - 30, duration: 160, yoyo: true, ease: 'Quad.easeOut', onComplete: () => this.hero.setTexture('player_preview') });
    });
    this.heroName = outlinedText(this, ...this.L.heroName, '', 22, '#fff4e6');
    const [sx, sy, sw] = this.L.showroom;
    makeButton(this, sx, sy, 'Showroom', () => this.go('Showroom'), { w: sw, h: 56, fontSize: 24, color: COLORS.mint, colorDark: 0x4fb594 });
  }

  buildCenter() {
    const L = this.L;
    const logo = outlinedText(this, L.logo[0], L.logo[1], 'LABUBU', L.logo[2], '#ff8fb1');
    outlinedText(this, ...L.subtitle, 'Blind Box Run & Collect', 30, '#fff4e6');
    this.tweens.add({ targets: logo, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });

    this.playBtn = makeButton(this, ...L.play, 'PLAY', () => this.go('Runner'), { w: 320, h: 108, fontSize: 56, color: COLORS.gold, colorDark: COLORS.goldDark });
    this.tweens.add({ targets: this.playBtn, scale: 1.06, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut' });
    this.bestText = outlinedText(this, ...L.best, '', 26, '#fff4e6');

    this.questBtn = makeButton(this, ...L.quests, 'Quests', () => this.showQuests(), { w: 230, h: 66, fontSize: 28, color: COLORS.rare, colorDark: 0x2b7bc0 });
    this.questBadge = this.add.container(L.quests[0] + 105, L.quests[1] - 28);
    this.questBadge.add(this.add.circle(0, 0, 17, 0xe8324b).setStrokeStyle(3, 0xffffff));
    this.questBadgeText = this.add.text(0, 0, '0', textStyle(18, '#ffffff')).setOrigin(0.5);
    this.questBadge.add(this.questBadgeText);
    this.tweens.add({ targets: this.questBadge, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });

    // Daily Lucky Spin
    this.spinBtn = makeButton(this, ...L.spin, 'Lucky Spin', () => this.showLuckySpin(), { w: 200, h: 62, fontSize: 24, color: COLORS.pink, colorDark: COLORS.pinkDark });
    this.spinBadge = this.add.container(L.spin[0] + 92, L.spin[1] - 26);
    this.spinBadge.add([this.add.circle(0, 0, 15, 0xe8324b).setStrokeStyle(3, 0xffffff), this.add.text(0, 0, '!', textStyle(18, '#ffffff')).setOrigin(0.5)]);
    this.tweens.add({ targets: this.spinBadge, scale: 1.25, yoyo: true, repeat: -1, duration: 420 });

    this.collectionText = this.add.text(...L.collection, '', textStyle(20, '#fff4e6', { stroke: '#3d2a52', strokeThickness: 4 })).setOrigin(0.5);

    // Shop: skins, boxes, deals and gems
    const [shx, shy] = L.shop;
    this.shopBtn = makeButton(this, shx, shy, 'SHOP', () => this.go('Shop'), { w: L.portrait ? 180 : 210, h: 64, fontSize: 30, skin: 'purple', icon: 'gem', iconScale: 0.75 });
    this.tweens.add({ targets: this.shopBtn, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });

    // Labubu Pass (season pass) with a "rewards ready" badge
    const [px, py] = L.pass;
    this.passBtn = makeButton(this, px, py, 'PASS', () => this.go('Pass'), { w: L.portrait ? 180 : 210, h: 64, fontSize: 30, skin: 'orange', icon: 'pw_score', iconScale: 0.6 });
    this.passBadge = this.add.container(px + (L.portrait ? 82 : 96), py - 28);
    this.passBadgeText = this.add.text(0, 0, '0', textStyle(18, '#ffffff')).setOrigin(0.5);
    this.passBadge.add([this.add.circle(0, 0, 17, 0xe8324b).setStrokeStyle(3, 0xffffff), this.passBadgeText]);
    this.tweens.add({ targets: this.passBadge, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });

    // Arcade: mini-games with exclusive prizes
    const [ax, ay] = L.arcade;
    this.arcadeBtn = makeButton(this, ax, ay, 'ARCADE', () => this.go('Arcade'), { w: L.portrait ? 180 : 210, h: 58, fontSize: 26, skin: 'blue', icon: 'key', iconScale: 0.6 });
    this.tweens.add({ targets: this.arcadeBtn, scale: 1.05, yoyo: true, repeat: -1, duration: 750, ease: 'Sine.easeInOut' });

    // Player level chip (tap = pass)
    const [lx, ly] = L.level;
    this.levelChip = this.add.container(lx, ly);
    const chipBg = this.add.graphics();
    chipBg.fillStyle(0x2d1b3d, 0.55).fillRoundedRect(-30, -20, 190, 40, 20);
    this.levelBar = makeProgressBar(this, 22, -8, 126, 16, { fill: 0xb07cff });
    this.levelNum = outlinedText(this, -14, 0, '1', 24);
    this.levelChip.add([chipBg, this.levelBar.graphics, this.add.circle(-14, 0, 24, 0x8a4dff).setStrokeStyle(4, 0xffffff), this.levelNum]);
    this.levelChip.setSize(190, 44).setInteractive({ useHandCursor: true });
    this.levelChip.on('pointerup', () => this.go('Pass'));
  }

  buildBoxPanel() {
    const { x: px, y: py, s } = this.L.box;
    const c = this.add.container(px, py).setScale(s);
    this.boxPanel = c;
    const w = 370;
    const h = 320;
    c.add(makePanel(this, 0, 0, w, h, { header: 0xff4f9a, headerH: 54 }));
    c.add(outlinedText(this, w / 2, 28, 'Blind Box', 30));
    const glow = this.add.image(95, 140, 'fx_glow').setScale(0.9).setTint(0xff8fb1).setAlpha(0.5);
    this.boxImg = this.add.image(95, 140, 'box_icon_classic').setScale(1.15);
    c.add([glow, this.boxImg]);
    this.tweens.add({ targets: this.boxImg, y: 130, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    const split = packSplit('classic');
    c.add(this.add.text(95, 228, `Mystery ${split.mystery}%`, displayStyle(18, '#e0337f')).setOrigin(0.5));
    this.pityText = this.add.text(95, 262, '', textStyle(14, '#7a6a8a', { align: 'center' })).setOrigin(0.5);
    c.add(this.pityText);

    this.openBtn = makeButton(this, 268, 98, 'Open', () => this.openBox('classic'), { w: 170, h: 60, fontSize: 26, icon: 'ticket', iconScale: 0.55, skin: 'yellow' });
    this.keyBtn = makeButton(this, 268, 176, 'Sparkle', () => this.openBox('sparkle', 'goldenKeys'), { w: 170, h: 56, fontSize: 22, icon: 'key', iconScale: 0.55, skin: 'blue' });
    this.boxShopBtn = makeButton(this, 268, 262, 'All Boxes', () => this.go('Shop', { tab: 'boxes' }), { w: 170, h: 56, fontSize: 21, skin: 'pink' });
    c.add([this.openBtn, this.keyBtn, this.boxShopBtn]);
  }

  buildIdleBank() {
    const { x: px, y: py, s } = this.L.bank;
    const c = this.add.container(px, py).setScale(s);
    this.bankPanel = c;
    const w = 370;
    const h = 270;
    c.add(makePanel(this, 0, 0, w, h, { header: 0xffa000, headerH: 54 }));
    c.add(outlinedText(this, w / 2, 28, 'Pop Bank', 30));
    this.bankCoinIcon = this.add.image(60, 92, 'coin').setScale(1.3);
    this.tweens.add({ targets: this.bankCoinIcon, scaleX: { from: 1.3, to: -1.3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.bankAmount = this.add.text(100, 80, '0', textStyle(42, '#c98a00', { stroke: '#3d2a52', strokeThickness: 5 })).setOrigin(0, 0.5);
    this.bankRate = this.add.text(100, 116, '', textStyle(16, '#7a6a8a'));
    this.bankBar = makeProgressBar(this, 30, 150, w - 60, 20, { fill: COLORS.gold });
    this.bankCap = this.add.text(w / 2, 184, '', textStyle(15, '#7a6a8a')).setOrigin(0.5);
    this.collectBtn = makeButton(this, w / 2, 230, 'Collect', () => this.collectIdle(1), {
      w: 220,
      h: 56,
      fontSize: 26,
      color: COLORS.gold,
      colorDark: COLORS.goldDark
    });
    c.add([this.bankCoinIcon, this.bankAmount, this.bankRate, this.bankBar.graphics, this.bankCap, this.collectBtn]);
    // The bank ticks up live.
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.updateIdleBank() });
    this.updateIdleBank();
  }

  /** World position of a point inside a scaled panel container. */
  panelPoint(c, x, y) {
    return { x: c.x + x * c.scaleX, y: c.y + y * c.scaleY };
  }

  // -------------------------------------------------------------------------- refresh

  refresh() {
    const d = Services.save.data;
    this.heroName.setText(CATALOG[d.equipped.baseDoll]?.name || 'Labubu');
    this.bestText.setText(`Best score: ${d.stats.highScore.toLocaleString('en-US')}`);
    this.spinBadge.setVisible(canSpin(Services.save));
    // Pay with a ticket when you have one, otherwise with coins.
    const cost = chooseCost(Services.save, 'classic');
    const coins = cost?.currency === 'popCoins';
    this.openBtn.setIcon(coins ? 'coin' : 'ticket').setLabel(coins ? `${cost.amount}` : 'Open');
    this.openBtn.setEnabled(Boolean(cost));
    this.keyBtn.setVisible(d.currencies.goldenKeys > 0);
    const pity = pityStatus(Services.save, 'classic');
    this.pityText.setText(`Epic+ within ${pity.epic}\nLegendary within ${pity.legendary}`);
    const claimable = Services.quests.claimableCount();
    this.questBadge.setVisible(claimable > 0);
    this.questBadgeText.setText(String(claimable));
    const lv = levelInfo(d.progress.xp);
    this.levelNum.setText(String(lv.level));
    this.levelBar.set(lv.into / lv.need);
    const passReady = passClaimable(Services.save);
    this.passBadge.setVisible(passReady > 0);
    this.passBadgeText.setText(String(passReady));
    const owned = d.inventory.length;
    this.collectionText.setText(`Collection ${owned}/${Object.keys(CATALOG).length} · Idle x${Services.idle.getTotalMultiplier().toFixed(2)}`);
  }

  onSaveReplaced() {
    // A newer cloud save may have a different outfit - re-bake the hero.
    bakePlayerTextures(this, Services.save.data.equipped);
    this.hero.setTexture('player_preview');
    this.refresh();
  }

  updateIdleBank() {
    const idle = Services.idle;
    const pending = idle.getPending();
    this.bankAmount.setText(pending.coins.toLocaleString('en-US'));
    const perHour = Math.round(idle.getRatePerSecond() * 3600);
    this.bankRate.setText(`+${perHour}/hour · x${idle.getTotalMultiplier().toFixed(2)} multiplier`);
    const ratio = idle.getFillRatio();
    this.bankBar.set(ratio);
    this.bankCap.setText(pending.capped ? 'Bank full! Collect to keep earning' : `Fills in ${IdleRewardManager.formatDuration((1 - ratio) * 8 * 3600)}`);
    this.collectBtn.setEnabled(pending.coins > 0);
  }

  updateSyncPill({ status, adapter } = {}) {
    if (!this.syncText) return;
    const map = {
      synced: ['Cloud saved ☁', 0x4cd964],
      pending: ['Sync pending', 0xffc93c],
      syncing: ['Syncing…', 0x3fa9f5],
      offline: ['Offline', 0x9aa0a6],
      local: ['Local save', 0x9aa0a6],
      error: ['Sync retry', 0xe8324b],
      idle: ['Local save', 0x9aa0a6]
    };
    const [label, color] = map[status] || map.idle;
    this.syncText.setText(adapter === 'none' ? 'Local save' : label);
    this.syncDot.setFillStyle(adapter === 'none' ? 0x9aa0a6 : color);
    this.tweens.killTweensOf(this.syncDot);
    this.syncDot.setScale(1);
    if (status === 'syncing') this.tweens.add({ targets: this.syncDot, scale: 1.5, yoyo: true, repeat: -1, duration: 300 });
  }

  // -------------------------------------------------------------------------- actions

  go(sceneKey, data) {
    this.input.enabled = false;
    this.cameras.main.fadeOut(200, 43, 29, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey, data));
  }

  openBox(packId, currency = null) {
    const cost = chooseCost(Services.save, packId, currency);
    if (!cost) {
      Services.audio.play('error');
      Services.bus.emit('ui:toast', { text: 'No tickets left!', sub: 'Find them while running or visit the Shop', color: COLORS.pink });
      return;
    }
    this.go('Unboxing', { packId, currency: cost.currency });
  }

  collectIdle(multiplier) {
    const paid = Services.idle.claim(multiplier);
    if (paid <= 0) return;
    Services.audio.play('cash');
    const from = this.panelPoint(this.bankPanel, this.bankCoinIcon.x, this.bankCoinIcon.y);
    flyCoins(this, from, this.currencyBar.iconPosition('popCoins'), Math.min(14, 4 + Math.floor(paid / 20)));
    floatText(this, from.x + 80, from.y - 20, `+${paid}`);
    this.updateIdleBank();
  }

  toggleSound() {
    const s = Services.save.data.settings;
    s.muted = !s.muted;
    Services.audio.setMuted(s.muted);
    Services.save.save('settings');
    this.updateMuteIcon();
  }

  updateMuteIcon() {
    const muted = Services.save.data.settings.muted;
    this.muteBtn.glyph.setText(muted ? '✕' : '♪');
    this.muteBtn.setAlpha(muted ? 0.7 : 1);
  }

  // -------------------------------------------------------------------------- dialogs

  /** "Welcome Back!" offline earnings with x2 options (ad or ticket). */
  showWelcomeBack() {
    const idle = Services.idle;
    const pending = idle.getPending();
    const modal = new Modal(this, { width: 640, height: 420, title: 'Welcome Back!', closable: false });
    const away = IdleRewardManager.formatDuration(pending.rawElapsedSeconds);
    modal.add([
      this.add.text(320, 70, `You were away for ${away}${pending.capped ? ' (bank full)' : ''}`, textStyle(22, '#7a6a8a')).setOrigin(0.5),
      this.add.text(320, 112, 'Your Pop Bank earned', textStyle(26)).setOrigin(0.5),
      this.add.image(230, 175, 'coin').setScale(1.5),
      this.add.text(270, 175, pending.coins.toLocaleString('en-US'), textStyle(56, '#c98a00', { stroke: '#3d2a52', strokeThickness: 6 })).setOrigin(0, 0.5)
    ]);
    const done = (mult) => {
      modal.close();
      this.time.delayedCall(200, () => this.collectIdle(mult));
    };
    modal.add(makeButton(this, 320, 268, 'Collect', () => done(1), { w: 260, h: 62, fontSize: 28, color: COLORS.gold, colorDark: COLORS.goldDark }));
    const adBtn = makeButton(
      this,
      175,
      350,
      'Watch Ad x2',
      async () => {
        adBtn.setEnabled(false);
        const ok = await showRewardedAd(this);
        if (ok) done(2);
        else {
          adBtn.setEnabled(true);
          Services.bus.emit('ui:toast', { text: 'Ads need an internet connection', color: 0x9aa0a6 });
        }
      },
      { w: 260, h: 56, fontSize: 22, color: COLORS.rare, colorDark: 0x2b7bc0 }
    );
    const tickets = Services.save.data.currencies.blindBoxTickets;
    const ticketBtn = makeButton(
      this,
      465,
      350,
      'Use 1 x2',
      () => {
        if (Services.save.spendCurrency('blindBoxTickets', 1, 'idle_double')) done(2);
      },
      { w: 260, h: 56, fontSize: 22, icon: 'ticket', iconScale: 0.5, color: COLORS.pink, colorDark: COLORS.pinkDark }
    );
    ticketBtn.setEnabled(tickets > 0);
    modal.add([adBtn, ticketBtn]);
  }

  /** Daily + weekly quests, claim buttons and the reward inbox. */
  showQuests() {
    const qm = Services.quests;
    qm.refreshIfNeeded();
    const modal = new Modal(this, { width: 860, height: 620, title: 'Quests', onClose: () => this.refresh() });
    const rebuild = () => {
      modal.content.removeAll(true);
      const items = [];
      const resetIn = IdleRewardManager.formatDuration(msUntilMidnight() / 1000);
      items.push(this.add.text(40, 50, 'Daily', textStyle(26)).setOrigin(0, 0.5));
      items.push(this.add.text(820, 50, `resets in ${resetIn}`, textStyle(18, '#7a6a8a')).setOrigin(1, 0.5));
      let y = 80;
      for (const q of qm.state.activeQuests) {
        items.push(...this.questRow(q, y, () => rebuild()));
        y += 82;
      }
      items.push(this.add.text(40, y + 22, 'Weekly', textStyle(26)).setOrigin(0, 0.5));
      y += 46;
      for (const q of qm.state.weeklyQuests) {
        items.push(...this.questRow(q, y, () => rebuild()));
        y += 82;
      }
      const inbox = qm.state.inbox;
      if (inbox.length) {
        items.push(
          makeButton(
            this,
            430,
            y + 36,
            `Collect inbox (${inbox.length})`,
            () => {
              const rewards = qm.claimInbox();
              addXp(Services.save, XP.PER_QUEST * rewards.length);
              Services.audio.play('cash');
              floatText(this, WIDTH / 2, HEIGHT / 2, `+${rewards.length} rewards`);
              rebuild();
            },
            { w: 320, h: 54, fontSize: 22, color: COLORS.gold, colorDark: COLORS.goldDark }
          )
        );
      }
      modal.add(items);
    };
    rebuild();
  }

  questRow(q, y, onClaim) {
    const tpl = getQuestTemplate(q.id);
    const done = q.progress >= q.target;
    const objs = [];
    const g = this.add.graphics();
    g.fillStyle(q.claimed ? 0xece4d8 : 0xffffff, 1).fillRoundedRect(30, y, 800, 72, 16);
    g.lineStyle(2, COLORS.panelDark, 0.4).strokeRoundedRect(30, y, 800, 72, 16);
    objs.push(g);
    objs.push(this.add.text(50, y + 20, tpl?.title || q.id, textStyle(21, q.claimed ? '#a89cb5' : COLORS.text)).setOrigin(0, 0.5));
    const bar = makeProgressBar(this, 50, y + 42, 360, 18, { fill: done ? COLORS.gold : COLORS.mint });
    bar.set(q.progress / q.target);
    objs.push(bar.graphics);
    objs.push(this.add.text(420, y + 51, `${Math.min(q.progress, q.target).toLocaleString('en-US')}/${q.target.toLocaleString('en-US')}`, textStyle(16, '#7a6a8a')).setOrigin(0, 0.5));
    objs.push(this.add.image(560, y + 36, REWARD_ICON[q.reward.type]).setScale(0.7));
    objs.push(this.add.text(588, y + 36, `x${q.reward.amount}`, textStyle(22)).setOrigin(0, 0.5));
    const label = q.claimed ? 'Claimed' : done ? 'Claim' : 'Go!';
    const btn = makeButton(
      this,
      745,
      y + 34,
      label,
      () => {
        if (done && !q.claimed) {
          const reward = Services.quests.claim(q.id);
          if (reward) {
            addXp(Services.save, XP.PER_QUEST);
            Services.audio.play('cash');
            floatText(this, WIDTH / 2, HEIGHT / 2, `+${reward.amount} ${REWARD_LABELS[reward.type]}`);
          }
          onClaim();
        } else if (!done) {
          // "Go!" jumps straight to where the quest is played.
          const boxQuest = tpl?.event === EVENTS.BOX_OPENED;
          this.go(boxQuest ? 'Shop' : 'Runner', boxQuest ? { tab: 'boxes' } : undefined);
        }
      },
      { w: 130, h: 50, fontSize: 22, color: done ? COLORS.gold : COLORS.mint, colorDark: done ? COLORS.goldDark : 0x4fb594 }
    );
    btn.setEnabled(!q.claimed);
    objs.push(btn);
    return objs;
  }

  /** Global top-50 (cloud), cached board when offline, or local bests. */
  async showLeaderboard() {
    const modal = new Modal(this, { width: 720, height: 600, title: 'Leaderboard' });
    const loading = this.add.text(360, 300, 'Loading…', textStyle(26, '#7a6a8a')).setOrigin(0.5);
    modal.add(loading);
    const result = await Services.sync.fetchLeaderboard();
    if (modal.closing || !modal.root.scene) return;
    loading.destroy();

    const sourceLabel = {
      cloud: 'Global Top 50',
      cache: 'Offline · last downloaded board',
      local: Services.sync.adapter.enabled ? 'Offline · your personal bests' : 'Cloud not configured · your personal bests'
    }[result.source];
    modal.add(this.add.text(360, 52, sourceLabel, textStyle(20, '#7a6a8a')).setOrigin(0.5));

    const list = new ScrollList(this, modal.content, 30, 80, 660, 420);
    const entries = result.entries;
    if (!entries.length) list.inner.add(this.add.text(330, 120, 'No runs yet - go set a record!', textStyle(22, '#7a6a8a')).setOrigin(0.5));
    entries.forEach((e, i) => {
      const y = i * 58;
      const g = this.add.graphics();
      g.fillStyle(e.isMe ? 0xffe3ec : i % 2 ? 0xffffff : 0xf8efe3, 1).fillRoundedRect(0, y, 660, 52, 12);
      const medal = ['#ffc93c', '#c0c7d1', '#d08a4e'][i];
      const rank = this.add.text(36, y + 26, `#${i + 1}`, textStyle(22, medal || COLORS.text, medal ? { stroke: '#3d2a52', strokeThickness: 4 } : {})).setOrigin(0.5);
      const icon = this.textures.exists(`icon_${e.doll}`) ? this.add.image(100, y + 26, `icon_${e.doll}`).setScale((0.42 * 0.75) / ICON_RES) : null;
      const name = this.add.text(140, y + 26, e.name || 'Labubu', textStyle(22)).setOrigin(0, 0.5);
      const score = this.add.text(640, y + 26, `${Number(e.score).toLocaleString('en-US')}`, textStyle(22, '#c98a00')).setOrigin(1, 0.5);
      list.inner.add([g, rank, ...(icon ? [icon] : []), name, score]);
    });
    list.setContentHeight(entries.length * 58);
    modal.onClose = () => list.destroy();

    modal.add(
      makeButton(this, 360, 545, `Rename (${Services.save.data.profile.displayName})`, () => this.promptRename(modal), {
        w: 420,
        h: 50,
        fontSize: 20,
        color: COLORS.mint,
        colorDark: 0x4fb594
      })
    );
  }

  async promptRename(modal) {
    const current = Services.save.data.profile.displayName;
    // In-page dialog: window.prompt() is blocked in many embedded WebViews.
    const name = await askText({ title: 'Choose a display name', value: current, maxLength: 18 });
    if (name && Services.sync.setDisplayName(name)) {
      Services.bus.emit('ui:toast', { text: `Hello, ${Services.save.data.profile.displayName}!`, color: COLORS.mint });
      modal?.close();
    }
  }

  /** Audio toggles, sync details, rename and reset. */
  showSettings() {
    const d = Services.save.data;
    const modal = new Modal(this, { width: 620, height: 640, title: 'Settings', onClose: () => this.refresh() });
    const sfxBtn = makeButton(
      this,
      170,
      90,
      d.settings.muted ? 'Sound: OFF' : 'Sound: ON',
      () => {
        this.toggleSound();
        sfxBtn.setLabel(d.settings.muted ? 'Sound: OFF' : 'Sound: ON');
      },
      { w: 250, h: 58, fontSize: 22, color: COLORS.mint, colorDark: 0x4fb594 }
    );
    const musicBtn = makeButton(
      this,
      450,
      90,
      d.settings.music !== false ? 'Music: ON' : 'Music: OFF',
      () => {
        d.settings.music = d.settings.music === false;
        Services.audio.setMusicEnabled(d.settings.music);
        if (d.settings.music) Services.audio.playMusic('menu');
        Services.save.save('settings');
        musicBtn.setLabel(d.settings.music ? 'Music: ON' : 'Music: OFF');
      },
      { w: 250, h: 58, fontSize: 22, color: COLORS.mint, colorDark: 0x4fb594 }
    );
    const sync = Services.sync;
    const last = d.meta.lastSyncedAt ? new Date(d.meta.lastSyncedAt).toLocaleString() : 'never';
    const info = [
      `Player: ${d.profile.displayName}`,
      `ID: ${d.profile.playerId.slice(0, 8)}…`,
      `Account: ${{ claude: 'Claude cloud save', supabase: 'cloud save', rest: 'cloud save' }[sync.adapter.enabled ? sync.adapter.kind : ''] || 'guest (saved on this device)'}`,
      `Status: ${sync.status}${d.meta.isDirty ? ' · unsynced changes' : ''}`,
      `Last cloud sync: ${last}`,
      `Runs ${d.stats.totalRuns} · Boxes ${d.stats.boxesOpened} · Coins ${d.stats.coinsCollectedTotal}`
    ];
    modal.add([sfxBtn, musicBtn, this.add.text(60, 150, info.join('\n'), textStyle(19, '#5a4a6a', { lineSpacing: 8 }))]);
    modal.add([
      makeButton(this, 170, 480, 'Copy save code', () => this.copySaveCode(), { w: 250, h: 52, fontSize: 20, skin: 'purple' }),
      makeButton(this, 450, 480, 'Load save code', () => this.loadSaveCode(modal), { w: 250, h: 52, fontSize: 20, skin: 'purple' })
    ]);
    modal.add(
      makeButton(this, 170, 400, 'Sync now', () => sync.syncNow({ force: true }), { w: 250, h: 56, fontSize: 22, color: COLORS.rare, colorDark: 0x2b7bc0 })
    );
    modal.add(makeButton(this, 450, 400, 'Rename', () => this.promptRename(modal), { w: 250, h: 56, fontSize: 22, color: COLORS.mint, colorDark: 0x4fb594 }));
    modal.add(
      makeButton(
        this,
        310,
        566,
        'Reset progress',
        (btn) => {
          // Two-tap confirmation (window.confirm() is blocked in embedded WebViews).
          if (!btn.armed) {
            btn.armed = true;
            btn.setLabel('Tap again to erase');
            this.time.delayedCall(3000, () => {
              if (!btn.scene) return;
              btn.armed = false;
              btn.setLabel('Reset progress');
            });
            return;
          }
          Services.save.reset();
          Services.quests.refreshIfNeeded();
          bakePlayerTextures(this, Services.save.data.equipped);
          this.scene.restart();
        },
        { w: 300, h: 50, fontSize: 20, color: 0xe8324b, colorDark: 0xa31d30 }
      )
    );
  }

  /** Save code: copy the whole save to move it to another device. */
  async copySaveCode() {
    const code = await exportSaveCode(Services.save.data);
    let copied = false;
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
    } catch {
      /* clipboard blocked (embedded page) - show the code instead */
    }
    if (copied) Services.bus.emit('ui:toast', { text: 'Save code copied!', sub: 'Paste it on your other device: Settings → Load save code', color: COLORS.mint });
    else await askText({ title: 'Copy this save code (select all, then copy)', value: code, maxLength: 200000, multiline: true, okLabel: 'Done' });
  }

  async loadSaveCode(modal) {
    const code = await askText({ title: 'Paste your save code', value: '', maxLength: 200000, multiline: true, okLabel: 'Load' });
    if (!code) return;
    try {
      await importSaveCode(Services.save, code);
      bakePlayerTextures(this, Services.save.data.equipped);
      Services.bus.emit('ui:toast', { text: 'Progress loaded!', color: COLORS.mint });
      modal?.close();
      this.scene.restart();
    } catch {
      Services.audio.play('error');
      Services.bus.emit('ui:toast', { text: "That code didn't work", sub: 'Copy the whole code and try again', color: COLORS.pink });
    }
  }

  /** Daily Lucky Spin: one free spin of the prize wheel per day. */
  showLuckySpin() {
    const modal = new Modal(this, { width: 620, height: 720, title: 'Lucky Spin', onClose: () => this.refresh() });
    const cx = 310;
    const cy = 330;
    const R = 230;
    const wheel = this.add.container(cx, cy);
    const g = this.add.graphics();
    const n = LUCKY_SPIN.length;
    const seg = (Math.PI * 2) / n;
    LUCKY_SPIN.forEach((s, i) => {
      g.fillStyle(s.color, 1);
      g.slice(0, 0, R, i * seg, (i + 1) * seg, false);
      g.fillPath();
    });
    g.lineStyle(6, 0xffffff, 1).strokeCircle(0, 0, R);
    for (let i = 0; i < n; i++) g.lineBetween(0, 0, Math.cos(i * seg) * R, Math.sin(i * seg) * R);
    wheel.add(g);
    LUCKY_SPIN.forEach((s, i) => {
      const a = (i + 0.5) * seg;
      const t = outlinedText(this, Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, s.label, 26, '#ffffff');
      t.setRotation(a + Math.PI / 2);
      const icon = REWARD_ICON[s.reward.type];
      const ic = this.add.image(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38, icon).setScale(0.55).setRotation(a + Math.PI / 2);
      wheel.add([t, ic]);
    });
    const hub = this.add.circle(0, 0, 40, 0xfff4e6).setStrokeStyle(6, COLORS.panelDark);
    wheel.add([hub, this.add.image(0, 0, 'box_icon_classic').setScale(0.42)]);
    // Pointer at the top
    const ptr = this.add.graphics();
    ptr.fillStyle(0xe8324b, 1).fillTriangle(cx - 22, cy - R - 26, cx + 22, cy - R - 26, cx, cy - R + 18);
    ptr.lineStyle(4, 0xffffff, 1).strokeTriangle(cx - 22, cy - R - 26, cx + 22, cy - R - 26, cx, cy - R + 18);
    modal.add([wheel, ptr]);

    const status = this.add.text(cx, 610, '', textStyle(22, '#7a6a8a', { align: 'center' })).setOrigin(0.5);
    const available = canSpin(Services.save);
    const btn = makeButton(
      this,
      cx,
      660,
      available ? 'SPIN!' : 'Come back tomorrow',
      () => {
        const result = spinWheel(Services.save);
        if (!result) return;
        btn.setEnabled(false);
        // Land the chosen segment's centre under the top pointer after 5 turns.
        const target = 270 - (result.index + 0.5) * (360 / n) + 360 * 5;
        let lastTick = 0;
        this.tweens.add({
          targets: wheel,
          angle: target,
          duration: 3800,
          ease: 'Cubic.easeOut',
          onUpdate: () => {
            const tick = Math.floor(wheel.angle / (360 / n));
            if (tick !== lastTick) {
              lastTick = tick;
              Services.audio.play('spinTick');
            }
          },
          onComplete: () => {
            Services.audio.play('spinWin');
            const r = result.segment.reward;
            const label = { popCoins: 'Pop Coins', blindBoxTickets: r.amount > 1 ? 'Tickets' : 'Ticket', goldenKeys: 'Golden Key', gems: 'Gems' }[r.type];
            status.setText(`You won ${r.amount} ${label}!`).setColor('#e0567f');
            floatText(this, WIDTH / 2, HEIGHT / 2, `+${r.amount} ${label}`, '#ffe066', 40);
            this.spinBadge.setVisible(false);
          }
        });
      },
      { w: 300, h: 70, fontSize: available ? 34 : 22, color: COLORS.gold, colorDark: COLORS.goldDark }
    );
    btn.setEnabled(available);
    if (!available) status.setText(`Next free spin in ${IdleRewardManager.formatDuration(msUntilMidnight() / 1000)}`);
    modal.add([status, btn]);
  }
}
