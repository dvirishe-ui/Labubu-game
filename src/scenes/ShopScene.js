/**
 * ShopScene.js
 * Brawl Stars-style store with four tabs:
 *  - Deals: today's rotating offers (free gift, a discounted skin, bundles).
 *  - Boxes: the three blind-box packs with their posted odds
 *           ("Regular X% · Mystery Y%" plus the per-rarity table and pity).
 *  - Skins: every Common/Rare/Epic/Legendary item for gems (some for coins);
 *           Mystery skins are blind-box exclusives, just like real Labubus.
 *  - Gems:  gem packs (real-money in the store app; see PurchaseService) and a
 *           free daily video reward.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS, GEM_BUNDLES, RUNNER } from '../config/GameConfig.js';
import { BOOST_ITEMS, UPGRADES, UPGRADE_ORDER, UPGRADE_COSTS, UPGRADE_STEP, HEAD_START } from '../config/ProgressionConfig.js';
import { boostCount, buyBoost, upgradeLevel, upgradeCost, buyUpgrade } from '../systems/Boosts.js';
import { CATALOG, RARITY_TIERS, RARITY_ORDER, PACKS, PACK_ORDER, packSplit } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { chooseCost, pityStatus, skinPrice, buySkin } from '../systems/GachaSystem.js';
import { dailyDeals, buyDeal } from '../systems/ShopSystem.js';
import { purchaseGems } from '../systems/PurchaseService.js';
import { showRewardedAd } from '../systems/AdService.js';
import { msUntilMidnight } from '../systems/QuestManager.js';
import { IdleRewardManager } from '../systems/IdleRewardManager.js';
import { ICON_RES, bakePlayerTextures } from '../art/CharacterRenderer.js';
import { addForestBackdrop, CurrencyBar, makeButton, Modal, ScrollList, outlinedText, textStyle, displayStyle, floatText } from '../ui/UIKit.js';
import { INK, uiImage, addPanel, buttonKey, cardKey, pillKey, vignetteKey } from '../ui/Skin.js';

const TABS = [
  { id: 'deals', label: 'Deals' },
  { id: 'boxes', label: 'Boxes' },
  { id: 'skins', label: 'Skins' },
  { id: 'boosts', label: 'Boosts' },
  { id: 'gems', label: 'Gems' }
];
const CURRENCY_ICON = { popCoins: 'coin', gems: 'gem', blindBoxTickets: 'ticket', goldenKeys: 'key' };
const UPGRADE_BASE = { magnet: RUNNER.SUPER_MAGNET_DURATION_MS / 1000, star: RUNNER.STAR_MS / 1000, mushroom: RUNNER.MUSHROOM_BOOST.ms / 1000 };
const CURRENCY_NAME = { popCoins: 'Coins', gems: 'Gems', blindBoxTickets: 'Tickets', goldenKeys: 'Keys' };
const RARITY_SKIN = { common: 'gray', rare: 'green', epic: 'purple', legendary: 'yellow', secret: 'pink' };
const SECTION_ORDER = ['legendary', 'epic', 'rare', 'common', 'secret'];
const FREE_GEMS = 10;

const hexNum = (css) => parseInt(css.replace('#', ''), 16);

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.tab = data?.tab || this.tab || 'deals';
  }

  create() {
    Services.audio.playMusic('menu');
    addForestBackdrop(this, { dim: 0.5 });
    uiImage(this, 0, 0, vignetteKey(this)).setDisplaySize(WIDTH, HEIGHT);

    const portrait = HEIGHT > WIDTH;
    this.currencyBar = new CurrencyBar(this, 20, 16, { shop: false });
    if (portrait) {
      makeButton(this, 84, 100, 'Back', () => this.leave(), { w: 130, h: 54, fontSize: 24, skin: 'green' });
      outlinedText(this, WIDTH / 2 + 40, 100, 'SHOP', 54, '#ffe066');
    } else {
      makeButton(this, WIDTH - 100, 42, 'Back', () => this.leave(), { w: 160, h: 54, fontSize: 24, skin: 'green' });
    }

    const tabsY = portrait ? 176 : 102;
    const tabW = Math.min(170, (WIDTH - 40) / TABS.length - 8);
    const tabsX = WIDTH / 2 - ((TABS.length - 1) * (tabW + 8)) / 2;
    this.tabButtons = TABS.map((t, i) => {
      const b = makeButton(this, tabsX + i * (tabW + 8), tabsY, t.label, () => this.showTab(t.id), { w: tabW, h: 56, fontSize: tabW < 140 ? 21 : 24, skin: 'blue' });
      b.tabId = t.id;
      return b;
    });
    this.dealDot = this.add.circle(0, 0, 11, 0xe8324b).setStrokeStyle(3, 0xffffff);

    this.CW = Math.min(WIDTH - 24, 1240);
    this.top = tabsY + 44;
    this.page = this.add.container(0, 0);
    this.showTab(this.tab);

    // Live countdown on the deals tab
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickCountdown() });
    this.cameras.main.fadeIn(220, 43, 29, 58);
  }

  // -------------------------------------------------------------------------- tabs

  showTab(id) {
    this.tab = id;
    this.tabButtons.forEach((b) => {
      const on = b.tabId === id;
      b.setScale(on ? 1.06 : 1);
      b.label.setColor(on ? '#ffe066' : '#ffffff');
      b.setAlpha(on ? 1 : 0.88);
    });
    const deals = dailyDeals(Services.save);
    const free = deals.find((d) => d.id === 'free_gift');
    const dealsBtn = this.tabButtons[0];
    this.dealDot.setPosition(dealsBtn.x + dealsBtn.width / 2 - 10, dealsBtn.y - 24).setVisible(free && !free.bought).setDepth(10);

    this.list?.destroy();
    this.page.removeAll(true);
    const x0 = (WIDTH - this.CW) / 2;
    this.list = new ScrollList(this, this.page, x0, this.top, this.CW, HEIGHT - this.top - 8);
    this.countdown = null;
    const builders = { deals: () => this.buildDeals(deals), boxes: () => this.buildBoxes(), skins: () => this.buildSkins(), boosts: () => this.buildBoosts(), gems: () => this.buildGems() };
    const h = builders[id]();
    this.list.setContentHeight(h + 20);
  }

  /** Rebuilds the current tab after a purchase, keeping the scroll position. */
  rebuild() {
    const scroll = this.list?.scroll ?? 0;
    this.showTab(this.tab);
    this.list.setScroll(scroll);
  }

  /** Grid positions for `n` cards of size (w, h) inside the content width. */
  grid(n, w, h, y0, gap = 18) {
    const cols = Math.max(1, Math.floor((this.CW + gap) / (w + gap)));
    const rowW = Math.min(n, cols) * (w + gap) - gap;
    const left = (this.CW - rowW) / 2;
    const pos = [];
    for (let i = 0; i < n; i++) pos.push({ x: left + (i % cols) * (w + gap), y: y0 + Math.floor(i / cols) * (h + gap) });
    const rows = Math.ceil(n / cols);
    return { pos, bottom: y0 + rows * (h + gap) - gap };
  }

  /** Adds a row container to the list (rowHeight lets the list cull it). */
  row(x, y, h) {
    const c = this.add.container(x, y);
    c.rowHeight = h;
    this.list.inner.add(c);
    return c;
  }

  sectionTitle(y, text, color = '#ffffff', sub = '') {
    const c = this.row(0, y, 50);
    const t = outlinedText(this, this.CW / 2, 24, text, 34, color);
    c.add(t);
    if (sub) {
      c.add(this.add.text(this.CW / 2, 54, sub, textStyle(18, '#fff4e6', { stroke: INK, strokeThickness: 4 })).setOrigin(0.5));
      c.rowHeight = 70;
    }
    return c;
  }

  /** Price button: currency icon + amount. */
  priceButton(x, y, cost, onClick, { w = 170, h = 52, skin = 'green', fontSize = 24 } = {}) {
    const afford = (Services.save.data.currencies[cost.currency] ?? 0) >= cost.amount;
    const b = makeButton(this, x, y, cost.amount.toLocaleString('en-US'), () => (afford ? onClick() : this.notEnough(cost.currency)), {
      w,
      h,
      fontSize,
      skin,
      icon: CURRENCY_ICON[cost.currency],
      iconScale: 0.6,
      sound: afford ? 'click' : null
    });
    if (!afford) b.setAlpha(0.75);
    return b;
  }

  notEnough(currency) {
    Services.audio.play('error');
    const hint = currency === 'gems' ? 'Get more in the Gems tab' : currency === 'popCoins' ? 'Run to collect more coins!' : 'Find more while running';
    Services.bus.emit('ui:toast', { text: `Not enough ${CURRENCY_NAME[currency]}`, sub: hint, color: COLORS.pink });
  }

  celebrate(text, color = '#ffe066') {
    Services.audio.play('cash');
    floatText(this, WIDTH / 2, HEIGHT / 2, text, color, 40);
    this.cameras.main.flash(180, 255, 240, 200);
  }

  // -------------------------------------------------------------------------- deals

  buildDeals(deals) {
    this.countdown = outlinedText(this, this.CW / 2, 24, '', 24, '#fff4e6');
    const head = this.row(0, 0, 50);
    head.add(this.countdown);
    this.tickCountdown();

    const W = 300;
    const H = 360;
    const { pos, bottom } = this.grid(deals.length, W, H, 60);
    deals.forEach((d, i) => {
      const c = this.row(pos[i].x, pos[i].y, H);
      const color = d.kind === 'skin' ? RARITY_TIERS[CATALOG[d.itemId].rarity].color : d.cost === null ? 0x2fc24f : 0xff7a1a;
      c.add(addPanel(this, 0, 0, W, H, { header: color, headerH: 58, radius: 26 }));
      c.add(outlinedText(this, W / 2, 30, d.title, 24));

      if (d.kind === 'skin') {
        const item = CATALOG[d.itemId];
        c.add(uiImage(this, W / 2 - 80 - 6, 70 - 4, cardKey(this, 160, 180, item.rarity)));
        c.add(this.add.image(W / 2, 150, `icon_${item.id}`).setScale((1.0 * 0.75) / ICON_RES));
        c.add(this.add.text(W / 2, 236, item.name, displayStyle(18, '#ffffff', { stroke: INK, strokeThickness: 4 })).setOrigin(0.5));
        const mult = RARITY_TIERS[item.rarity].multiplier;
        c.add(this.add.text(W / 2, 270, item.slot === 'doll' ? `x${mult} score & coins` : 'Accessory', textStyle(18, '#7a4dd6')).setOrigin(0.5));
      } else {
        const entries = Object.entries(d.give);
        entries.forEach(([cur, amt], k) => {
          const x = W / 2 + (k - (entries.length - 1) / 2) * 120;
          const icon = this.add.image(x, 140, CURRENCY_ICON[cur]).setScale(1.7);
          this.tweens.add({ targets: icon, y: 130, yoyo: true, repeat: -1, duration: 900 + k * 120, ease: 'Sine.easeInOut' });
          c.add([icon, outlinedText(this, x, 210, `x${amt}`, 34, '#ffe066')]);
        });
        if (d.cost === null) c.add(this.add.text(W / 2, 262, 'A present for you, every day!', textStyle(17, '#7a6a8a')).setOrigin(0.5));
      }

      if (d.was && !d.bought) {
        // Struck-through original price + discount sticker
        const off = Math.round((1 - d.cost.amount / d.was) * 100);
        const was = this.add.text(W / 2, 294, `${d.was}`, textStyle(18, '#9a8aaa')).setOrigin(0.5);
        const strike = this.add.rectangle(W / 2, 294, was.width + 10, 3, 0xe8324b);
        const sticker = this.add.container(W - 28, 74).setAngle(14);
        sticker.add([this.add.circle(0, 0, 30, 0xe8324b).setStrokeStyle(4, 0xffffff), outlinedText(this, 0, 0, `-${off}%`, 20)]);
        this.tweens.add({ targets: sticker, scale: 1.1, yoyo: true, repeat: -1, duration: 500 });
        c.add([was, strike, sticker]);
      }

      if (d.bought) {
        c.add(uiImage(this, W / 2 - 90 - 6, 316 - 4, buttonKey(this, 180, 44, 'gray', false)));
        c.add(outlinedText(this, W / 2, 336, d.kind === 'skin' ? 'OWNED ✓' : 'CLAIMED ✓', 22));
      } else if (d.cost === null) {
        const b = makeButton(this, W / 2, 334, 'FREE!', () => this.onBuyDeal(d), { w: 200, h: 52, fontSize: 28, skin: 'green' });
        this.tweens.add({ targets: b, scale: 1.07, yoyo: true, repeat: -1, duration: 450 });
        c.add(b);
      } else {
        c.add(this.priceButton(W / 2, 334, d.cost, () => this.onBuyDeal(d), { w: 200 }));
      }
    });
    return bottom;
  }

  tickCountdown() {
    if (!this.countdown?.scene) return;
    this.countdown.setText(`New deals in ${IdleRewardManager.formatDuration(msUntilMidnight() / 1000)}`);
  }

  onBuyDeal(d) {
    const res = buyDeal(Services.save, d.id);
    if (!res.ok) return res.reason === 'insufficient' ? this.notEnough(d.cost.currency) : Services.audio.play('error');
    if (d.kind === 'skin') this.celebrate(`${CATALOG[d.itemId].name} unlocked!`, '#ffc93c');
    else this.celebrate(Object.entries(d.give).map(([k, v]) => `+${v} ${CURRENCY_NAME[k]}`).join('  '));
    this.rebuild();
  }

  // -------------------------------------------------------------------------- boxes

  buildBoxes() {
    this.sectionTitle(0, 'Blind Boxes', '#ffe066', 'Every box has a figure + bonus coins, boosts & gems!');
    const W = 600;
    const H = 400;
    const { pos, bottom } = this.grid(PACK_ORDER.length, W, H, 86);
    PACK_ORDER.forEach((id, i) => {
      const pack = PACKS[id];
      const c = this.row(pos[i].x, pos[i].y, H);
      c.add(addPanel(this, 0, 0, W, H, { header: hexNum(pack.colors.accent), headerH: 60, radius: 26 }));
      c.add(outlinedText(this, W / 2, 31, pack.name.toUpperCase(), 28));

      const glow = this.add.image(112, 186, 'fx_glow').setScale(1.3).setTint(hexNum(pack.colors.front[1])).setAlpha(0.55);
      const box = this.add.image(112, 190, `box_icon_${id}`).setScale(1.45);
      this.tweens.add({ targets: box, y: 178, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 1100 + i * 150, ease: 'Sine.easeInOut' });
      c.add([glow, box, this.add.text(112, 330, pack.tagline, textStyle(15, '#7a6a8a', { align: 'center', wordWrap: { width: 200 } })).setOrigin(0.5)]);

      // "Regular X% · Mystery Y%" - the headline odds, like a real blind box.
      const split = packSplit(id);
      c.add(uiImage(this, 226 - 6, 74 - 4, buttonKey(this, 170, 44, 'blue', false)));
      c.add(outlinedText(this, 311, 94, `Regular ${split.regular}%`, 20));
      c.add(uiImage(this, 404 - 6, 74 - 4, buttonKey(this, 176, 44, 'pink', false)));
      c.add(outlinedText(this, 492, 94, `Mystery ${split.mystery}%`, 20));

      // Per-rarity table
      let y = 140;
      for (const r of RARITY_ORDER) {
        const p = pack.odds[r];
        if (!p) continue;
        const tier = RARITY_TIERS[r];
        c.add(this.add.circle(240, y, 8, tier.color).setStrokeStyle(2, 0x2d1b3d));
        c.add(this.add.text(256, y, tier.label, textStyle(18, '#3d2a52')).setOrigin(0, 0.5));
        c.add(this.add.text(410, y, `x${tier.multiplier}`, textStyle(15, '#9a8aaa')).setOrigin(0, 0.5));
        c.add(this.add.text(578, y, `${p}%`, displayStyle(20, Phaser.Display.Color.IntegerToColor(tier.dark).rgba)).setOrigin(1, 0.5));
        y += 25;
      }

      const pity = pityStatus(Services.save, id);
      const best = pity.secret !== undefined && pity.secret <= 20 ? ['Mystery', pity.secret] : pity.legendary !== undefined ? ['Legendary', pity.legendary] : ['Epic', pity.epic];
      c.add(this.add.text(410, 268, `${best[0]} guaranteed within ${best[1]} box${best[1] === 1 ? '' : 'es'}`, textStyle(15, '#e0567f')).setOrigin(0.5));

      const n = pack.costs.length;
      pack.costs.forEach((cost, k) => {
        const bx = n === 1 ? 410 : 318 + k * 186;
        const btn = this.priceButton(bx, 312, cost, () => this.openPack(id, cost.currency), { w: n === 1 ? 300 : 172, skin: k === 0 ? 'yellow' : 'green' });
        c.add(btn);
        // Open 5 at once
        const five = { currency: cost.currency, amount: cost.amount * 5 };
        const b5 = this.priceButton(bx, 368, five, () => this.openPack(id, cost.currency, 5), { w: n === 1 ? 300 : 172, h: 46, fontSize: 20, skin: 'purple' });
        const tag = this.add.container(bx - (n === 1 ? 150 : 86) + 4, 352);
        tag.add([uiImage(this, -24 - 6, -12 - 4, buttonKey(this, 48, 24, 'red', false)), outlinedText(this, 0, 0, 'x5', 15)]);
        c.add([b5, tag]);
      });
    });
    return bottom;
  }

  openPack(packId, currency, count = 1) {
    if (!chooseCost(Services.save, packId, currency, count)) return this.notEnough(currency);
    this.leave('Unboxing', { packId, currency, count });
  }

  // -------------------------------------------------------------------------- skins

  buildSkins() {
    let y = 0;
    const W = 200;
    const H = 300;
    for (const rarity of SECTION_ORDER) {
      const items = Object.values(CATALOG).filter((it) => it.rarity === rarity && (rarity === 'secret' || skinPrice(it.id)));
      if (!items.length) continue;
      const tier = RARITY_TIERS[rarity];
      items.sort((a, b) => (a.slot === 'doll' ? 0 : 1) - (b.slot === 'doll' ? 0 : 1));
      const sub = rarity === 'secret' ? 'Only from blind boxes - can you find one?' : `Skins play with a x${tier.multiplier} score & coin bonus`;
      this.sectionTitle(y, tier.label.toUpperCase(), Phaser.Display.Color.IntegerToColor(tier.glow).rgba, sub);
      const { pos, bottom } = this.grid(items.length, W, H, y + 86, 16);
      items.forEach((item, i) => this.skinCard(item, pos[i].x, pos[i].y, W, H));
      y = bottom + 30;
    }
    return y;
  }

  skinCard(item, x, y, W, H) {
    const c = this.row(x, y, H);
    const owned = Services.save.hasItem(item.id);
    const tier = RARITY_TIERS[item.rarity];
    const secret = item.rarity === 'secret';
    c.add(uiImage(this, -6, -4, cardKey(this, W, 226, item.rarity, secret && !owned)));
    const icon = this.add.image(W / 2, 104, `icon_${item.id}`).setScale((1.05 * 0.75) / ICON_RES);
    if (secret && !owned) icon.setTintFill(0x2d1b3d).setAlpha(0.8);
    c.add(icon);
    if (secret && !owned) c.add(outlinedText(this, W / 2, 96, '?', 64, '#ff8fd0'));
    c.add(this.add.text(W / 2, 211, secret && !owned ? 'Mystery' : item.name, displayStyle(16, '#ffffff', { stroke: INK, strokeThickness: 4 })).setOrigin(0.5));
    if (item.slot === 'doll' && tier.multiplier > 1) {
      c.add(uiImage(this, 8 - 6, 8 - 4, buttonKey(this, 66, 30, RARITY_SKIN[item.rarity], false)));
      c.add(outlinedText(this, 41, 22, `x${tier.multiplier}`, 18));
    } else if (item.slot !== 'doll') {
      c.add(uiImage(this, 8, 10, pillKey(this, 92, 26)));
      c.add(this.add.text(56, 24, item.slot.toUpperCase(), textStyle(13, '#ffffff')).setOrigin(0.5));
    }

    const by = 264;
    if (owned) {
      c.add(uiImage(this, W / 2 - 86 - 6, by - 22 - 4, buttonKey(this, 172, 44, 'gray', false)));
      c.add(outlinedText(this, W / 2, by - 2, 'OWNED ✓', 22));
    } else if (secret) {
      c.add(makeButton(this, W / 2, by, 'Find in Boxes', () => this.showTab('boxes'), { w: 184, h: 46, fontSize: 19, skin: 'pink' }));
    } else {
      const price = skinPrice(item.id);
      const options = ['gems', 'popCoins'].filter((cur) => price[cur] !== undefined);
      options.forEach((cur, k) => {
        const bw = options.length === 1 ? 184 : 92;
        const bx = options.length === 1 ? W / 2 : W / 2 + (k ? 48 : -48);
        c.add(this.priceButton(bx, by, { currency: cur, amount: price[cur] }, () => this.onBuySkin(item, cur), { w: bw, h: 46, fontSize: options.length === 1 ? 22 : 18, skin: cur === 'gems' ? 'purple' : 'yellow' }));
      });
    }
  }

  onBuySkin(item, currency) {
    const res = buySkin(Services.save, item.id, currency);
    if (!res.ok) return res.reason === 'insufficient' ? this.notEnough(currency) : Services.audio.play('error');
    Services.audio.play('powerup');
    this.celebrate(`${item.name} unlocked!`, '#ffc93c');
    this.offerEquip(item);
    this.rebuild();
  }

  /** After buying a skin: show it off and offer to wear it right away. */
  offerEquip(item) {
    const tier = RARITY_TIERS[item.rarity];
    const modal = new Modal(this, { width: 520, height: 470, title: 'Unlocked!', ribbon: RARITY_SKIN[item.rarity] });
    modal.add(this.add.image(260, 90, 'fx_rays').setScale(0.9).setTint(tier.color).setAlpha(0.6));
    const icon = this.add.image(260, 170, `icon_${item.id}`).setScale((1.5 * 0.75) / ICON_RES);
    this.tweens.add({ targets: icon, y: 160, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut' });
    modal.add([icon, outlinedText(this, 260, 300, item.name, 32, Phaser.Display.Color.IntegerToColor(tier.color).rgba)]);
    if (item.slot === 'doll' && tier.multiplier > 1) modal.add(this.add.text(260, 340, `Runs with this skin earn x${tier.multiplier}!`, textStyle(20, '#7a4dd6')).setOrigin(0.5));
    modal.add(
      makeButton(
        this,
        260,
        400,
        'Wear it now',
        () => {
          Services.save.equip(item.slot, item.id);
          bakePlayerTextures(this, Services.save.data.equipped);
          Services.bus.emit('ui:toast', { text: `${item.name} equipped!`, color: COLORS.gold });
          modal.close();
        },
        { w: 260, h: 60, fontSize: 26, skin: 'yellow' }
      )
    );
  }

  // -------------------------------------------------------------------------- boosts & upgrades

  buildBoosts() {
    this.sectionTitle(0, 'Boosts', '#ffb347', 'Use them at the start of a run!');
    const W = 320;
    const H = 330;
    const keys = Object.keys(BOOST_ITEMS);
    const g1 = this.grid(keys.length, W, H, 86);
    keys.forEach((key, i) => {
      const item = BOOST_ITEMS[key];
      const c = this.row(g1.pos[i].x, g1.pos[i].y, H);
      c.add(addPanel(this, 0, 0, W, H, { header: key === 'headStart' ? 0xff7a1a : 0xffb400, headerH: 56, radius: 26 }));
      c.add(outlinedText(this, W / 2, 29, item.name, 26));
      const icon = this.add.image(W / 2, 128, item.icon).setScale(1.9);
      this.tweens.add({ targets: icon, y: 118, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut' });
      c.add(icon);
      c.add(this.add.text(W / 2, 192, key === 'headStart' ? `Rocket ride to ${(HEAD_START.BASE_M + HEAD_START.PER_LEVEL_M * upgradeLevel(Services.save, 'headStart')).toLocaleString('en-US')} m!` : item.desc, textStyle(18, '#5a4a6a', { align: 'center', wordWrap: { width: W - 30 } })).setOrigin(0.5));
      c.add(outlinedText(this, W / 2, 228, `You have ${boostCount(Services.save, key)}`, 22, '#ffe066'));
      c.add(this.priceButton(W / 2 - 74, 290, { currency: 'popCoins', amount: item.price.popCoins }, () => this.onBuyBoost(key, 'popCoins'), { w: 138, h: 50, fontSize: 21, skin: 'yellow' }));
      c.add(this.priceButton(W / 2 + 74, 290, { currency: 'gems', amount: item.price.gems }, () => this.onBuyBoost(key, 'gems'), { w: 138, h: 50, fontSize: 21, skin: 'purple' }));
    });

    let y = g1.bottom + 30;
    this.sectionTitle(y, 'Upgrades', '#8fd3ff', 'Spend coins to make power-ups last longer');
    const UW = Math.min(this.CW, 600);
    const UH = 120;
    UPGRADE_ORDER.forEach((key, i) => {
      const up = UPGRADES[key];
      const lvl = upgradeLevel(Services.save, key);
      const cost = upgradeCost(Services.save, key);
      const c = this.row((this.CW - UW) / 2, y + 86 + i * (UH + 14), UH);
      c.add(addPanel(this, 0, 0, UW, UH, { radius: 24 }));
      c.add(this.add.circle(62, UH / 2, 40, 0x3d2a52, 0.12));
      c.add(this.add.image(62, UH / 2, up.icon).setScale(1.25));
      c.add(this.add.text(118, 30, up.name, textStyle(22, COLORS.text)).setOrigin(0, 0.5));
      // Level pips
      for (let k = 0; k < UPGRADE_COSTS.length; k++) {
        c.add(this.add.rectangle(118 + k * 34, 64, 28, 16, k < lvl ? 0x2fc24f : 0xd9cfe3).setStrokeStyle(2, 0x2d1b3d).setOrigin(0, 0.5));
      }
      const fmt = (l) => (key === 'headStart' ? `${(HEAD_START.BASE_M + HEAD_START.PER_LEVEL_M * l).toLocaleString('en-US')} m` : `${(UPGRADE_BASE[key] * (1 + UPGRADE_STEP * l)).toFixed(1)} s`);
      c.add(this.add.text(118, 94, cost === null ? `${fmt(lvl)} · MAX` : `${fmt(lvl)} → ${fmt(lvl + 1)}`, textStyle(16, '#7a6a8a')).setOrigin(0, 0.5));
      if (cost === null) c.add(outlinedText(this, UW - 90, UH / 2, 'MAX', 28, '#6ee7a8'));
      else c.add(this.priceButton(UW - 92, UH / 2, { currency: 'popCoins', amount: cost }, () => this.onUpgrade(key), { w: 150, h: 54, fontSize: 22, skin: 'green' }));
    });
    return y + 86 + UPGRADE_ORDER.length * (UH + 14);
  }

  onBuyBoost(key, currency) {
    const res = buyBoost(Services.save, key, currency);
    if (!res.ok) return res.reason === 'insufficient' ? this.notEnough(currency) : Services.audio.play('error');
    this.celebrate(`+1 ${BOOST_ITEMS[key].name}`, '#ffb347');
    this.rebuild();
  }

  onUpgrade(key) {
    const res = buyUpgrade(Services.save, key);
    if (!res.ok) return res.reason === 'insufficient' ? this.notEnough('popCoins') : Services.audio.play('error');
    Services.audio.play('powerup');
    this.celebrate(`${UPGRADES[key].name} level ${res.level}!`, '#8fd3ff');
    this.rebuild();
  }

  // -------------------------------------------------------------------------- gems

  buildGems() {
    this.sectionTitle(0, 'Gems', '#ff9ef0', 'Use gems for skins, Sparkle Boxes and Mega Mystery Boxes');
    const W = 270;
    const H = 320;
    const cards = [{ free: true }, ...GEM_BUNDLES];
    const { pos, bottom } = this.grid(cards.length, W, H, 86);
    cards.forEach((b, i) => {
      const c = this.row(pos[i].x, pos[i].y, H);
      c.add(addPanel(this, 0, 0, W, H, { header: b.free ? 0x2fc24f : 0x8a4dff, headerH: 54, radius: 26 }));
      c.add(outlinedText(this, W / 2, 28, b.free ? 'Free Gems' : b.label, 24));
      const n = b.free ? 1 : Math.min(5, i + 1);
      for (let k = 0; k < n; k++) {
        const a = (k / Math.max(1, n)) * Math.PI * 2;
        const r = n === 1 ? 0 : 26;
        const g = this.add.image(W / 2 + Math.cos(a) * r, 130 + Math.sin(a) * r * 0.6, 'gem').setScale(n === 1 ? 2.2 : 1.6);
        this.tweens.add({ targets: g, y: g.y - 6, yoyo: true, repeat: -1, duration: 700 + k * 90, ease: 'Sine.easeInOut' });
        c.add(g);
      }
      c.add(outlinedText(this, W / 2, 210, b.free ? `x${FREE_GEMS}` : `x${b.gems.toLocaleString('en-US')}`, 36, '#ffd6fb'));
      if (b.bonus) {
        const tag = this.add.container(W - 40, 76).setAngle(12);
        tag.add([uiImage(this, -50 - 6, -16 - 4, buttonKey(this, 100, 32, 'red', false)), outlinedText(this, 0, -1, b.bonus, 15)]);
        c.add(tag);
      }
      if (b.free) {
        const used = Services.save.data.shop?.bought?.includes('ad_gems');
        const btn = makeButton(this, W / 2, 280, used ? 'Tomorrow!' : 'Watch video', () => this.freeGems(btn), { w: 210, h: 54, fontSize: 22, skin: 'green' });
        btn.setEnabled(!used);
        c.add(btn);
      } else {
        c.add(makeButton(this, W / 2, 280, b.price, () => this.buyGems(b), { w: 210, h: 54, fontSize: 26, skin: 'yellow' }));
      }
    });
    const note = this.row(0, bottom + 20, 60);
    note.add(
      this.add
        .text(this.CW / 2, 20, 'Real-money purchases need a grown-up and are only available in the App Store / Google Play version.', textStyle(16, '#fff4e6', { align: 'center', wordWrap: { width: Math.min(this.CW - 40, 640) }, stroke: INK, strokeThickness: 3 }))
        .setOrigin(0.5, 0)
    );
    return bottom + 80;
  }

  async freeGems(btn) {
    btn.setEnabled(false);
    const ok = await showRewardedAd(this);
    if (!this.scene.isActive()) return;
    if (!ok) {
      btn.setEnabled(true);
      Services.bus.emit('ui:toast', { text: 'Videos need an internet connection', color: 0x9aa0a6 });
      return;
    }
    const data = Services.save.data;
    data.shop.bought.push('ad_gems');
    Services.save.addCurrency('gems', FREE_GEMS, 'ad_gems');
    this.celebrate(`+${FREE_GEMS} Gems`, '#ff9ef0');
    this.rebuild();
  }

  async buyGems(bundle) {
    const res = await purchaseGems(bundle);
    if (res.ok) {
      Services.save.addCurrency('gems', bundle.gems, `iap:${bundle.id}`);
      this.celebrate(`+${bundle.gems} Gems`, '#ff9ef0');
      this.rebuild();
      return;
    }
    if (res.reason === 'cancelled') return;
    const modal = new Modal(this, { width: 560, height: 360, title: 'Ask a grown-up', ribbon: 'purple' });
    modal.add([
      this.add.image(280, 110, 'gem').setScale(2),
      this.add
        .text(280, 200, 'Gem packs can be bought in the App Store or Google Play version of the game.\nYou can still earn free gems every day!', textStyle(19, '#5a4a6a', { align: 'center', wordWrap: { width: 480 } }))
        .setOrigin(0.5),
      makeButton(this, 280, 300, 'OK', () => modal.close(), { w: 180, h: 56, fontSize: 26, skin: 'green' })
    ]);
  }

  // -------------------------------------------------------------------------- nav

  leave(key = 'MainMenu', data) {
    this.input.enabled = false;
    this.list?.destroy();
    this.cameras.main.fadeOut(200, 43, 29, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}
