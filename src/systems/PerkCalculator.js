/**
 * PerkCalculator.js
 * Turns the equipped loadout into one flat set of gameplay modifiers that
 * Player, RunnerScene and IdleRewardManager consume.
 */
import { CATALOG } from '../config/GachaDropTable.js';
import { RUNNER } from '../config/GameConfig.js';

/**
 * @param {object} equipped  save.equipped ({ baseDoll, outfit, headwear, tail, shoes })
 * @returns {{
 *   doubleJump: boolean, floatyFall: boolean, attractRadius: number,
 *   shieldCharges: number, coinMultiplier: number, jumpMultiplier: number,
 *   gravityMultiplier: number, idleBonus: number, ticketLuck: number, sources: string[]
 * }}
 */
export function computePerks(equipped = {}) {
  const perks = {
    doubleJump: false,
    floatyFall: false,
    attractRadius: RUNNER.BASE_ATTRACT_RADIUS,
    shieldCharges: 0,
    coinMultiplier: 1,
    jumpMultiplier: 1,
    gravityMultiplier: 1,
    idleBonus: 0,
    ticketLuck: 0,
    sources: []
  };

  for (const id of Object.values(equipped)) {
    const item = id && CATALOG[id];
    if (!item?.perks) continue;
    const p = item.perks;
    if (Object.keys(p).length) perks.sources.push(item.name);
    if (p.doubleJump) perks.doubleJump = true;
    if (p.floatyFall) perks.floatyFall = true;
    if (p.magnetBonus) perks.attractRadius += p.magnetBonus;
    if (p.shield) perks.shieldCharges += p.shield;
    if (p.coinMultiplier) perks.coinMultiplier += p.coinMultiplier;
    if (p.jumpBoost) perks.jumpMultiplier += p.jumpBoost;
    if (p.gravityReduction) perks.gravityMultiplier -= p.gravityReduction;
    if (p.idleBonus) perks.idleBonus += p.idleBonus;
    if (p.ticketLuck) perks.ticketLuck += p.ticketLuck;
  }
  return perks;
}
