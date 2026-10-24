import { openSecret, playablePool } from './deck';
import type { PowerUp, SoloRunState } from './profile';
import { mulberry32, hashSeed, shuffle } from './rng';
import type { GameMeta, Round } from './types';

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const ROUNDS_PER_LEVEL = 10;
export const BOSS_QUESTIONS = 3;
/** Order of the power buttons during a run. */
export const POWER_ORDER: PowerUp[] = ['fifty', 'answer', 'life', 'skip', 'time'];

export type SoloKind = 'normal' | 'special' | 'boss';

export function kindOf(round: number): SoloKind {
  if (round % ROUNDS_PER_LEVEL === 0) return 'boss';
  if (round % 5 === 0) return 'special';
  return 'normal';
}

export function timerFor(level: number, kind: SoloKind): number {
  const base = Math.max(10, 22 - (level - 1) * 2);
  return kind === 'boss' ? Math.max(8, base - 6) : kind === 'special' ? Math.max(10, base - 4) : base;
}

/** A new run. `powers` comes from the player's Easter eggs (see eggs.ts startingPowers). */
export function newRun(level: number, seed: string, powers: Record<PowerUp, number> = { fifty: 0, answer: 0, life: 0, skip: 0, time: 0 }): SoloRunState {
  return {
    seed,
    level,
    round: 1,
    lives: START_LIVES,
    score: 0,
    streak: 0,
    correct: 0,
    coins: 0,
    used: [],
    powerups: { ...powers },
    startedAt: Date.now(),
    shieldLevel: null
  };
}

/** Points for a correct answer: grows with level, streak and speed; boss questions ×3, special ×2. */
export function pointsFor(level: number, streak: number, secondsLeft: number, seconds: number, kind: SoloKind, doubled: boolean): number {
  const base = 100 * (1 + 0.25 * (level - 1));
  const speed = seconds ? Math.round(50 * (secondsLeft / seconds)) : 0;
  const streakBonus = Math.min(100, streak * 10);
  const mult = (kind === 'boss' ? 3 : kind === 'special' ? 2 : 1) * (doubled ? 2 : 1);
  return Math.round((base + speed + streakBonus) * mult);
}

export function soloPool(rounds: Round[], games: GameMeta[], mature: boolean): Round[] {
  const ids = games.filter((g) => g.engine === 'realfake').map((g) => g.id);
  return playablePool(rounds, ids, mature);
}

export interface SingleQ {
  type: 'single';
  round: Round;
}

export interface TripleQ {
  type: 'triple';
  gameId: string;
  /** Exactly one item has `target` as its revealed answer. */
  items: Round[];
  target: string;
  answerIndex: number;
}

export type SoloQ = SingleQ | TripleQ;

/** Next unused single question; deterministic for a seed so a resumed run continues the same way. */
export function pickSingle(pool: Round[], used: ReadonlySet<string>, seed: string): Round | null {
  const fresh = pool.filter((r) => !used.has(r.id));
  if (!fresh.length) return null;
  return fresh[Math.floor(mulberry32(hashSeed(seed))() * fresh.length)];
}

/**
 * "Which of these three is <target>?" built from one game: one round whose revealed answer is the
 * game's first option (e.g. real) and two whose answer is the other option.
 */
export function pickTriple(pool: Round[], games: GameMeta[], used: ReadonlySet<string>, seed: string): TripleQ | null {
  const byGame = new Map<string, Round[]>();
  for (const r of pool) if (!used.has(r.id)) byGame.set(r.gameId, [...(byGame.get(r.gameId) ?? []), r]);
  for (const gameId of shuffle([...byGame.keys()], seed + ':g')) {
    const g = games.find((x) => x.id === gameId);
    if (!g) continue;
    const target = Object.keys(g.options)[0];
    const list = shuffle(byGame.get(gameId)!, seed + ':' + gameId);
    const hit = list.find((r) => openSecret(r).a === target);
    const miss = list.filter((r) => openSecret(r).a && openSecret(r).a !== target).slice(0, 2);
    if (!hit || miss.length < 2) continue;
    const items = shuffle([hit, ...miss], seed + ':order');
    return { type: 'triple', gameId, items, target, answerIndex: items.indexOf(hit) };
  }
  return null;
}

/** Index of a wrong option to hide with 50/50 (deterministic per question). */
export function fiftyFifty(q: TripleQ, seed: string): number {
  const wrong = q.items.map((_, i) => i).filter((i) => i !== q.answerIndex);
  return wrong[Math.floor(mulberry32(hashSeed(seed + ':5050'))() * wrong.length)];
}

/** Level-up gift: one extra charge of a power the player has an egg for (null if they have none). */
export function randomPowerUp(seed: string, available: PowerUp[]): PowerUp | null {
  if (!available.length) return null;
  return available[Math.floor(mulberry32(hashSeed(seed))() * available.length)];
}
