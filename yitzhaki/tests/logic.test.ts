import { beforeEach, describe, expect, it } from 'vitest';
import { drawRounds, loadSeen, markSeen, openSecret, playablePool, resolveDeck } from '../src/lib/deck';
import { assign } from '../src/lib/fmk';
import { seal, unseal } from '../src/lib/obfuscate';
import { shuffle } from '../src/lib/rng';
import { applyDeltas, majority, scoreBinary, scoreCreative, scoreHotSeat, scoreMajorityPrediction, standings } from '../src/lib/scoring';
import { createSession } from '../src/lib/session';
import type { Round, SessionConfig } from '../src/lib/types';

const { games, rounds } = resolveDeck();
const gameById = new Map(games.map((g) => [g.id, g]));

beforeEach(() => localStorage.clear());

describe('seeded shuffle', () => {
  it('is deterministic per seed and a permutation', () => {
    const xs = Array.from({ length: 50 }, (_, i) => i);
    expect(shuffle(xs, 'abc')).toEqual(shuffle(xs, 'abc'));
    expect(shuffle(xs, 'abc')).not.toEqual(shuffle(xs, 'abd'));
    expect(shuffle(xs, 'abc').slice().sort((a, b) => a - b)).toEqual(xs);
  });
});

describe('obfuscation', () => {
  it('round-trips Hebrew text', () => {
    const v = { a: 'real', rv: 'טקסט בעברית ✓' };
    expect(unseal('x-1', seal('x-1', v))).toEqual(v);
  });
  it('matches the build script implementation', async () => {
    // @ts-expect-error plain .mjs helper without types
    const build = await import('../scripts/obfuscate.mjs');
    const sealed = build.seal('S01-1', { a: 'noam' });
    expect(unseal('S01-1', sealed)).toEqual({ a: 'noam' });
  });
});

describe('shipped deck', () => {
  it('has playable rounds for most games', () => {
    expect(games.filter((g) => g.count > 0).length).toBeGreaterThanOrEqual(20);
  });
  it('every usable real/fake round has a revealed answer that is one of the options', () => {
    for (const r of rounds.filter((x) => x.usable)) {
      const g = gameById.get(r.gameId)!;
      expect(r.prompt.trim().length).toBeGreaterThan(3);
      if (g.engine === 'realfake') expect(Object.keys(g.options)).toContain(openSecret(r).a);
      if (g.engine === 'fmk') expect(r.choices).toHaveLength(3);
    }
  });
  it('does not expose answers in plain text', async () => {
    const raw = JSON.stringify((await import('../src/generated/deck.json')).default);
    expect(raw).not.toMatch(/"(a|rv|answer|correct_answer|host_final_reveal_excerpt)":/);
  });
  it('mature rounds are excluded unless 18+ mode is on', () => {
    const all = games.map((g) => g.id);
    expect(playablePool(rounds, all, false).some((r) => r.mature)).toBe(false);
    expect(playablePool(rounds, all, true).some((r) => r.mature)).toBe(true);
  });
});

describe('drawing rounds', () => {
  const pool = playablePool(rounds, ['israel-bidur', 'mizrahi-song', 'perfect-but'], true);

  it('never repeats a round until the pool is exhausted', () => {
    const seen = new Set<string>();
    let recycledAt = -1;
    for (let i = 0; recycledAt < 0 && i < 100; i++) {
      const { picked, recycled } = drawRounds(pool, 10, seen, 'seed' + i);
      expect(new Set(picked.map((r) => r.id)).size).toBe(picked.length);
      if (recycled) recycledAt = seen.size;
      else for (const r of picked) {
        expect(seen.has(r.id)).toBe(false);
        seen.add(r.id);
      }
    }
    expect(recycledAt).toBeGreaterThan(pool.length - 10);
  });

  it('interleaves games in a mixed session', () => {
    const { picked } = drawRounds(pool, 6, new Set(), 'mix');
    expect(new Set(picked.slice(0, 3).map((r) => r.gameId)).size).toBe(3);
  });

  it('is reproducible for the same seed', () => {
    const a = drawRounds(pool, 10, new Set(), 's').picked.map((r) => r.id);
    const b = drawRounds(pool, 10, new Set(), 's').picked.map((r) => r.id);
    expect(a).toEqual(b);
  });
});

describe('party flow on one device', () => {
  const cfg = (over: Partial<SessionConfig> = {}): SessionConfig => ({
    mode: 'players',
    participants: ['א', 'ב', 'ג', 'ד'].map((n, i) => ({ id: 'p' + i, name: n, score: 0 })),
    gameIds: ['israel-bidur', 'red-line'],
    length: 10,
    secretVotes: false,
    timer: 0,
    predictMajority: false,
    mature: false,
    seed: 'one',
    ...over
  });

  it('4 players, 10 rounds, then a rematch with unseen questions', () => {
    const s = createSession(cfg(), games, rounds);
    const ids = s.steps.map((x) => x.roundIds[0]);
    expect(ids).toHaveLength(10);
    const byId = new Map(rounds.map((r) => [r.id, r]));
    // red-line is 18+, so with mature off it never appears
    expect(ids.every((id) => byId.get(id)!.gameId === 'israel-bidur')).toBe(true);
    let ps = s.participants;
    for (const id of ids) {
      const a = openSecret(byId.get(id)!).a!;
      ps = applyDeltas(ps, scoreBinary({ p0: a, p1: a === 'real' ? 'fake' : 'real', p2: a }, a));
      markSeen([id]);
    }
    expect(ps.find((p) => p.id === 'p0')!.score).toBe(10);
    expect(ps.find((p) => p.id === 'p1')!.score).toBe(0);
    expect(standings(ps).leaders.map((p) => p.id).sort()).toEqual(['p0', 'p2']);
    const again = createSession(cfg({ seed: 'two' }), games, rounds);
    expect(again.steps.some((x) => ids.includes(x.roundIds[0]))).toBe(false);
  });

  it('marathon plays every unseen round once', () => {
    const s = createSession(cfg({ length: 'marathon', gameIds: ['student-film'] }), games, rounds);
    const pool = playablePool(rounds, ['student-film'], false);
    const ids = s.steps.map((x) => x.roundIds[0]);
    expect(new Set(ids)).toEqual(new Set(pool.map((r) => r.id)));
    markSeen(ids);
    expect(loadSeen().size).toBe(pool.length);
    // exhausted → next marathon starts over
    expect(createSession(cfg({ length: 'marathon', gameIds: ['student-film'], seed: 'z' }), games, rounds).steps).toHaveLength(pool.length);
  });

  it('team mode scores per team', () => {
    const s = createSession(cfg({ mode: 'teams', participants: [{ id: 't1', name: 'הגג', score: 0 }, { id: 't2', name: 'המרפסת', score: 0 }] }), games, rounds);
    const ps = applyDeltas(s.participants, { t1: 1 });
    expect(ps.map((p) => p.score)).toEqual([1, 0]);
  });
});

describe('scoring', () => {
  it('majority handles ties', () => {
    expect(majority({ a: 'yes', b: 'no' })).toBeNull();
    expect(majority({ a: 'yes', b: 'no', c: 'yes' })).toBe('yes');
  });
  it('majority prediction', () => {
    expect(scoreMajorityPrediction({ a: 'yes', b: 'yes', c: 'no' }, { a: 'yes', b: 'no', c: 'yes' })).toEqual({ a: 1, b: 0, c: 1 });
  });
  it('creative ignores self votes', () => {
    expect(scoreCreative({ x: 'a', y: 'b' }, { a: 'x', b: 'x', c: 'y' })).toEqual({ a: 1, b: 1 });
  });
  it('hot seat rewards fooling the judges', () => {
    expect(scoreHotSeat('s', false, { a: 'truth', b: 'truth', c: 'lie' })).toEqual({ s: 2, a: 0, b: 0, c: 1 });
    expect(scoreHotSeat('s', true, { a: 'truth', b: 'lie' })).toEqual({ s: 0, a: 1, b: 0 });
  });
  it('fmk assignment stays a permutation', () => {
    let p = assign({}, 0, 'f');
    p = assign(p, 1, 'f');
    expect(p).toEqual({ 1: 'f' });
    p = assign(assign(p, 0, 'm'), 0, 'k');
    expect(p).toEqual({ 1: 'f', 0: 'k' });
  });
});

describe('editor overrides', () => {
  it('approving a round with a known answer makes it playable; disabling removes it', () => {
    const low = rounds.find((r) => !r.usable && r.prompt && gameById.get(r.gameId)!.engine === 'realfake' && openSecret(r).a != null) as Round | undefined;
    const ok = rounds.find((r) => r.usable)!;
    const res = resolveDeck({ edits: { ...(low ? { [low.id]: { approve: true } } : {}), [ok.id]: { disabled: true } }, custom: [], rules: {} });
    if (low) expect(res.rounds.find((r) => r.id === low.id)!.usable).toBe(true);
    expect(res.rounds.find((r) => r.id === ok.id)!.usable).toBe(false);
  });
  it('custom rounds need an answer for real/fake games', () => {
    const res = resolveDeck({
      edits: {},
      custom: [
        { id: 'c1', gameId: 'israel-bidur', prompt: 'כותרת לדוגמה', answer: null, choices: null, mature: false },
        { id: 'c2', gameId: 'israel-bidur', prompt: 'כותרת לדוגמה', answer: 'fake', choices: null, mature: false }
      ],
      rules: {}
    });
    expect(res.rounds.find((r) => r.id === 'c1')!.usable).toBe(false);
    expect(res.rounds.find((r) => r.id === 'c2')!.usable).toBe(true);
  });
});
