/**
 * GameConfig.js
 * Central place for every tunable number in the game. Scenes and systems import
 * from here instead of hard-coding values so balancing never requires a hunt.
 */

/**
 * Logical viewport. The short side of the screen is always 720 logical px and
 * the long side follows the device's aspect ratio (1280..1600), in PORTRAIT or
 * LANDSCAPE - whichever way the phone is held - so the game always fills the
 * whole screen. These are live bindings: main.js calls updateViewport() when
 * the device rotates, and every scene reads WIDTH / HEIGHT inside create().
 */
export const SHORT_SIDE = 720;
export const MIN_LONG_SIDE = 1280;
export const MAX_LONG_SIDE = 1600;

/** Pure viewport maths (unit-testable): window size + DPR -> logical size & render scale. */
export function computeViewport(innerW = 1280, innerH = 720, dpr = 1) {
  const portrait = innerH > innerW;
  const long = Math.max(innerW, innerH);
  const short = Math.min(innerW, innerH);
  let longSide = Math.round((SHORT_SIDE * long) / short);
  longSide = Math.min(MAX_LONG_SIDE, Math.max(MIN_LONG_SIDE, longSide - (longSide % 2)));
  // Render resolution: canvas = logical x RES, cameras zoom by RES (ui/Display.js).
  const res = Math.round(Math.min(1.5, Math.max(1, (short * dpr) / SHORT_SIDE)) * 4) / 4;
  return {
    width: portrait ? SHORT_SIDE : longSide,
    height: portrait ? longSide : SHORT_SIDE,
    portrait,
    res
  };
}

export let WIDTH = 1280;
export let HEIGHT = 720;
export let PORTRAIT = false;
export let RES = 1;

/** Recomputes the viewport from the window. Returns true if the logical size changed. */
export function updateViewport() {
  if (typeof window === 'undefined') return false;
  const v = computeViewport(window.innerWidth || 1280, window.innerHeight || 720, window.devicePixelRatio || 1);
  const changed = v.width !== WIDTH || v.height !== HEIGHT;
  WIDTH = v.width;
  HEIGHT = v.height;
  PORTRAIT = v.portrait;
  // RES is fixed at boot: changing it would require re-baking every texture.
  return changed;
}
if (typeof window !== 'undefined') {
  updateViewport();
  RES = computeViewport(window.innerWidth || 1280, window.innerHeight || 720, window.devicePixelRatio || 1).res;
}

export const STORAGE_KEY = 'labubu_blindbox_save_v1';
export const SAVE_VERSION = 3;

/**
 * 3D lane runner tuning. World units are metres; the camera sits behind the
 * runner and everything is projected onto the screen (see RunnerScene.project).
 */
export const RUNNER = {
  LANES: [-2.1, 0, 2.1], // lane centres (x, metres)
  LANE_SWITCH_MS: 150,
  PLAYER_Z: 5, // distance from camera to the runner
  DRAW_DISTANCE: 140, // objects spawn this far ahead of the runner
  GRAVITY: 34, // m/s^2
  JUMP_VELOCITY: 11, // -> ~1.8 m jump
  AIR_JUMP_VELOCITY: 9.5,
  FAST_FALL_VELOCITY: -22,
  FLOATY_GRAVITY_FACTOR: 0.6, // Beaver Tail glide while holding
  PLAYER_HEIGHT: 1.7,
  DUCK_HEIGHT: 0.75,
  ROLL_MS: 520, // a duck/roll lasts this long (holding keeps rolling)

  BASE_SPEED: 16, // m/s - brisk from the first second
  SPEED_PER_METER: 0.011, // speed ramps with distance...
  MAX_SPEED: 34, // ...up to this

  MULTIPLIER_EVERY_M: 300, // score multiplier +1 every 300 m...
  MAX_MULTIPLIER: 6, // ...up to x6

  ATTRACT_DIST: 1.2, // coin pickup reach (m); lumberjack vest adds more
  SUPER_MAGNET_RANGE: 9,
  SUPER_MAGNET_DURATION_MS: 8000,
  COIN_VALUE: 1,

  // Mario Kart-style extras
  COUNTDOWN_STEP_MS: 600, // 3 - 2 - 1 - GO!
  ROCKET_WINDOW_MS: 260, // tap within this of "GO!" for a rocket start
  ROCKET_BOOST: { ms: 1800, mult: 1.6 },
  PAD_BOOST: { ms: 1400, mult: 1.4 },
  MUSHROOM_BOOST: { ms: 2300, mult: 1.6 },
  STAR_MS: 6000,
  STAR_SPEED_MULT: 1.15,
  COMBO_WINDOW_MS: 700, // coins collected within this window chain a combo
  CLOSE_CALL_M: 0.35, // clearing an obstacle by less than this = close call
  REVIVE_TICKET_COST: 1,
  REVIVE_PROMPT_MS: 5000,
  LETTER_EVERY_M: 320, // a L-A-B-U-B-U letter appears about this often

  DISTANCE_TICK_METERS: 10, // EVENT_DISTANCE_TICK fires every N meters
  INVULNERABLE_AFTER_SHIELD_MS: 1300
};

/** Word hunt: collect these letters during runs for a daily prize. */
export const WORD_HUNT = {
  WORD: 'LABUBU',
  REWARD: { popCoins: 300, blindBoxTickets: 1 }
};

/** Daily Lucky Spin wheel segments (weights are relative). */
export const LUCKY_SPIN = [
  { label: '50', reward: { type: 'popCoins', amount: 50 }, weight: 26, color: 0xffc93c },
  { label: '1 Ticket', reward: { type: 'blindBoxTickets', amount: 1 }, weight: 16, color: 0xff8fb1 },
  { label: '100', reward: { type: 'popCoins', amount: 100 }, weight: 20, color: 0x6ee7a8 },
  { label: '2 Tickets', reward: { type: 'blindBoxTickets', amount: 2 }, weight: 6, color: 0x59b8ff },
  { label: '200', reward: { type: 'popCoins', amount: 200 }, weight: 12, color: 0xb07cff },
  { label: 'Key!', reward: { type: 'goldenKeys', amount: 1 }, weight: 4, color: 0xff7a1a },
  { label: '75', reward: { type: 'popCoins', amount: 75 }, weight: 22, color: 0x8fd3ff },
  { label: '500', reward: { type: 'popCoins', amount: 500 }, weight: 3, color: 0xe8324b }
];

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
