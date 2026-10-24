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
  /** Most slips a team may get in one turn (null = until time runs out). */
  perTurn?: number | null;
  /** Slips guessed so far this turn. */
  turnGuessed?: number;
  /** Set when the last turn ended by hitting the per-turn limit. */
  limitHit?: boolean;
}

export function createNotes(slips: string[], teamNames: string[], seconds: number, skipPenalty: boolean, seed: string, perTurn: number | null = null): NotesState {
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
    finished: clean.length === 0,
    perTurn,
    turnGuessed: 0
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
  const turnGuessed = (s.turnGuessed ?? 0) + 1;
  if (!remaining.length) return endRound({ ...s, teams, remaining });
  // Reached the per-turn limit: the turn passes even if time is left.
  if (s.perTurn && turnGuessed >= s.perTurn) return { ...passTurn({ ...s, teams, remaining }), limitHit: true };
  return { ...s, teams, remaining, current: remaining[0], turnGuessed };
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
  return { ...s, round, remaining, current: null, turnTeam: (s.turnTeam + 1) % s.teams.length, turnCount: s.turnCount + 1, turnGuessed: 0, limitHit: false };
}

function passTurn(s: NotesState): NotesState {
  const remaining = shuffle(s.remaining, `${s.seed}:t${s.turnCount}`);
  return { ...s, remaining, current: null, turnTeam: (s.turnTeam + 1) % s.teams.length, turnCount: s.turnCount + 1, turnGuessed: 0, limitHit: false };
}

/** Timer ran out: pass to the next team, slip order reshuffled so the same hard slip isn't always first. */
export function timeUp(s: NotesState): NotesState {
  if (s.finished) return s;
  return passTurn(s);
}

export function startTurn(s: NotesState): NotesState {
  return { ...s, current: s.remaining[0] ?? null, turnGuessed: 0, limitHit: false };
}

export function totals(s: NotesState): number[] {
  return s.teams.map((t) => t.scores[0] + t.scores[1] + t.scores[2]);
}

/** Ready-made slips, all from the world of the roof: the panel, the segments, the show itself. */
export interface SlipPack {
  id: 'panel' | 'segments' | 'roof';
  title: string;
  icon: string;
  slips: string[];
}

export const ROOF_SLIPS = [
  'בגג של יצחקי', 'הגג', 'מיקרופון', 'אוזניות', 'פודקאסט', 'פרק חדש', 'הקלטה', 'מצלמה', 'פאנל', 'פאנליסט',
  'אורח בפאנל', 'מנחה', 'סטנדאפ', 'סטנדאפיסט', 'ערב פתוח', 'במה', 'קהל', 'מחיאות כפיים', 'צחוק מתגלגל', 'בדיחה פנימית',
  'פאנץ\'', 'מערכון', 'שאלה של מאזין', 'נקודה לקבוצה', 'תשובה לא נכונה', 'ניחוש פרוע', 'מישהו מנצח', 'תיקו', 'לוח תוצאות', 'פינה חדשה',
  'ספוילר', 'נוף מהגג', 'שקיעה על הגג', 'מעקה', 'תאורה', 'כיסא בר', 'שולחן הפאנל', 'שעון שמגיע לאפס', 'הפסקה קצרה', 'סוף הפרק'
];

export function slipPacks(panel: string[], segments: string[]): SlipPack[] {
  return [
    { id: 'panel', title: 'הפאנל', icon: '🎤', slips: panel },
    { id: 'segments', title: 'הפינות', icon: '🎲', slips: segments },
    { id: 'roof', title: 'עולם הגג', icon: '🌃', slips: ROOF_SLIPS }
  ];
}
