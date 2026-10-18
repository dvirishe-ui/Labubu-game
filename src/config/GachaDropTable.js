/**
 * GachaDropTable.js
 * Rarity tiers, drop probabilities, pity thresholds and the full item catalog.
 *
 * Every collectible lives in CATALOG. Items are data-only: the procedural art
 * (src/art/CharacterRenderer.js) reads `palette`/`id` to draw them, and the
 * PerkCalculator reads `perks` to turn equipment into gameplay modifiers.
 */

/** Ordered from lowest to highest. `weight` values are percentages and sum to 100. */
export const RARITY_TIERS = {
  common: { key: 'common', label: 'Common', weight: 60.0, color: 0x9aa0a6, glow: 0xd7dade, rank: 0 },
  rare: { key: 'rare', label: 'Rare', weight: 29.0, color: 0x3fa9f5, glow: 0x9fd6ff, rank: 1 },
  epic: { key: 'epic', label: 'Epic', weight: 10.0, color: 0xa45cff, glow: 0xd4b0ff, rank: 2 },
  secret: { key: 'secret', label: 'Secret Chase', weight: 1.0, color: 0xffc93c, glow: 0xfff1b8, rank: 3 }
};

export const RARITY_ORDER = ['common', 'rare', 'epic', 'secret'];

/** Pity: pull N is guaranteed to be at least this tier if none dropped in the last N-1 pulls. */
export const PITY = {
  EPIC_EVERY: 10,
  SECRET_EVERY: 50
};

/** Equipment slots -> the save-file key under `equipped`. */
export const SLOTS = {
  doll: 'baseDoll',
  outfit: 'outfit',
  headwear: 'headwear',
  tail: 'tail',
  shoes: 'shoes'
};

export const SERIES_NAME = 'The Monsters · Forest Run Series';

/**
 * Item catalog.
 * - slot:   which equip slot the item occupies.
 * - type:   inventory type written to the save ('base' and 'secret_chase' are dolls).
 * - inPool: false for starter items that never drop from boxes.
 * - perks:  gameplay modifiers aggregated by PerkCalculator.
 */
export const CATALOG = {
  // ---------------------------------------------------------------- starter
  labubu_classic: {
    id: 'labubu_classic',
    name: 'Classic Labubu',
    slot: 'doll',
    type: 'base',
    rarity: 'common',
    inPool: false,
    description: 'The mischievous original. Nine pointy teeth, endless energy.',
    palette: { fur: '#efd9b9', shade: '#d6b994', ear: '#f7b6c2', face: '#fff3e2', eye: '#2a1f2e', accent: '#e59aa8' },
    perks: {}
  },

  // ---------------------------------------------------------------- common (60%)
  raincoat: {
    id: 'raincoat',
    name: 'Puddle Raincoat',
    slot: 'outfit',
    type: 'outfit',
    rarity: 'common',
    description: 'A sunny yellow raincoat. Lucky charms rattle in the pockets.',
    perks: { ticketLuck: 0.5 }
  },
  beanie: {
    id: 'beanie',
    name: 'Cozy Beanie',
    slot: 'headwear',
    type: 'headwear',
    rarity: 'common',
    description: 'Knitted with ear-holes, of course. Keeps the idle bank warm.',
    perks: { idleBonus: 0.1 }
  },
  canvas_sneakers: {
    id: 'canvas_sneakers',
    name: 'Canvas Sneakers',
    slot: 'shoes',
    type: 'shoes',
    rarity: 'common',
    description: 'Springy soles for springy monsters.',
    perks: { jumpBoost: 0.08 }
  },
  lumberjack_vest: {
    id: 'lumberjack_vest',
    name: 'Lumberjack Vest',
    slot: 'outfit',
    type: 'outfit',
    rarity: 'common',
    description: 'Red plaid with magnetic buttons. Coins can’t resist it.',
    perks: { magnetBonus: 3 } // +3 m coin reach
  },
  beaver_cap: {
    id: 'beaver_cap',
    name: 'Beaver Cap',
    slot: 'headwear',
    type: 'headwear',
    rarity: 'common',
    description: 'Fuzzy cap with tiny round ears. Smells like cedar.',
    perks: { coinMultiplier: 0.05 }
  },
  beaver_paddle_tail: {
    id: 'beaver_paddle_tail',
    name: 'Beaver Paddle Tail',
    slot: 'tail',
    type: 'tail',
    rarity: 'common',
    description: 'A flat, quilted tail. Slap the air for a third jump and glide down gently.',
    perks: { extraJump: 1, floatyFall: true }
  },

  // ---------------------------------------------------------------- rare (29%)
  macaron_pink: {
    id: 'macaron_pink',
    name: 'Macaron Pink',
    slot: 'doll',
    type: 'base',
    rarity: 'rare',
    description: 'Strawberry-macaron colorway. Sweet look, sour attitude.',
    palette: { fur: '#ffc4d6', shade: '#f29ab6', ear: '#ff7fa6', face: '#fff0f5', eye: '#3a1f33', accent: '#ff6f9c' },
    perks: {}
  },
  sesame_grey: {
    id: 'sesame_grey',
    name: 'Sesame Grey',
    slot: 'doll',
    type: 'base',
    rarity: 'rare',
    description: 'Toasted-sesame colorway with speckled fur.',
    palette: { fur: '#b9b5b0', shade: '#8f8a84', ear: '#e6a9b6', face: '#efebe6', eye: '#1e1b1d', accent: '#6f6a66', speckle: true },
    perks: {}
  },
  toffee_brown: {
    id: 'toffee_brown',
    name: 'Toffee Brown',
    slot: 'doll',
    type: 'base',
    rarity: 'rare',
    description: 'Caramel-glazed colorway. Slightly sticky.',
    palette: { fur: '#c98b55', shade: '#a26a3a', ear: '#f2b38c', face: '#f8e2c8', eye: '#2a1a12', accent: '#8a5328' },
    perks: {}
  },

  // ---------------------------------------------------------------- epic (10%)
  zimomo_king: {
    id: 'zimomo_king',
    name: 'Zimomo King',
    slot: 'doll',
    type: 'base',
    rarity: 'epic',
    description: 'The boss of the Monsters, crowned and caped. Royal pockets hold extra coins.',
    palette: { fur: '#6d5a4f', shade: '#4d3e36', ear: '#e7a3a9', face: '#f4e3d3', eye: '#140e0c', accent: '#d4252f' },
    perks: { coinMultiplier: 0.1 }
  },
  space_explorer: {
    id: 'space_explorer',
    name: 'Space Explorer',
    slot: 'doll',
    type: 'base',
    rarity: 'epic',
    description: 'Moon-walk certified. Gravity is merely a suggestion.',
    palette: { fur: '#eef2f7', shade: '#c4cdd9', ear: '#ffb0c4', face: '#ffffff', eye: '#1a2233', accent: '#4f7cff' },
    perks: { gravityReduction: 0.1 }
  },

  // ---------------------------------------------------------------- secret chase (1%)
  beaver_labubu_secret: {
    id: 'beaver_labubu_secret',
    name: 'Lumberjack Beaver Labubu',
    slot: 'doll',
    type: 'secret_chase',
    rarity: 'secret',
    description: 'SECRET CHASE! Buck-teeth faceplate, quilted beaver tail and plaid flannel. Shrugs off one hit per run.',
    palette: { fur: '#8a5a34', shade: '#6a4224', ear: '#d99a7a', face: '#e9c9a3', eye: '#1b120c', accent: '#c7362f', plaid: true },
    perks: { shield: 1, coinMultiplier: 0.25 }
  }
};

/** Pre-bucketed pool: rarity -> array of droppable item ids. */
export const DROP_POOL = RARITY_ORDER.reduce((pool, rarity) => {
  pool[rarity] = Object.values(CATALOG)
    .filter((item) => item.rarity === rarity && item.inPool !== false)
    .map((item) => item.id);
  return pool;
}, {});

export const ALL_ITEM_IDS = Object.keys(CATALOG);

export const getItem = (id) => CATALOG[id] || null;

export const isDoll = (id) => CATALOG[id]?.slot === 'doll';

/** Human-readable perk descriptions for the stats inspector / reveal card. */
export function describePerks(perks = {}) {
  const lines = [];
  if (perks.extraJump) lines.push('Triple jump');
  if (perks.floatyFall) lines.push('Glide: -35% gravity while holding jump');
  if (perks.magnetBonus) lines.push(`Coin magnet +${perks.magnetBonus} m reach`);
  if (perks.shield) lines.push(`${perks.shield}-hit shield per run`);
  if (perks.coinMultiplier) lines.push(`+${Math.round(perks.coinMultiplier * 100)}% coin value`);
  if (perks.jumpBoost) lines.push(`+${Math.round(perks.jumpBoost * 100)}% jump height`);
  if (perks.gravityReduction) lines.push(`-${Math.round(perks.gravityReduction * 100)}% gravity`);
  if (perks.idleBonus) lines.push(`+${Math.round(perks.idleBonus * 100)}% idle coin rate`);
  if (perks.ticketLuck) lines.push(`+${Math.round(perks.ticketLuck * 100)}% ticket spawn chance`);
  if (!lines.length) lines.push('Cosmetic · +5% idle multiplier (collection bonus)');
  return lines;
}
