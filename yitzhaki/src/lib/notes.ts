import { shuffle } from './rng';

// "פתקים על הגג" — an original Time's Up–style bonus game (not a podcast segment).
export const NOTE_ROUNDS = [
  { title: 'סיבוב 1 — תיאור חופשי', rule: 'מתארים במילים כמה שרוצים. אסור להגיד את המילה שבפתק או חלק ממנה.' },
  { title: 'סיבוב 2 — מילה אחת', rule: 'רק מילה אחת לכל פתק. אפשר לחזור עליה, אבל לא להוסיף.' },
  { title: 'סיבוב 3 — פנטומימה', rule: 'בלי מילים ובלי קולות. רק תנועות.' }
] as const;

export interface NotesTeam {
  name: string;
  scores: [number, number, number];
}

export interface NotesState {
  slips: string[];
  teams: NotesTeam[];
  round: 0 | 1 | 2;
  turnTeam: number;
  remaining: string[];
  current: string | null;
  skipPenalty: boolean;
  seconds: number;
  seed: string;
  turnCount: number;
  finished: boolean;
}

export function createNotes(slips: string[], teamNames: string[], seconds: number, skipPenalty: boolean, seed: string): NotesState {
  const clean = [...new Set(slips.map((s) => s.trim()).filter(Boolean))];
  const remaining = shuffle(clean, seed + ':0');
  return {
    slips: clean,
    teams: teamNames.map((name) => ({ name, scores: [0, 0, 0] })),
    round: 0,
    turnTeam: 0,
    remaining,
    current: remaining[0] ?? null,
    skipPenalty,
    seconds,
    seed,
    turnCount: 0,
    finished: clean.length === 0
  };
}

function withScore(s: NotesState, delta: number): NotesTeam[] {
  return s.teams.map((t, i) => {
    if (i !== s.turnTeam) return t;
    const scores = [...t.scores] as [number, number, number];
    scores[s.round] += delta;
    return { ...t, scores };
  });
}

export function guessed(s: NotesState): NotesState {
  if (!s.current || s.finished) return s;
  const remaining = s.remaining.slice(1);
  const teams = withScore(s, 1);
  if (remaining.length) return { ...s, teams, remaining, current: remaining[0] };
  return endRound({ ...s, teams, remaining });
}

/** Skipped slip goes to the back of the pile; optional -1. */
export function skipped(s: NotesState): NotesState {
  if (!s.current || s.finished) return s;
  const teams = s.skipPenalty ? withScore(s, -1) : s.teams;
  const remaining = s.remaining.length > 1 ? [...s.remaining.slice(1), s.remaining[0]] : s.remaining;
  return { ...s, teams, remaining, current: remaining[0] };
}

function endRound(s: NotesState): NotesState {
  if (s.round === 2) return { ...s, current: null, finished: true };
  const round = (s.round + 1) as 0 | 1 | 2;
  const remaining = shuffle(s.slips, `${s.seed}:${round}`);
  // Emptying the pile ends the turn; the next round opens with the next team.
  return { ...s, round, remaining, current: null, turnTeam: (s.turnTeam + 1) % s.teams.length, turnCount: s.turnCount + 1 };
}

/** Timer ran out: pass to the next team, slip order reshuffled so the same hard slip isn't always first. */
export function timeUp(s: NotesState): NotesState {
  if (s.finished) return s;
  const remaining = shuffle(s.remaining, `${s.seed}:t${s.turnCount}`);
  return { ...s, remaining, current: null, turnTeam: (s.turnTeam + 1) % s.teams.length, turnCount: s.turnCount + 1 };
}

export function startTurn(s: NotesState): NotesState {
  return { ...s, current: s.remaining[0] ?? null };
}

export function totals(s: NotesState): number[] {
  return s.teams.map((t) => t.scores[0] + t.scores[1] + t.scores[2]);
}

export const SAMPLE_SLIPS = [
  'מקרר', 'חתונה', 'גלגל ענק', 'מכונת כביסה', 'ים המלח', 'פיתה עם חומוס', 'מונית שירות', 'יום הולדת', 'מסיבת רווקים', 'שעון מעורר',
  'פקק תנועה', 'משקפי שמש', 'בית קפה', 'גשם ראשון', 'מטקות', 'קולנוע', 'מזגן', 'דוד שמש', 'שוק הכרמל', 'ארטיק',
  'אוטובוס לילה', 'שמלת כלה', 'קריוקי', 'מנגל', 'כלב שכן', 'ליצן', 'אבטיח', 'בריכה', 'מעלית תקועה', 'סבתא',
  'טלפון ציבורי', 'טיסה לאילת', 'חדר כושר', 'שלט רחוק', 'מסטיק', 'פיצה משפחתית', 'ראש השנה', 'פנס', 'גיטרה', 'כרית'
];
