/**
 * Rewards.js
 * One place that knows how to hand out any reward: currencies, consumable
 * boosts (Head Start, Score Booster) and items. Used by blind-box bonus loot,
 * level-ups and the season pass. Callers persist the save afterwards.
 */
import { CATALOG } from '../config/GachaDropTable.js';
import { OWNED_ITEM_GEMS } from '../config/ProgressionConfig.js';

export const BOOST_KEYS = ['headStart', 'scoreBooster'];

export const REWARD_ICONS = {
  popCoins: 'coin',
  gems: 'gem',
  blindBoxTickets: 'ticket',
  goldenKeys: 'key',
  headStart: 'pw_headstart',
  scoreBooster: 'pw_score'
};

const NAMES = {
  popCoins: ['Coin', 'Coins'],
  gems: ['Gem', 'Gems'],
  blindBoxTickets: ['Ticket', 'Tickets'],
  goldenKeys: ['Golden Key', 'Golden Keys'],
  headStart: ['Head Start', 'Head Starts'],
  scoreBooster: ['Score Booster', 'Score Boosters']
};

/** "+3 Head Starts", "Dragon Labubu"... */
export function rewardLabel(r) {
  if (r.type === 'item') return r.converted ? `+${r.amount} Gems` : CATALOG[r.id]?.name || 'Item';
  const [one, many] = NAMES[r.type] || [r.type, r.type];
  return `+${r.amount} ${r.amount === 1 ? one : many}`;
}

/** Texture key for a reward's icon (items use their baked icon). */
export function rewardIcon(r) {
  if (r.type === 'item' && !r.converted) return `icon_${r.id}`;
  if (r.type === 'item') return 'gem';
  return REWARD_ICONS[r.type] || 'coin';
}

/**
 * Applies one reward to the save. Items already owned turn into gems.
 * @returns the reward as granted (items may come back as { converted, amount }).
 */
export function grantReward(saveManager, reward) {
  const data = saveManager.data;
  if (!reward) return null;
  if (reward.type === 'item') {
    const item = CATALOG[reward.id];
    if (!item) return null;
    if (saveManager.hasItem(reward.id)) {
      const gems = OWNED_ITEM_GEMS[item.rarity] || 50;
      data.currencies.gems += gems;
      return { ...reward, converted: true, amount: gems };
    }
    saveManager.unlockItem(reward.id);
    return { ...reward };
  }
  if (BOOST_KEYS.includes(reward.type)) {
    data.powerups = data.powerups || {};
    data.powerups[reward.type] = (data.powerups[reward.type] || 0) + reward.amount;
    return { ...reward };
  }
  if (reward.type in data.currencies) {
    data.currencies[reward.type] += reward.amount;
    return { ...reward };
  }
  return null;
}

export function grantRewards(saveManager, list) {
  return list.map((r) => grantReward(saveManager, r)).filter(Boolean);
}

/** Merges a list of rewards into totals per type (items stay separate). */
export function sumRewards(list) {
  const out = [];
  for (const r of list) {
    if (r.type === 'item') {
      out.push(r);
      continue;
    }
    const hit = out.find((o) => o.type === r.type);
    if (hit) hit.amount += r.amount;
    else out.push({ ...r });
  }
  return out;
}
