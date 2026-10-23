import type { Participant } from './types';

export type Votes = Record<string, string>;

export function tally(votes: Votes): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of Object.values(votes)) out[v] = (out[v] ?? 0) + 1;
  return out;
}

/** The single most-voted option, or null on a tie / no votes. */
export function majority(votes: Votes): string | null {
  const t = Object.entries(tally(votes)).sort((a, b) => b[1] - a[1]);
  if (!t.length || (t[1] && t[1][1] === t[0][1])) return null;
  return t[0][0];
}

/** Real/fake: one point per correct guess. */
export function scoreBinary(votes: Votes, answer: string): Record<string, number> {
  const d: Record<string, number> = {};
  for (const [pid, v] of Object.entries(votes)) d[pid] = v === answer ? 1 : 0;
  return d;
}

/** Dilemmas have no right answer; optional point for predicting the majority. */
export function scoreMajorityPrediction(votes: Votes, predictions: Votes): Record<string, number> {
  const m = majority(votes);
  const d: Record<string, number> = {};
  for (const [pid, p] of Object.entries(predictions)) d[pid] = m && p === m ? 1 : 0;
  return d;
}

/** Creative round: each vote is worth a point to the author. Self-votes are ignored. */
export function scoreCreative(authors: Record<string, string>, votes: Votes): Record<string, number> {
  const d: Record<string, number> = {};
  for (const [voter, answerId] of Object.entries(votes)) {
    const author = authors[answerId];
    if (!author || author === voter) continue;
    d[author] = (d[author] ?? 0) + 1;
  }
  return d;
}

/**
 * Hot seat: the seated player secretly records the truth, then answers out loud.
 * Each judge who correctly calls truth/lie gets a point; if most judges were fooled the seated player gets 2.
 */
export function scoreHotSeat(seatId: string, toldTruth: boolean, judgments: Votes): Record<string, number> {
  const d: Record<string, number> = { [seatId]: 0 };
  let fooled = 0;
  const entries = Object.entries(judgments).filter(([pid]) => pid !== seatId);
  for (const [pid, j] of entries) {
    const right = (j === 'truth') === toldTruth;
    d[pid] = right ? 1 : 0;
    if (!right) fooled++;
  }
  if (entries.length && fooled > entries.length / 2) d[seatId] = 2;
  return d;
}

export function applyDeltas(ps: Participant[], deltas: Record<string, number>): Participant[] {
  return ps.map((p) => ({ ...p, score: p.score + (deltas[p.id] ?? 0) }));
}

export function standings(ps: Participant[]): { leaders: Participant[]; ranked: Participant[] } {
  const ranked = ps.slice().sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  return { leaders: ranked.filter((p) => p.score === top), ranked };
}

/** "הרוב קובע": a point for everyone who voted with the majority (no points on a tie). */
export function scoreMajority(votes: Votes): Record<string, number> {
  const m = majority(votes);
  return Object.fromEntries(Object.entries(votes).map(([pid, v]) => [pid, m && v === m ? 1 : 0]));
}

/** "הכבשה השחורה": a point for the minority (needs 3+ voters and a clear minority). */
export function scoreMinority(votes: Votes): Record<string, number> {
  const m = majority(votes);
  const n = Object.keys(votes).length;
  return Object.fromEntries(Object.entries(votes).map(([pid, v]) => [pid, n >= 3 && m && v !== m ? 1 : 0]));
}

export function minorityVoters(votes: Votes): string[] {
  const m = majority(votes);
  return m ? Object.entries(votes).filter(([, v]) => v !== m).map(([pid]) => pid) : [];
}
