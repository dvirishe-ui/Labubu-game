/**
 * RunnerItems.js
 * Mario Kart-style item boxes for the runner. Hitting a box spins a roulette
 * in the HUD; the result is held until the player taps the item button.
 * Effects are applied by RunnerScene.useItem().
 */
export const RUN_ITEMS = {
  mushroom: { key: 'mushroom', name: 'Dash Mushroom', icon: 'item_mushroom', weight: 30, hint: 'Speed burst - plow through obstacles' },
  magnet: { key: 'magnet', name: 'Super Magnet', icon: 'magnet', weight: 22, hint: 'Pulls in every coin nearby' },
  coins: { key: 'coins', name: 'Coin Rain', icon: 'item_coins', weight: 22, hint: 'Showers the path with coins' },
  shield: { key: 'shield', name: 'Bubble Shield', icon: 'item_shield', weight: 14, hint: 'Blocks one hit' },
  star: { key: 'star', name: 'Super Star', icon: 'item_star', weight: 12, hint: 'Invincible and faster for 6 s' }
};

export const ITEM_ORDER = Object.keys(RUN_ITEMS);

/** Weighted random item key. */
export function rollRunItem(rng = Math.random) {
  const total = ITEM_ORDER.reduce((s, k) => s + RUN_ITEMS[k].weight, 0);
  let r = rng() * total;
  for (const k of ITEM_ORDER) {
    r -= RUN_ITEMS[k].weight;
    if (r < 0) return k;
  }
  return ITEM_ORDER[0];
}
