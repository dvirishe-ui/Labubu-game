/**
 * GachaDropTable.js
 * Rarity tiers, skin multipliers, blind-box packs (with posted odds, like real
 * Pop Mart series), shop prices and the full item catalog.
 *
 * Every collectible lives in CATALOG. Items are data-only: the procedural art
 * (src/art/CharacterRenderer.js) reads `palette` / `features` to draw them,
 * and PerkCalculator turns `perks` + the doll's rarity into gameplay modifiers.
 */

/**
 * Rarity tiers, lowest to highest. `multiplier` is the score & coin bonus you
 * get while PLAYING with a doll (skin) of that rarity.
 */
export const RARITY_TIERS = {
  common: { key: 'common', label: 'Common', color: 0x8fa3b8, dark: 0x5b6f86, glow: 0xdbe6f2, rank: 0, multiplier: 1.0 },
  rare: { key: 'rare', label: 'Rare', color: 0x3ecf6b, dark: 0x1f8f45, glow: 0xb8ffd0, rank: 1, multiplier: 1.15 },
  epic: { key: 'epic', label: 'Epic', color: 0xa45cff, dark: 0x6a2bc7, glow: 0xdcc4ff, rank: 2, multiplier: 1.3 },
  legendary: { key: 'legendary', label: 'Legendary', color: 0xffc31f, dark: 0xd17a00, glow: 0xfff0a8, rank: 3, multiplier: 1.5 },
  secret: { key: 'secret', label: 'Mystery', color: 0xff4fa3, dark: 0xb3186a, glow: 0xffc7e4, rank: 4, multiplier: 2.0 }
};

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'secret'];

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
 * Blind-box packs. `odds` are percentages per tier (they sum to 100). Like a
 * real Pop Mart series, every box shows "Regular X% · Mystery Y%" up front.
 * `pity` guarantees a tier after N pulls of THIS pack without it.
 * `costs` lists the ways to pay (any one of them).
 * `bonus` is the extra loot in every box: coins plus a chance of boosts,
 * gems, tickets or keys (like the coins and goodies in a Brawl Stars box).
 */
export const PACKS = {
  classic: {
    id: 'classic',
    name: 'Forest Friends Box',
    tagline: 'The classic series',
    odds: { common: 58, rare: 28, epic: 10, legendary: 3.5, secret: 0.5 },
    pity: { epic: 10, legendary: 40, secret: 150 },
    costs: [
      { currency: 'blindBoxTickets', amount: 1 },
      { currency: 'popCoins', amount: 300 }
    ],
    colors: { front: ['#ffd0de', '#ff8fb1'], side: ['#e05b86', '#b8406a'], label: '#3d2a52', accent: '#e0567f' },
    bonus: {
      coins: [40, 120],
      extras: [
        { type: 'headStart', amount: 1, chance: 0.2 },
        { type: 'scoreBooster', amount: 1, chance: 0.15 },
        { type: 'gems', amount: [3, 10], chance: 0.2 },
        { type: 'blindBoxTickets', amount: 1, chance: 0.08 }
      ]
    }
  },
  sparkle: {
    id: 'sparkle',
    name: 'Sparkle Box',
    tagline: 'Rare or better, every time',
    odds: { rare: 52, epic: 33, legendary: 13, secret: 2 },
    pity: { legendary: 15, secret: 60 },
    costs: [
      { currency: 'goldenKeys', amount: 1 },
      { currency: 'gems', amount: 60 }
    ],
    colors: { front: ['#d6e9ff', '#6fb4ff'], side: ['#3f86e0', '#2a5fb0'], label: '#1d2a52', accent: '#2f6fd6' },
    bonus: {
      coins: [100, 250],
      extras: [
        { type: 'headStart', amount: 1, chance: 0.35 },
        { type: 'scoreBooster', amount: 1, chance: 0.3 },
        { type: 'gems', amount: [8, 20], chance: 0.3 },
        { type: 'blindBoxTickets', amount: 2, chance: 0.12 }
      ]
    }
  },
  mega: {
    id: 'mega',
    name: 'Mega Mystery Box',
    tagline: 'Epic or better - best Mystery odds',
    odds: { epic: 60, legendary: 33, secret: 7 },
    pity: { legendary: 4, secret: 20 },
    costs: [{ currency: 'gems', amount: 150 }],
    colors: { front: ['#fff1b8', '#ffc31f'], side: ['#e09b00', '#a86a00'], label: '#4a2a00', accent: '#d17a00' },
    bonus: {
      coins: [250, 500],
      extras: [
        { type: 'headStart', amount: 1, chance: 1 },
        { type: 'scoreBooster', amount: 1, chance: 0.5 },
        { type: 'gems', amount: [15, 40], chance: 0.4 },
        { type: 'goldenKeys', amount: 1, chance: 0.25 }
      ]
    }
  }
};
export const PACK_ORDER = ['classic', 'sparkle', 'mega'];

/** Regular vs. Mystery split for a pack, e.g. { regular: 99.5, mystery: 0.5 }. */
export function packSplit(packId) {
  const odds = PACKS[packId].odds;
  const mystery = odds.secret || 0;
  return { regular: Math.round((100 - mystery) * 10) / 10, mystery };
}

/** Shop prices for skins by rarity (Mystery skins are box-exclusive). */
export const SKIN_PRICES = {
  common: { gems: 30, popCoins: 900 },
  rare: { gems: 80, popCoins: 2500 },
  epic: { gems: 170 },
  legendary: { gems: 350 },
  secret: null
};

const pal = (fur, shade, ear, face, eye, accent, extra = {}) => ({ fur, shade, ear, face, eye, accent, ...extra });

/**
 * Item catalog.
 * - slot:     which equip slot the item occupies ('doll' = a skin).
 * - type:     inventory type written to the save ('base' and 'secret_chase' are dolls).
 * - inPool:   false for starter items that never drop from boxes.
 * - features: extra procedural details (horn, tiara, stars, metallic...).
 * - perks:    gameplay modifiers aggregated by PerkCalculator.
 */
export const CATALOG = {
  // ---------------------------------------------------------------- common skins
  labubu_classic: {
    id: 'labubu_classic',
    name: 'Classic Labubu',
    slot: 'doll',
    type: 'base',
    rarity: 'common',
    inPool: false,
    description: 'The mischievous original. Nine pointy teeth, endless energy.',
    palette: pal('#efd9b9', '#d6b994', '#f7b6c2', '#fff3e2', '#2a1f2e', '#e59aa8'),
    perks: {}
  },
  mint_cream: {
    id: 'mint_cream',
    name: 'Mint Cream',
    slot: 'doll',
    type: 'base',
    rarity: 'common',
    description: 'Cool as a mint ice cream on a summer run.',
    palette: pal('#bff2df', '#86d8bb', '#ff9fb8', '#f4fffa', '#1f2e2a', '#3fbf95'),
    perks: {}
  },
  lemon_fizz: {
    id: 'lemon_fizz',
    name: 'Lemon Fizz',
    slot: 'doll',
    type: 'base',
    rarity: 'common',
    description: 'Sour, sparkly and always bouncing.',
    palette: pal('#fff09a', '#f2cf4a', '#ffab8a', '#fffbe0', '#2e2410', '#f2a91a'),
    perks: {}
  },
  cotton_candy: {
    id: 'cotton_candy',
    name: 'Cotton Candy',
    slot: 'doll',
    type: 'base',
    rarity: 'common',
    description: 'Spun from sky-blue sugar clouds.',
    palette: pal('#c6e4ff', '#8fc1f2', '#ff9ccc', '#f5fbff', '#1d2533', '#ff7ab8'),
    perks: {}
  },

  // ---------------------------------------------------------------- rare skins
  macaron_pink: {
    id: 'macaron_pink',
    name: 'Macaron Pink',
    slot: 'doll',
    type: 'base',
    rarity: 'rare',
    description: 'Strawberry-macaron colorway. Sweet look, sour attitude.',
    palette: pal('#ffc4d6', '#f29ab6', '#ff7fa6', '#fff0f5', '#3a1f33', '#ff6f9c'),
    perks: {}
  },
  sesame_grey: {
    id: 'sesame_grey',
    name: 'Sesame Grey',
    slot: 'doll',
    type: 'base',
    rarity: 'rare',
    description: 'Toasted-sesame colorway with speckled fur.',
    palette: pal('#b9b5b0', '#8f8a84', '#e6a9b6', '#efebe6', '#1e1b1d', '#6f6a66', { speckle: true }),
    perks: {}
  },
  toffee_brown: {
    id: 'toffee_brown',
    name: 'Toffee Brown',
    slot: 'doll',
    type: 'base',
    rarity: 'rare',
    description: 'Caramel-glazed colorway. Slightly sticky.',
    palette: pal('#c98b55', '#a26a3a', '#f2b38c', '#f8e2c8', '#2a1a12', '#8a5328'),
    perks: {}
  },
  matcha_latte: {
    id: 'matcha_latte',
    name: 'Matcha Latte',
    slot: 'doll',
    type: 'base',
    rarity: 'rare',
    description: 'Whisked green tea fur with a foamy face.',
    palette: pal('#a9cf7a', '#7fae4f', '#ffb3a6', '#fbf6e6', '#1e2614', '#5c8f32'),
    perks: {}
  },

  // ---------------------------------------------------------------- epic skins
  zimomo_king: {
    id: 'zimomo_king',
    name: 'Zimomo King',
    slot: 'doll',
    type: 'base',
    rarity: 'epic',
    description: 'The boss of the Monsters, crowned and caped.',
    palette: pal('#6d5a4f', '#4d3e36', '#e7a3a9', '#f4e3d3', '#140e0c', '#d4252f'),
    perks: {}
  },
  space_explorer: {
    id: 'space_explorer',
    name: 'Space Explorer',
    slot: 'doll',
    type: 'base',
    rarity: 'epic',
    description: 'Moon-walk certified. Gravity is merely a suggestion.',
    palette: pal('#eef2f7', '#c4cdd9', '#ffb0c4', '#ffffff', '#1a2233', '#4f7cff'),
    perks: { gravityReduction: 0.1 }
  },
  pirate_captain: {
    id: 'pirate_captain',
    name: 'Pirate Captain',
    slot: 'doll',
    type: 'base',
    rarity: 'epic',
    description: 'Arr! Sails the forest road hunting for coins.',
    palette: pal('#8c7a6b', '#665647', '#e3a19a', '#f3e2cf', '#160f0b', '#d1303a', { features: ['bandana', 'eyepatch'] }),
    perks: {}
  },
  strawberry_bunny: {
    id: 'strawberry_bunny',
    name: 'Strawberry Bunny',
    slot: 'doll',
    type: 'base',
    rarity: 'epic',
    description: 'Fresh-picked, leafy-topped and extra juicy.',
    palette: pal('#ff6f7f', '#e0435a', '#ffd0d6', '#fff0f0', '#2a0f14', '#4fb34a', { features: ['seeds', 'leafcap'] }),
    perks: {}
  },

  // ---------------------------------------------------------------- legendary skins
  golden_labubu: {
    id: 'golden_labubu',
    name: 'Golden Labubu',
    slot: 'doll',
    type: 'base',
    rarity: 'legendary',
    description: 'Solid 24-carat fluff. Shines brighter than every coin it collects.',
    palette: pal('#ffd75e', '#d99a1c', '#fff2b0', '#fff8dc', '#3a2600', '#fff6c2', { features: ['metallic', 'sparkles'] }),
    perks: {}
  },
  dragon_labubu: {
    id: 'dragon_labubu',
    name: 'Dragon Labubu',
    slot: 'doll',
    type: 'base',
    rarity: 'legendary',
    description: 'Tiny horns, tiny wings, enormous attitude.',
    palette: pal('#4fc77a', '#2f8f52', '#ffd166', '#e6ffd9', '#10220f', '#ff7a1a', { features: ['dragon'] }),
    perks: {}
  },
  unicorn_dream: {
    id: 'unicorn_dream',
    name: 'Unicorn Dream',
    slot: 'doll',
    type: 'base',
    rarity: 'legendary',
    description: 'A golden horn and a rainbow mane. Pure magic.',
    palette: pal('#fbf3ff', '#dccbf0', '#ffb3d9', '#ffffff', '#2c1f3a', '#b07cff', { features: ['horn', 'mane'] }),
    perks: {}
  },
  ice_queen: {
    id: 'ice_queen',
    name: 'Ice Queen',
    slot: 'doll',
    type: 'base',
    rarity: 'legendary',
    description: 'Frost-blue fur and a crystal tiara. Cool under pressure.',
    palette: pal('#bfe8ff', '#7ec3ef', '#e6f6ff', '#f5fcff', '#0f2233', '#59b8ff', { features: ['tiara', 'frost'] }),
    perks: {}
  },

  // ---------------------------------------------------------------- mystery (secret chase)
  beaver_labubu_secret: {
    id: 'beaver_labubu_secret',
    name: 'Lumberjack Beaver',
    slot: 'doll',
    type: 'secret_chase',
    rarity: 'secret',
    description: 'MYSTERY! Buck-teeth faceplate, quilted beaver tail and plaid flannel. Shrugs off one hit per run.',
    palette: pal('#8a5a34', '#6a4224', '#d99a7a', '#e9c9a3', '#1b120c', '#c7362f', { plaid: true }),
    perks: { shield: 1 }
  },
  galaxy_labubu: {
    id: 'galaxy_labubu',
    name: 'Galaxy Labubu',
    slot: 'doll',
    type: 'secret_chase',
    rarity: 'secret',
    description: 'MYSTERY! Fur made of midnight and stardust. Coins orbit it.',
    palette: pal('#3b2f7a', '#231a52', '#ff8fd8', '#e9e4ff', '#0b0820', '#8fd3ff', { features: ['stars'] }),
    perks: { magnetBonus: 2 }
  },

  // ---------------------------------------------------------------- accessories
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
    rarity: 'rare',
    description: 'Red plaid with magnetic buttons. Coins can’t resist it.',
    perks: { magnetBonus: 3 } // +3 m coin reach
  },
  beaver_cap: {
    id: 'beaver_cap',
    name: 'Beaver Cap',
    slot: 'headwear',
    type: 'headwear',
    rarity: 'rare',
    description: 'Fuzzy cap with tiny round ears. Smells like cedar.',
    perks: { coinMultiplier: 0.05 }
  },
  beaver_paddle_tail: {
    id: 'beaver_paddle_tail',
    name: 'Beaver Paddle Tail',
    slot: 'tail',
    type: 'tail',
    rarity: 'epic',
    description: 'A flat, quilted tail. Slap the air for a third jump and glide down gently.',
    perks: { extraJump: 1, floatyFall: true }
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

/** Score & coin multiplier of a skin (doll) while playing. */
export const skinMultiplier = (dollId) => RARITY_TIERS[CATALOG[dollId]?.rarity]?.multiplier ?? 1;

/** Human-readable perk descriptions for the stats inspector / reveal card. */
export function describePerks(perks = {}, item = null) {
  const lines = [];
  if (item?.slot === 'doll') {
    const mult = skinMultiplier(item.id);
    if (mult > 1) lines.push(`x${mult} score & coins while playing`);
  }
  if (perks.extraJump) lines.push('Triple jump');
  if (perks.floatyFall) lines.push('Glide: -35% gravity while holding jump');
  if (perks.magnetBonus) lines.push(`Coin magnet +${perks.magnetBonus} m reach`);
  if (perks.shield) lines.push(`${perks.shield}-hit shield per run`);
  if (perks.coinMultiplier) lines.push(`+${Math.round(perks.coinMultiplier * 100)}% coin value`);
  if (perks.jumpBoost) lines.push(`+${Math.round(perks.jumpBoost * 100)}% jump height`);
  if (perks.gravityReduction) lines.push(`-${Math.round(perks.gravityReduction * 100)}% gravity`);
  if (perks.idleBonus) lines.push(`+${Math.round(perks.idleBonus * 100)}% idle coin rate`);
  if (perks.ticketLuck) lines.push(`+${Math.round(perks.ticketLuck * 100)}% ticket spawn chance`);
  if (!lines.length) lines.push('Collection bonus: +5% idle coins');
  return lines;
}
