import { describe, expect, it } from 'vitest';
import { ERAS, flap, gapAt, LIVES, newGame, nextWall, proceed, step, monthLabel, yearOf, type TMState } from '../src/lib/timeMachine';

/** Flaps whenever it is below the middle of the next gap and not already rising fast. */
function autopilot(s: TMState): TMState {
  const w = nextWall(s);
  const target = w ? gapAt(w, s.t, ERAS[s.era]) : 0.5;
  return s.y > target + 0.02 && s.vy > -0.15 ? flap(s) : s;
}

function run(seed: string, pilot: (s: TMState) => TMState, maxSeconds = 600) {
  let s = flap(newGame(seed));
  const eras: number[] = [];
  for (let t = 0; t < maxSeconds && s.status !== 'done'; t += 1 / 60) {
    s = step(pilot(s), 1 / 60);
    if (s.status === 'eraClear') {
      eras.push(s.era);
      s = flap(proceed(s));
    } else if (s.status === 'over') s = flap(proceed(s));
  }
  return { s, eras };
}

describe('מכונת הזמן', () => {
  it('spans 2026 → 2028 in three eras', () => {
    expect(Math.floor(ERAS[0].from / 12)).toBe(2026);
    expect(Math.floor(ERAS.at(-1)!.to / 12)).toBe(2028);
    expect(monthLabel(ERAS[0].from)).toBe('אוקטובר 2026');
    for (let i = 1; i < ERAS.length; i++) expect(ERAS[i].from).toBe(ERAS[i - 1].to);
    expect(yearOf(newGame('x'))).toBe(2026);
  });

  it('is beatable: a careful pilot reaches 2028', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const { s, eras } = run(seed, autopilot);
      expect(s.status, seed).toBe('done');
      expect(eras).toEqual([0, 1]);
      expect(yearOf(s)).toBe(2028);
    }
  });

  it('not touching the screen crashes, costs lives and ends the attempt', () => {
    let s = flap(newGame('idle'));
    for (let i = 0; i < 60 * 30 && s.status === 'play'; i++) s = step(s, 1 / 60);
    expect(s.status).toBe('over');
    expect(s.crashes).toBe(LIVES);
    // retrying restarts the same era with full lives
    const r = proceed(s);
    expect(r.era).toBe(0);
    expect(r.lives).toBe(LIVES);
    expect(r.passed).toBe(0);
  });

  it('a crash gives a moment of invulnerability instead of instant death', () => {
    let s = flap(newGame('inv'));
    while (s.status === 'play' && s.crashes === 0) s = step(s, 1 / 60);
    expect(s.lives).toBe(LIVES - 1);
    expect(s.invuln).toBeGreaterThan(1);
  });
});
