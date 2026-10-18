import { describe, it, expect } from 'vitest';
import { rollRarity, weightedRarity, pullBlindBox, buyTicket, pityStatus, buySkin, skinPrice, emptyPity } from '../src/systems/GachaSystem.js';
import { dailyDeals, buyDeal } from '../src/systems/ShopSystem.js';
import { PACKS, PACK_ORDER, RARITY_TIERS, RARITY_ORDER, DROP_POOL, CATALOG, packSplit } from '../src/config/GachaDropTable.js';
import { ECONOMY } from '../src/config/GameConfig.js';
import { makeSave, seq } from './helpers.js';

describe('packs & posted odds', () => {
  it('every pack odds table sums to 100% and only names known tiers', () => {
    for (const id of PACK_ORDER) {
      const odds = PACKS[id].odds;
      const sum = Object.values(odds).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 6);
      for (const k of Object.keys(odds)) expect(RARITY_ORDER).toContain(k);
    }
  });

  it('shows a Regular vs Mystery split like a real blind box', () => {
    expect(packSplit('classic')).toEqual({ regular: 99.5, mystery: 0.5 });
    expect(packSplit('mega').mystery).toBe(7);
  });

  it('Classic box matches its table within tolerance', () => {
    const odds = PACKS.classic.odds;
    const counts = Object.fromEntries(RARITY_ORDER.map((k) => [k, 0]));
    const N = 200000;
    for (let i = 0; i < N; i++) counts[weightedRarity(odds)]++;
    for (const k of RARITY_ORDER) expect(Math.abs(counts[k] / N - odds[k] / 100)).toBeLessThan(0.006);
  });

  it('maps roll boundaries onto the right tiers', () => {
    const odds = PACKS.classic.odds;
    expect(weightedRarity(odds, () => 0)).toBe('common');
    expect(weightedRarity(odds, () => 0.579)).toBe('common');
    expect(weightedRarity(odds, () => 0.5801)).toBe('rare');
    expect(weightedRarity(odds, () => 0.9)).toBe('epic');
    expect(weightedRarity(odds, () => 0.97)).toBe('legendary');
    expect(weightedRarity(odds, () => 0.999)).toBe('secret');
  });

  it('every tier that a pack can roll has items in the pool', () => {
    for (const r of RARITY_ORDER) expect(DROP_POOL[r].length).toBeGreaterThan(0);
  });

  it('every rarity has a run multiplier, Legendary is x1.5', () => {
    expect(RARITY_TIERS.common.multiplier).toBe(1);
    expect(RARITY_TIERS.legendary.multiplier).toBe(1.5);
    for (let i = 1; i < RARITY_ORDER.length; i++) {
      expect(RARITY_TIERS[RARITY_ORDER[i]].multiplier).toBeGreaterThan(RARITY_TIERS[RARITY_ORDER[i - 1]].multiplier);
    }
  });
});

describe('pity system', () => {
  it('guarantees Epic+ on the 10th Classic pull without one', () => {
    const pack = PACKS.classic;
    let pity = emptyPity();
    const commonRng = () => 0.1;
    for (let i = 1; i < pack.pity.epic; i++) {
      const r = rollRarity(pack, pity, commonRng);
      expect(r.rarity).toBe('common');
      pity = r.pity;
    }
    const tenth = rollRarity(pack, pity, commonRng);
    expect(RARITY_TIERS[tenth.rarity].rank).toBeGreaterThanOrEqual(RARITY_TIERS.epic.rank);
    expect(tenth.pityTriggered).toBe('epic');
    expect(tenth.pity.sinceEpic).toBe(0);
  });

  it('guarantees a Legendary+ after the Classic legendary pity', () => {
    const pack = PACKS.classic;
    let pity = emptyPity();
    let legendaries = 0;
    for (let i = 1; i <= pack.pity.legendary; i++) {
      const r = rollRarity(pack, pity, () => 0.1);
      if (RARITY_TIERS[r.rarity].rank >= RARITY_TIERS.legendary.rank) legendaries++;
      pity = r.pity;
    }
    expect(legendaries).toBe(1);
    expect(pity.sinceLegendary).toBe(0);
  });

  it('guarantees a Mystery on the Mega box secret pity', () => {
    const pack = PACKS.mega;
    let pity = emptyPity();
    let secrets = 0;
    for (let i = 1; i <= pack.pity.secret; i++) {
      const r = rollRarity(pack, pity, () => 0.1);
      if (r.rarity === 'secret') secrets++;
      pity = r.pity;
    }
    expect(secrets).toBe(1);
  });

  it('a natural Epic resets the epic counter only', () => {
    const r = rollRarity(PACKS.classic, { sinceEpic: 5, sinceLegendary: 20, sinceSecret: 30 }, () => 0.9);
    expect(r.rarity).toBe('epic');
    expect(r.pity).toEqual({ sinceEpic: 0, sinceLegendary: 21, sinceSecret: 31 });
  });

  it('pityStatus reports pulls left per pack', () => {
    const { save } = makeSave();
    expect(pityStatus(save, 'classic')).toEqual({ epic: 10, legendary: 40, secret: 150 });
    pullBlindBox(save, 'classic', null, seq(0.1, 0));
    expect(pityStatus(save, 'classic').epic).toBe(9);
    expect(pityStatus(save, 'sparkle').legendary).toBe(PACKS.sparkle.pity.legendary);
  });
});

describe('pullBlindBox', () => {
  it('spends a ticket, unlocks the item and counts the box', () => {
    const { save } = makeSave();
    const tickets = save.data.currencies.blindBoxTickets;
    const res = pullBlindBox(save, 'classic', null, seq(0.1, 0));
    expect(res.ok).toBe(true);
    expect(res.rarity).toBe('common');
    expect(res.itemId).toBe(DROP_POOL.common[0]);
    expect(res.isNew).toBe(true);
    expect(res.cost).toEqual({ currency: 'blindBoxTickets', amount: 1 });
    expect(save.data.currencies.blindBoxTickets).toBe(tickets - 1);
    expect(save.hasItem(res.itemId)).toBe(true);
    expect(save.data.stats.boxesOpened).toBe(1);
  });

  it('falls back to coins when out of tickets', () => {
    const { save } = makeSave();
    save.data.currencies.blindBoxTickets = 0;
    save.data.currencies.popCoins = 300;
    const res = pullBlindBox(save, 'classic', null, seq(0.1, 0));
    expect(res.ok).toBe(true);
    expect(res.cost.currency).toBe('popCoins');
    expect(save.data.currencies.popCoins).toBe(0);
  });

  it('converts duplicates into coins (and gems for Legendary+)', () => {
    const { save } = makeSave();
    pullBlindBox(save, 'classic', null, seq(0.1, 0));
    const coins = save.data.currencies.popCoins;
    const dup = pullBlindBox(save, 'classic', null, seq(0.1, 0));
    expect(dup.isNew).toBe(false);
    expect(dup.refund.coins).toBe(ECONOMY.DUPLICATE_REFUND.common);
    expect(save.data.currencies.popCoins).toBe(coins + ECONOMY.DUPLICATE_REFUND.common);

    save.data.currencies.gems = 1000;
    pullBlindBox(save, 'mega', null, seq(0.7, 0)); // legendary
    const gems = save.data.currencies.gems;
    const dupL = pullBlindBox(save, 'mega', null, seq(0.7, 0));
    expect(dupL.rarity).toBe('legendary');
    expect(dupL.refund.gems).toBe(ECONOMY.DUPLICATE_GEMS.legendary);
    expect(save.data.currencies.gems).toBe(gems - PACKS.mega.costs[0].amount + ECONOMY.DUPLICATE_GEMS.legendary);
  });

  it('refuses to pull without currency', () => {
    const { save } = makeSave();
    save.data.currencies.blindBoxTickets = 0;
    save.data.currencies.gems = 0;
    expect(pullBlindBox(save, 'classic').ok).toBe(false);
    expect(pullBlindBox(save, 'sparkle').ok).toBe(false);
    expect(pullBlindBox(save, 'nope').ok).toBe(false);
  });

  it('Sparkle boxes are Rare+, Mega boxes are Epic+', () => {
    const { save } = makeSave();
    save.data.currencies.goldenKeys = 40;
    save.data.currencies.gems = 150 * 40;
    for (let i = 0; i < 40; i++) {
      expect(RARITY_TIERS[pullBlindBox(save, 'sparkle', 'goldenKeys').rarity].rank).toBeGreaterThanOrEqual(1);
      expect(RARITY_TIERS[pullBlindBox(save, 'mega', 'gems').rarity].rank).toBeGreaterThanOrEqual(2);
    }
  });

  it('buyTicket trades coins for a ticket', () => {
    const { save } = makeSave();
    save.data.currencies.popCoins = ECONOMY.TICKET_PRICE_COINS;
    const t = save.data.currencies.blindBoxTickets;
    expect(buyTicket(save)).toBe(true);
    expect(save.data.currencies.blindBoxTickets).toBe(t + 1);
    expect(buyTicket(save)).toBe(false);
  });
});

describe('skin shop', () => {
  it('sells skins by rarity; Mystery skins are box-exclusive', () => {
    expect(skinPrice('golden_labubu')).toEqual({ gems: 350 });
    expect(skinPrice('beaver_labubu_secret')).toBeNull();
    const { save } = makeSave();
    expect(buySkin(save, 'beaver_labubu_secret').reason).toBe('not_for_sale');
  });

  it('buys a Legendary skin with gems exactly once', () => {
    const { save } = makeSave();
    save.data.currencies.gems = 400;
    expect(buySkin(save, 'golden_labubu', 'gems')).toEqual({ ok: true, amount: 350 });
    expect(save.hasItem('golden_labubu')).toBe(true);
    expect(save.data.currencies.gems).toBe(50);
    expect(buySkin(save, 'golden_labubu', 'gems').reason).toBe('owned');
  });

  it('refuses when short and supports coin prices', () => {
    const { save } = makeSave();
    save.data.currencies.gems = 10;
    const rare = Object.values(CATALOG).find((it) => it.rarity === 'rare' && it.slot === 'doll');
    expect(buySkin(save, rare.id, 'gems').reason).toBe('insufficient');
    save.data.currencies.popCoins = 5000;
    expect(buySkin(save, rare.id, 'popCoins').ok).toBe(true);
    expect(buySkin(save, 'golden_labubu', 'popCoins').reason).toBe('not_for_sale');
  });
});

describe('daily deals', () => {
  it('are stable within a day and can be bought once', () => {
    const { save, clock } = makeSave();
    const a = dailyDeals(save, clock.t).map((d) => d.id);
    const b = dailyDeals(save, clock.t + 3600e3).map((d) => d.id);
    expect(a).toEqual(b);
    const gems = save.data.currencies.gems;
    expect(buyDeal(save, 'free_gift', clock.t).ok).toBe(true);
    expect(save.data.currencies.gems).toBe(gems + 5);
    expect(buyDeal(save, 'free_gift', clock.t).reason).toBe('already_bought');
    // Next day the gift is back.
    expect(buyDeal(save, 'free_gift', clock.t + 24 * 3600e3).ok).toBe(true);
  });

  it('the featured skin is discounted and unlocks the item', () => {
    const { save, clock } = makeSave();
    save.data.currencies.gems = 1000;
    const deal = dailyDeals(save, clock.t).find((d) => d.kind === 'skin');
    expect(deal.cost.amount).toBeLessThan(deal.was);
    expect(buyDeal(save, deal.id, clock.t).ok).toBe(true);
    expect(save.hasItem(deal.itemId)).toBe(true);
  });
});
