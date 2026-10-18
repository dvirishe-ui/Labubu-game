/**
 * GachaSystem.js
 * Pure blind-box logic: weighted rarity roll, pity counters, duplicate refunds.
 * No Phaser here - UnboxingScene calls `pullBlindBox` and only animates the
 * result. The result is committed to the save BEFORE the animation starts so
 * closing the app mid-reveal can never re-roll or lose a pull.
 */
import { RARITY_TIERS, RARITY_ORDER, PITY, DROP_POOL, CATALOG } from '../config/GachaDropTable.js';
import { ECONOMY } from '../config/GameConfig.js';

/** Box sources and what they cost. A golden key box is guaranteed Epic or better. */
export const BOX_SOURCES = {
  ticket: { currency: 'blindBoxTickets', cost: 1, minRank: 0 },
  key: { currency: 'goldenKeys', cost: 1, minRank: 2 }
};

/** Weighted pick among the tiers whose rank >= minRank. */
export function weightedRarity(rng = Math.random, minRank = 0) {
  const tiers = RARITY_ORDER.map((k) => RARITY_TIERS[k]).filter((t) => t.rank >= minRank);
  const total = tiers.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng() * total;
  for (const tier of tiers) {
    roll -= tier.weight;
    if (roll < 0) return tier.key;
  }
  return tiers[tiers.length - 1].key;
}

/**
 * Rolls a rarity while honouring pity. Counters count the CURRENT pull, so the
 * 10th pull without an Epic is forced to Epic+, the 50th without a Secret is
 * forced to Secret.
 * @returns {{ rarity: string, pity: object, pityTriggered: null|'epic'|'secret' }}
 */
export function rollRarity(pityCounter, rng = Math.random, minRank = 0) {
  const pity = {
    pullsSinceLastEpic: (pityCounter?.pullsSinceLastEpic ?? 0) + 1,
    pullsSinceLastSecret: (pityCounter?.pullsSinceLastSecret ?? 0) + 1
  };
  let rarity;
  let pityTriggered = null;

  if (pity.pullsSinceLastSecret >= PITY.SECRET_EVERY) {
    rarity = 'secret';
    pityTriggered = 'secret';
  } else if (pity.pullsSinceLastEpic >= PITY.EPIC_EVERY && minRank < RARITY_TIERS.epic.rank) {
    rarity = weightedRarity(rng, RARITY_TIERS.epic.rank);
    pityTriggered = 'epic';
  } else {
    rarity = weightedRarity(rng, minRank);
  }

  const rank = RARITY_TIERS[rarity].rank;
  if (rank >= RARITY_TIERS.epic.rank) pity.pullsSinceLastEpic = 0;
  if (rarity === 'secret') pity.pullsSinceLastSecret = 0;
  return { rarity, pity, pityTriggered };
}

/** Uniform pick of an item id inside a rarity bucket. */
export function pickItem(rarity, rng = Math.random) {
  const pool = DROP_POOL[rarity];
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

/**
 * Spends the box currency, rolls, and writes the outcome to the save.
 * @param {import('./SaveManager.js').SaveManager} saveManager
 * @param {'ticket'|'key'} source
 * @returns {{ok: false, reason: string} | {ok: true, itemId, rarity, isNew, refund, pityTriggered}}
 */
export function pullBlindBox(saveManager, source = 'ticket', rng = Math.random) {
  const spec = BOX_SOURCES[source];
  if (!spec) return { ok: false, reason: 'unknown_source' };
  const data = saveManager.data;
  if ((data.currencies[spec.currency] ?? 0) < spec.cost) return { ok: false, reason: 'insufficient' };

  const { rarity, pity, pityTriggered } = rollRarity(data.pityCounter, rng, spec.minRank);
  const itemId = pickItem(rarity, rng);
  const isNew = saveManager.unlockItem(itemId);

  data.currencies[spec.currency] -= spec.cost;
  data.pityCounter = pity;
  data.stats.boxesOpened += 1;

  const refund = { coins: 0, keys: 0 };
  if (!isNew) {
    refund.coins = ECONOMY.DUPLICATE_REFUND[rarity];
    refund.keys = ECONOMY.DUPLICATE_KEYS[rarity];
    data.currencies.popCoins += refund.coins;
    data.currencies.goldenKeys += refund.keys;
    data.stats.duplicatesPulled += 1;
  }

  saveManager.save('gacha');
  return { ok: true, itemId, item: CATALOG[itemId], rarity, isNew, refund, pityTriggered, source };
}

/** Converts Pop Coins into a ticket. */
export function buyTicket(saveManager) {
  if (!saveManager.spendCurrency('popCoins', ECONOMY.TICKET_PRICE_COINS, 'buy_ticket_spend')) return false;
  saveManager.addCurrency('blindBoxTickets', 1, 'buy_ticket');
  return true;
}
