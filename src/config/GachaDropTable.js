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
  shoes: 'shoes',
  back: 'back'
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

/** Compact constructor for wardrobe items drawn by art/Wardrobe.js from `look`. */
const wear = (id, name, slot, rarity, description, look, perks = {}) => ({ id, name, slot, type: slot, rarity, description, look, perks });

/** The big wardrobe: outfits, hats, shoes, tails and back items (wings, capes, packs). */
const WARDROBE = [
  // ---- outfits
  wear('tee_rainbow', 'Rainbow Tee', 'outfit', 'common', 'A comfy white tee with a rainbow on the front.', { kind: 'tee', color: '#ffffff', print: 'rainbow', trim: '#ff8fb1' }),
  wear('hoodie_pink', 'Bubblegum Hoodie', 'outfit', 'common', 'Super soft, super pink, super cozy.', { kind: 'hoodie', color: '#ff8fc8', trim: '#ffffff' }),
  wear('hoodie_mint', 'Minty Hoodie', 'outfit', 'common', 'Fresh as a mint ice cream.', { kind: 'hoodie', color: '#6ee7b7', trim: '#ffffff' }),
  wear('sailor_stripes', 'Sailor Stripes', 'outfit', 'common', 'Ahoy! Blue and white like the sea.', { kind: 'stripes', color: '#ffffff', alt: '#3a6fd8' }),
  wear('denim_overalls', 'Denim Overalls', 'outfit', 'common', 'Pockets for snacks. Lots of snacks.', { kind: 'overalls', color: '#4a78c9', shirt: '#ffd23f' }),
  wear('polka_dress', 'Polka Dot Dress', 'outfit', 'common', 'Twirl-tested red dress with white dots.', { kind: 'dress', color: '#ff5a6e', dots: '#ffffff' }),
  wear('ballet_tutu', 'Ballet Tutu', 'outfit', 'rare', 'Lilac tulle for the fanciest pirouettes.', { kind: 'tutu', color: '#d8b4ff', alt: '#f2e3ff' }),
  wear('varsity_jacket', 'Varsity Jacket', 'outfit', 'rare', 'Team Labubu, number one fan.', { kind: 'jacket', color: '#2f6fd6', sleeve: '#ffffff', trim: '#ffd23f' }),
  wear('soccer_jersey', 'Star Striker Jersey', 'outfit', 'rare', 'Lucky number 10. Goooal!', { kind: 'jersey', color: '#2fc24f', trim: '#ffffff', number: '10' }),
  wear('snowflake_sweater', 'Snowflake Sweater', 'outfit', 'rare', 'Knitted by grandma monster.', { kind: 'stripes', color: '#c7362f', alt: '#ffffff', print: 'snow' }),
  wear('tiny_tuxedo', 'Tiny Tuxedo', 'outfit', 'epic', 'For very important monster parties.', { kind: 'suit', color: '#24202e', shirt: '#ffffff', sleeve: '#24202e' }, { coinMultiplier: 0.03 }),
  wear('sakura_kimono', 'Sakura Kimono', 'outfit', 'epic', 'Cherry blossoms and a big bow on the back.', { kind: 'kimono', color: '#ffb3cf', trim: '#c2185b', print: 'flowers' }),
  wear('knight_armor', 'Knight Armor', 'outfit', 'epic', 'Shiny, clanky and very brave.', { kind: 'armor', color: '#c9d2de', trim: '#ffc93c', sleeve: '#c9d2de' }, { shield: 1 }),
  wear('royal_gown', 'Royal Ball Gown', 'outfit', 'legendary', 'Sparkling purple gown fit for a queen.', { kind: 'dress', color: '#8a4dff', dots: '#ffe066', sparkle: true }, { idleBonus: 0.1 }),
  wear('super_suit', 'Super Labubu Suit', 'outfit', 'legendary', 'Faster than a speeding coin!', { kind: 'hero', color: '#2f6fd6', trim: '#e8324b', emblem: 'L' }, { jumpBoost: 0.08 }),

  // ---- headwear
  wear('red_cap', 'Red Ball Cap', 'headwear', 'common', 'Classic cap, brim to the front.', { kind: 'cap', color: '#e8324b' }),
  wear('blue_cap', 'Sky Ball Cap', 'headwear', 'common', 'Bright blue like a sunny day.', { kind: 'cap', color: '#3f8fff' }),
  wear('pink_bow', 'Big Pink Bow', 'headwear', 'common', 'The bigger the bow, the better.', { kind: 'bow', color: '#ff6fae' }),
  wear('party_hat', 'Party Hat', 'headwear', 'common', 'Every run is a party!', { kind: 'party', color: '#59b8ff', alt: '#ffd23f' }),
  wear('flower_crown', 'Flower Crown', 'headwear', 'common', 'Picked fresh from the forest road.', { kind: 'flowers', color: '#ff8fb1' }),
  wear('headphones', 'Beat Headphones', 'headwear', 'rare', 'Running is better with music.', { kind: 'headphones', color: '#8a4dff' }),
  wear('chef_hat', 'Chef Hat', 'headwear', 'rare', 'Cooks up the tastiest coin combos.', { kind: 'chef' }),
  wear('cowboy_hat', 'Cowboy Hat', 'headwear', 'rare', 'Yee-haw, partner!', { kind: 'cowboy', color: '#b07040' }),
  wear('star_shades', 'Star Shades', 'headwear', 'rare', 'Too cool for the sun.', { kind: 'shades', color: '#ff4fa3' }),
  wear('top_hat', 'Magic Top Hat', 'headwear', 'epic', 'Pull a coin out of it. Or a bunny.', { kind: 'tophat', color: '#24202e', trim: '#e0337f' }, { coinMultiplier: 0.03 }),
  wear('witch_hat', 'Witch Hat', 'headwear', 'epic', 'Spooky, sparkly and a little bendy.', { kind: 'witch', color: '#4a2a7a', trim: '#ff9f43' }),
  wear('propeller_cap', 'Propeller Cap', 'headwear', 'epic', 'Spins when you jump. Floaty!', { kind: 'propeller', color: '#ffd23f', alt: '#e8324b' }, { gravityReduction: 0.05 }),
  wear('golden_crown', 'Golden Crown', 'headwear', 'legendary', 'Ruby-topped crown of the Monster King.', { kind: 'crown', color: '#ffc93c', gem: '#e8324b' }, { coinMultiplier: 0.05 }),
  wear('angel_halo', 'Angel Halo', 'headwear', 'legendary', 'A glowing ring of pure goodness.', { kind: 'halo' }, { shield: 1 }),

  // ---- shoes
  wear('pink_sneakers', 'Bubblegum Sneakers', 'shoes', 'common', 'Pink kicks with white soles.', { kind: 'sneakers', color: '#ff6fae', trim: '#ffffff' }),
  wear('rain_boots', 'Puddle Boots', 'shoes', 'common', 'Splash-proof yellow wellies.', { kind: 'boots', color: '#ffd23f' }),
  wear('bunny_slippers', 'Bunny Slippers', 'shoes', 'rare', 'Fluffy slippers with tiny ears.', { kind: 'slippers', color: '#ffffff', alt: '#ffb3cf' }),
  wear('cowboy_boots', 'Cowboy Boots', 'shoes', 'rare', 'Stompy boots with gold trim.', { kind: 'boots', color: '#8a5a34', trim: '#ffc93c' }),
  wear('roller_skates', 'Roller Skates', 'shoes', 'epic', 'Wheee! Zoom down the forest road.', { kind: 'skates', color: '#59b8ff', alt: '#ffd23f' }, { coinMultiplier: 0.03 }),
  wear('rocket_boots', 'Rocket Boots', 'shoes', 'legendary', 'Little rockets for really big jumps.', { kind: 'rocket', color: '#c9d2de', alt: '#ff7a1a' }, { jumpBoost: 0.12 }),
  wear('glass_slippers', 'Glass Slippers', 'shoes', 'legendary', 'Sparkly slippers from a fairy tale.', { kind: 'glass' }, { idleBonus: 0.1 }),

  // ---- tails
  wear('bunny_puff', 'Bunny Puff', 'tail', 'common', 'A fluffy cotton-ball tail.', { kind: 'puff', color: '#ffffff' }),
  wear('cat_tail', 'Kitty Tail', 'tail', 'common', 'Swishy, curly, purrfect.', { kind: 'cat', color: '#3a2a3a' }),
  wear('fox_tail', 'Fox Tail', 'tail', 'rare', 'Big, bushy and orange with a white tip.', { kind: 'fox', color: '#ff8a3d', tip: '#ffffff' }),
  wear('devil_tail', 'Little Devil Tail', 'tail', 'rare', 'Cheeky red tail with a pointy tip.', { kind: 'devil', color: '#e8324b' }),
  wear('dino_tail', 'Dino Tail', 'tail', 'epic', 'RAWR! Spiky green dinosaur tail.', { kind: 'dino', color: '#4fc77a', spikes: '#ffd23f' }),
  wear('mermaid_tail', 'Mermaid Tail', 'tail', 'epic', 'Shimmery fin for splashing.', { kind: 'mermaid', color: '#3ec7c0', alt: '#8a4dff' }),
  wear('rainbow_tail', 'Rainbow Tail', 'tail', 'legendary', 'Every color of the rainbow, all fluffy.', { kind: 'fox', rainbow: true }, { magnetBonus: 1 }),

  // ---- back (new slot)
  wear('school_backpack', 'Star Backpack', 'back', 'common', 'Room for every coin you find.', { kind: 'backpack', color: '#ff9f43' }),
  wear('mint_backpack', 'Mint Backpack', 'back', 'common', 'A fresh minty pack.', { kind: 'backpack', color: '#2fc2a0' }),
  wear('butterfly_wings', 'Butterfly Wings', 'back', 'rare', 'Blue and yellow, flutter-ready.', { kind: 'butterfly', color: '#59b8ff', alt: '#ffd23f' }),
  wear('hero_cape', 'Hero Cape', 'back', 'rare', 'Every hero needs a cape.', { kind: 'cape', color: '#e8324b' }),
  wear('fairy_wings', 'Fairy Wings', 'back', 'epic', 'See-through and sparkly.', { kind: 'fairy', color: '#b8f0ff' }, { gravityReduction: 0.05 }),
  wear('bat_wings', 'Bat Wings', 'back', 'epic', 'Spooky-cute purple wings.', { kind: 'bat', color: '#4a2a7a' }),
  wear('jetpack', 'Jet Pack', 'back', 'epic', 'Two little rockets on your back.', { kind: 'jetpack', color: '#c9d2de', alt: '#ff7a1a' }, { jumpBoost: 0.06 }),
  wear('angel_wings', 'Angel Wings', 'back', 'legendary', 'Feathery wings: hold to glide!', { kind: 'angel', color: '#ffffff' }, { floatyFall: true })
];
for (const item of WARDROBE) CATALOG[item.id] = item;

/**
 * Exclusives: never in boxes or the shop. `exclusive` says where to win them
 * (the Arcade mini-games or the last tier of the Gold pass).
 */
const EXCLUSIVES = [
  {
    id: 'neon_labubu',
    name: 'Neon Arcade Labubu',
    slot: 'doll',
    type: 'base',
    rarity: 'legendary',
    exclusive: 'arcade',
    description: 'ARCADE EXCLUSIVE! Glows like a game machine. Win it in the Claw Machine.',
    palette: pal('#39e6ff', '#1f9fd6', '#ff6fd8', '#eaffff', '#0a1630', '#ff6fd8', { features: ['sparkles'] }),
    perks: {}
  },
  {
    id: 'champion_labubu',
    name: 'Pass Champion',
    slot: 'doll',
    type: 'base',
    rarity: 'legendary',
    exclusive: 'pass',
    description: 'GOLD PASS EXCLUSIVE! Only for players who reach tier 60.',
    palette: pal('#ff7ac8', '#d94a9a', '#ffd23f', '#fff0f8', '#2a0f20', '#ffd23f', { features: ['tiara', 'sparkles'] }),
    perks: { coinMultiplier: 0.05 }
  },
  { ...wear('brainy_shades', 'Memory Master Shades', 'headwear', 'epic', 'ARCADE EXCLUSIVE! Win 3 stars in Memory Match.', { kind: 'shades', color: '#2fc24f' }), exclusive: 'arcade' },
  { ...wear('gift_backpack', 'Lucky Gift Pack', 'back', 'epic', 'ARCADE EXCLUSIVE! Catch 100 points in Coin Catcher.', { kind: 'backpack', color: '#ffc93c' }, { magnetBonus: 1 }), exclusive: 'arcade' }
];
for (const item of EXCLUSIVES) CATALOG[item.id] = { inPool: false, ...item };

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
