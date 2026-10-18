/**
 * GameConfig.js
 * Central place for every tunable number in the game. Scenes and systems import
 * from here instead of hard-coding values so balancing never requires a hunt.
 */

/** Logical resolution. Phaser's Scale.FIT letterboxes this onto any device. */
export const WIDTH = 1280;
export const HEIGHT = 720;

export const STORAGE_KEY = 'labubu_blindbox_save_v1';
export const SAVE_VERSION = 2;

/** Runner physics and pacing. */
export const RUNNER = {
  GRAVITY: 1200,
  GROUND_Y: 610, // y of the running surface (top of the ground strip)
  PLAYER_X: 260,
  JUMP_VELOCITY: -640,
  DOUBLE_JUMP_VELOCITY: -560,
  FAST_FALL_VELOCITY: 900, // swipe down while airborne slams you to the ground
  FLOATY_GRAVITY_FACTOR: 0.65, // beaver tail: -35% gravity while falling & holding jump
  SLIDE_DURATION_MS: 650, // minimum slide time...
  SLIDE_DISTANCE_PX: 340, // ...but a slide always covers at least this much ground

  BASE_SPEED: 300, // px / second
  SPEED_PER_METER: 0.15, // speed = base + distance * 0.15
  MAX_SPEED: 800,
  PIXELS_PER_METER: 20,

  BASE_ATTRACT_RADIUS: 40, // coins inside this radius fly to the player
  SUPER_MAGNET_RADIUS: 420,
  SUPER_MAGNET_DURATION_MS: 8000,
  COIN_VALUE: 1,

  DISTANCE_TICK_METERS: 10, // EVENT_DISTANCE_TICK fires every N meters
  MIN_OBSTACLE_GAP: 420, // px, scaled up with speed
  INVULNERABLE_AFTER_SHIELD_MS: 1200
};

/** Parallax scroll factors relative to the running surface. */
export const PARALLAX = {
  SKY: 0.08,
  CANOPY: 0.35,
  GROUND: 1
};

/** Gacha economy. */
export const ECONOMY = {
  TICKET_PRICE_COINS: 300,
  STARTING_COINS: 250,
  STARTING_TICKETS: 3,
  /** Coins refunded when you pull an item you already own (Pop Mart "dupe" swap). */
  DUPLICATE_REFUND: { common: 25, rare: 60, epic: 150, secret: 500 },
  /** Golden keys granted on top of the refund for high-tier duplicates. */
  DUPLICATE_KEYS: { common: 0, rare: 0, epic: 1, secret: 3 }
};

/** Idle tycoon tuning (see IdleRewardManager for the formula). */
export const IDLE = {
  BASE_RATE_PER_SECOND: 0.02, // 72 coins / hour at 1.0x
  HIGHSCORE_RATE_BONUS_PER_1000M: 0.1, // +10% base rate per 1000m best distance
  MULTIPLIER_PER_UNIQUE_DOLL: 0.05, // +5% per unique doll owned
  MAX_OFFLINE_SECONDS: 8 * 60 * 60, // cap: 8 hours of accumulation
  WELCOME_BACK_MIN_SECONDS: 120, // only show the dialog after 2+ minutes away
  AD_SIMULATION_MS: 3000
};

/** Sync tuning. */
export const SYNC = {
  DEBOUNCE_MS: 2500,
  RETRY_BASE_MS: 4000,
  RETRY_MAX_MS: 60000,
  LEADERBOARD_SIZE: 50
};

/** Shared palette (Pop Mart pastel + forest tones). */
export const COLORS = {
  bgDark: 0x2b1d3a,
  panel: 0xfff4e6,
  panelDark: 0x3d2a52,
  pink: 0xff8fb1,
  pinkDark: 0xe0567f,
  mint: 0x8fe3c6,
  gold: 0xffc93c,
  goldDark: 0xc98a00,
  text: '#3d2a52',
  textLight: '#fff4e6',
  common: 0x9aa0a6,
  rare: 0x3fa9f5,
  epic: 0xa45cff,
  secret: 0xffc93c
};

export const FONT = 'Trebuchet MS, Verdana, system-ui, sans-serif';

/** Names of the global gameplay events consumed by QuestManager & friends. */
export const EVENTS = {
  DISTANCE_TICK: 'EVENT_DISTANCE_TICK',
  COIN_COLLECTED: 'EVENT_COIN_COLLECTED',
  BOX_OPENED: 'EVENT_BOX_OPENED',
  OBSTACLE_DODGED: 'EVENT_OBSTACLE_DODGED',
  RUN_STARTED: 'EVENT_RUN_STARTED',
  RUN_ENDED: 'EVENT_RUN_ENDED',
  TICKET_COLLECTED: 'EVENT_TICKET_COLLECTED',
  ITEM_EQUIPPED: 'EVENT_ITEM_EQUIPPED',
  QUEST_COMPLETED: 'EVENT_QUEST_COMPLETED',
  SAVE_CHANGED: 'save:changed',
  SAVE_REPLACED: 'save:replaced',
  SYNC_STATUS: 'sync:status'
};
