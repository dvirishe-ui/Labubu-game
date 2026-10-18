/**
 * ShowroomScene.js
 * Wardrobe & collection viewer:
 *  - Live preview of the dressed doll (re-baked whenever equipment changes).
 *  - Stats inspector showing the gameplay perks of the current loadout.
 *  - Tabbed wardrobe grid per slot: owned items equip on tap, locked items
 *    appear as rarity-framed silhouettes so players know what to chase.
 */
import Phaser from 'phaser';
import { WIDTH, COLORS } from '../config/GameConfig.js';
import { CATALOG, RARITY_TIERS, RARITY_ORDER, describePerks } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { computePerks } from '../systems/PerkCalculator.js';
import { bakePlayerTextures, ICON_RES } from '../art/CharacterRenderer.js';
import { addForestBackdrop, CurrencyBar, makeButton, makePanel, outlinedText, textStyle } from '../ui/UIKit.js';

const TABS = [
  { slot: 'doll', label: 'Dolls' },
  { slot: 'outfit', label: 'Outfits' },
  { slot: 'headwear', label: 'Hats' },
  { slot: 'tail', label: 'Tails' },
  { slot: 'shoes', label: 'Shoes' }
];

// Centre the 1280-wide layout on wider screens.
const OX = Math.round((WIDTH - 1280) / 2);
const GRID = { x: 790 + OX, y: 190, cols: 3, cellW: 150, cellH: 162 };

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
    makeButton(this, WIDTH - 100, 42, 'Back', () => this.leave(), { w: 160, h: 54, fontSize: 24, color: COLORS.mint, colorDark: 0x4fb594 });

    // Preview
    this.add.image(250 + OX, 600, 'pedestal');
    this.preview = this.add.image(250 + OX, 606, 'player_preview').setOrigin(0.5, 1).setScale(1.3);
    this.tweens.add({ targets: this.preview, scaleY: 1.33, scaleX: 1.28, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.dollName = outlinedText(this, 250 + OX, 660, '', 26, '#fff4e6');
    this.collectionText = this.add.text(250 + OX, 696, '', textStyle(18, '#fff4e6', { stroke: '#3d2a52', strokeThickness: 4 })).setOrigin(0.5);

    // Stats inspector
    makePanel(this, 480 + OX, 90, 290, 610);
    this.add.text(625 + OX, 118, 'Stats Inspector', textStyle(24)).setOrigin(0.5);
    this.statsText = this.add.text(500 + OX, 148, '', textStyle(18, COLORS.text, { lineSpacing: 9 }));
    this.statsValues = this.add.text(752 + OX, 148, '', textStyle(18, '#3fa98a', { lineSpacing: 9, align: 'right' })).setOrigin(1, 0);
    this.add.graphics().lineStyle(2, COLORS.panelDark, 0.25).lineBetween(500 + OX, 462, 750 + OX, 462);
    this.detailTitle = this.add.text(625 + OX, 474, '', textStyle(20, COLORS.text, { align: 'center', wordWrap: { width: 260 } })).setOrigin(0.5, 0);
    this.detailBody = this.add.text(500 + OX, 508, '', textStyle(15, '#5a4a6a', { wordWrap: { width: 255 }, fontStyle: 'normal', lineSpacing: 2 }));

    // Wardrobe
    makePanel(this, 780 + OX, 90, 480, 610);
    this.tabButtons = TABS.map((tab, i) =>
      makeButton(this, 830 + OX + i * 95, 135, tab.label, () => this.selectTab(tab.slot), { w: 90, h: 46, fontSize: 17, sound: 'click' })
    );
    this.grid = this.add.container(0, 0);

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
      ['Jump power', `${Math.round(p.jumpMultiplier * 100)}%`],
      ['Air jumps', p.maxJumps === 3 ? 'Triple' : 'Double'],
      ['Glide (hold)', p.floatyFall ? 'Yes' : 'No'],
      ['Coin magnet', `${p.attractRadius}px`],
      ['Shield', p.shieldCharges ? `${p.shieldCharges} hit` : 'None'],
      ['Coin value', `x${p.coinMultiplier.toFixed(2)}`],
      ['Gravity', `${Math.round(p.gravityMultiplier * 100)}%`],
      ['Ticket luck', `+${Math.round(p.ticketLuck * 100)}%`],
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
    this.detailTitle.setColor(Phaser.Display.Color.IntegerToColor(tier.color === 0x9aa0a6 ? 0x3d2a52 : tier.color).rgba);
    this.detailBody.setText(
      owned ? `${item.description}\n\n${describePerks(item.perks).map((l) => `• ${l}`).join('\n')}` : 'Not collected yet. Open blind boxes to find it!'
    );
  }

  /** Rebuilds the item grid for the active tab. */
  refreshGrid() {
    this.grid.removeAll(true);
    TABS.forEach((tab, i) => this.tabButtons[i].setAlpha(tab.slot === this.activeTab ? 1 : 0.6).setScale(tab.slot === this.activeTab ? 1.05 : 1));

    const d = Services.save.data;
    const items = Object.values(CATALOG)
      .filter((it) => it.slot === this.activeTab)
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

    items.forEach((item, i) => {
      const col = i % GRID.cols;
      const row = Math.floor(i / GRID.cols);
      const cx = GRID.x + col * GRID.cellW + GRID.cellW / 2;
      const cy = GRID.y + row * GRID.cellH + GRID.cellH / 2;
      const owned = Services.save.hasItem(item.id);
      const equipped = Object.values(d.equipped).includes(item.id);
      const tier = RARITY_TIERS[item.rarity];

      const card = this.add.container(cx, cy);
      const g = this.add.graphics();
      g.fillStyle(owned ? 0xffffff : 0xd9cfe3, 1).fillRoundedRect(-66, -74, 132, 148, 16);
      g.lineStyle(equipped ? 6 : 4, equipped ? COLORS.gold : tier.color, 1).strokeRoundedRect(-66, -74, 132, 148, 16);
      g.fillStyle(tier.color, 1).fillRoundedRect(-66, 50, 132, 24, { tl: 0, tr: 0, bl: 16, br: 16 });
      const icon = this.add.image(0, -10, `icon_${item.id}`).setScale((0.88 * 0.75) / ICON_RES);
      if (!owned) icon.setTintFill(0x3d2a52).setAlpha(0.55);
      const name = this.add.text(0, 62, owned ? item.name : tier.label, textStyle(13, '#ffffff', { stroke: '#3d2a52', strokeThickness: 3 })).setOrigin(0.5);
      card.add([g, icon, name]);
      if (!owned) card.add(outlinedText(this, 0, -14, '?', 54, '#ffffff'));
      if (equipped) {
        const badge = this.add.container(48, -58);
        badge.add([this.add.circle(0, 0, 15, COLORS.gold).setStrokeStyle(3, COLORS.panelDark), this.add.text(0, 0, '✓', textStyle(18, '#ffffff')).setOrigin(0.5)]);
        card.add(badge);
      }
      card.setSize(132, 148).setInteractive({ useHandCursor: true });
      card.on('pointerup', () => this.onItemTapped(item, owned, equipped, card));
      this.grid.add(card);
    });
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
    this.tweens.add({ targets: this.preview, y: 570, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
  }

  leave() {
    this.input.enabled = false;
    this.cameras.main.fadeOut(200, 43, 29, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenu'));
  }
}
