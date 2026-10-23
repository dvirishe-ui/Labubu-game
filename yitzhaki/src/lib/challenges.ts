import type { CrowdStats, PublicPlayer } from './cloud';
import { drawRounds } from './deck';
import { soloPool } from './solo';
import type { GameMeta, Round } from './types';

export const CHALLENGE_SIZE = 10;
export const CHALLENGE_SECONDS = 20;

/** Same ten verified, non-adult questions for everyone on a given day. */
export function dailyRounds(rounds: Round[], games: GameMeta[], day: string): Round[] {
  return drawRounds(soloPool(rounds, games, false), CHALLENGE_SIZE, new Set(), 'daily:' + day).picked;
}

export function duelRounds(rounds: Round[], games: GameMeta[], code: string): Round[] {
  return drawRounds(soloPool(rounds, games, false), CHALLENGE_SIZE, new Set(), 'duel:' + code).picked;
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newDuelCode(rand: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('');
}

export const isDuelCode = (s: string) => new RegExp(`^[${ALPHABET}]{6}$`).test(s);

/** Link fragment: #duel-CODE or #duel-CODE-SCORE (the score lets a friend compare even without shared storage). */
export function duelHash(code: string, score?: number): string {
  return `#duel-${code}${score != null ? `-${score}` : ''}`;
}

export function parseDuelHash(hash: string): { code: string; score: number | null } | null {
  const m = hash.match(/^#?duel-([A-Z0-9]{6})(?:-(\d{1,6}))?$/);
  if (!m || !isDuelCode(m[1])) return null;
  return { code: m[1], score: m[2] ? Number(m[2]) : null };
}

export function challengePoints(correct: boolean, secondsLeft: number): number {
  return correct ? 100 + Math.round(50 * Math.max(0, secondsLeft) / CHALLENGE_SECONDS) : 0;
}

export interface BoardRow {
  id: string;
  name: string;
  char: string | null;
  skin: string | null;
  score: number;
  correct: number;
}

export function dailyBoard(players: PublicPlayer[], day: string): BoardRow[] {
  return players
    .filter((p) => p.days?.[day])
    .map((p) => ({ id: p.id, name: p.name, char: p.char, skin: p.skin, score: p.days[day].score, correct: p.days[day].correct }))
    .sort((a, b) => b.score - a.score || b.correct - a.correct);
}

export function weeklyBoard(players: PublicPlayer[], days: string[]): BoardRow[] {
  return players
    .map((p) => {
      const ds = days.map((d) => p.days?.[d]).filter(Boolean) as { score: number; correct: number }[];
      return { id: p.id, name: p.name, char: p.char, skin: p.skin, score: ds.reduce((n, d) => n + d.score, 0), correct: ds.reduce((n, d) => n + d.correct, 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function duelBoard(players: PublicPlayer[], code: string): BoardRow[] {
  return players
    .filter((p) => p.duels?.[code])
    .map((p) => ({ id: p.id, name: p.name, char: p.char, skin: p.skin, score: p.duels[code].score, correct: p.duels[code].correct }))
    .sort((a, b) => b.score - a.score);
}

/** Share of other real players who answered correctly. Null until at least `min` have answered. */
export function crowdFor(stats: CrowdStats | null, qid: string, answer: string | null, min = 3): { total: number; pct: number } | null {
  if (!stats || !answer) return null;
  const t = stats.byQuestion[qid];
  if (!t) return null;
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  if (total < min) return null;
  return { total, pct: Math.round(((t[answer] ?? 0) / total) * 100) };
}

/** Real vote distribution for a decision question (null below `min` votes). */
export function crowdSplit(stats: CrowdStats | null, qid: string, min = 3): { total: number; counts: Record<string, number> } | null {
  const t = stats?.byQuestion[qid];
  if (!t) return null;
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  return total >= min ? { total, counts: t } : null;
}
