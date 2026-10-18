/**
 * IdleRewardManager.js
 * Idle-tycoon "Pop Bank": coins accrue in real time - also while the app is
 * closed - and are claimed from the main menu or the Welcome Back dialog.
 *
 * Formula
 * -------
 *   elapsed              = clamp((now - lastIdleClaimTimestamp) / 1000, 0, MAX_OFFLINE_SECONDS)
 *   CollectionMultiplier = 1 + 0.05 * uniqueDollsOwned
 *   ProgressMultiplier   = 1 + 0.10 * floor(bestDistance / 1000)
 *   PerkMultiplier       = 1 + sum(idleBonus perks of equipped items)
 *   ratePerSecond        = BASE_RATE * CollectionMultiplier * ProgressMultiplier * PerkMultiplier
 *   idleCoins            = floor(elapsed * ratePerSecond)
 *
 * Clock tampering: if the device clock moves backwards we re-anchor the claim
 * timestamp to "now" (no negative or retroactive payouts); moving it forwards
 * is bounded by the MAX_OFFLINE_SECONDS cap.
 */
import { IDLE } from '../config/GameConfig.js';
import { computePerks } from './PerkCalculator.js';

export class IdleRewardManager {
  /**
   * @param {import('./SaveManager.js').SaveManager} saveManager
   * @param {() => number} [now]
   */
  constructor(saveManager, now = () => Date.now()) {
    this.save = saveManager;
    this.now = now;
  }

  /** +5% per unique doll owned (starter doll included). */
  getCollectionMultiplier() {
    return 1 + IDLE.MULTIPLIER_PER_UNIQUE_DOLL * this.save.uniqueDollCount();
  }

  /** +10% per full 1000 m of best distance - rewards getting better at the runner. */
  getProgressMultiplier() {
    const best = this.save.data.stats.bestDistance ?? this.save.data.stats.highScore;
    return 1 + IDLE.HIGHSCORE_RATE_BONUS_PER_1000M * Math.floor(best / 1000);
  }

  getPerkMultiplier() {
    return 1 + computePerks(this.save.data.equipped).idleBonus;
  }

  getTotalMultiplier() {
    return this.getCollectionMultiplier() * this.getProgressMultiplier() * this.getPerkMultiplier();
  }

  /** Coins generated per second with the current collection and loadout. */
  getRatePerSecond() {
    return IDLE.BASE_RATE_PER_SECOND * this.getTotalMultiplier();
  }

  /**
   * Coins waiting in the bank right now.
   * @returns {{ coins: number, elapsedSeconds: number, capped: boolean, rawElapsedSeconds: number }}
   */
  getPending() {
    const profile = this.save.data.profile;
    const now = this.now();
    if (!profile.lastIdleClaimTimestamp || now < profile.lastIdleClaimTimestamp) {
      // First launch or clock went backwards: re-anchor without paying out.
      profile.lastIdleClaimTimestamp = now;
      this.save.save('idle_reanchor');
      return { coins: 0, elapsedSeconds: 0, capped: false, rawElapsedSeconds: 0 };
    }
    const rawElapsedSeconds = (now - profile.lastIdleClaimTimestamp) / 1000;
    const elapsedSeconds = Math.min(rawElapsedSeconds, IDLE.MAX_OFFLINE_SECONDS);
    const coins = Math.floor(elapsedSeconds * this.getRatePerSecond());
    return { coins, elapsedSeconds, capped: rawElapsedSeconds >= IDLE.MAX_OFFLINE_SECONDS, rawElapsedSeconds };
  }

  /** Fraction (0..1) of the bank capacity that is filled - drives the UI meter. */
  getFillRatio() {
    return Math.min(1, this.getPending().elapsedSeconds / IDLE.MAX_OFFLINE_SECONDS);
  }

  /** Whether the "Welcome Back!" dialog should appear on launch. */
  shouldShowWelcomeBack() {
    const pending = this.getPending();
    return pending.coins > 0 && pending.elapsedSeconds >= IDLE.WELCOME_BACK_MIN_SECONDS;
  }

  /**
   * Pays the pending coins (times `bonusMultiplier`, e.g. 2 after an ad) and
   * resets the bank timer. Returns the amount paid.
   */
  claim(bonusMultiplier = 1) {
    const { coins } = this.getPending();
    const paid = Math.floor(coins * bonusMultiplier);
    const d = this.save.data;
    d.currencies.popCoins += paid;
    d.profile.lastIdleClaimTimestamp = this.now();
    this.save.save('idle_claim');
    return paid;
  }

  /** Formats seconds as "3h 12m" / "5m 03s" for the UI. */
  static formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m ${String(sec).padStart(2, '0')}s`;
  }
}
