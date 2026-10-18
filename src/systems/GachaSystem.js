/**
 * GachaSystem.js
 * Pure blind-box logic: per-pack weighted rarity rolls with posted odds,
 * per-pack pity counters, duplicate refunds, and direct skin purchases.
 * No Phaser here - UnboxingScene calls `pullBlindBox` and only animates the
 * result. The result is committed to the save BEFORE the animation starts so
 * closing the app mid-reveal can never re-roll or lose a pull.
 */
import { RARITY_TIERS, RARITY_ORDER, DROP_POOL, CATALOG, PACKS, SKIN_PRICES } from '../config/GachaDropTable.js';
import { ECONOMY } from '../config/GameConfig.js';
import { grantRewards } from './Rewards.js';

/** Weighted pick from a pack's `odds`, restricted to tiers with rank >= minRank. */
export function weightedRarity(odds, rng = Math.random, minRank = 0) {
  const tiers = RARITY_ORDER.filter((k) => (odds[k] || 0) > 0 && RARITY_TIERS[k].rank >= minRank);
  if (!tiers.length) return RARITY_ORDER.filter((k) => RARITY_TIERS[k].rank >= minRank)[0];
  const total = tiers.reduce((sum, k) => sum + odds[k], 0);
  let roll = rng() * total;
  for (const k of tiers) {
    roll -= odds[k];
    if (roll < 0) return k;
  }
  return tiers[tiers.length - 1];
}

/** Fresh pity counters for one pack. */
export const emptyPity = () => ({ sinceEpic: 0, sinceLegendary: 0, sinceSecret: 0 });

/**
 * Rolls a rarity for `pack` while honouring its pity rules. Counters count the
 * CURRENT pull, so with pity.legendary = 40 the 40th pull without a Legendary
 * is forced to Legendary or better.
 * @returns {{ rarity: string, pity: object, pityTriggered: null|'epic'|'legendary'|'secret' }}
 */
export function rollRarity(pack, counters, rng = Math.random) {
  const pity = {
    sinceEpic: (counters?.sinceEpic ?? 0) + 1,
    sinceLegendary: (counters?.sinceLegendary ?? 0) + 1,
    sinceSecret: (counters?.sinceSecret ?? 0) + 1
  };
  const rules = pack.pity || {};
  let rarity;
  let pityTriggered = null;
  if (rules.secret && pity.sinceSecret >= rules.secret) {
    rarity = 'secret';
    pityTriggered = 'secret';
  } else if (rules.legendary && pity.sinceLegendary >= rules.legendary) {
    rarity = weightedRarity(pack.odds, rng, RARITY_TIERS.legendary.rank);
    pityTriggered = 'legendary';
  } else if (rules.epic && pity.sinceEpic >= rules.epic) {
    rarity = weightedRarity(pack.odds, rng, RARITY_TIERS.epic.rank);
    pityTriggered = 'epic';
  } else {
    rarity = weightedRarity(pack.odds, rng);
  }
  const rank = RARITY_TIERS[rarity].rank;
  if (rank >= RARITY_TIERS.epic.rank) pity.sinceEpic = 0;
  if (rank >= RARITY_TIERS.legendary.rank) pity.sinceLegendary = 0;
  if (rarity === 'secret') pity.sinceSecret = 0;
  return { rarity, pity, pityTriggered };
}

/** Uniform pick of an item id inside a rarity bucket. */
export function pickItem(rarity, rng = Math.random) {
  const pool = DROP_POOL[rarity];
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

/**
 * The first way to pay for `count` boxes of `packId` the player can afford
 * (optionally only with `currency`). Returns the per-box cost or null.
 */
export function chooseCost(saveManager, packId, currency = null, count = 1) {
  const pack = PACKS[packId];
  if (!pack) return null;
  const c = saveManager.data.currencies;
  const options = currency ? pack.costs.filter((o) => o.currency === currency) : pack.costs;
  return options.find((o) => (c[o.currency] ?? 0) >= o.amount * count) || null;
}

const between = ([lo, hi], rng) => lo + Math.floor(rng() * (hi - lo + 1));

/** Bonus loot that comes with every box of `pack`: coins + random extras. */
export function rollBonus(pack, rng = Math.random) {
  const b = pack.bonus;
  if (!b) return [];
  const out = [{ type: 'popCoins', amount: between(b.coins, rng) }];
  for (const e of b.extras) {
    if (rng() < e.chance) out.push({ type: e.type, amount: Array.isArray(e.amount) ? between(e.amount, rng) : e.amount });
  }
  return out;
}

/** Pulls left before each pity guarantee for a pack (for the UI). */
export function pityStatus(saveManager, packId) {
  const pack = PACKS[packId];
  const p = saveManager.data.pity?.[packId] || emptyPity();
  const out = {};
  if (pack.pity.epic) out.epic = pack.pity.epic - p.sinceEpic;
  if (pack.pity.legendary) out.legendary = pack.pity.legendary - p.sinceLegendary;
  if (pack.pity.secret) out.secret = pack.pity.secret - p.sinceSecret;
  return out;
}

/**
 * Spends the pack's cost, rolls, and writes the outcome to the save.
 * @param {import('./SaveManager.js').SaveManager} saveManager
 * @param {string} packId    'classic' | 'sparkle' | 'mega'
 * @param {string} [currency] pay with this currency (default: first affordable)
 */
export function pullBlindBox(saveManager, packId = 'classic', currency = null, rng = Math.random) {
  const pack = PACKS[packId];
  if (!pack) return { ok: false, reason: 'unknown_pack' };
  const cost = chooseCost(saveManager, packId, currency);
  if (!cost) return { ok: false, reason: 'insufficient' };

  const data = saveManager.data;
  data.pity = data.pity || {};
  const { rarity, pity, pityTriggered } = rollRarity(pack, data.pity[packId], rng);
  const itemId = pickItem(rarity, rng);
  const isNew = saveManager.unlockItem(itemId);

  data.currencies[cost.currency] -= cost.amount;
  data.pity[packId] = pity;
  data.stats.boxesOpened += 1;

  const bonus = grantRewards(saveManager, rollBonus(pack, rng));

  const refund = { coins: 0, keys: 0, gems: 0 };
  if (!isNew) {
    refund.coins = ECONOMY.DUPLICATE_REFUND[rarity] || 0;
    refund.keys = ECONOMY.DUPLICATE_KEYS[rarity] || 0;
    refund.gems = ECONOMY.DUPLICATE_GEMS[rarity] || 0;
    data.currencies.popCoins += refund.coins;
    data.currencies.goldenKeys += refund.keys;
    data.currencies.gems += refund.gems;
    data.stats.duplicatesPulled += 1;
  }

  saveManager.save('gacha');
  return { ok: true, itemId, item: CATALOG[itemId], rarity, isNew, refund, bonus, pityTriggered, packId, cost };
}

/**
 * Opens `count` boxes in one go (only if all of them can be paid for with the
 * same currency). Returns { ok, results, reason? }.
 */
export function pullMany(saveManager, packId, currency = null, count = 1, rng = Math.random) {
  const cost = chooseCost(saveManager, packId, currency, count);
  if (!cost) return { ok: false, reason: 'insufficient', results: [] };
  const results = [];
  for (let i = 0; i < count; i++) {
    const r = pullBlindBox(saveManager, packId, cost.currency, rng);
    if (!r.ok) break;
    results.push(r);
  }
  return { ok: results.length > 0, results, cost };
}

/** Converts Pop Coins into a ticket. */
export function buyTicket(saveManager) {
  if (!saveManager.spendCurrency('popCoins', ECONOMY.TICKET_PRICE_COINS, 'buy_ticket_spend')) return false;
  saveManager.addCurrency('blindBoxTickets', 1, 'buy_ticket');
  return true;
}

/** Shop price of an item, e.g. { gems: 80, popCoins: 2500 } or null (box-exclusive). */
export function skinPrice(itemId) {
  const item = CATALOG[itemId];
  if (!item) return null;
  return SKIN_PRICES[item.rarity] || null;
}

/**
 * Buys a skin/accessory from the shop. `discount` (0..1) applies to the price.
 * Returns { ok, reason? }.
 */
export function buySkin(saveManager, itemId, currency = 'gems', discount = 0) {
  const price = skinPrice(itemId);
  if (!price || price[currency] === undefined) return { ok: false, reason: 'not_for_sale' };
  if (saveManager.hasItem(itemId)) return { ok: false, reason: 'owned' };
  const amount = Math.round(price[currency] * (1 - discount));
  if (!saveManager.spendCurrency(currency, amount, 'shop_skin')) return { ok: false, reason: 'insufficient' };
  saveManager.unlockItem(itemId);
  saveManager.save('shop_skin_unlock');
  return { ok: true, amount };
}
