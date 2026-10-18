/**
 * Boosts.js
 * Consumable boosts (Head Start, Score Booster) and coin upgrades that make
 * in-run power-ups last longer. Pure logic on the save.
 */
import { BOOST_ITEMS, UPGRADES, UPGRADE_COSTS, UPGRADE_STEP, HEAD_START } from '../config/ProgressionConfig.js';

export const boostCount = (saveManager, key) => saveManager.data.powerups?.[key] || 0;

/** Buys one boost with coins or gems. */
export function buyBoost(saveManager, key, currency = 'popCoins') {
  const item = BOOST_ITEMS[key];
  const price = item?.price[currency];
  if (price === undefined) return { ok: false, reason: 'not_for_sale' };
  if (!saveManager.spendCurrency(currency, price, `boost:${key}`)) return { ok: false, reason: 'insufficient' };
  saveManager.data.powerups[key] = boostCount(saveManager, key) + 1;
  saveManager.save('boost_buy');
  return { ok: true };
}

/** Consumes one boost at the start of a run. */
export function useBoost(saveManager, key) {
  if (boostCount(saveManager, key) <= 0) return false;
  saveManager.data.powerups[key] -= 1;
  saveManager.save('boost_use');
  return true;
}

export const upgradeLevel = (saveManager, key) => saveManager.data.upgrades?.[key] || 0;

/** Coins for the next level, or null at max level. */
export function upgradeCost(saveManager, key) {
  const lvl = upgradeLevel(saveManager, key);
  return lvl < UPGRADE_COSTS.length ? UPGRADE_COSTS[lvl] : null;
}

export function buyUpgrade(saveManager, key) {
  if (!UPGRADES[key]) return { ok: false, reason: 'unknown' };
  const cost = upgradeCost(saveManager, key);
  if (cost === null) return { ok: false, reason: 'max' };
  if (!saveManager.spendCurrency('popCoins', cost, `upgrade:${key}`)) return { ok: false, reason: 'insufficient' };
  saveManager.data.upgrades[key] = upgradeLevel(saveManager, key) + 1;
  saveManager.save('upgrade');
  return { ok: true, level: saveManager.data.upgrades[key] };
}

/** Duration multiplier for an in-run power-up (1.0 at level 0, +20% per level). */
export const durationMult = (saveManager, key) => 1 + UPGRADE_STEP * upgradeLevel(saveManager, key);

/** How far the Head Start rocket flies. */
export const headStartDistance = (saveManager) => HEAD_START.BASE_M + HEAD_START.PER_LEVEL_M * upgradeLevel(saveManager, 'headStart');
