/**
 * Services.js
 * Service locator for the long-lived singletons (save, sync, quests, idle,
 * audio, bus). main.js fills it once at startup; scenes import it to reach the
 * systems without threading references through scene data.
 */
export const Services = {
  /** @type {import('./EventBus.js').EventBus} */ bus: null,
  /** @type {import('./SaveManager.js').SaveManager} */ save: null,
  /** @type {import('./SyncManager.js').SyncManager} */ sync: null,
  /** @type {import('./QuestManager.js').QuestManager} */ quests: null,
  /** @type {import('./IdleRewardManager.js').IdleRewardManager} */ idle: null,
  /** @type {import('./AudioController.js').AudioController} */ audio: null,
  /** True once the Welcome Back check ran for this app session. */
  welcomeBackShown: false
};
