import { describe, expect, it } from 'vitest';
import { findDuplicates, importRounds, parseCsv, similarity } from '../src/lib/admin';
import { resolveDeck, reviewFlags } from '../src/lib/deck';
import { createNotes, guessed, ROOF_SLIPS, skipped, slipPacks, startTurn, timeUp, totals } from '../src/lib/notes';

describe('פתקים על הגג', () => {
  const slips = ['א', 'ב', 'ג', 'ד', 'ה'];

  it('plays three rounds with the same slips', () => {
    let s = createNotes(slips, ['כחולים', 'אדומים'], 45, false, 'seed');
    for (let round = 0; round < 3; round++) {
      expect(s.round).toBe(round);
      s = startTurn(s);
      const seenThisRound = new Set<string>();
      while (!s.finished && s.round === round) {
        seenThisRound.add(s.current!);
        s = guessed(s);
      }
      expect(seenThisRound).toEqual(new Set(slips));
    }
    expect(s.finished).toBe(true);
    expect(totals(s).reduce((a, b) => a + b, 0)).toBe(15);
  });

  it('time up passes the turn and keeps the slips', () => {
    let s = startTurn(createNotes(slips, ['א', 'ב', 'ג'], 30, false, 'x'));
    s = guessed(s);
    s = timeUp(s);
    expect(s.turnTeam).toBe(1);
    expect(s.remaining).toHaveLength(4);
    expect(totals(s)).toEqual([1, 0, 0]);
  });

  it('skip moves the slip to the back and can cost a point', () => {
    let s = startTurn(createNotes(slips, ['א', 'ב'], 30, true, 'x'));
    const first = s.current;
    s = skipped(s);
    expect(s.remaining[s.remaining.length - 1]).toBe(first);
    expect(totals(s)).toEqual([-1, 0]);
  });

  it('dedupes and trims slips', () => {
    expect(createNotes([' א ', 'א', '', 'ב'], ['x', 'y'], 30, false, 's').slips).toEqual(['א', 'ב']);
  });
});

describe('editor tools', () => {
  const { games } = resolveDeck();

  it('parses CSV with quotes and newlines', () => {
    expect(parseCsv('a,b\n"x, y","multi\nline"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'multi\nline']
    ]);
  });

  it('imports CSV and validates game ids and answers', () => {
    const { rounds, errors } = importRounds('game_id,prompt,answer\nisrael-bidur,כותרת,fake\nnope,x,real\nisrael-bidur,כותרת,maybe\n', games);
    expect(rounds).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it("imports this app's own questions.json format", () => {
    const { rounds } = importRounds(JSON.stringify([{ game_id: 'israel-bidur', display_prompt: 'כותרת', correct_answer: 'real', options: ['real', 'fake'] }]), games);
    expect(rounds[0]).toMatchObject({ gameId: 'israel-bidur', answer: 'real', choices: null });
  });

  it('finds near-duplicate prompts', () => {
    expect(similarity('שלום, עולם!', 'שלום עולם')).toBe(1);
    const d = findDuplicates([
      { id: '1', gameId: 'g', prompt: 'החתול ישב על השטיח האדום' },
      { id: '2', gameId: 'g', prompt: 'החתול ישב על השטיח האדום!' },
      { id: '3', gameId: 'g', prompt: 'משהו אחר לגמרי' }
    ]);
    expect(d.map(([a, b]) => a + b)).toEqual(['12']);
  });
});

describe('editor review list', () => {
  const base = resolveDeck().rounds.find((r) => r.usable)!;
  it('flags rounds that need a human look', () => {
    expect(reviewFlags({ ...base, prompt: 'שאלה ארוכה מספיק וברורה לגמרי' })).toEqual([]);
    expect(reviewFlags({ ...base, prompt: 'מישהו גר ב[שם רחוב] כבר שנים' })).toContain('placeholder');
    expect(reviewFlags({ ...base, prompt: 'ואז הוא אמר שהוא…' })).toContain('cut-off');
    expect(reviewFlags({ ...base, prompt: 'קצר' })).toContain('too-short');
    expect(reviewFlags({ ...base, usable: false, prompt: 'שאלה ארוכה מספיק וברורה לגמרי' })).toEqual(['not-playable']);
    expect(reviewFlags({ ...base, sourceStatus: 'ambiguous_autocaption', prompt: 'שאלה ארוכה מספיק וברורה לגמרי' })).toContain('unclear-captions');
  });
  it('edited text and review marks flow through the deck', () => {
    const o = { custom: [], rules: {}, edits: { [base.id]: { p: 'נוסח חדש וברור לשאלה', reviewed: true } } };
    const r = resolveDeck(o as never).rounds.find((x) => x.id === base.id)!;
    expect(r.prompt).toBe('נוסח חדש וברור לשאלה');
  });
});

describe('roof slip packs', () => {
  it('builds the panel, segments and roof packs without duplicates', () => {
    const packs = slipPacks(['אסף יצחקי', 'יונתן ברק'], resolveDeck().games.map((g) => g.title));
    expect(packs.map((p) => p.id)).toEqual(['panel', 'segments', 'roof']);
    expect(packs[1].slips.length).toBe(resolveDeck().games.length);
    expect(new Set(ROOF_SLIPS).size).toBe(ROOF_SLIPS.length);
    for (const p of packs) for (const s of p.slips) expect(s.length).toBeLessThanOrEqual(40);
  });
});
