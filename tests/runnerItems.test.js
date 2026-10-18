import { describe, it, expect } from 'vitest';
import { rollRunItem, RUN_ITEMS, ITEM_ORDER } from '../src/systems/RunnerItems.js';

describe('runner item roulette', () => {
  it('only returns known items and roughly follows the weights', () => {
    const counts = Object.fromEntries(ITEM_ORDER.map((k) => [k, 0]));
    const N = 50000;
    for (let i = 0; i < N; i++) counts[rollRunItem()]++;
    const total = ITEM_ORDER.reduce((s, k) => s + RUN_ITEMS[k].weight, 0);
    for (const k of ITEM_ORDER) expect(counts[k] / N).toBeCloseTo(RUN_ITEMS[k].weight / total, 1);
  });

  it('maps roll boundaries deterministically', () => {
    expect(rollRunItem(() => 0)).toBe(ITEM_ORDER[0]);
    expect(rollRunItem(() => 0.9999)).toBe(ITEM_ORDER[ITEM_ORDER.length - 1]);
  });
});
