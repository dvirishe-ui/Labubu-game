/**
 * ArcadeUI.js
 * Shared pieces for the Arcade mini-game scenes: the neon backdrop, the top
 * bar (back button + title) and the prize/result dialog.
 */
import { WIDTH, HEIGHT } from '../../config/GameConfig.js';
import { CATALOG } from '../../config/GachaDropTable.js';
import { Services } from '../../systems/Services.js';
import { usePlay, playsLeft } from '../../systems/MiniGames.js';
import { rewardIcon, rewardLabel } from '../../systems/Rewards.js';
import { ICON_RES, bakePlayerTextures } from '../../art/CharacterRenderer.js';
import { makeButton, Modal, outlinedText, textStyle } from '../../ui/UIKit.js';
import { uiImage, vignetteKey } from '../../ui/Skin.js';

/** Dark arcade room with neon light streaks. */
export function arcadeBackdrop(scene, title, backTo = 'Arcade') {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x2a1150, 0x2a1150, 0x12062a, 0x12062a, 1);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  const neon = [0xff4fa3, 0x39e6ff, 0xffd23f, 0x8a4dff];
  for (let i = 0; i < 14; i++) {
    g.fillStyle(neon[i % neon.length], 0.07);
    g.fillCircle((i * 173) % WIDTH, (i * 311) % HEIGHT, 60 + (i % 4) * 30);
  }
  uiImage(scene, 0, 0, vignetteKey(scene)).setDisplaySize(WIDTH, HEIGHT);
  const portrait = HEIGHT > WIDTH;
  makeButton(scene, portrait ? 84 : 100, portrait ? 52 : 46, 'Back', () => leaveTo(scene, backTo), { w: portrait ? 130 : 150, h: 54, fontSize: 24, skin: 'green' }).setDepth(50);
  const t = outlinedText(scene, WIDTH / 2, portrait ? 112 : 46, title, portrait ? 44 : 40, '#ffe066').setDepth(50);
  scene.tweens.add({ targets: t, scale: 1.04, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
  scene.cameras.main.fadeIn(220, 18, 6, 42);
}

export function leaveTo(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.cameras.main.fadeOut(200, 18, 6, 42);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

/**
 * Result dialog listing what was won, with "Play again" (uses a play) and
 * "Arcade" buttons.
 */
export function showArcadeResult(scene, { title, subtitle = '', rewards = [], ribbon = 'pink' }) {
  const items = rewards.filter(Boolean);
  const won = items.find((r) => r.type === 'item' && !r.converted);
  if (won) bakePlayerTextures(scene, Services.save.data.equipped);
  Services.audio.play(items.length ? 'spinWin' : 'error');
  const modal = new Modal(scene, { width: 600, height: 470, title, closable: false, depth: 4000, ribbon });
  if (subtitle) modal.add(scene.add.text(300, 70, subtitle, textStyle(22, '#5a4a6a', { align: 'center', wordWrap: { width: 540 } })).setOrigin(0.5));
  if (won) {
    modal.add(scene.add.image(300, 190, 'fx_rays').setScale(0.55).setTint(0xffd23f).setAlpha(0.6));
    const icon = scene.add.image(300, 190, `icon_${won.id}`).setScale((1.15 * 0.75) / ICON_RES);
    scene.tweens.add({ targets: icon, y: 180, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    modal.add([icon, outlinedText(scene, 300, 290, `${CATALOG[won.id].name}!`, 28, '#ffe066')]);
  }
  const others = items.filter((r) => r !== won);
  const rowY = won ? 340 : 200;
  others.forEach((r, i) => {
    const x = 300 + (i - (others.length - 1) / 2) * 150;
    const icon = scene.add.image(x, rowY - 10, rewardIcon(r));
    if (r.type === 'item') icon.setScale((0.5 * 0.75) / ICON_RES);
    else icon.setScale(1.1);
    modal.add([icon, outlinedText(scene, x, rowY + 34, rewardLabel(r), 18)]);
  });
  if (!items.length) modal.add(outlinedText(scene, 300, 200, 'Better luck next time!', 30, '#ffffff'));
  const left = playsLeft(Services.save);
  modal.add(
    makeButton(
      scene,
      170,
      420,
      left > 0 ? `Again (${left})` : 'Get plays',
      () => {
        if (left > 0 && usePlay(Services.save)) {
          scene._leaving = false;
          scene.scene.restart();
        } else leaveTo(scene, 'Arcade');
      },
      { w: 240, h: 60, fontSize: 24, skin: 'yellow' }
    )
  );
  modal.add(makeButton(scene, 430, 420, 'Arcade', () => leaveTo(scene, 'Arcade'), { w: 220, h: 60, fontSize: 24, skin: 'blue' }));
  return modal;
}
