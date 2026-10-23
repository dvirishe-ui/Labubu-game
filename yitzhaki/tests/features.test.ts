import { describe, expect, it } from 'vitest';
import { crowdFor, crowdSplit, dailyBoard, dailyRounds, duelHash, duelRounds, newDuelCode, parseDuelHash, weeklyBoard } from '../src/lib/challenges';
import { aggregate, type PublicPlayer } from '../src/lib/cloud';
import { openSecret, resolveDeck } from '../src/lib/deck';
import { buildSteps, INVENT_PROMPTS, MECHANICS, mechanicAvailable } from '../src/lib/plan';
import { buildRecap } from '../src/lib/recap';
import { minorityVoters, scoreMajority, scoreMinority } from '../src/lib/scoring';
import type { Session } from '../src/lib/session';
import { fiftyFifty, kindOf, pickSingle, pickTriple, pointsFor, soloPool, timerFor } from '../src/lib/solo';
import type { SessionConfig } from '../src/lib/types';

const { games, rounds } = resolveDeck();
const gameById = new Map(games.map((g) => [g.id, g]));

describe('solo path', () => {
  it('special every 5 rounds, boss every 10', () => {
    expect([1, 4, 5, 9, 10].map(kindOf)).toEqual(['normal', 'normal', 'special', 'normal', 'boss']);
    expect(timerFor(1, 'normal')).toBeGreaterThan(timerFor(5, 'normal'));
    expect(timerFor(20, 'boss')).toBeGreaterThanOrEqual(8);
  });
  it('points grow with level, streak, speed and multipliers', () => {
    const base = pointsFor(1, 0, 0, 20, 'normal', false);
    expect(pointsFor(3, 0, 0, 20, 'normal', false)).toBeGreaterThan(base);
    expect(pointsFor(1, 5, 0, 20, 'normal', false)).toBeGreaterThan(base);
    expect(pointsFor(1, 0, 20, 20, 'normal', false)).toBeGreaterThan(base);
    expect(pointsFor(1, 0, 0, 20, 'boss', false)).toBe(base * 3);
    expect(pointsFor(1, 0, 0, 20, 'normal', true)).toBe(base * 2);
  });
  it('solo uses only verified guessing questions and respects 18+', () => {
    const pool = soloPool(rounds, games, false);
    expect(pool.length).toBeGreaterThan(100);
    expect(pool.every((r) => gameById.get(r.gameId)!.engine === 'realfake' && !r.mature && openSecret(r).a)).toBe(true);
  });
  it('triple questions have exactly one target answer; 50/50 never hides it', () => {
    const pool = soloPool(rounds, games, true);
    for (let i = 0; i < 40; i++) {
      const t = pickTriple(pool, games, new Set(), 'seed' + i)!;
      expect(t.items).toHaveLength(3);
      const hits = t.items.filter((r) => openSecret(r).a === t.target);
      expect(hits).toHaveLength(1);
      expect(t.items[t.answerIndex]).toBe(hits[0]);
      expect(fiftyFifty(t, 'x' + i)).not.toBe(t.answerIndex);
    }
  });
  it('single pick avoids used questions', () => {
    const pool = soloPool(rounds, games, false).slice(0, 3);
    const used = new Set([pool[0].id, pool[1].id]);
    expect(pickSingle(pool, used, 'a')!.id).toBe(pool[2].id);
    expect(pickSingle(pool, new Set(pool.map((r) => r.id)), 'a')).toBeNull();
  });
});

describe('daily and duels', () => {
  it('daily set is the same for everyone on a day, different on another day, and family-friendly', () => {
    const a = dailyRounds(rounds, games, '2026-10-23').map((r) => r.id);
    expect(a).toHaveLength(10);
    expect(dailyRounds(rounds, games, '2026-10-23').map((r) => r.id)).toEqual(a);
    expect(dailyRounds(rounds, games, '2026-10-24').map((r) => r.id)).not.toEqual(a);
    expect(dailyRounds(rounds, games, '2026-10-23').every((r) => !r.mature)).toBe(true);
  });
  it('duel codes round-trip through the link', () => {
    const code = newDuelCode(() => 0.42);
    expect(parseDuelHash(duelHash(code, 1234))).toEqual({ code, score: 1234 });
    expect(parseDuelHash(duelHash(code))).toEqual({ code, score: null });
    expect(parseDuelHash('#duel-abc')).toBeNull();
    expect(duelRounds(rounds, games, code).map((r) => r.id)).toEqual(duelRounds(rounds, games, code).map((r) => r.id));
  });
  it('boards sort real results only', () => {
    const P = (id: string, days: PublicPlayer['days']): PublicPlayer => ({ id, name: id, char: null, skin: null, level: 1, days, duels: {}, updatedAt: 0 });
    const players = [P('a', { '2026-10-20': { score: 500, correct: 5 } }), P('b', { '2026-10-20': { score: 900, correct: 9 }, '2026-10-21': { score: 100, correct: 1 } }), P('c', {})];
    expect(dailyBoard(players, '2026-10-20').map((r) => r.id)).toEqual(['b', 'a']);
    expect(weeklyBoard(players, ['2026-10-20', '2026-10-21']).map((r) => [r.id, r.score])).toEqual([
      ['b', 1000],
      ['a', 500]
    ]);
  });
});

describe('against everyone', () => {
  const rows: { id: string; a: Record<string, string> }[] = [
    { id: 'me', a: { q1: 'real' } },
    { id: 'x', a: { q1: 'real', q2: 'yes' } },
    { id: 'y', a: { q1: 'fake', q2: 'yes' } },
    { id: 'z', a: { q1: 'fake', q2: 'no' } }
  ];
  it('excludes your own answers and hides thin data', () => {
    const s = aggregate(rows, 'me');
    expect(s.players).toBe(3);
    expect(crowdFor(s, 'q1', 'real')).toEqual({ total: 3, pct: 33 });
    expect(crowdFor(s, 'q1', 'real', 4)).toBeNull();
    expect(crowdFor(s, 'missing', 'real')).toBeNull();
    expect(crowdSplit(s, 'q2')!.counts).toEqual({ yes: 2, no: 1 });
    expect(crowdFor(null, 'q1', 'real')).toBeNull();
  });
});

describe('decision scoring', () => {
  it('majority, minority and black sheep', () => {
    const v = { a: 'yes', b: 'yes', c: 'no' };
    expect(scoreMajority(v)).toEqual({ a: 1, b: 1, c: 0 });
    expect(scoreMinority(v)).toEqual({ a: 0, b: 0, c: 1 });
    expect(minorityVoters(v)).toEqual(['c']);
    expect(scoreMinority({ a: 'yes', b: 'no' })).toEqual({ a: 0, b: 0 });
    expect(scoreMajority({ a: 'yes', b: 'no' })).toEqual({ a: 0, b: 0 });
  });
});

describe('party plans', () => {
  const cfg = (over: Partial<SessionConfig> = {}): SessionConfig => ({
    mode: 'players',
    participants: ['א', 'ב', 'ג', 'ד'].map((n, i) => ({ id: 'p' + i, name: n, score: 0 })),
    gameIds: games.map((g) => g.id),
    length: 10,
    secretVotes: false,
    timer: 0,
    predictMajority: false,
    mature: false,
    seed: 's',
    ...over
  });

  it('every mechanic builds valid steps from podcast content', () => {
    for (const m of MECHANICS) {
      const c = cfg({ mechanics: [m.id], ...(m.teamsOnly ? { mode: 'teams' as const, participants: [{ id: 't1', name: 'א', score: 0 }, { id: 't2', name: 'ב', score: 0 }] } : {}) });
      const steps = buildSteps(c, games, rounds, new Set());
      expect(steps.length, m.id).toBe(10);
      for (const s of steps) {
        if (s.engine === 'invent') expect(INVENT_PROMPTS[s.promptIndex!]).toBeTruthy();
        else expect(s.roundIds.every((id) => rounds.find((r) => r.id === id)?.usable)).toBe(true);
        if (s.engine === 'impostor') {
          const [x, y] = s.roundIds.map((id) => rounds.find((r) => r.id === id)!);
          expect(x.gameId).toBe(y.gameId);
          expect(x.id).not.toBe(y.id);
        }
        if (['bluff', 'battle', 'whowrote'].includes(s.engine)) expect(openSecret(rounds.find((r) => r.id === s.roundIds[0])!).a).toBeTruthy();
      }
      // no podcast item repeats inside a session
      const ids = steps.flatMap((s) => s.roundIds);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('availability rules', () => {
    const imp = MECHANICS.find((m) => m.id === 'impostor')!;
    const bat = MECHANICS.find((m) => m.id === 'battle')!;
    expect(mechanicAvailable(imp, 'players', 2)).toBe(false);
    expect(mechanicAvailable(imp, 'players', 3)).toBe(true);
    expect(mechanicAvailable(bat, 'players', 2)).toBe(false);
    expect(mechanicAvailable(bat, 'teams', 2)).toBe(true);
  });

  it('party night rotates through different kinds of rounds without repeats', () => {
    const steps = buildSteps(cfg({ minutes: 20, mature: true }), games, rounds, new Set());
    expect(steps.length).toBeGreaterThanOrEqual(30);
    const kinds = new Set(steps.map((s) => s.engine + (s.mode ?? '')));
    for (const k of ['realfake', 'dilemmamajority', 'dilemmaminority', 'bluff', 'impostor', 'whowrote', 'knows', 'invent']) expect(kinds.has(k), k).toBe(true);
    for (let i = 1; i < steps.length; i++) expect(steps[i].engine + (steps[i].mode ?? '')).not.toBe(steps[i - 1].engine + (steps[i - 1].mode ?? ''));
    const ids = steps.flatMap((s) => s.roundIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('party night with two players skips mechanics that need three', () => {
    const steps = buildSteps(cfg({ minutes: 10, participants: [{ id: 'a', name: 'א', score: 0 }, { id: 'b', name: 'ב', score: 0 }] }), games, rounds, new Set());
    expect(steps.some((s) => s.engine === 'impostor' || s.engine === 'knows' || s.engine === 'hotseat')).toBe(false);
  });
});

describe('recap', () => {
  it('awards come from the round log', () => {
    const s = {
      participants: [
        { id: 'a', name: 'א', score: 5 },
        { id: 'b', name: 'ב', score: 3 }
      ],
      log: [
        { deltas: {}, meta: { correct: ['b'] }, scores: { a: 0, b: 3 } },
        { deltas: {}, meta: { correct: ['b'], fooled: { a: 2 }, unpopular: ['b'] }, scores: { a: 1, b: 3 } },
        { deltas: {}, meta: { correct: ['a'] }, scores: { a: 5, b: 3 } }
      ]
    } as unknown as Session;
    const r = buildRecap(s);
    expect(r.winners).toEqual(['a']);
    expect(r.mostCorrect).toEqual({ id: 'b', n: 2 });
    expect(r.bestBluffer).toEqual({ id: 'a', n: 2 });
    expect(r.mostUnpopular).toEqual({ id: 'b', n: 1 });
    expect(r.comeback).toEqual({ id: 'a', from: 3 });
  });
});
