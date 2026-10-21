import { describe, it, expect } from 'vitest';
import { speedAt, stageIndexAt, ZoneDirector } from '../src/systems/RunDirector.js';
import { addXp, levelInfo, passInfo, claimPassTier, unlockGoldPass, runXp, claimableCount, ensureSeason } from '../src/systems/Progression.js';
import { buyBoost, useBoost, buyUpgrade, upgradeCost, durationMult, headStartDistance } from '../src/systems/Boosts.js';
import { grantReward } from '../src/systems/Rewards.js';
import { SPEED, STAGES, ZONE_RULES, PASS, UPGRADE_COSTS, levelStep, passReward, tierXp } from '../src/config/ProgressionConfig.js';
import { makeSave } from './helpers.js';

describe('run difficulty', () => {
  it('starts slow and keeps getting faster', () => {
    expect(speedAt(0)).toBe(SPEED.START);
    expect(speedAt(500)).toBeLessThan(16);
    expect(speedAt(3000)).toBeGreaterThan(speedAt(1000));
    expect(speedAt(1e6)).toBeCloseTo(SPEED.MAX, 3);
  });

  it('moves through the stages and unlocks harder tricks', () => {
    expect(stageIndexAt(0)).toBe(0);
    expect(stageIndexAt(1000)).toBe(2);
    expect(stageIndexAt(99999)).toBe(STAGES.length - 1);
    expect(STAGES[0].highWall).toBe(0);
    expect(STAGES[STAGES.length - 1].gapMult).toBeLessThan(STAGES[0].gapMult);
  });

  it('schedules zones with gaps and no repeats in a row', () => {
    const zd = new ZoneDirector(() => 0.37);
    expect(zd.zoneAt(ZONE_RULES.FIRST_AT - 1)).toBeNull();
    const first = zd.zoneAt(ZONE_RULES.FIRST_AT + 10);
    expect(first.end - first.start).toBe(ZONE_RULES.LENGTH);
    const second = zd.nextZone(first.end);
    expect(second.start - first.end).toBeGreaterThanOrEqual(ZONE_RULES.GAP_MIN);
    expect(second.type).not.toBe(first.type);
  });
});

describe('levels & pass', () => {
  it('computes levels from XP', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, need: levelStep(1) });
    expect(levelInfo(levelStep(1)).level).toBe(2);
  });

  it('grants level-up rewards and pass progress', () => {
    const { save, clock } = makeSave();
    const coins = save.data.currencies.popCoins;
    const res = addXp(save, levelStep(1) + 5, clock.t);
    expect(res.levelUps).toHaveLength(1);
    expect(save.data.currencies.popCoins).toBeGreaterThan(coins);
    expect(passInfo(save, clock.t).tier).toBe(levelStep(1) + 5 >= tierXp(1) ? 1 : 0);
  });

  it('claims free tiers, gold needs the Gold Pass', () => {
    const { save, clock } = makeSave();
    addXp(save, tierXp(1) + tierXp(2), clock.t);
    expect(claimableCount(save, clock.t)).toBe(2);
    expect(claimPassTier(save, 1, 'free', clock.t).ok).toBe(true);
    expect(claimPassTier(save, 1, 'free', clock.t).ok).toBe(false);
    expect(claimPassTier(save, 3, 'free', clock.t).ok).toBe(false);
    expect(claimPassTier(save, 1, 'gold', clock.t).ok).toBe(false);
    save.data.currencies.gems = PASS.GOLD_PRICE_GEMS;
    expect(unlockGoldPass(save, clock.t).ok).toBe(true);
    expect(claimPassTier(save, 1, 'gold', clock.t).ok).toBe(true);
  });

  it('resets the pass each month', () => {
    const { save, clock } = makeSave();
    addXp(save, 500, clock.t);
    const next = clock.t + 40 * 864e5;
    ensureSeason(save, next);
    expect(passInfo(save, next).tier).toBe(0);
    expect(levelInfo(save.data.progress.xp).level).toBeGreaterThan(1); // level is lifetime
  });

  it('is 60 tiers and each tier costs more XP than the last', () => {
    expect(PASS.TIERS).toBe(60);
    for (let t = 2; t <= PASS.TIERS; t++) expect(tierXp(t)).toBeGreaterThan(tierXp(t - 1));
    const { save, clock } = makeSave();
    addXp(save, 1e9, clock.t);
    expect(passInfo(save, clock.t).tier).toBe(60);
    expect(passReward(60, 'gold')).toEqual({ type: 'item', id: 'champion_labubu' });
  });

  it('every tier has a reward on both tracks', () => {
    for (let t = 1; t <= PASS.TIERS; t++) {
      expect(passReward(t, 'free')).toBeTruthy();
      expect(passReward(t, 'gold')).toBeTruthy();
    }
  });

  it('run XP grows with distance and is capped', () => {
    expect(runXp({ distance: 1000, coins: 100 })).toBe(150);
    expect(runXp({ distance: 1e6, coins: 0 })).toBe(600);
  });
});

describe('boosts & upgrades', () => {
  it('buys and uses consumables', () => {
    const { save } = makeSave();
    save.data.powerups.headStart = 0;
    save.data.currencies.popCoins = 1500;
    expect(useBoost(save, 'headStart')).toBe(false);
    expect(buyBoost(save, 'headStart', 'popCoins').ok).toBe(true);
    expect(useBoost(save, 'headStart')).toBe(true);
    expect(save.data.powerups.headStart).toBe(0);
  });

  it('upgrades make power-ups last longer up to level 5', () => {
    const { save } = makeSave();
    save.data.currencies.popCoins = 1e6;
    for (let i = 0; i < UPGRADE_COSTS.length; i++) expect(buyUpgrade(save, 'magnet').ok).toBe(true);
    expect(upgradeCost(save, 'magnet')).toBeNull();
    expect(buyUpgrade(save, 'magnet').reason).toBe('max');
    expect(durationMult(save, 'magnet')).toBeCloseTo(2);
    buyUpgrade(save, 'headStart');
    expect(headStartDistance(save)).toBe(1250);
  });

  it('owned item rewards turn into gems', () => {
    const { save } = makeSave();
    const gems = save.data.currencies.gems;
    const r = grantReward(save, { type: 'item', id: 'labubu_classic' });
    expect(r.converted).toBe(true);
    expect(save.data.currencies.gems).toBeGreaterThan(gems);
  });
});
