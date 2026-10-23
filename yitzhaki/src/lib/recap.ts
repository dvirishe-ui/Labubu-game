import type { Session } from './session';

export interface Recap {
  winners: string[];
  mostCorrect: { id: string; n: number } | null;
  bestBluffer: { id: string; n: number } | null;
  mostUnpopular: { id: string; n: number } | null;
  comeback: { id: string; from: number } | null;
}

function top(counts: Record<string, number>): { id: string; n: number } | null {
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? { id: best[0], n: best[1] } : null;
}

/** End-of-session awards computed from the round log (nothing invented). */
export function buildRecap(s: Session): Recap {
  const correct: Record<string, number> = {};
  const fooled: Record<string, number> = {};
  const unpopular: Record<string, number> = {};
  for (const l of s.log) {
    for (const id of l.meta.correct ?? []) correct[id] = (correct[id] ?? 0) + 1;
    for (const [id, n] of Object.entries(l.meta.fooled ?? {})) fooled[id] = (fooled[id] ?? 0) + n;
    for (const id of l.meta.unpopular ?? []) unpopular[id] = (unpopular[id] ?? 0) + 1;
  }
  const finalTop = Math.max(...s.participants.map((p) => p.score));
  const winners = s.participants.filter((p) => p.score === finalTop && finalTop > 0).map((p) => p.id);
  // Best comeback: a winner (or top finisher) who was furthest behind the leader at some point.
  let comeback: Recap['comeback'] = null;
  for (const id of winners) {
    let worst = 0;
    for (const l of s.log) {
      const lead = Math.max(...Object.values(l.scores));
      worst = Math.max(worst, lead - (l.scores[id] ?? 0));
    }
    if (worst >= 2 && (!comeback || worst > comeback.from)) comeback = { id, from: worst };
  }
  return { winners, mostCorrect: top(correct), bestBluffer: top(fooled), mostUnpopular: top(unpopular), comeback };
}
