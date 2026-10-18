/**
 * main.js
 * Entry point: builds the long-lived services (save, quests, idle, sync,
 * audio), wires app-lifecycle hooks for mobile, and boots Phaser.
 */
import Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, RUNNER, COLORS } from './config/GameConfig.js';
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
  // Portrait phones see a "rotate your device" overlay (index.html): pause runs.
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  portrait.addEventListener?.('change', (e) => {
    if (e.matches) Services.bus.emit('app:pause');
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
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: RUNNER.GRAVITY }, debug: false }
  },
  input: { activePointers: 4 },
  plugins: { scene: [{ key: 'DisplayPlugin', plugin: DisplayPlugin, mapping: 'display' }] },
  render: { antialias: true, powerPreference: 'high-performance' },
  // Phaser caps frame delta at 1000/min ms; RunnerScene uses the same cap so the
  // manually-scrolled world and the Arcade physics step never drift apart.
  fps: { target: 60, min: 10 },
  // UIOverlay is last so it always renders on top of every other scene.
  scene: [BootScene, PreloaderScene, MainMenuScene, RunnerScene, UnboxingScene, ShowroomScene, UIOverlayScene]
};

const game = new Phaser.Game(config);

// Handy for debugging from the devtools console.
if (import.meta.env.DEV) window.__LABUBU__ = { game, Services };
