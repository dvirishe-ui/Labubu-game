/**
 * LoginScene.js
 * The start screen. It signs the player in (Claude account / cloud backend),
 * brings back their saved progress and greets them:
 *  - "Welcome back, Name!" with their level, coins and collection, or
 *  - "Welcome, new player!" with a name picker, or
 *  - guest mode (progress kept on this device) with save-code transfer.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS } from '../config/GameConfig.js';
import { CATALOG } from '../config/GachaDropTable.js';
import { Services } from '../systems/Services.js';
import { accountReady } from '../systems/Account.js';
import { levelInfo } from '../systems/Progression.js';
import { importSaveCode } from '../systems/SaveCode.js';
import { bakePlayerTextures } from '../art/CharacterRenderer.js';
import { askText } from '../ui/TextPrompt.js';
import { addForestBackdrop, makeButton, outlinedText, textStyle, floatText } from '../ui/UIKit.js';
import { INK, uiImage, addPanel, vignetteKey } from '../ui/Skin.js';

export class LoginScene extends Phaser.Scene {
  constructor() {
    super('Login');
  }

  create() {
    Services.audio.playMusic('menu');
    addForestBackdrop(this);
    uiImage(this, 0, 0, vignetteKey(this)).setDisplaySize(WIDTH, HEIGHT);
    const portrait = HEIGHT > WIDTH;
    this.portrait = portrait;

    const logoY = portrait ? 170 : 90;
    const logo = outlinedText(this, WIDTH / 2, logoY, 'LABUBU', portrait ? 96 : 80, '#ff8fb1');
    this.tweens.add({ targets: logo, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
    outlinedText(this, WIDTH / 2, logoY + (portrait ? 70 : 58), 'Blind Box Run & Collect', 30, '#fff4e6');

    const heroX = portrait ? WIDTH / 2 : WIDTH * 0.27;
    const feet = portrait ? HEIGHT * 0.52 : HEIGHT - 70;
    this.add.image(heroX, feet - 5, 'pedestal').setScale(0.9);
    this.hero = this.add.image(heroX, feet, 'player_preview').setOrigin(0.5, 1).setScale(portrait ? 0.95 : 1.05);
    this.tweens.add({ targets: this.hero, scaleY: this.hero.scaleY * 1.03, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });

    // Card that holds the sign-in state
    this.CW = Math.min(WIDTH - 40, 560);
    this.CH = 330;
    const cx = portrait ? WIDTH / 2 : WIDTH * 0.66;
    const cy = portrait ? feet + 40 + this.CH / 2 : HEIGHT / 2 + 40;
    this.card = this.add.container(cx - this.CW / 2, cy - this.CH / 2);
    this.cameras.main.fadeIn(300, 43, 29, 58);

    this.showConnecting();
    accountReady().then((acct) => {
      if (!this.scene.isActive()) return;
      this.account = acct;
      // The cloud may have brought back a different outfit.
      bakePlayerTextures(this, Services.save.data.equipped);
      this.hero.setTexture('player_preview');
      if (acct.cloud && acct.newPlayer) this.showNewPlayer();
      else if (acct.cloud) this.showWelcomeBack();
      else this.showGuest();
    });
  }

  clearCard(header = 0x8a4dff, title = '') {
    this.card.removeAll(true);
    this.card.add(addPanel(this, 0, 0, this.CW, this.CH, { header, headerH: 58, radius: 28 }));
    if (title) this.card.add(outlinedText(this, this.CW / 2, 30, title, 30));
  }

  text(y, str, size = 20, color = '#5a4a6a') {
    const t = this.add.text(this.CW / 2, y, str, textStyle(size, color, { align: 'center', wordWrap: { width: this.CW - 50 } })).setOrigin(0.5);
    this.card.add(t);
    return t;
  }

  showConnecting() {
    this.clearCard(0x2f8cff, 'Signing in…');
    const coin = this.add.image(this.CW / 2, 130, 'coin').setScale(1.6);
    this.tweens.add({ targets: coin, scaleX: { from: 1.6, to: -1.6 }, yoyo: true, repeat: -1, duration: 500 });
    this.card.add(coin);
    this.text(200, 'Looking for your saved progress', 20);
    this.card.add(makeButton(this, this.CW / 2, 280, 'Play as guest', () => this.play(), { w: 240, h: 54, fontSize: 22, skin: 'gray' }));
  }

  summaryLines() {
    const d = Services.save.data;
    const lv = levelInfo(d.progress.xp).level;
    const owned = d.inventory.length;
    return `Level ${lv} · ${d.currencies.popCoins.toLocaleString('en-US')} coins · ${owned}/${Object.keys(CATALOG).length} collected`;
  }

  showWelcomeBack() {
    const d = Services.save.data;
    this.clearCard(0x2fc24f, 'Welcome back!');
    this.card.add(outlinedText(this, this.CW / 2, 98, d.profile.displayName, 34, '#ffe066'));
    this.text(146, this.summaryLines(), 19);
    this.text(184, '☁  Your progress is saved to your account', 17, '#2f8a5a');
    this.playButton(262);
    Services.audio.play('itemGet');
  }

  showNewPlayer() {
    const acct = this.account;
    this.clearCard(0xff4f9a, 'Welcome, new player!');
    this.text(96, 'Your progress will be saved to your account, so you can keep playing on any device.', 18);
    const suggested = (acct.accountName || '').split(' ')[0];
    if (suggested) Services.sync.setDisplayName(suggested);
    const nameText = outlinedText(this, this.CW / 2, 162, Services.save.data.profile.displayName, 30, '#ffe066');
    this.card.add(nameText);
    this.card.add(
      makeButton(
        this,
        this.CW / 2,
        210,
        'Change name',
        async () => {
          const name = await askText({ title: 'Choose your player name', value: Services.save.data.profile.displayName, maxLength: 18 });
          if (name && Services.sync.setDisplayName(name)) nameText.setText(Services.save.data.profile.displayName);
        },
        { w: 200, h: 46, fontSize: 19, skin: 'blue' }
      )
    );
    this.playButton(276);
  }

  showGuest() {
    const acct = this.account;
    this.clearCard(0xff9f43, acct?.readOnly ? 'Signed in (view only)' : 'Playing as guest');
    this.text(
      104,
      acct?.readOnly
        ? 'This link lets you view the game but not save to the cloud. Your progress is kept on this device.'
        : 'Your progress is kept on this device. Sign in to Claude to save it everywhere, or use a save code to move it.',
      17
    );
    this.text(168, this.summaryLines(), 17, '#7a6a8a');
    this.card.add(makeButton(this, this.CW / 2, 216, 'I have a save code', () => this.loadCode(), { w: 260, h: 46, fontSize: 19, skin: 'blue' }));
    this.playButton(282);
  }

  playButton(y) {
    const b = makeButton(this, this.CW / 2, y, 'PLAY', () => this.play(), { w: 260, h: 74, fontSize: 40, skin: 'yellow' });
    this.tweens.add({ targets: b, scale: 1.05, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut' });
    this.card.add(b);
  }

  async loadCode() {
    const code = await askText({ title: 'Paste your save code', value: '', maxLength: 200000, multiline: true, okLabel: 'Load' });
    if (!code) return;
    try {
      await importSaveCode(Services.save, code);
      bakePlayerTextures(this, Services.save.data.equipped);
      this.hero.setTexture('player_preview');
      Services.audio.play('spinWin');
      floatText(this, WIDTH / 2, HEIGHT / 2, 'Progress loaded!', '#6ee7a8', 40);
      this.showGuest();
    } catch {
      Services.audio.play('error');
      Services.bus.emit('ui:toast', { text: "That code didn't work", sub: 'Copy the whole code and try again', color: COLORS.pink });
    }
  }

  play() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(220, 43, 29, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenu'));
  }
}
