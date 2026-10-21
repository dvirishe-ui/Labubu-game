/**
 * MiniGames.js
 * The Arcade: three mini-games (Claw Machine, Memory Match, Coin Catcher)
 * that award coins, gems, tickets, golden keys and ARCADE-EXCLUSIVE items.
 * Everyone gets a few free plays a day; extra plays cost a ticket or gems.
 * Pure logic on the save - the scenes only animate.
 */
import { toDateKey } from './QuestManager.js';
import { grantRewards } from './Rewards.js';

export const ARCADE = {
  FREE_PLAYS: 3,
  PLAY_COST: { blindBoxTickets: 1, gems: 10 }
};

export const GAMES = {
  claw: { key: 'claw', name: 'Claw Machine', scene: 'Claw', prize: 'neon_labubu', blurb: 'Grab a capsule! The glowing one hides Neon Arcade Labubu.' },
  memory: { key: 'memory', name: 'Memory Match', scene: 'Memory', prize: 'brainy_shades', blurb: 'Find the pairs. 3 stars wins Memory Master Shades!' },
  catcher: { key: 'catcher', name: 'Coin Catcher', scene: 'Catcher', prize: 'gift_backpack', blurb: 'Catch coins, dodge rocks. 100 points wins the Lucky Gift Pack!' }
};

/** Claw capsules: what can be grabbed and how hard each one is to hold on to. */
export const CLAW_PRIZES = [
  { id: 'coins', icon: 'coin', color: 0xffc93c, weight: 5, slip: 0.1, rewards: [{ type: 'popCoins', amount: 250 }] },
  { id: 'gems', icon: 'gem', color: 0xd65cff, weight: 3, slip: 0.2, rewards: [{ type: 'gems', amount: 20 }] },
  { id: 'tickets', icon: 'ticket', color: 0xff8fb1, weight: 3, slip: 0.2, rewards: [{ type: 'blindBoxTickets', amount: 2 }] },
  { id: 'key', icon: 'key', color: 0xffd34d, weight: 2, slip: 0.3, rewards: [{ type: 'goldenKeys', amount: 1 }] },
  { id: 'headstart', icon: 'pw_headstart', color: 0xff7a1a, weight: 2, slip: 0.2, rewards: [{ type: 'headStart', amount: 1 }] },
  { id: 'neon', icon: 'icon_neon_labubu', color: 0x39e6ff, weight: 1, slip: 0.55, rewards: [{ type: 'item', id: 'neon_labubu' }] }
];

/** Arcade state for today (free plays reset at midnight). */
export function arcadeState(saveManager, now = Date.now()) {
  const data = saveManager.data;
  data.arcade = data.arcade || { date: '', used: 0, extra: 0, best: {}, won: [] };
  const a = data.arcade;
  const day = toDateKey(now);
  if (a.date !== day) {
    a.date = day;
    a.used = 0;
  }
  a.best = a.best || {};
  a.won = a.won || [];
  a.extra = a.extra || 0;
  return a;
}

export function freePlaysLeft(saveManager, now = Date.now()) {
  const a = arcadeState(saveManager, now);
  return Math.max(0, ARCADE.FREE_PLAYS - a.used);
}

export function playsLeft(saveManager, now = Date.now()) {
  return freePlaysLeft(saveManager, now) + arcadeState(saveManager, now).extra;
}

/** Uses one play (free first, then bought ones). Returns false when none are left. */
export function usePlay(saveManager, now = Date.now()) {
  const a = arcadeState(saveManager, now);
  if (a.used < ARCADE.FREE_PLAYS) a.used += 1;
  else if (a.extra > 0) a.extra -= 1;
  else return false;
  saveManager.save('arcade_play');
  return true;
}

/** Buys one extra play with a ticket or gems. */
export function buyPlay(saveManager, currency = 'blindBoxTickets', now = Date.now()) {
  const cost = ARCADE.PLAY_COST[currency];
  if (!cost || !saveManager.spendCurrency(currency, cost, 'arcade_buy')) return false;
  arcadeState(saveManager, now).extra += 1;
  saveManager.save('arcade_buy');
  return true;
}

/** Weighted pick of the capsules that fill the claw machine. */
export function fillClawMachine(count = 9, rng = Math.random) {
  // Exactly one shot at the big prize; the rest are weighted everyday capsules.
  const common = CLAW_PRIZES.filter((p) => p.id !== 'neon');
  const total = common.reduce((s, p) => s + p.weight, 0);
  const out = [CLAW_PRIZES.find((p) => p.id === 'neon')];
  while (out.length < count) {
    let r = rng() * total;
    out.push(common.find((p) => (r -= p.weight) < 0) || common[0]);
  }
  return out;
}

/** The claw closed on `prize`: does it hold on? */
export const clawHolds = (prize, rng = Math.random) => rng() >= prize.slip;

/** Memory Match stars from how many pairs were tried. */
export function memoryStars(moves, pairs = 6) {
  if (moves <= pairs + 3) return 3;
  if (moves <= pairs + 7) return 2;
  return 1;
}

function finish(saveManager, game, rewards, prizeEarned) {
  const a = arcadeState(saveManager);
  const list = [...rewards];
  const prizeId = GAMES[game].prize;
  if (prizeEarned && !a.won.includes(prizeId)) {
    a.won.push(prizeId);
    list.push({ type: 'item', id: prizeId });
  }
  const granted = grantRewards(saveManager, list);
  saveManager.save(`arcade_${game}`);
  return granted;
}

/** Rewards for grabbing a claw capsule (the item may come back as gems if owned). */
export function clawReward(saveManager, prize) {
  const granted = grantRewards(saveManager, prize.rewards);
  if (prize.id === 'neon') {
    const a = arcadeState(saveManager);
    if (!a.won.includes('neon_labubu')) a.won.push('neon_labubu');
  }
  saveManager.save('arcade_claw');
  return granted;
}

/** Rewards for a finished Memory Match. */
export function memoryReward(saveManager, moves, pairs = 6) {
  const stars = memoryStars(moves, pairs);
  const a = arcadeState(saveManager);
  a.best.memory = Math.max(a.best.memory || 0, stars);
  const rewards = stars === 3 ? [{ type: 'popCoins', amount: 150 }, { type: 'goldenKeys', amount: 1 }] : stars === 2 ? [{ type: 'popCoins', amount: 150 }] : [{ type: 'popCoins', amount: 60 }];
  return { stars, rewards: finish(saveManager, 'memory', rewards, stars === 3) };
}

/** Rewards for a Coin Catcher round. */
export function catcherReward(saveManager, score) {
  const a = arcadeState(saveManager);
  a.best.catcher = Math.max(a.best.catcher || 0, score);
  const rewards = [{ type: 'popCoins', amount: Math.max(10, score * 3) }];
  if (score >= 60) rewards.push({ type: 'goldenKeys', amount: 1 });
  if (score >= 100) rewards.push({ type: 'gems', amount: 10 });
  return { rewards: finish(saveManager, 'catcher', rewards, score >= 100) };
}
