/**
 * main.js
 * Entry point: builds the long-lived services (save, quests, idle, sync,
 * audio), wires app-lifecycle hooks for mobile, and boots Phaser.
 */
import Phaser from 'phaser';
// Bundled fonts (no network): chunky display face + rounded body face.
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/fredoka/latin-600.css';
import { WIDTH, HEIGHT, RES, COLORS, updateViewport } from './config/GameConfig.js';
import { DisplayPlugin } from './ui/Display.js';
import { Services } from './systems/Services.js';
import { EventBus } from './systems/EventBus.js';
import { SaveManager } from './systems/SaveManager.js';
import { QuestManager } from './systems/QuestManager.js';
import { IdleRewardManager } from './systems/IdleRewardManager.js';
import { SyncManager, createAdapterFromEnv } from './systems/SyncManager.js';
import { AudioController } from './systems/AudioController.js';

import { BootScene } from './scenes/BootScene.js';
import { PreloaderScene } from './scenes/PreloaderScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { RunnerScene } from './scenes/RunnerScene.js';
import { UnboxingScene } from './scenes/UnboxingScene.js';
import { ShowroomScene } from './scenes/ShowroomScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { UIOverlayScene } from './scenes/UIOverlayScene.js';

/** Creates every singleton system and registers it in the Services locator. */
function initServices() {
  const bus = new EventBus();
  const save = new SaveManager({ bus });
  save.load();

  const audio = new AudioController();
  audio.setMuted(Boolean(save.data.settings.muted));
  audio.setMusicEnabled(save.data.settings.music !== false);

  const quests = new QuestManager(save, bus);
  quests.start();

  const idle = new IdleRewardManager(save);
  const sync = new SyncManager({ saveManager: save, bus, adapter: createAdapterFromEnv(import.meta.env) });

  Object.assign(Services, { bus, save, audio, quests, idle, sync });
  sync.start();
}

/** Mobile lifecycle: flush saves when backgrounded, resync when resumed. */
function initLifecycle() {
  const unlockAudio = () => Services.audio.unlock();
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('touchend', unlockAudio, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Services.save.flush();
      Services.save.touchOnline();
      Services.audio.suspend();
      Services.bus.emit('app:pause');
    } else {
      Services.audio.resume();
      Services.quests.refreshIfNeeded();
      Services.sync.requestSync(500);
      Services.bus.emit('app:resume');
    }
  });
  window.addEventListener('pagehide', () => {
    Services.save.flush();
    Services.save.touchOnline();
  });
}

initServices();
initLifecycle();

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  // Rendered at RES x the logical size; DisplayPlugin zooms every camera back.
  width: Math.round(WIDTH * RES),
  height: Math.round(HEIGHT * RES),
  backgroundColor: COLORS.bgDark,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  input: { activePointers: 4 },
  plugins: { scene: [{ key: 'DisplayPlugin', plugin: DisplayPlugin, mapping: 'display' }] },
  render: { antialias: true, powerPreference: 'high-performance' },
  // Phaser caps frame delta at 1000/min ms; RunnerScene uses the same cap.
  fps: { target: 60, min: 10 },
  // UIOverlay is last so it always renders on top of every other scene.
  scene: [BootScene, PreloaderScene, MainMenuScene, RunnerScene, UnboxingScene, ShowroomScene, ShopScene, UIOverlayScene]
};

/**
 * Canvas text and the procedural textures need the web fonts ready before the
 * first frame; wait for them (briefly - never block the game on a font).
 */
async function loadFonts() {
  if (!document.fonts?.load) return;
  const fonts = Promise.all([document.fonts.load('32px "Lilita One"'), document.fonts.load('600 32px Fredoka')]);
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
}

let game = null;
loadFonts().then(() => {
  game = new Phaser.Game(config);
  if (import.meta.env.DEV) window.__LABUBU__ = { game, Services };
});

/**
 * Both orientations play full screen. When the phone rotates (or the window is
 * resized) the logical viewport is recomputed; menu scenes rebuild their
 * layout, and a running RunnerScene re-projects its 3D view without restarting.
 */
let resizeTimer = null;
function handleViewportChange() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!game || !updateViewport()) return;
    // setGameSize (unlike resize) also updates the FIT aspect ratio.
    game.scale.setGameSize(Math.round(WIDTH * RES), Math.round(HEIGHT * RES));
    for (const scene of game.scene.getScenes(true)) {
      const key = scene.scene.key;
      if (key === 'Boot' || key === 'Preloader') continue;
      if (typeof scene.onViewportChange === 'function') scene.onViewportChange();
      else scene.scene.restart();
    }
    Services.bus.emit('app:viewport');
  }, 180);
}
window.addEventListener('resize', handleViewportChange);
window.addEventListener('orientationchange', handleViewportChange);

