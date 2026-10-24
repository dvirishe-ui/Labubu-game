// The shop roster is fixed at these eight panelists. Adding anyone needs explicit approval.
// Prices: every character and every skin costs something different, and each skin tier costs
// more than the one below it (the classic skin comes with the character).
export type Tier = 'classic' | 'special' | 'legendary' | 'gold' | 'crown' | 'secret';

export interface CharacterDef {
  id: string;
  name: string;
  price: number;
  rarity: 'נדיר' | 'אפי' | 'אגדי' | 'מיתי';
  /** Visual identity of the illustrated mascot (not a likeness). */
  look: {
    skin: string;
    hair: 'curly' | 'buzz' | 'swoop' | 'beanie' | 'bun' | 'cap' | 'wavy' | 'spiky';
    hairColor: string;
    beard: 'none' | 'stubble' | 'full' | 'goatee' | 'mustache';
    glasses: boolean;
    accent: string;
    accent2: string;
    prop: 'mic' | 'coffee' | 'notebook' | 'phone' | 'headphones' | 'shades' | 'chain' | 'sneaker';
  };
  skinPrices: { special: number; legendary: number; gold: number };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'assaf',
    name: 'אסף יצחקי',
    price: 20000,
    rarity: 'מיתי',
    look: { skin: '#e8b48f', hair: 'swoop', hairColor: '#2a1d16', beard: 'stubble', glasses: false, accent: '#ffbe3b', accent2: '#e0243f', prop: 'mic' },
    skinPrices: { special: 22000, legendary: 26500, gold: 32000 }
  },
  {
    id: 'yonatan',
    name: 'יונתן ברק',
    price: 12500,
    rarity: 'אגדי',
    look: { skin: '#d9a07a', hair: 'curly', hairColor: '#1d1410', beard: 'full', glasses: false, accent: '#8b5cf6', accent2: '#22d3ee', prop: 'headphones' },
    skinPrices: { special: 14500, legendary: 18000, gold: 30000 }
  },
  {
    id: 'chen',
    name: 'חן מזרחי',
    price: 10500,
    rarity: 'אפי',
    look: { skin: '#c98d66', hair: 'buzz', hairColor: '#1a1310', beard: 'goatee', glasses: false, accent: '#10b981', accent2: '#ffbe3b', prop: 'chain' },
    skinPrices: { special: 12000, legendary: 16000, gold: 29000 }
  },
  {
    id: 'matan',
    name: 'מתן פרץ',
    price: 10000,
    rarity: 'אפי',
    look: { skin: '#e2a982', hair: 'wavy', hairColor: '#3b2a1e', beard: 'stubble', glasses: true, accent: '#3b82f6', accent2: '#f472b6', prop: 'notebook' },
    skinPrices: { special: 11500, legendary: 15500, gold: 28000 }
  },
  {
    id: 'noam',
    name: 'נועם אונגר',
    price: 9000,
    rarity: 'אפי',
    look: { skin: '#edc19c', hair: 'spiky', hairColor: '#4a3426', beard: 'none', glasses: false, accent: '#f97316', accent2: '#a3e635', prop: 'phone' },
    skinPrices: { special: 9800, legendary: 14000, gold: 27000 }
  },
  {
    id: 'dor',
    name: 'דור יתח',
    price: 7500,
    rarity: 'נדיר',
    look: { skin: '#b97f5a', hair: 'cap', hairColor: '#120d0a', beard: 'mustache', glasses: false, accent: '#ef4444', accent2: '#fbbf24', prop: 'sneaker' },
    skinPrices: { special: 8500, legendary: 13000, gold: 26000 }
  },
  {
    id: 'tal',
    name: 'טל ראשון',
    price: 7000,
    rarity: 'נדיר',
    look: { skin: '#f0c7a6', hair: 'bun', hairColor: '#5b3a24', beard: 'full', glasses: true, accent: '#06b6d4', accent2: '#f43f5e', prop: 'coffee' },
    skinPrices: { special: 8000, legendary: 12200, gold: 25000 }
  },
  {
    id: 'tzach',
    name: 'צח רוקח',
    price: 5000,
    rarity: 'נדיר',
    look: { skin: '#d6a07c', hair: 'beanie', hairColor: '#2b1f17', beard: 'stubble', glasses: false, accent: '#eab308', accent2: '#6366f1', prop: 'shades' },
    skinPrices: { special: 6000, legendary: 9500, gold: 24000 }
  }
];

export const CROWN_SKIN = { id: 'assaf:crown', charId: 'assaf', name: 'מלך הגג', price: 40000 };

/**
 * Secret character: never listed in the shop and can't be bought.
 * Unlocked only by finishing the hidden "מכונת הזמן" mini-game.
 */
export const SECRET_CHARACTER: CharacterDef = {
  id: 'noam-future',
  name: 'נועם אונגר מהעתיד',
  price: 0,
  rarity: 'מיתי',
  look: { skin: '#8a665a', hair: 'wavy', hairColor: '#9ca3af', beard: 'none', glasses: false, accent: '#22d3ee', accent2: '#a855f7', prop: 'phone' },
  skinPrices: { special: 0, legendary: 0, gold: 0 }
};
export const SECRET_SKIN = { id: 'noam-future:secret', charId: SECRET_CHARACTER.id, name: 'מהעתיד', price: 0 };

export const TIER_META: Record<Tier, { label: string; color: string; glow: string }> = {
  classic: { label: 'קלאסי', color: '#9ca3af', glow: 'rgba(156,163,175,.35)' },
  special: { label: 'מיוחד', color: '#22d3ee', glow: 'rgba(34,211,238,.45)' },
  legendary: { label: 'אגדי', color: '#a855f7', glow: 'rgba(168,85,247,.6)' },
  gold: { label: 'זהב', color: '#ffbe3b', glow: 'rgba(255,190,59,.7)' },
  crown: { label: 'מלך הגג', color: '#fff1a8', glow: 'rgba(255,214,102,.85)' },
  secret: { label: 'סודי', color: '#67e8f9', glow: 'rgba(103,232,249,.75)' }
};

export interface SkinDef {
  id: string;
  charId: string;
  tier: Tier;
  name: string;
  price: number;
}

const SKIN_NAMES: Record<Exclude<Tier, 'crown' | 'secret'>, string> = {
  classic: 'על הגג',
  special: 'ערב פתוח',
  legendary: 'ספיישל בנטפליקס',
  gold: 'עשוי זהב'
};

export function skinsFor(charId: string): SkinDef[] {
  if (charId === SECRET_CHARACTER.id) return [{ ...SECRET_SKIN, tier: 'secret' }];
  const c = CHARACTERS.find((x) => x.id === charId)!;
  const list: SkinDef[] = [
    { id: `${charId}:classic`, charId, tier: 'classic', name: SKIN_NAMES.classic, price: 0 },
    { id: `${charId}:special`, charId, tier: 'special', name: SKIN_NAMES.special, price: c.skinPrices.special },
    { id: `${charId}:legendary`, charId, tier: 'legendary', name: SKIN_NAMES.legendary, price: c.skinPrices.legendary },
    { id: `${charId}:gold`, charId, tier: 'gold', name: SKIN_NAMES.gold, price: c.skinPrices.gold }
  ];
  if (charId === CROWN_SKIN.charId) list.push({ id: CROWN_SKIN.id, charId, tier: 'crown', name: CROWN_SKIN.name, price: CROWN_SKIN.price });
  return list;
}

/** Shop skins (the secret character's skin is not part of the shop or the collection percentage). */
export const ALL_SKINS: SkinDef[] = CHARACTERS.flatMap((c) => skinsFor(c.id));
const EVERY_SKIN: SkinDef[] = [...ALL_SKINS, ...skinsFor(SECRET_CHARACTER.id)];
export const charById = (id: string | null | undefined) => CHARACTERS.find((c) => c.id === id) ?? (id === SECRET_CHARACTER.id ? SECRET_CHARACTER : null);
export const skinById = (id: string | null | undefined) => EVERY_SKIN.find((s) => s.id === id) ?? null;
export const isSecret = (id: string | null | undefined) => id === SECRET_CHARACTER.id;
