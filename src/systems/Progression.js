/**
 * Progression.js
 * XP, player level (with level-up rewards) and the monthly season pass
 * ("Labubu Pass") with a free track and a Gold track. Pure logic on the save.
 */
import { XP, PASS, levelStep, levelReward, passReward } from '../config/ProgressionConfig.js';
import { grantRewards, grantReward } from './Rewards.js';

/** Season id, one per calendar month: "2026-10". */
export function seasonKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Milliseconds until the season ends (next month's first midnight). */
export function seasonEndsIn(now = Date.now()) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - now;
}

/** Starts a fresh pass when the month changes. */
export function ensureSeason(saveManager, now = Date.now()) {
  const data = saveManager.data;
  const key = seasonKey(now);
  if (!data.pass || data.pass.season !== key) {
    data.pass = { season: key, xp: 0, gold: false, claimed: { free: [], gold: [] } };
  }
  return data.pass;
}

/** Level, XP into the level and XP needed for the next one. */
export function levelInfo(totalXp) {
  let level = 1;
  let rest = Math.max(0, totalXp);
  while (rest >= levelStep(level)) {
    rest -= levelStep(level);
    level += 1;
  }
  return { level, into: rest, need: levelStep(level) };
}

/** Current pass tier (0..TIERS) and progress toward the next tier. */
export function passInfo(saveManager, now = Date.now()) {
  const pass = ensureSeason(saveManager, now);
  const tier = Math.min(PASS.TIERS, Math.floor(pass.xp / PASS.XP_PER_TIER));
  const into = tier >= PASS.TIERS ? PASS.XP_PER_TIER : pass.xp - tier * PASS.XP_PER_TIER;
  return { tier, into, need: PASS.XP_PER_TIER, gold: pass.gold, season: pass.season };
}

/** XP for a run. */
export function runXp({ distance = 0, coins = 0 }) {
  return Math.min(XP.MAX_RUN, Math.floor(distance / 10) * XP.PER_10M + Math.floor(coins / 2) * XP.PER_2_COINS);
}

/**
 * Adds XP to the lifetime level and the season pass. Level-up rewards are
 * granted immediately. Returns { gained, levelUps: [{ level, rewards }], tiersGained }.
 */
export function addXp(saveManager, amount, now = Date.now()) {
  const data = saveManager.data;
  const gained = Math.max(0, Math.floor(amount));
  const before = levelInfo(data.progress.xp).level;
  const tierBefore = passInfo(saveManager, now).tier;
  data.progress.xp += gained;
  ensureSeason(saveManager, now).xp += gained;
  const after = levelInfo(data.progress.xp).level;
  const levelUps = [];
  for (let lv = before + 1; lv <= after; lv++) levelUps.push({ level: lv, rewards: grantRewards(saveManager, levelReward(lv)) });
  const tiersGained = passInfo(saveManager, now).tier - tierBefore;
  saveManager.save('xp');
  return { gained, levelUps, tiersGained };
}

/** Can tier `tier` on `track` be claimed right now? */
export function canClaim(saveManager, tier, track, now = Date.now()) {
  const info = passInfo(saveManager, now);
  const pass = saveManager.data.pass;
  if (tier < 1 || tier > info.tier) return false;
  if (track === 'gold' && !pass.gold) return false;
  return !pass.claimed[track].includes(tier);
}

export function claimPassTier(saveManager, tier, track, now = Date.now()) {
  if (!canClaim(saveManager, tier, track, now)) return { ok: false };
  const reward = grantReward(saveManager, passReward(tier, track));
  saveManager.data.pass.claimed[track].push(tier);
  saveManager.save('pass_claim');
  return { ok: true, reward };
}

/** Number of pass rewards waiting to be claimed (menu badge). */
export function claimableCount(saveManager, now = Date.now()) {
  const info = passInfo(saveManager, now);
  let n = 0;
  for (let t = 1; t <= info.tier; t++) {
    if (canClaim(saveManager, t, 'free', now)) n++;
    if (canClaim(saveManager, t, 'gold', now)) n++;
  }
  return n;
}

export function unlockGoldPass(saveManager, now = Date.now()) {
  const pass = ensureSeason(saveManager, now);
  if (pass.gold) return { ok: false, reason: 'owned' };
  if (!saveManager.spendCurrency('gems', PASS.GOLD_PRICE_GEMS, 'gold_pass')) return { ok: false, reason: 'insufficient' };
  pass.gold = true;
  saveManager.save('gold_pass');
  return { ok: true };
}
