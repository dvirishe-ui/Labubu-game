import { describe, it, expect } from 'vitest';
import { IdleRewardManager } from '../src/systems/IdleRewardManager.js';
import { IDLE } from '../src/config/GameConfig.js';
import { makeSave } from './helpers.js';

describe('IdleRewardManager', () => {
  it('pays base rate x collection multiplier for elapsed time', () => {
    const { save, clock } = makeSave();
    const idle = new IdleRewardManager(save, () => clock.t);
    clock.t += 3600 * 1000;
    // 1 doll owned -> 1.05x
    expect(idle.getCollectionMultiplier()).toBeCloseTo(1.05);
    expect(idle.getPending().coins).toBe(Math.floor(3600 * IDLE.BASE_RATE_PER_SECOND * 1.05));
  });

  it('adds +5% per unique doll (accessories do not count)', () => {
    const { save } = makeSave();
    const idle = new IdleRewardManager(save);
    save.unlockItem('macaron_pink');
    save.unlockItem('zimomo_king');
    save.unlockItem('raincoat');
    expect(idle.getCollectionMultiplier()).toBeCloseTo(1.15);
  });

  it('caps accumulation at MAX_OFFLINE_SECONDS', () => {
    const { save, clock } = makeSave();
    const idle = new IdleRewardManager(save, () => clock.t);
    clock.t += 48 * 3600 * 1000;
    const p = idle.getPending();
    expect(p.capped).toBe(true);
    expect(p.elapsedSeconds).toBe(IDLE.MAX_OFFLINE_SECONDS);
  });

  it('claim pays (with bonus multiplier) and resets the timer', () => {
    const { save, clock } = makeSave();
    const idle = new IdleRewardManager(save, () => clock.t);
    clock.t += 2 * 3600 * 1000;
    const pending = idle.getPending().coins;
    const coins = save.data.currencies.popCoins;
    expect(idle.claim(2)).toBe(pending * 2);
    expect(save.data.currencies.popCoins).toBe(coins + pending * 2);
    expect(idle.getPending().coins).toBe(0);
  });

  it('ignores a clock moved backwards', () => {
    const { save, clock } = makeSave();
    const idle = new IdleRewardManager(save, () => clock.t);
    clock.t -= 5 * 3600 * 1000;
    expect(idle.getPending().coins).toBe(0);
    expect(save.data.profile.lastIdleClaimTimestamp).toBe(clock.t);
  });
});
