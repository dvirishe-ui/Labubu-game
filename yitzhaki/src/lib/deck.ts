import rawDeck from '../generated/deck.json';
import { unseal } from './obfuscate';
import { shuffle } from './rng';
import { load, save } from './storage';
import type { DeckRound, GameMeta, Round, Secret } from './types';

export interface CustomRound {
  id: string;
  gameId: string;
  prompt: string;
  answer: string | null;
  choices: string[] | null;
  mature: boolean;
  source?: { name: string; ls: number; le: number; raw: string };
}

export interface RoundEdit {
  p?: string;
  a?: string | null;
  approve?: boolean;
  disabled?: boolean;
}

export interface AdminOverrides {
  edits: Record<string, RoundEdit>;
  custom: CustomRound[];
  rules: Record<string, string>;
}

const deck = rawDeck as { version: number; games: GameMeta[]; rounds: DeckRound[] };

export const EMPTY_OVERRIDES: AdminOverrides = { edits: {}, custom: [], rules: {} };

export function loadOverrides(): AdminOverrides {
  return { ...EMPTY_OVERRIDES, ...load<AdminOverrides>('admin.v1', EMPTY_OVERRIDES) };
}

export function saveOverrides(o: AdminOverrides): void {
  save('admin.v1', o);
}

export function baseGames(): GameMeta[] {
  return deck.games;
}

export function baseRounds(): DeckRound[] {
  return deck.rounds;
}

export function openSecret(r: Round): Secret {
  const base: Secret = r.sealed
    ? unseal<Secret>(r.id, r.sealed)
    : { a: null, rv: null, gs: [], pn: [], fee: null, ar: null, rn: null };
  return { ...base, ...(r.plain ?? {}) };
}

/** Applies admin edits/approvals/custom rounds on top of the shipped deck. */
export function resolveDeck(
  overrides: AdminOverrides = EMPTY_OVERRIDES,
  source: { games: GameMeta[]; rounds: DeckRound[] } = deck
): { games: GameMeta[]; rounds: Round[] } {
  const engineOf = Object.fromEntries(source.games.map((g) => [g.id, g.engine]));
  const rounds: Round[] = source.rounds.map((d) => {
    const e = overrides.edits[d.id] ?? {};
    const r: Round = {
      id: d.id,
      gameId: d.g,
      prompt: e.p ?? d.p ?? '',
      choices: d.o,
      mature: d.m,
      usable: d.u,
      confidence: d.c,
      sealed: d.x,
      plain: e.a !== undefined ? { a: e.a } : undefined
    };
    if (e.approve) {
      const needsAnswer = engineOf[d.g] === 'realfake';
      r.usable = !needsAnswer || openSecret(r).a != null;
    }
    if (e.disabled) r.usable = false;
    if (!r.prompt.trim()) r.usable = false;
    return r;
  });
  for (const c of overrides.custom) {
    const e = overrides.edits[c.id] ?? {};
    const needsAnswer = engineOf[c.gameId] === 'realfake';
    const prompt = e.p ?? c.prompt;
    const answer = e.a !== undefined ? e.a : c.answer;
    rounds.push({
      id: c.id,
      gameId: c.gameId,
      prompt,
      choices: c.choices,
      mature: c.mature,
      usable: !!prompt.trim() && (!needsAnswer || answer != null) && !e.disabled,
      confidence: 'admin',
      custom: true,
      sealed: '',
      plain: { a: answer, rv: null, gs: [], pn: [], fee: null, ar: null, rn: null }
    });
  }
  const games = source.games.map((g) => {
    const rs = rounds.filter((r) => r.gameId === g.id);
    const count = rs.filter((r) => r.usable).length;
    return { ...g, count, unresolved: rs.length - count, rules: overrides.rules[g.id] ?? g.rules };
  });
  return { games, rounds };
}

export function playablePool(rounds: Round[], gameIds: string[], mature: boolean): Round[] {
  const set = new Set(gameIds);
  return rounds.filter((r) => r.usable && set.has(r.gameId) && (mature || !r.mature));
}

/**
 * Picks rounds without repeats until every round in the pool was seen.
 * Rounds are interleaved across games so one big game doesn't swallow a mixed session.
 */
export function drawRounds(
  pool: Round[],
  count: number | 'all',
  seen: ReadonlySet<string>,
  seed: string
): { picked: Round[]; recycled: boolean } {
  const unseen = pool.filter((r) => !seen.has(r.id));
  const ordered = interleave(unseen, seed);
  if (count === 'all') return { picked: ordered, recycled: false };
  if (ordered.length >= count) return { picked: ordered.slice(0, count), recycled: false };
  const used = new Set(ordered.map((r) => r.id));
  const refill = interleave(pool.filter((r) => !used.has(r.id)), seed + ':refill');
  return { picked: [...ordered, ...refill].slice(0, count), recycled: true };
}

function interleave(rounds: Round[], seed: string): Round[] {
  const groups = new Map<string, Round[]>();
  for (const r of rounds) {
    const list = groups.get(r.gameId) ?? [];
    list.push(r);
    groups.set(r.gameId, list);
  }
  const queues = shuffle([...groups.keys()], seed + ':games').map((g) => shuffle(groups.get(g)!, seed + ':' + g));
  const out: Round[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
  return out;
}

export function loadSeen(): Set<string> {
  return new Set(load<string[]>('seen', []));
}

export function markSeen(ids: string[]): void {
  const seen = loadSeen();
  for (const id of ids) seen.add(id);
  save('seen', [...seen]);
}

/** Forget history for a pool once it's exhausted so the next session starts fresh. */
export function resetSeen(ids: string[]): void {
  const seen = loadSeen();
  for (const id of ids) seen.delete(id);
  save('seen', [...seen]);
}
