/**
 * ProgressionConfig.js
 * Tuning for everything that makes runs and the meta game grow over time:
 *  - STAGES: Subway Surfers-style difficulty that ramps with distance (speed,
 *    tighter gaps and new tricks: double-jump walls, charging carts, combos).
 *  - ZONES: special stretches of track (Low Gravity, Turbo, Gold Rush, Bounce).
 *  - BOOSTS: consumable power-ups (Head Start, Score Booster) and the
 *    coin-bought upgrade levels for in-run items.
 *  - LEVELS + PASS: Brawl Stars-style player level and a monthly season pass
 *    with a free track and a Gold track.
 */

/** Run speed: starts gentle, then climbs toward MAX (metres / second). */
export const SPEED = { START: 11, MAX: 34, RAMP_M: 2600 };

/**
 * Difficulty stages. Each one unlocks new tricks and tightens the gaps.
 * gapMult scales the distance between obstacle rows; the other numbers are
 * the chances of each special pattern per row.
 */
export const STAGES = [
  { from: 0, name: 'Warm-up Meadow', gapMult: 1.4, breather: 0.2, pairs: 0.15, fullRow: 0, highWall: 0, cart: 0, combo: 0 },
  { from: 350, name: 'Tricky Trail', gapMult: 1.2, breather: 0.14, pairs: 0.28, fullRow: 0.08, highWall: 0.1, cart: 0, combo: 0.06 },
  { from: 900, name: 'Wild Woods', gapMult: 1.05, breather: 0.1, pairs: 0.3, fullRow: 0.1, highWall: 0.13, cart: 0.1, combo: 0.12 },
  { from: 1800, name: 'Thunder Canyon', gapMult: 0.95, breather: 0.08, pairs: 0.3, fullRow: 0.1, highWall: 0.15, cart: 0.15, combo: 0.18 },
  { from: 3000, name: 'Monster Mountain', gapMult: 0.86, breather: 0.06, pairs: 0.3, fullRow: 0.12, highWall: 0.17, cart: 0.2, combo: 0.24 },
  { from: 4500, name: 'Rainbow Inferno', gapMult: 0.8, breather: 0.05, pairs: 0.3, fullRow: 0.12, highWall: 0.18, cart: 0.25, combo: 0.3 }
];

/** Special zones. `gravity` and `speed` multiply the normal values. */
export const ZONES = {
  moon: { key: 'moon', name: 'LOW GRAVITY', sub: 'Jumps float sky-high!', tint: 0x2a1a6a, tintAlpha: 0.32, arch: 0x6a4dff, gravity: 0.38, speed: 0.92, coinMult: 1, scoreMult: 1 },
  turbo: { key: 'turbo', name: 'TURBO ZONE', sub: 'Super speed - double score!', tint: 0xff7a1a, tintAlpha: 0.14, arch: 0xff7a1a, gravity: 1, speed: 1.35, coinMult: 1, scoreMult: 2 },
  gold: { key: 'gold', name: 'GOLD RUSH', sub: 'Coins are worth double!', tint: 0xffc93c, tintAlpha: 0.16, arch: 0xffb400, gravity: 1, speed: 1.05, coinMult: 2, scoreMult: 1 },
  bounce: { key: 'bounce', name: 'BOUNCE ZONE', sub: 'Hit the springs!', tint: 0xff4fa3, tintAlpha: 0.13, arch: 0xff4fa3, gravity: 1, speed: 1, coinMult: 1, scoreMult: 1 }
};
export const ZONE_ORDER = Object.keys(ZONES);
export const ZONE_RULES = { FIRST_AT: 450, LENGTH: 240, GAP_MIN: 380, GAP_MAX: 560 };

/** Consumables you take into a run. */
export const BOOST_ITEMS = {
  headStart: { key: 'headStart', name: 'Head Start', icon: 'pw_headstart', desc: 'Rocket ride to 1,000 m!', price: { popCoins: 1500, gems: 25 } },
  scoreBooster: { key: 'scoreBooster', name: 'Score Booster', icon: 'pw_score', desc: '+2 score multiplier all run', price: { popCoins: 1000, gems: 15 } }
};
export const HEAD_START = { BASE_M: 1000, PER_LEVEL_M: 250, SPEED: 110, FLY_Y: 3.2 };
export const SCORE_BOOSTER_BONUS = 2;

/** Coin upgrades (Subway Surfers-style): each level makes a power-up last longer. */
export const UPGRADES = {
  magnet: { key: 'magnet', name: 'Super Magnet', icon: 'magnet', desc: 'Lasts longer' },
  star: { key: 'star', name: 'Super Star', icon: 'item_star', desc: 'Lasts longer' },
  mushroom: { key: 'mushroom', name: 'Dash Mushroom', icon: 'item_mushroom', desc: 'Lasts longer' },
  headStart: { key: 'headStart', name: 'Head Start', icon: 'pw_headstart', desc: '+250 m per level' }
};
export const UPGRADE_ORDER = Object.keys(UPGRADES);
export const UPGRADE_COSTS = [400, 900, 1800, 3500, 7000]; // coins for levels 1..5
export const UPGRADE_STEP = 0.2; // +20% duration per level

/** XP: earned from runs, boxes and quests; drives the level and the pass. */
export const XP = { PER_10M: 1, PER_2_COINS: 1, PER_BOX: 12, PER_QUEST: 30, MAX_RUN: 600 };

/** Player level: XP needed to go from level L to L+1. */
export const levelStep = (level) => 120 + 40 * (level - 1);

/** Reward for reaching `level`. */
export function levelReward(level) {
  const rewards = [{ type: 'popCoins', amount: 100 + 25 * level }];
  if (level % 5 === 0) rewards.push({ type: 'blindBoxTickets', amount: 2 }, { type: 'gems', amount: 15 });
  if (level % 10 === 0) rewards.push({ type: 'goldenKeys', amount: 1 });
  if (level % 3 === 0) rewards.push({ type: 'headStart', amount: 1 });
  return rewards;
}

/**
 * Season pass (one season per calendar month): 60 tiers, and each tier needs
 * a bit more XP than the one before (200 XP for tier 1 ... 672 XP for tier 60).
 */
export const PASS = { TIERS: 60, BASE_XP: 200, XP_STEP: 8, GOLD_PRICE_GEMS: 250 };

/** XP needed to go from tier t-1 to tier t. */
export const tierXp = (t) => PASS.BASE_XP + PASS.XP_STEP * (t - 1);

const FREE_SPECIAL = {
  5: { type: 'goldenKeys', amount: 1 },
  10: { type: 'item', id: 'matcha_latte' },
  15: { type: 'goldenKeys', amount: 2 },
  20: { type: 'item', id: 'pirate_captain' },
  25: { type: 'scoreBooster', amount: 3 },
  30: { type: 'gems', amount: 150 },
  35: { type: 'goldenKeys', amount: 2 },
  40: { type: 'item', id: 'fox_tail' },
  45: { type: 'headStart', amount: 3 },
  50: { type: 'item', id: 'top_hat' },
  55: { type: 'gems', amount: 200 },
  60: { type: 'item', id: 'super_suit' }
};
const GOLD_SPECIAL = {
  1: { type: 'gems', amount: 30 },
  8: { type: 'item', id: 'strawberry_bunny' },
  12: { type: 'goldenKeys', amount: 3 },
  18: { type: 'headStart', amount: 3 },
  24: { type: 'item', id: 'dragon_labubu' },
  30: { type: 'item', id: 'ice_queen' },
  36: { type: 'item', id: 'witch_hat' },
  42: { type: 'item', id: 'mermaid_tail' },
  48: { type: 'item', id: 'fairy_wings' },
  54: { type: 'item', id: 'royal_gown' },
  60: { type: 'item', id: 'champion_labubu' }
};
const FREE_CYCLE = [
  { type: 'popCoins', amount: 200 },
  { type: 'blindBoxTickets', amount: 1 },
  { type: 'headStart', amount: 1 },
  { type: 'popCoins', amount: 300 }
];
const GOLD_CYCLE = [
  { type: 'gems', amount: 15 },
  { type: 'popCoins', amount: 500 },
  { type: 'blindBoxTickets', amount: 2 },
  { type: 'scoreBooster', amount: 1 },
  { type: 'goldenKeys', amount: 1 }
];

/** The reward for a pass tier on the 'free' or 'gold' track. */
export function passReward(tier, track) {
  if (track === 'gold') return GOLD_SPECIAL[tier] || GOLD_CYCLE[(tier - 1) % GOLD_CYCLE.length];
  return FREE_SPECIAL[tier] || FREE_CYCLE[(tier - 1) % FREE_CYCLE.length];
}

/** Gems paid instead when an item reward is already owned. */
export const OWNED_ITEM_GEMS = { common: 30, rare: 80, epic: 170, legendary: 350, secret: 500 };
