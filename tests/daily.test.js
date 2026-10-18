import { describe, it, expect } from 'vitest';
import { wordHuntState, nextLetterIndex, collectLetter, canSpin, spinWheel, pickSpinSegment } from '../src/systems/DailyRewards.js';
import { WORD_HUNT, LUCKY_SPIN, computeViewport } from '../src/config/GameConfig.js';
import { makeSave } from './helpers.js';

describe('word hunt (L-A-B-U-B-U)', () => {
  it('hands out letters in order and pays once when the word is complete', () => {
    const { save, clock } = makeSave();
    const coins = save.data.currencies.popCoins;
    const tickets = save.data.currencies.blindBoxTickets;
    for (let i = 0; i < WORD_HUNT.WORD.length; i++) {
      expect(nextLetterIndex(save, clock.t)).toBe(i);
      const r = collectLetter(save, i, clock.t);
      expect(r.complete).toBe(i === WORD_HUNT.WORD.length - 1);
    }
    expect(nextLetterIndex(save, clock.t)).toBe(-1);
    expect(save.data.currencies.popCoins).toBe(coins + WORD_HUNT.REWARD.popCoins);
    expect(save.data.currencies.blindBoxTickets).toBe(tickets + WORD_HUNT.REWARD.blindBoxTickets);
    expect(collectLetter(save, 0, clock.t).reward).toBeNull();
  });

  it('resets the next day', () => {
    const { save, clock } = makeSave();
    collectLetter(save, 0, clock.t);
    clock.t += 24 * 3600 * 1000;
    expect(wordHuntState(save, clock.t).collected.every((c) => !c)).toBe(true);
  });
});

describe('Lucky Spin', () => {
  it('allows one free spin per day and grants the prize', () => {
    const { save, clock } = makeSave();
    expect(canSpin(save, clock.t)).toBe(true);
    const before = { ...save.data.currencies };
    const r = spinWheel(save, () => 0, clock.t);
    expect(r.index).toBe(0);
    const { type, amount } = LUCKY_SPIN[0].reward;
    expect(save.data.currencies[type]).toBe(before[type] + amount);
    expect(canSpin(save, clock.t)).toBe(false);
    expect(spinWheel(save, Math.random, clock.t)).toBeNull();
    clock.t += 24 * 3600 * 1000;
    expect(canSpin(save, clock.t)).toBe(true);
  });

  it('only lands on real segments', () => {
    for (let i = 0; i < 2000; i++) {
      const idx = pickSpinSegment();
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(LUCKY_SPIN.length);
    }
  });
});

describe('viewport', () => {
  it('fills portrait and landscape phones', () => {
    expect(computeViewport(390, 844, 3)).toMatchObject({ width: 720, height: 1558, portrait: true, res: 1.5 });
    expect(computeViewport(844, 390, 3)).toMatchObject({ width: 1558, height: 720, portrait: false });
    expect(computeViewport(1920, 1080, 1)).toMatchObject({ width: 1280, height: 720, res: 1.5 });
    expect(computeViewport(1024, 768, 1).width).toBe(1280);
  });
});

describe('run scoring', () => {
  it('stores the best score and best distance separately', () => {
    const { save } = makeSave();
    save.recordRun({ distance: 400, coins: 3, score: 9000 });
    save.recordRun({ distance: 650, coins: 3, score: 7000 });
    expect(save.data.stats.highScore).toBe(9000);
    expect(save.data.stats.bestDistance).toBe(650);
  });
});
