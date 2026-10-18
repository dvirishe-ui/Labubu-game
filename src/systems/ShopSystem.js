/**
 * ShopSystem.js
 * Pure logic for the store's daily deals (Brawl Stars-style "today's offers").
 * Deals are deterministic per calendar day so every reload shows the same
 * offers, and each can be bought once per day (tracked in save.shop).
 */
import { CATALOG, RARITY_TIERS } from '../config/GachaDropTable.js';
import { ECONOMY } from '../config/GameConfig.js';
import { toDateKey } from './QuestManager.js';
import { skinPrice } from './GachaSystem.js';

/** Small deterministic PRNG seeded by a string. */
function seededRng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const SKIN_DEAL_DISCOUNT = 0.3;

/** Resets the "bought today" list when the day changes. */
function shopState(saveManager, now) {
  const data = saveManager.data;
  data.shop = data.shop || { dealsDate: '', bought: [] };
  const day = toDateKey(now);
  if (data.shop.dealsDate !== day) {
    data.shop.dealsDate = day;
    data.shop.bought = [];
  }
  return data.shop;
}

/**
 * Today's offers. Each deal: { id, kind, title, cost: {currency, amount} | null,
 * was?, give: {currency: amount} | itemId, bought }.
 */
export function dailyDeals(saveManager, now = Date.now()) {
  const shop = shopState(saveManager, now);
  const rng = seededRng(`deals-${shop.dealsDate}`);
  const deals = [{ id: 'free_gift', kind: 'bundle', title: 'Free Daily Gift', cost: null, give: { popCoins: 100, gems: 5 } }];

  // Featured skin: a skin the player doesn't own yet (dolls first), 30% off.
  const candidates = Object.values(CATALOG).filter((it) => skinPrice(it.id) && !saveManager.hasItem(it.id));
  const dolls = candidates.filter((it) => it.slot === 'doll');
  const pool = dolls.length ? dolls : candidates;
  if (pool.length) {
    const item = pool[Math.floor(rng() * pool.length)];
    const base = skinPrice(item.id).gems;
    deals.push({
      id: `skin_${item.id}`,
      kind: 'skin',
      title: `${RARITY_TIERS[item.rarity].label} Skin`,
      itemId: item.id,
      cost: { currency: 'gems', amount: Math.round(base * (1 - SKIN_DEAL_DISCOUNT)) },
      was: base
    });
  }

  const tickets = 3 + Math.floor(rng() * 3); // 3-5 tickets
  deals.push({
    id: 'ticket_pack',
    kind: 'bundle',
    title: `${tickets} Box Tickets`,
    cost: { currency: 'popCoins', amount: Math.round(tickets * ECONOMY.TICKET_PRICE_COINS * 0.8) },
    was: tickets * ECONOMY.TICKET_PRICE_COINS,
    give: { blindBoxTickets: tickets }
  });
  deals.push({ id: 'key_pack', kind: 'bundle', title: '3 Golden Keys', cost: { currency: 'gems', amount: 140 }, was: 180, give: { goldenKeys: 3 } });

  for (const d of deals) d.bought = shop.bought.includes(d.id) || (d.kind === 'skin' && saveManager.hasItem(d.itemId));
  return deals;
}

/** Buys one of today's deals. Returns { ok, deal?, reason? }. */
export function buyDeal(saveManager, dealId, now = Date.now()) {
  const deal = dailyDeals(saveManager, now).find((d) => d.id === dealId);
  if (!deal) return { ok: false, reason: 'unknown_deal' };
  if (deal.bought) return { ok: false, reason: 'already_bought' };
  if (deal.cost && (saveManager.data.currencies[deal.cost.currency] ?? 0) < deal.cost.amount) return { ok: false, reason: 'insufficient' };

  const data = saveManager.data;
  if (deal.cost) data.currencies[deal.cost.currency] -= deal.cost.amount;
  if (deal.kind === 'skin') saveManager.unlockItem(deal.itemId);
  for (const [cur, amt] of Object.entries(deal.give || {})) data.currencies[cur] = (data.currencies[cur] ?? 0) + amt;
  data.shop.bought.push(deal.id);
  saveManager.save('shop_deal');
  return { ok: true, deal };
}
