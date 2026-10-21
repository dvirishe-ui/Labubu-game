import { describe, it, expect } from 'vitest';
import { ARCADE, playsLeft, usePlay, buyPlay, memoryStars, memoryReward, catcherReward, fillClawMachine, clawHolds, clawReward, CLAW_PRIZES } from '../src/systems/MiniGames.js';
import { skinPrice } from '../src/systems/GachaSystem.js';
import { DROP_POOL, CATALOG } from '../src/config/GachaDropTable.js';
import { makeSave } from './helpers.js';

describe('arcade plays', () => {
  it('gives free plays each day, then paid plays', () => {
    const { save, clock } = makeSave();
    expect(playsLeft(save, clock.t)).toBe(ARCADE.FREE_PLAYS);
    for (let i = 0; i < ARCADE.FREE_PLAYS; i++) expect(usePlay(save, clock.t)).toBe(true);
    expect(usePlay(save, clock.t)).toBe(false);
    const tickets = save.data.currencies.blindBoxTickets;
    expect(buyPlay(save, 'blindBoxTickets', clock.t)).toBe(true);
    expect(save.data.currencies.blindBoxTickets).toBe(tickets - 1);
    expect(usePlay(save, clock.t)).toBe(true);
    // next day the free plays come back
    expect(playsLeft(save, clock.t + 864e5)).toBe(ARCADE.FREE_PLAYS);
  });
});

describe('exclusive prizes', () => {
  it('are never in boxes or the shop', () => {
    for (const id of ['neon_labubu', 'brainy_shades', 'gift_backpack', 'champion_labubu']) {
      expect(CATALOG[id].exclusive).toBeTruthy();
      expect(skinPrice(id)).toBeNull();
      expect(Object.values(DROP_POOL).flat()).not.toContain(id);
    }
  });

  it('Memory Match: 3 stars wins the shades once, then just coins + key', () => {
    const { save } = makeSave();
    expect(memoryStars(6)).toBe(3);
    expect(memoryStars(12)).toBe(2);
    expect(memoryStars(30)).toBe(1);
    memoryReward(save, 7);
    expect(save.hasItem('brainy_shades')).toBe(true);
    const keys = save.data.currencies.goldenKeys;
    const again = memoryReward(save, 7);
    expect(again.rewards.some((r) => r.type === 'item')).toBe(false);
    expect(save.data.currencies.goldenKeys).toBe(keys + 1);
  });

  it('Coin Catcher: 100 points wins the gift pack', () => {
    const { save } = makeSave();
    catcherReward(save, 70);
    expect(save.hasItem('gift_backpack')).toBe(false);
    catcherReward(save, 120);
    expect(save.hasItem('gift_backpack')).toBe(true);
  });

  it('Claw Machine always holds one Neon capsule, which is slippery', () => {
    for (const v of [0.01, 0.5, 0.999]) expect(fillClawMachine(9, () => v).filter((p) => p.id === 'neon')).toHaveLength(1);
    const neon = CLAW_PRIZES.find((p) => p.id === 'neon');
    expect(clawHolds(neon, () => 0.2)).toBe(false);
    expect(clawHolds(neon, () => 0.9)).toBe(true);
    const { save } = makeSave();
    clawReward(save, neon);
    expect(save.hasItem('neon_labubu')).toBe(true);
  });
});
