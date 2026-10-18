/**
 * PassScene.js
 * "Labubu Pass" - a Brawl Stars-style season pass. Runs, boxes and quests give
 * XP; every tier unlocks a reward on the free track and one on the Gold track
 * (unlocked with gems). A new season starts every month.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS } from '../config/GameConfig.js';
import { PASS, passReward } from '../config/ProgressionConfig.js';
import { CATALOG } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { passInfo, canClaim, claimPassTier, unlockGoldPass, seasonEndsIn, levelInfo } from '../systems/Progression.js';
import { rewardLabel, rewardIcon } from '../systems/Rewards.js';
import { IdleRewardManager } from '../systems/IdleRewardManager.js';
import { ICON_RES, bakePlayerTextures } from '../art/CharacterRenderer.js';
import { addForestBackdrop, CurrencyBar, makeButton, makeProgressBar, ScrollList, outlinedText, textStyle, floatText } from '../ui/UIKit.js';
import { INK, uiImage, addPanel, vignetteKey, cardKey } from '../ui/Skin.js';

const ROW_H = 132;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export class PassScene extends Phaser.Scene {
  constructor() {
    super('Pass');
  }

  create() {
    Services.audio.playMusic('menu');
    addForestBackdrop(this, { dim: 0.5 });
    uiImage(this, 0, 0, vignetteKey(this)).setDisplaySize(WIDTH, HEIGHT);
    const portrait = HEIGHT > WIDTH;
    new CurrencyBar(this, 20, 16, { shop: false });
    makeButton(this, portrait ? 84 : WIDTH - 100, portrait ? 100 : 42, 'Back', () => this.leave(), { w: portrait ? 130 : 160, h: 54, fontSize: 24, skin: 'green' });

    this.CW = Math.min(WIDTH - 24, 720);
    this.x0 = (WIDTH - this.CW) / 2;
    this.headerY = portrait ? 140 : 76;
    this.header = this.add.container(this.x0, this.headerY);
    this.page = this.add.container(0, 0);
    this.build();
    this.cameras.main.fadeIn(220, 43, 29, 58);
  }

  build(keepScroll = false) {
    const scroll = this.list?.scroll ?? 0;
    this.header.removeAll(true);
    this.list?.destroy();
    this.page.removeAll(true);

    const info = passInfo(Services.save);
    const lv = levelInfo(Services.save.data.progress.xp);
    const CW = this.CW;
    const H = 170;
    const h = this.header;
    h.add(addPanel(this, 0, 0, CW, H, { header: info.gold ? 0xffb400 : 0x8a4dff, headerH: 56, radius: 26 }));
    const month = MONTHS[Number(info.season.split('-')[1]) - 1];
    h.add(outlinedText(this, CW / 2, 29, `LABUBU PASS · ${month.toUpperCase()}`, 30));
    h.add(this.add.text(24, 76, `Tier ${info.tier} / ${PASS.TIERS}`, textStyle(24, COLORS.text)).setOrigin(0, 0.5));
    h.add(this.add.text(CW - 24, 76, `Ends in ${this.endsIn()}`, textStyle(17, '#8a7a9a')).setOrigin(1, 0.5));
    const bar = makeProgressBar(this, 24, 98, CW - 48, 22, { fill: 0x8a4dff });
    bar.set(info.into / info.need);
    h.add(bar.graphics);
    h.add(this.add.text(CW / 2, 109, `${info.into} / ${info.need} XP`, textStyle(15, '#ffffff', { stroke: INK, strokeThickness: 3 })).setOrigin(0.5));
    h.add(this.add.text(24, 144, `Player level ${lv.level} · runs, boxes & quests give XP`, textStyle(16, '#7a6a8a')).setOrigin(0, 0.5));
    if (!info.gold) {
      const b = makeButton(this, CW - 120, 144, `GOLD  ${PASS.GOLD_PRICE_GEMS}`, () => this.buyGold(), { w: 210, h: 46, fontSize: 21, skin: 'yellow', icon: 'gem', iconScale: 0.55 });
      this.tweens.add({ targets: b, scale: 1.05, yoyo: true, repeat: -1, duration: 500 });
      h.add(b);
    } else {
      h.add(outlinedText(this, CW - 110, 144, 'GOLD PASS ✓', 22, '#ffe066'));
    }

    // Column headers + scrolling tier list
    const top = this.headerY + H + 20;
    const cols = this.add.container(this.x0, top);
    cols.add([outlinedText(this, CW * 0.25, 0, 'FREE', 24, '#6ee7a8'), outlinedText(this, CW * 0.75, 0, 'GOLD', 24, '#ffe066')]);
    this.page.add(cols);
    const listTop = top + 22;
    this.list = new ScrollList(this, this.page, this.x0, listTop, CW, HEIGHT - listTop - 8);
    for (let t = 1; t <= PASS.TIERS; t++) this.tierRow(t, info);
    this.list.setContentHeight(PASS.TIERS * ROW_H + 10);
    const target = keepScroll ? scroll : Math.max(0, (info.tier - 1) * ROW_H - 40);
    this.list.setScroll(target);
  }

  tierRow(t, info) {
    const CW = this.CW;
    const y = (t - 1) * ROW_H;
    const row = this.add.container(0, y);
    row.rowHeight = ROW_H;
    this.list.inner.add(row);
    const reached = t <= info.tier;
    // Progress spine with the tier number
    const g = this.add.graphics();
    g.fillStyle(reached ? 0x8a4dff : 0x5a4a6a, 0.9).fillRect(CW / 2 - 6, 0, 12, ROW_H);
    row.add(g);
    row.add(this.add.circle(CW / 2, ROW_H / 2, 26, reached ? 0x8a4dff : 0x6f6585).setStrokeStyle(4, 0xffffff));
    row.add(outlinedText(this, CW / 2, ROW_H / 2, String(t), 24));
    for (const track of ['free', 'gold']) {
      const x = track === 'free' ? 10 : CW / 2 + 40;
      row.add(this.rewardCell(t, track, x, 10, CW / 2 - 50, ROW_H - 20, info));
    }
  }

  rewardCell(t, track, x, y, w, h, info) {
    const save = Services.save;
    const reward = passReward(t, track);
    const claimed = save.data.pass.claimed[track].includes(t);
    const claimable = canClaim(save, t, track);
    const goldLocked = track === 'gold' && !info.gold;
    const c = this.add.container(x, y);
    const rarity = reward.type === 'item' ? CATALOG[reward.id].rarity : track === 'gold' ? 'legendary' : 'rare';
    c.add(uiImage(this, -6, -4, cardKey(this, w, h, rarity, !claimable && !claimed && (t > info.tier || goldLocked))));
    const iconKey = rewardIcon(reward);
    const icon = this.add.image(46, h / 2 - 4, iconKey);
    if (reward.type === 'item') icon.setScale((0.62 * 0.75) / ICON_RES);
    else icon.setScale(1.1);
    c.add(icon);
    const label = reward.type === 'item' ? CATALOG[reward.id].name : rewardLabel(reward).replace('+', '');
    c.add(outlinedText(this, 90, h / 2 - 12, label, 18).setOrigin(0, 0.5));
    if (claimed) {
      c.add(outlinedText(this, w - 30, 24, '✓', 34, '#6ee7a8'));
      c.setAlpha(0.7);
    } else if (goldLocked) {
      c.add(outlinedText(this, w - 44, 22, 'LOCKED', 15, '#ffe066'));
    }
    if (claimable) {
      const b = makeButton(this, 90 + 64, h - 24, 'CLAIM', () => this.claim(t, track), { w: 128, h: 38, fontSize: 18, skin: 'green' });
      this.tweens.add({ targets: b, scale: 1.08, yoyo: true, repeat: -1, duration: 420 });
      c.add(b);
    } else if (!claimed && !goldLocked) {
      c.add(this.add.text(90, h - 24, t > info.tier ? `Tier ${t}` : '', textStyle(14, '#ffffff', { stroke: INK, strokeThickness: 3 })).setOrigin(0, 0.5));
    }
    return c;
  }

  claim(t, track) {
    const res = claimPassTier(Services.save, t, track);
    if (!res.ok) return;
    Services.audio.play('cash');
    if (res.reward?.type === 'item' && !res.reward.converted) {
      bakePlayerTextures(this, Services.save.data.equipped);
      floatText(this, WIDTH / 2, HEIGHT / 2, `${CATALOG[res.reward.id].name} unlocked!`, '#ffc93c', 38);
    } else {
      floatText(this, WIDTH / 2, HEIGHT / 2, rewardLabel(res.reward), '#ffe066', 38);
    }
    this.build(true);
  }

  buyGold() {
    const res = unlockGoldPass(Services.save);
    if (!res.ok) {
      Services.audio.play('error');
      Services.bus.emit('ui:toast', { text: 'Not enough Gems', sub: 'Earn gems from deals, spins and boxes', color: COLORS.pink });
      return;
    }
    Services.audio.play('spinWin');
    this.cameras.main.flash(250, 255, 220, 120);
    floatText(this, WIDTH / 2, HEIGHT / 2, 'GOLD PASS UNLOCKED!', '#ffe066', 40);
    this.build(true);
  }

  endsIn() {
    const s = seasonEndsIn() / 1000;
    const days = Math.floor(s / 86400);
    return days >= 1 ? `${days} day${days > 1 ? 's' : ''}` : IdleRewardManager.formatDuration(s);
  }

  leave() {
    this.input.enabled = false;
    this.list?.destroy();
    this.cameras.main.fadeOut(200, 43, 29, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenu'));
  }
}
