import { describe, it, expect } from 'vitest';
import { rollRarity, weightedRarity, pullBlindBox, buyTicket } from '../src/systems/GachaSystem.js';
import { PITY, RARITY_TIERS, DROP_POOL } from '../src/config/GachaDropTable.js';
import { ECONOMY } from '../src/config/GameConfig.js';
import { makeSave, seq } from './helpers.js';

describe('weighted rarity', () => {
  it('matches the 60 / 29 / 10 / 1 table within tolerance', () => {
    const counts = { common: 0, rare: 0, epic: 0, secret: 0 };
    const N = 200000;
    for (let i = 0; i < N; i++) counts[weightedRarity()]++;
    expect(counts.common / N).toBeCloseTo(0.6, 1);
    expect(counts.rare / N).toBeCloseTo(0.29, 1);
    expect(counts.epic / N).toBeCloseTo(0.1, 1);
    expect(Math.abs(counts.secret / N - 0.01)).toBeLessThan(0.003);
  });

  it('maps roll boundaries onto the right tiers', () => {
    expect(weightedRarity(() => 0)).toBe('common');
    expect(weightedRarity(() => 0.599)).toBe('common');
    expect(weightedRarity(() => 0.6)).toBe('rare');
    expect(weightedRarity(() => 0.89)).toBe('epic');
    expect(weightedRarity(() => 0.995)).toBe('secret');
  });
});

describe('pity system', () => {
  it('guarantees Epic+ on the 10th pull without one', () => {
    let pity = { pullsSinceLastEpic: 0, pullsSinceLastSecret: 0 };
    const commonRng = () => 0.1;
    for (let i = 1; i < PITY.EPIC_EVERY; i++) {
      const r = rollRarity(pity, commonRng);
      expect(r.rarity).toBe('common');
      pity = r.pity;
    }
    const tenth = rollRarity(pity, commonRng);
    expect(RARITY_TIERS[tenth.rarity].rank).toBeGreaterThanOrEqual(RARITY_TIERS.epic.rank);
    expect(tenth.pityTriggered).toBe('epic');
    expect(tenth.pity.pullsSinceLastEpic).toBe(0);
  });

  it('guarantees a Secret Chase on the 50th pull without one', () => {
    let pity = { pullsSinceLastEpic: 0, pullsSinceLastSecret: 0 };
    let secrets = 0;
    for (let i = 1; i <= PITY.SECRET_EVERY; i++) {
      const r = rollRarity(pity, () => 0.1);
      if (r.rarity === 'secret') secrets++;
      pity = r.pity;
    }
    expect(secrets).toBe(1);
    expect(pity.pullsSinceLastSecret).toBe(0);
  });

  it('a natural Epic resets the epic counter only', () => {
    const r = rollRarity({ pullsSinceLastEpic: 5, pullsSinceLastSecret: 20 }, () => 0.9);
    expect(r.rarity).toBe('epic');
    expect(r.pity).toEqual({ pullsSinceLastEpic: 0, pullsSinceLastSecret: 21 });
  });
});

describe('pullBlindBox', () => {
  it('spends a ticket, unlocks the item and counts the box', () => {
    const { save } = makeSave();
    const tickets = save.data.currencies.blindBoxTickets;
    const res = pullBlindBox(save, 'ticket', seq(0.1, 0));
    expect(res.ok).toBe(true);
    expect(res.rarity).toBe('common');
    expect(res.itemId).toBe(DROP_POOL.common[0]);
    expect(res.isNew).toBe(true);
    expect(save.data.currencies.blindBoxTickets).toBe(tickets - 1);
    expect(save.hasItem(res.itemId)).toBe(true);
    expect(save.data.stats.boxesOpened).toBe(1);
  });

  it('converts duplicates into coins', () => {
    const { save } = makeSave();
    pullBlindBox(save, 'ticket', seq(0.1, 0));
    const coins = save.data.currencies.popCoins;
    const dup = pullBlindBox(save, 'ticket', seq(0.1, 0));
    expect(dup.isNew).toBe(false);
    expect(dup.refund.coins).toBe(ECONOMY.DUPLICATE_REFUND.common);
    expect(save.data.currencies.popCoins).toBe(coins + ECONOMY.DUPLICATE_REFUND.common);
  });

  it('refuses to pull without currency', () => {
    const { save } = makeSave();
    save.data.currencies.blindBoxTickets = 0;
    expect(pullBlindBox(save, 'ticket').ok).toBe(false);
    expect(pullBlindBox(save, 'key').ok).toBe(false);
  });

  it('golden key boxes are always Epic or better', () => {
    const { save } = makeSave();
    save.data.currencies.goldenKeys = 50;
    for (let i = 0; i < 50; i++) {
      const r = pullBlindBox(save, 'key');
      expect(RARITY_TIERS[r.rarity].rank).toBeGreaterThanOrEqual(2);
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
