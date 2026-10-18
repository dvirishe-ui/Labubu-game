/**
 * UIOverlayScene.js
 * Always-on-top scene that renders toast notifications (quest completed,
 * connectivity changes, generic messages) no matter which scene is active.
 * Any system can raise a toast with: Services.bus.emit('ui:toast', { text, color }).
 */
import Phaser from 'phaser';
import { WIDTH, COLORS, EVENTS } from '../config/GameConfig.js';
import { Services } from '../systems/Services.js';
import { textStyle } from '../ui/UIKit.js';

export class UIOverlayScene extends Phaser.Scene {
  constructor() {
    super('UIOverlay');
  }

  create() {
    this.queue = [];
    this.showing = false;
    this.lastNet = null;
    const bus = Services.bus;

    bus.on('ui:toast', (t) => this.enqueue(t), this);
    bus.on(
      EVENTS.QUEST_COMPLETED,
      ({ title }) => {
        Services.audio.play('questComplete');
        this.enqueue({ text: `Quest complete: ${title}`, color: COLORS.mint, sub: 'Claim it in Quests' });
      },
      this
    );
    bus.on(
      EVENTS.SYNC_STATUS,
      ({ status }) => {
        // Only announce real connectivity transitions, not every sync tick.
        const net = status === 'offline' ? 'offline' : status === 'local' ? 'local' : 'online';
        if (this.lastNet && net !== this.lastNet && net !== 'local') {
          this.enqueue(
            net === 'offline'
              ? { text: 'You are offline', sub: 'Progress is saved on this device', color: 0x9aa0a6 }
              : { text: 'Back online', sub: 'Syncing your collection…', color: COLORS.rare }
          );
        }
        this.lastNet = net;
      },
      this
    );
    this.events.once('shutdown', () => bus.offContext(this));
  }

  enqueue(toast) {
    this.queue.push(toast);
    if (!this.showing) this.next();
  }

  /** Slides the next toast in from the top, holds, then slides it out. */
  next() {
    const toast = this.queue.shift();
    if (!toast) {
      this.showing = false;
      return;
    }
    this.showing = true;
    const w = 560;
    const h = toast.sub ? 78 : 58;
    const c = this.add.container(WIDTH / 2, -h);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 3, 5, w, h, 20);
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(-w / 2, 0, w, h, 20);
    g.fillStyle(toast.color ?? COLORS.pink, 1).fillRoundedRect(-w / 2, 0, 18, h, { tl: 20, bl: 20, tr: 0, br: 0 });
    g.lineStyle(3, COLORS.panelDark, 1).strokeRoundedRect(-w / 2, 0, w, h, 20);
    const t = this.add.text(10, toast.sub ? 24 : h / 2, toast.text, textStyle(24)).setOrigin(0.5);
    c.add([g, t]);
    if (toast.sub) c.add(this.add.text(10, 54, toast.sub, textStyle(18, '#7a6a8a')).setOrigin(0.5));

    this.tweens.chain({
      targets: c,
      tweens: [
        { y: 14, duration: 280, ease: 'Back.easeOut' },
        { y: 14, duration: toast.duration ?? 2000 },
        { y: -h - 10, duration: 220, ease: 'Quad.easeIn' }
      ],
      onComplete: () => {
        c.destroy();
        this.next();
      }
    });
  }
}
