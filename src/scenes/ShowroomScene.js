/**
 * ShowroomScene.js
 * Wardrobe & collection viewer:
 *  - Live preview of the dressed doll (re-baked whenever equipment changes).
 *  - Stats inspector showing the gameplay perks of the current loadout.
 *  - Tabbed wardrobe grid per slot: owned items equip on tap, locked items
 *    appear as rarity-framed silhouettes so players know what to chase.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, COLORS } from '../config/GameConfig.js';
import { CATALOG, RARITY_TIERS, RARITY_ORDER, describePerks } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { computePerks } from '../systems/PerkCalculator.js';
import { bakePlayerTextures, ICON_RES } from '../art/CharacterRenderer.js';
import { addForestBackdrop, CurrencyBar, makeButton, makePanel, outlinedText, textStyle, displayStyle, ScrollList } from '../ui/UIKit.js';
import { INK, uiImage, cardKey, buttonKey } from '../ui/Skin.js';

const TABS = [
  { slot: 'doll', label: 'Dolls' },
  { slot: 'outfit', label: 'Outfits' },
  { slot: 'headwear', label: 'Hats' },
  { slot: 'tail', label: 'Tails' },
  { slot: 'shoes', label: 'Shoes' }
];

// Grid inside the wardrobe panel (panel-local coordinates).
const GRID = { x: 15, y: 92, cols: 3, cellW: 150, cellH: 172, viewH: 506 };
const MULT_SKIN = { rare: 'green', epic: 'purple', legendary: 'yellow', secret: 'pink' };

export class ShowroomScene extends Phaser.Scene {
  constructor() {
    super('Showroom');
  }

  init() {
    this.activeTab = this.activeTab || 'doll';
    this.selectedId = Services.save.data.equipped.baseDoll;
  }

  create() {
    Services.audio.playMusic('menu');
    addForestBackdrop(this, { dim: 0.35 });
    new CurrencyBar(this, 20, 16);
    const portraitTop = HEIGHT > WIDTH;
    makeButton(this, portraitTop ? 84 : WIDTH - 100, portraitTop ? 100 : 42, 'Back', () => this.leave(), { w: portraitTop ? 130 : 160, h: 54, fontSize: 24, skin: 'green' });
    makeButton(this, portraitTop ? 245 : WIDTH - 290, portraitTop ? 100 : 42, 'Shop', () => this.leave('Shop', { tab: 'skins' }), { w: portraitTop ? 150 : 160, h: 54, fontSize: 24, skin: 'purple', icon: 'gem', iconScale: 0.6 });

    // Layout: landscape = preview | stats | wardrobe; portrait = preview +
    // stats on top, wardrobe (scaled to fit) below.
    const portrait = HEIGHT > WIDTH;
    const OX = portrait ? 0 : Math.round((WIDTH - 1280) / 2);
    const P = portrait
      ? { hero: [190, 560, 1.0], name: [190, 600], coll: [190, 632], stats: [412, 100], ward: null }
      : { hero: [250 + OX, 606, 1.3], name: [250 + OX, 660], coll: [250 + OX, 696], stats: [480 + OX, 90], ward: [780 + OX, 90, 1] };
    if (portrait) {
      const top = 720;
      const ws = Math.min((WIDTH - 24) / 480, (HEIGHT - top - 16) / 610);
      P.ward = [(WIDTH - 480 * ws) / 2, top, ws];
    }

    // Preview
    const [hx, hy, hs] = P.hero;
    this.add.image(hx, hy - 6, 'pedestal').setScale(hs / 1.3);
    this.preview = this.add.image(hx, hy, 'player_preview').setOrigin(0.5, 1).setScale(hs);
    this.previewY = hy;
    this.tweens.add({ targets: this.preview, scaleY: hs * 1.03, scaleX: hs * 0.98, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.dollName = outlinedText(this, ...P.name, '', 26, '#fff4e6');
    this.collectionText = this.add.text(...P.coll, '', textStyle(18, '#fff4e6', { stroke: '#3d2a52', strokeThickness: 4 })).setOrigin(0.5);

    // Stats inspector (panel-local layout)
    const st = this.add.container(...P.stats);
    st.add(makePanel(this, 0, 0, 290, 610, { header: 0x2f8cff, headerH: 52 }));
    st.add(outlinedText(this, 145, 26, 'Stats', 28));
    this.statsText = this.add.text(20, 66, '', textStyle(18, COLORS.text, { lineSpacing: 9 }));
    this.statsValues = this.add.text(272, 66, '', textStyle(18, '#3fa98a', { lineSpacing: 9, align: 'right' })).setOrigin(1, 0);
    this.detailTitle = this.add.text(145, 384, '', textStyle(20, COLORS.text, { align: 'center', wordWrap: { width: 260 } })).setOrigin(0.5, 0);
    this.detailBody = this.add.text(20, 418, '', textStyle(15, '#5a4a6a', { wordWrap: { width: 255 }, fontStyle: 'normal', lineSpacing: 2 }));
    st.add([this.statsText, this.statsValues, this.add.graphics().lineStyle(2, COLORS.panelDark, 0.25).lineBetween(20, 372, 270, 372), this.detailTitle, this.detailBody]);
    if (portrait) st.setScale(Math.min(1, (HEIGHT * 0.45) / 610));

    // Wardrobe (panel-local layout, scaled as one unit)
    const [wx, wy, ws] = P.ward;
    this.wardrobe = this.add.container(wx, wy).setScale(ws);
    this.wardrobe.add(makePanel(this, 0, 0, 480, 610));
    this.tabButtons = TABS.map((tab, i) => makeButton(this, 50 + i * 95, 42, tab.label, () => this.selectTab(tab.slot), { w: 88, h: 46, fontSize: 18, skin: 'blue', sound: 'click' }));
    this.wardrobe.add(this.tabButtons);
    this.gridList = new ScrollList(this, this.wardrobe, 0, GRID.y, 480, GRID.viewH);
    this.grid = this.gridList.inner;
    this.events.once('shutdown', () => this.gridList.destroy());

    this.refreshAll();
    this.cameras.main.fadeIn(220, 43, 29, 58);
  }

  selectTab(slot) {
    this.activeTab = slot;
    this.refreshGrid();
  }

  refreshAll() {
    this.refreshPreview();
    this.refreshStats();
    this.refreshGrid();
    this.refreshDetail(this.selectedId);
  }

  refreshPreview() {
    const d = Services.save.data;
    this.preview.setTexture('player_preview');
    this.dollName.setText(CATALOG[d.equipped.baseDoll].name);
    this.collectionText.setText(`Collection ${d.inventory.length}/${Object.keys(CATALOG).length}`);
  }

  /** Lists every perk of the current loadout, highlighting non-default values. */
  refreshStats() {
    const p = computePerks(Services.save.data.equipped);
    const idle = Services.idle;
    const rows = [
      ['Skin bonus', `x${p.skinMultiplier}`],
      ['Jump power', `${Math.round(p.jumpMultiplier * 100)}%`],
      ['Air jumps', p.maxJumps === 3 ? 'Triple' : 'Double'],
      ['Glide (hold)', p.floatyFall ? 'Yes' : 'No'],
      ['Coin magnet', `${p.attractRadius.toFixed(1)} m`],
      ['Shield', p.shieldCharges ? `${p.shieldCharges} hit` : 'None'],
      ['Coin value', `x${p.coinMultiplier.toFixed(2)}`],
      ['Gravity', `${Math.round(p.gravityMultiplier * 100)}%`],
      ['Idle rate', `x${idle.getTotalMultiplier().toFixed(2)}`],
      ['Bank / hour', `${Math.round(idle.getRatePerSecond() * 3600)}`]
    ];
    this.statsText.setText(rows.map((r) => r[0]).join('\n'));
    this.statsValues.setText(rows.map((r) => r[1]).join('\n'));
  }

  refreshDetail(id) {
    const item = CATALOG[id];
    if (!item) return;
    const owned = Services.save.hasItem(id);
    const tier = RARITY_TIERS[item.rarity];
    this.detailTitle.setText(owned ? item.name : `??? (${tier.label})`);
    this.detailTitle.setColor(Phaser.Display.Color.IntegerToColor(tier.dark).rgba);
    const how = item.rarity === 'secret' ? 'Mystery! Only found in blind boxes.' : 'Not collected yet. Find it in blind boxes or buy it in the Shop!';
    this.detailBody.setText(owned ? `${item.description}\n\n${describePerks(item.perks, item).map((l) => `• ${l}`).join('\n')}` : how);
  }

  /** Rebuilds the item grid for the active tab. */
  refreshGrid() {
    this.grid.removeAll(true);
    TABS.forEach((tab, i) => {
      const on = tab.slot === this.activeTab;
      this.tabButtons[i].setScale(on ? 1.06 : 1).setAlpha(on ? 1 : 0.85);
      this.tabButtons[i].label.setColor(on ? '#ffe066' : '#ffffff');
    });

    const d = Services.save.data;
    const items = Object.values(CATALOG)
      .filter((it) => it.slot === this.activeTab)
      .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));

    const CW = 132;
    const CH = 160;
    items.forEach((item, i) => {
      const col = i % GRID.cols;
      const row = Math.floor(i / GRID.cols);
      const cx = GRID.x + col * GRID.cellW + GRID.cellW / 2;
      const cy = 8 + row * GRID.cellH + CH / 2;
      const owned = Services.save.hasItem(item.id);
      const equipped = Object.values(d.equipped).includes(item.id);
      const tier = RARITY_TIERS[item.rarity];

      const card = this.add.container(cx, cy);
      card.rowHeight = CH;
      card.y = cy - CH / 2; // rows are culled by their top edge
      const inner = this.add.container(0, CH / 2);
      card.add(inner);
      inner.add(uiImage(this, -CW / 2 - 6, -CH / 2 - 4, cardKey(this, CW, CH, item.rarity, !owned)));
      const icon = this.add.image(0, -12, `icon_${item.id}`).setScale((0.82 * 0.75) / ICON_RES);
      if (!owned) icon.setTintFill(0x2d1b3d).setAlpha(0.6);
      const name = this.add.text(0, CH / 2 - 15, owned ? item.name : tier.label, displayStyle(13, '#ffffff', { stroke: INK, strokeThickness: 3 })).setOrigin(0.5);
      inner.add([icon, name]);
      if (!owned) inner.add(outlinedText(this, 0, -16, '?', 50, '#ffffff'));
      if (item.slot === 'doll' && tier.multiplier > 1) {
        inner.add(uiImage(this, -CW / 2 + 4 - 6, -CH / 2 + 4 - 4, buttonKey(this, 52, 24, MULT_SKIN[item.rarity], false)));
        inner.add(outlinedText(this, -CW / 2 + 30, -CH / 2 + 15, `x${tier.multiplier}`, 15));
      }
      if (equipped) {
        const badge = this.add.container(CW / 2 - 14, -CH / 2 + 14);
        badge.add([this.add.circle(0, 0, 15, 0x2fc24f).setStrokeStyle(3, 0xffffff), this.add.text(0, 0, '✓', textStyle(18, '#ffffff')).setOrigin(0.5)]);
        inner.add(badge);
      }
      inner.setSize(CW, CH).setInteractive({ useHandCursor: true });
      let downY = 0;
      inner.on('pointerdown', (p) => (downY = p.y));
      inner.on('pointerup', (p) => {
        if (Math.abs(p.y - downY) > 14 * RES || !this.gridList.contains(p)) return; // scroll drag
        this.onItemTapped(item, owned, equipped, inner);
      });
      this.grid.add(card);
    });
    const rows = Math.ceil(items.length / GRID.cols);
    this.gridList.setContentHeight(rows * GRID.cellH + 16);
    this.gridList.setScroll(0);
  }

  /** Equip / unequip an owned item; locked items just show their teaser. */
  onItemTapped(item, owned, equipped, card) {
    this.selectedId = item.id;
    this.refreshDetail(item.id);
    if (!owned) {
      Services.audio.play('error');
      this.tweens.add({ targets: card, x: card.x + 6, yoyo: true, repeat: 2, duration: 50 });
      return;
    }
    const save = Services.save;
    let changed = false;
    if (equipped && item.slot !== 'doll') changed = save.equip(item.slot, null);
    else if (!equipped) changed = save.equip(item.slot, item.id);
    if (!changed) return;

    Services.audio.play(equipped ? 'slide' : 'powerup');
    bakePlayerTextures(this, save.data.equipped);
    this.refreshAll();
    this.refreshDetail(item.id);
    this.tweens.add({ targets: this.preview, y: this.previewY - 36, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
  }

  leave(key = 'MainMenu', data) {
    this.input.enabled = false;
    this.cameras.main.fadeOut(200, 43, 29, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}
