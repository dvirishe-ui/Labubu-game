/**
 * MainMenuScene.js
 * The hub: character on a pedestal, PLAY, blind box counter, the idle Pop Bank,
 * quests, leaderboard, settings and the sync status pill. Also shows the
 * "Welcome Back!" offline-earnings dialog once per app session.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS, EVENTS, ECONOMY } from '../config/GameConfig.js';
import { CATALOG } from '../config/GachaDropTable.js';
import { getQuestTemplate, REWARD_LABELS } from '../config/QuestCatalog.js';
import { Services } from '../systems/Services.js';
import { IdleRewardManager } from '../systems/IdleRewardManager.js';
import { msUntilMidnight } from '../systems/QuestManager.js';
import { buyTicket } from '../systems/GachaSystem.js';
import { showRewardedAd } from '../systems/AdService.js';
import { bakePlayerTextures } from '../art/CharacterRenderer.js';
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
  floatText,
  flyCoins
} from '../ui/UIKit.js';

const REWARD_ICON = { popCoins: 'coin', blindBoxTickets: 'ticket', goldenKeys: 'key' };

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

  buildTopRight() {
    // Sync status pill
    this.syncPill = this.add.container(880, 39);
    this.syncPillBg = this.add.graphics();
    this.syncDot = this.add.circle(-62, 0, 8, 0x9aa0a6);
    this.syncText = this.add.text(-48, 0, '', textStyle(18, '#ffffff', { stroke: '#3d2a52', strokeThickness: 3 })).setOrigin(0, 0.5);
    this.syncPill.add([this.syncPillBg, this.syncDot, this.syncText]);
    this.syncPillBg.fillStyle(0x000000, 0.28).fillRoundedRect(-80, -20, 170, 40, 20);
    this.syncPill.setSize(170, 40).setInteractive({ useHandCursor: true });
    this.syncPill.on('pointerup', () => Services.sync.syncNow({ force: true }));

    makeIconButton(this, 1010, 39, '♛', () => this.showLeaderboard(), { size: 54 });
    this.muteBtn = makeIconButton(this, 1080, 39, '♪', () => this.toggleSound(), { size: 54 });
    makeIconButton(this, 1150, 39, '≡', () => this.showSettings(), { size: 54 });
    this.updateMuteIcon();
  }

  buildCharacter() {
    const x = 230;
    this.add.image(x, 585, 'pedestal');
    this.hero = this.add.image(x, 590, 'player_preview').setOrigin(0.5, 1).setScale(1.25);
    this.tweens.add({ targets: this.hero, scaleY: 1.28, scaleX: 1.23, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hero.setInteractive({ useHandCursor: true });
    this.hero.on('pointerup', () => {
      Services.audio.play('jump');
      this.hero.setTexture('player_wave');
      this.tweens.add({ targets: this.hero, y: 560, duration: 160, yoyo: true, ease: 'Quad.easeOut', onComplete: () => this.hero.setTexture('player_preview') });
    });
    this.heroName = outlinedText(this, x, 632, '', 22, '#fff4e6');
    makeButton(this, x, 684, 'Showroom', () => this.go('Showroom'), { w: 210, h: 56, fontSize: 24, color: COLORS.mint, colorDark: 0x4fb594 });
  }

  buildCenter() {
    const cx = 590;
    const logo = outlinedText(this, cx, 130, 'LABUBU', 92, '#ff8fb1');
    outlinedText(this, cx, 200, 'Blind Box Run & Collect', 30, '#fff4e6');
    this.tweens.add({ targets: logo, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });

    this.playBtn = makeButton(this, cx, 320, 'PLAY', () => this.go('Runner'), { w: 300, h: 104, fontSize: 52, color: COLORS.gold, colorDark: COLORS.goldDark });
    this.tweens.add({ targets: this.playBtn, scale: 1.05, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    this.bestText = outlinedText(this, cx, 410, '', 26, '#fff4e6');

    this.questBtn = makeButton(this, cx, 490, 'Quests', () => this.showQuests(), { w: 240, h: 66, fontSize: 28, color: COLORS.rare, colorDark: 0x2b7bc0 });
    this.questBadge = this.add.container(cx + 110, 462);
    this.questBadge.add(this.add.circle(0, 0, 17, 0xe8324b).setStrokeStyle(3, 0xffffff));
    this.questBadgeText = this.add.text(0, 0, '0', textStyle(18, '#ffffff')).setOrigin(0.5);
    this.questBadge.add(this.questBadgeText);
    this.tweens.add({ targets: this.questBadge, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });

    this.collectionText = this.add.text(cx, 560, '', textStyle(20, '#fff4e6', { stroke: '#3d2a52', strokeThickness: 4 })).setOrigin(0.5);
  }

  buildBoxPanel() {
    const x = 880;
    const y = 90;
    const w = 370;
    const h = 320;
    makePanel(this, x, y, w, h);
    this.add.text(x + w / 2, y + 26, 'Blind Box', textStyle(28)).setOrigin(0.5);
    this.boxImg = this.add.image(x + 95, y + 150, 'box_icon').setScale(1.15);
    this.tweens.add({ targets: this.boxImg, y: y + 140, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    this.pityText = this.add.text(x + 95, y + 232, '', textStyle(15, '#7a6a8a', { align: 'center' })).setOrigin(0.5);

    this.openBtn = makeButton(this, x + 268, y + 100, 'Open', () => this.openBox('ticket'), { w: 170, h: 60, fontSize: 26, icon: 'ticket', iconScale: 0.55 });
    this.buyBtn = makeButton(this, x + 268, y + 172, `${ECONOMY.TICKET_PRICE_COINS}`, () => this.buyTicket(), {
      w: 170,
      h: 56,
      fontSize: 22,
      icon: 'coin',
      iconScale: 0.55,
      color: COLORS.mint,
      colorDark: 0x4fb594
    });
    this.add.text(x + 268, y + 208, 'buy a ticket', textStyle(14, '#7a6a8a')).setOrigin(0.5);
    this.keyBtn = makeButton(this, x + 268, y + 262, 'Key Box', () => this.openBox('key'), {
      w: 170,
      h: 56,
      fontSize: 22,
      icon: 'key',
      iconScale: 0.55,
      color: COLORS.epic,
      colorDark: 0x7a3dcc
    });
  }

  buildIdleBank() {
    const x = 880;
    const y = 430;
    const w = 370;
    const h = 270;
    makePanel(this, x, y, w, h);
    this.add.text(x + w / 2, y + 26, 'Pop Bank', textStyle(28)).setOrigin(0.5);
    this.bankCoinIcon = this.add.image(x + 60, y + 92, 'coin').setScale(1.3);
    this.tweens.add({ targets: this.bankCoinIcon, scaleX: { from: 1.3, to: -1.3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.bankAmount = this.add.text(x + 100, y + 80, '0', textStyle(42, '#c98a00', { stroke: '#3d2a52', strokeThickness: 5 })).setOrigin(0, 0.5);
    this.bankRate = this.add.text(x + 100, y + 116, '', textStyle(16, '#7a6a8a'));
    this.bankBar = makeProgressBar(this, x + 30, y + 150, w - 60, 20, { fill: COLORS.gold });
    this.bankCap = this.add.text(x + w / 2, y + 184, '', textStyle(15, '#7a6a8a')).setOrigin(0.5);
    this.collectBtn = makeButton(this, x + w / 2, y + 230, 'Collect', () => this.collectIdle(1), {
      w: 220,
      h: 56,
      fontSize: 26,
      color: COLORS.gold,
      colorDark: COLORS.goldDark
    });
    // The bank ticks up live.
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.updateIdleBank() });
    this.updateIdleBank();
  }

  // -------------------------------------------------------------------------- refresh

  refresh() {
    const d = Services.save.data;
    this.heroName.setText(CATALOG[d.equipped.baseDoll]?.name || 'Labubu');
    this.bestText.setText(`Best run: ${d.stats.highScore.toLocaleString('en-US')} m`);
    const tickets = d.currencies.blindBoxTickets;
    this.openBtn.setEnabled(tickets > 0);
    this.buyBtn.setEnabled(d.currencies.popCoins >= ECONOMY.TICKET_PRICE_COINS);
    this.keyBtn.setVisible(d.currencies.goldenKeys > 0);
    const epicIn = 10 - d.pityCounter.pullsSinceLastEpic;
    const secretIn = 50 - d.pityCounter.pullsSinceLastSecret;
    this.pityText.setText(`Epic+ in ≤ ${epicIn}\nSecret in ≤ ${secretIn}`);
    const claimable = Services.quests.claimableCount();
    this.questBadge.setVisible(claimable > 0);
    this.questBadgeText.setText(String(claimable));
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
      synced: ['Cloud saved', 0x4cd964],
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

  openBox(source) {
    const d = Services.save.data;
    const has = source === 'key' ? d.currencies.goldenKeys > 0 : d.currencies.blindBoxTickets > 0;
    if (!has) {
      Services.audio.play('error');
      Services.bus.emit('ui:toast', { text: 'No tickets left!', sub: 'Find them while running or buy one with coins', color: COLORS.pink });
      return;
    }
    this.go('Unboxing', { source });
  }

  buyTicket() {
    if (buyTicket(Services.save)) {
      Services.audio.play('ticket');
      floatText(this, 1148, 260, '+1 ticket', '#ff8fb1');
    } else {
      Services.audio.play('error');
    }
  }

  collectIdle(multiplier) {
    const paid = Services.idle.claim(multiplier);
    if (paid <= 0) return;
    Services.audio.play('cash');
    flyCoins(this, { x: this.bankCoinIcon.x, y: this.bankCoinIcon.y }, this.currencyBar.iconPosition('popCoins'), Math.min(14, 4 + Math.floor(paid / 20)));
    floatText(this, this.bankCoinIcon.x + 80, this.bankCoinIcon.y - 20, `+${paid}`);
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
            Services.audio.play('cash');
            floatText(this, WIDTH / 2, HEIGHT / 2, `+${reward.amount} ${REWARD_LABELS[reward.type]}`);
          }
          onClaim();
        }
      },
      { w: 130, h: 50, fontSize: 22, color: done ? COLORS.gold : 0xc9bfd6, colorDark: done ? COLORS.goldDark : 0x9a8fab }
    );
    btn.setEnabled(done && !q.claimed);
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
      const icon = this.textures.exists(`icon_${e.doll}`) ? this.add.image(100, y + 26, `icon_${e.doll}`).setScale(0.42) : null;
      const name = this.add.text(140, y + 26, e.name || 'Labubu', textStyle(22)).setOrigin(0, 0.5);
      const score = this.add.text(640, y + 26, `${Number(e.score).toLocaleString('en-US')} m`, textStyle(22, '#c98a00')).setOrigin(1, 0.5);
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

  promptRename(modal) {
    const current = Services.save.data.profile.displayName;
    // window.prompt works in browsers and in Capacitor WebViews.
    const name = window.prompt('Choose a display name (max 18 characters)', current);
    if (name && Services.sync.setDisplayName(name)) {
      Services.bus.emit('ui:toast', { text: `Hello, ${Services.save.data.profile.displayName}!`, color: COLORS.mint });
      modal?.close();
    }
  }

  /** Audio toggles, sync details, rename and reset. */
  showSettings() {
    const d = Services.save.data;
    const modal = new Modal(this, { width: 620, height: 560, title: 'Settings', onClose: () => this.refresh() });
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
      `Backend: ${sync.adapter.kind === 'none' ? 'offline only (no cloud configured)' : sync.adapter.kind}`,
      `Status: ${sync.status}${d.meta.isDirty ? ' · unsynced changes' : ''}`,
      `Last cloud sync: ${last}`,
      `Runs ${d.stats.totalRuns} · Boxes ${d.stats.boxesOpened} · Coins ${d.stats.coinsCollectedTotal}`
    ];
    modal.add([sfxBtn, musicBtn, this.add.text(60, 150, info.join('\n'), textStyle(19, '#5a4a6a', { lineSpacing: 8 }))]);
    modal.add(
      makeButton(this, 170, 400, 'Sync now', () => sync.syncNow({ force: true }), { w: 250, h: 56, fontSize: 22, color: COLORS.rare, colorDark: 0x2b7bc0 })
    );
    modal.add(makeButton(this, 450, 400, 'Rename', () => this.promptRename(modal), { w: 250, h: 56, fontSize: 22, color: COLORS.mint, colorDark: 0x4fb594 }));
    modal.add(
      makeButton(
        this,
        310,
        480,
        'Reset progress',
        () => {
          if (window.confirm('Erase ALL local progress? This cannot be undone.')) {
            Services.save.reset();
            Services.quests.refreshIfNeeded();
            bakePlayerTextures(this, Services.save.data.equipped);
            this.scene.restart();
          }
        },
        { w: 300, h: 50, fontSize: 20, color: 0xe8324b, colorDark: 0xa31d30 }
      )
    );
  }
}
