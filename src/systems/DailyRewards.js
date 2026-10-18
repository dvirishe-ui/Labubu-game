/**
 * DailyRewards.js
 * Two light daily loops that give kids a reason to come back:
 *  - Word hunt: collect the letters L-A-B-U-B-U during runs (one letter at a
 *    time, in order). Spelling the whole word pays a prize; resets daily.
 *  - Lucky Spin: one free spin of a prize wheel per day.
 * Pure functions over the SaveManager so they are unit-testable.
 */
import { WORD_HUNT, LUCKY_SPIN } from '../config/GameConfig.js';
import { toDateKey } from './QuestManager.js';

/** Today's word-hunt state, reset when the date changed. Does not save. */
export function wordHuntState(saveManager, now = Date.now()) {
  const d = saveManager.data;
  const today = toDateKey(now);
  if (!d.wordHunt || d.wordHunt.date !== today) {
    d.wordHunt = { date: today, collected: Array(WORD_HUNT.WORD.length).fill(false), completed: false };
  }
  return d.wordHunt;
}

/** Index of the next letter to find, or -1 when the word is done for today. */
export function nextLetterIndex(saveManager, now = Date.now()) {
  const st = wordHuntState(saveManager, now);
  if (st.completed) return -1;
  return st.collected.findIndex((c) => !c);
}

/**
 * Marks letter `index` collected. Returns { complete, reward } - the reward is
 * granted (and saved) when the last letter completes the word.
 */
export function collectLetter(saveManager, index, now = Date.now()) {
  const st = wordHuntState(saveManager, now);
  if (index < 0 || index >= st.collected.length || st.collected[index]) return { complete: st.completed, reward: null };
  st.collected[index] = true;
  let reward = null;
  if (st.collected.every(Boolean) && !st.completed) {
    st.completed = true;
    reward = { ...WORD_HUNT.REWARD };
    for (const [k, v] of Object.entries(reward)) saveManager.data.currencies[k] += v;
  }
  saveManager.save('word_hunt');
  return { complete: st.completed, reward };
}

/** Whether today's free spin is still available. */
export function canSpin(saveManager, now = Date.now()) {
  return saveManager.data.luckySpin?.lastSpinDate !== toDateKey(now);
}

/** Weighted pick of a wheel segment index. */
export function pickSpinSegment(rng = Math.random) {
  const total = LUCKY_SPIN.reduce((s, seg) => s + seg.weight, 0);
  let r = rng() * total;
  for (let i = 0; i < LUCKY_SPIN.length; i++) {
    r -= LUCKY_SPIN[i].weight;
    if (r < 0) return i;
  }
  return LUCKY_SPIN.length - 1;
}

/**
 * Spends today's free spin: rolls, grants and saves the prize up-front (the
 * wheel animation only shows it). Returns { index, segment } or null.
 */
export function spinWheel(saveManager, rng = Math.random, now = Date.now()) {
  if (!canSpin(saveManager, now)) return null;
  const index = pickSpinSegment(rng);
  const segment = LUCKY_SPIN[index];
  saveManager.data.luckySpin = { lastSpinDate: toDateKey(now) };
  saveManager.data.currencies[segment.reward.type] += segment.reward.amount;
  saveManager.save('lucky_spin');
  return { index, segment };
}
