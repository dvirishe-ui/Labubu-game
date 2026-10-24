import { CHARACTERS, SECRET_CHARACTER } from './characters';

export interface SoloRunState {
  seed: string;
  level: number;
  round: number;
  lives: number;
  score: number;
  streak: number;
  correct: number;
  coins: number;
  used: string[];
  powerups: Record<PowerUp, number>;
  startedAt: number;
}

export type PowerUp = 'fifty' | 'time' | 'double' | 'skip';

export interface Profile {
  v: 1;
  rev: number;
  name: string;
  createdAt: number;
  coins: number;
  coinsEarned: number;
  xp: number;
  owned: string[];
  skins: string[];
  equipped: { char: string | null; skin: string | null };
  favorite: string | null;
  wish: string | null;
  achievements: Record<string, number>;
  stats: {
    games: number;
    wins: number;
    correct: number;
    answered: number;
    bestStreak: number;
    streak: number;
    perfectGames: number;
    soloBest: number;
    soloBestLevel: number;
    bossesBeaten: number;
    dailies: number;
    dailyPerfect: number;
    duelsWon: number;
    bluffWins: number;
    partyNights: number;
    crowdBeats: number;
  };
  /** Reward keys already paid out (idempotency); pruned after 60 days. */
  claimed: Record<string, number>;
  /** Per-day earning counters for anti-farming caps. */
  day: { key: string; gameRewards: number; soloCoins: number; decisionCoins: number };
  week: { key: string; correct: number; games: number; dailies: number };
  daily: Record<string, { score: number; correct: number; at: number }>;
  duels: Record<string, { score: number; correct: number; at: number }>;
  solo: { unlockedLevel: number; run: SoloRunState | null };
  /** An unfinished daily attempt: reloading continues it rather than starting over. */
  dailyProgress: { day: string; i: number; score: number; correct: number } | null;
  /** Questions this player already answered once (for crowd statistics). */
  answered: Record<string, string>;
}

export const WELCOME_COINS = 500;

export function newProfile(now = Date.now()): Profile {
  return {
    v: 1,
    rev: 0,
    name: '',
    createdAt: now,
    coins: WELCOME_COINS,
    coinsEarned: WELCOME_COINS,
    xp: 0,
    owned: [],
    skins: [],
    equipped: { char: null, skin: null },
    favorite: null,
    wish: null,
    achievements: {},
    stats: {
      games: 0,
      wins: 0,
      correct: 0,
      answered: 0,
      bestStreak: 0,
      streak: 0,
      perfectGames: 0,
      soloBest: 0,
      soloBestLevel: 0,
      bossesBeaten: 0,
      dailies: 0,
      dailyPerfect: 0,
      duelsWon: 0,
      bluffWins: 0,
      partyNights: 0,
      crowdBeats: 0
    },
    claimed: { welcome: now },
    day: { key: '', gameRewards: 0, soloCoins: 0, decisionCoins: 0 },
    week: { key: '', correct: 0, games: 0, dailies: 0 },
    daily: {},
    duels: {},
    solo: { unlockedLevel: 1, run: null },
    dailyProgress: null,
    answered: {}
  };
}

/** Accepts anything loaded from storage and returns a well-formed profile. */
export function normalizeProfile(raw: unknown): Profile {
  const base = newProfile();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<Profile>;
  const known = new Set([...CHARACTERS.map((c) => c.id), SECRET_CHARACTER.id]);
  return {
    ...base,
    ...p,
    v: 1,
    coins: Math.max(0, Math.floor(Number(p.coins ?? base.coins)) || 0),
    owned: (p.owned ?? []).filter((id) => known.has(id)),
    skins: (p.skins ?? []).filter((id) => known.has(id.split(':')[0])),
    equipped: { ...base.equipped, ...(p.equipped ?? {}) },
    stats: { ...base.stats, ...(p.stats ?? {}) },
    day: { ...base.day, ...(p.day ?? {}) },
    week: { ...base.week, ...(p.week ?? {}) },
    solo: { ...base.solo, ...(p.solo ?? {}) },
    achievements: p.achievements ?? {},
    claimed: p.claimed ?? base.claimed,
    daily: p.daily ?? {},
    duels: p.duels ?? {},
    answered: p.answered ?? {}
  };
}

/** XP needed to reach level L (level 1 = 0 XP). */
export const xpForLevel = (L: number) => 60 * (L - 1) * L;

export function levelOf(xp: number): { level: number; into: number; need: number } {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  return { level: L, into: xp - xpForLevel(L), need: xpForLevel(L + 1) - xpForLevel(L) };
}
