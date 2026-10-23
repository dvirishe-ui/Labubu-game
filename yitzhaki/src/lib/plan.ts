import { openSecret, playablePool, drawRounds } from './deck';
import { shuffle } from './rng';
import type { GameMeta, Mechanic, Round, SessionConfig, Step, StepEngine } from './types';

export interface MechanicDef {
  id: Mechanic;
  title: string;
  emoji: string;
  blurb: string;
  minPlayers: number;
  teamsOnly?: boolean;
}

export const MECHANICS: MechanicDef[] = [
  { id: 'impostor', title: 'המתחזה של יצחקי', emoji: '🕵️', blurb: 'כולם מקבלים אותו פריט מהפודקאסט — חוץ מאחד. רמזים, הצבעה, תופסים את המתחזה.', minPlayers: 3 },
  { id: 'whowrote', title: 'מי כתב את זה?', emoji: '✍️', blurb: 'כל אחד כותב זיוף משכנע. מנחשים מה באמת הופיע בפודקאסט.', minPlayers: 2 },
  { id: 'bluff', title: 'הבלוף הגדול', emoji: '🃏', blurb: 'שחקן אחד יודע את התשובה — ומנסה לשכנע. אמת או בלוף?', minPlayers: 2 },
  { id: 'knows', title: 'מי הכי מכיר את החבורה?', emoji: '🔮', blurb: 'דילמה מהפודקאסט: מנחשים מה חבר אחד יבחר.', minPlayers: 3 },
  { id: 'battle', title: 'הקרב על הגג', emoji: '⚔️', blurb: 'שתי קבוצות, שאלות אמיתי/מומצא, וזכות גניבה כשהיריבה טועה.', minPlayers: 2, teamsOnly: true },
  { id: 'invent', title: 'מה יצחקי היה ממציא?', emoji: '💡', blurb: 'ממציאים כותרות, שירים ופרסומות בסגנון הפינות. הכי מצחיק מנצח.', minPlayers: 2 },
  { id: 'majority', title: 'הרוב קובע', emoji: '👥', blurb: 'דילמות מהפודקאסט — נקודה למי שבחר כמו הרוב.', minPlayers: 3 },
  { id: 'minority', title: 'הכבשה השחורה', emoji: '🐑', blurb: 'דילמות מהפודקאסט — נקודה למי שבחר כמו המיעוט.', minPlayers: 3 }
];

/** Prompts for "מה יצחקי היה ממציא?". Player-written answers; nothing here is attributed to anyone. */
export const INVENT_PROMPTS = [
  { gameId: 'israel-bidur', text: 'כתבו כותרת מומצאת לאתר רכילות על סלב ישראלי — הכי מיותרת שיש.' },
  { gameId: 'mizrahi-song', text: 'כתבו שורה לשיר מזרחית מומצא על משהו יומיומי לגמרי.' },
  { gameId: 'new-age-workshop', text: 'המציאו סדנת ניו־אייג׳: שם הסדנה ומשפט שיווקי אחד.' },
  { gameId: 'tiktok-ads', text: 'המציאו פרסומת טיקטוק לעסק שכונתי. משפט אחד שמוכר.' },
  { gameId: 'student-film', text: 'כתבו תקציר לסרט סטודנטים מומצא במשפט אחד.' },
  { gameId: 'fake-podcast', text: 'המציאו פודקאסט שלא קיים: שם, מנחים, ונושא.' },
  { gameId: 'mizrahi-poster', text: 'כתבו פוסטר להופעה במועדון: מי מופיע ומה בתפריט.' },
  { gameId: 'zimmer', text: 'המציאו צימר: שם ומשפט פרסום.' },
  { gameId: 'pickup-tips', text: 'כתבו "טיפ" של אמן פיתוי — הכי גרוע שאפשר.' },
  { gameId: 'crisis-ads', text: 'בחרו מותג ומשבר דמיוני, וכתבו סלוגן "מחבק".' }
];

export const MECHANIC_ENGINE: Record<Exclude<Mechanic, 'majority' | 'minority'>, StepEngine> = {
  impostor: 'impostor',
  whowrote: 'whowrote',
  bluff: 'bluff',
  knows: 'knows',
  battle: 'battle',
  invent: 'invent'
};

const SHORT = 150;

export function mechanicAvailable(m: MechanicDef, mode: SessionConfig['mode'], count: number): boolean {
  if (m.teamsOnly) return mode === 'teams' && count === 2;
  return count >= m.minPlayers;
}

/** One step for a mechanic, avoiding rounds in `used`. */
export function stepFor(m: Mechanic, games: GameMeta[], rounds: Round[], mature: boolean, used: Set<string>, seed: string, inventIndex: number): Step | null {
  const ids = (engine: string) => games.filter((g) => g.engine === engine).map((g) => g.id);
  const fresh = (pool: Round[]) => shuffle(pool.filter((r) => !used.has(r.id)), seed);
  if (m === 'invent') {
    const i = inventIndex % INVENT_PROMPTS.length;
    return { engine: 'invent', gameId: INVENT_PROMPTS[i].gameId, roundIds: [], promptIndex: i };
  }
  if (m === 'majority' || m === 'minority' || m === 'knows') {
    const r = fresh(playablePool(rounds, ids('dilemma'), mature))[0];
    if (!r) return null;
    return m === 'knows' ? { engine: 'knows', gameId: r.gameId, roundIds: [r.id] } : { engine: 'dilemma', gameId: r.gameId, roundIds: [r.id], mode: m };
  }
  const guess = playablePool(rounds, ids('realfake'), mature).filter((r) => openSecret(r).a);
  if (m === 'impostor') {
    const short = fresh(guess.filter((r) => r.prompt.length <= SHORT));
    for (const r of short) {
      const twin = short.find((x) => x.id !== r.id && x.gameId === r.gameId);
      if (twin) return { engine: 'impostor', gameId: r.gameId, roundIds: [r.id, twin.id] };
    }
    return null;
  }
  const pool = fresh(m === 'whowrote' ? guess.filter((r) => r.prompt.length <= SHORT) : guess);
  const r = pool[0];
  return r ? { engine: MECHANIC_ENGINE[m], gameId: r.gameId, roundIds: [r.id] } : null;
}

/** Party-night rotation: mixes guessing, decisions, bluffing, impostor and creative rounds. */
const NIGHT_ORDER: (Mechanic | 'realfake' | 'fmk' | 'hotseat')[] = ['realfake', 'majority', 'bluff', 'impostor', 'whowrote', 'realfake', 'knows', 'invent', 'minority', 'realfake', 'fmk', 'hotseat'];

export function buildSteps(config: SessionConfig, games: GameMeta[], rounds: Round[], seen: ReadonlySet<string>): Step[] {
  const gameById = new Map(games.map((g) => [g.id, g]));
  const n = config.participants.length;
  const steps: Step[] = [];
  const used = new Set<string>();
  const take = (s: Step | null) => {
    if (!s) return false;
    s.roundIds.forEach((id) => used.add(id));
    steps.push(s);
    return true;
  };
  const singles = (ids: string[], count: number | 'all', seed: string) =>
    drawRounds(playablePool(rounds, ids, config.mature).filter((r) => !used.has(r.id)), count, seen, seed).picked.map(
      (r): Step => ({ engine: gameById.get(r.gameId)!.engine, gameId: r.gameId, roundIds: [r.id], mode: config.decisionMode })
    );

  if (config.minutes) {
    // Enough steps for the longest night; the session stops when time is up.
    const total = Math.max(12, config.minutes * 2);
    const guessIds = games.filter((g) => g.engine === 'realfake').map((g) => g.id);
    let invent = 0;
    for (let i = 0; steps.length < total && i < total * 3; i++) {
      const kind = NIGHT_ORDER[i % NIGHT_ORDER.length];
      const seed = `${config.seed}:${i}`;
      if (kind === 'realfake') take(singles(guessIds, 1, seed)[0] ?? null);
      else if (kind === 'fmk' || kind === 'hotseat') {
        const ids = games.filter((g) => g.engine === kind).map((g) => g.id);
        if (kind === 'hotseat' && n < 3) continue;
        take(singles(ids, 1, seed)[0] ?? null);
      } else {
        const def = MECHANICS.find((m) => m.id === kind)!;
        if (!mechanicAvailable(def, config.mode, n)) continue;
        take(stepFor(kind, games, rounds, config.mature, used, seed, invent));
        if (kind === 'invent') invent++;
      }
    }
    return steps;
  }

  const count = config.length === 'marathon' ? 'all' : config.length;
  const mechanics = (config.mechanics ?? []).filter((m) => mechanicAvailable(MECHANICS.find((x) => x.id === m)!, config.mode, n));
  if (!mechanics.length) return singles(config.gameIds, count, config.seed);
  const target = count === 'all' ? 30 : count;
  let invent = 0;
  for (let i = 0; steps.length < target && i < target * 4; i++) {
    const m = mechanics[i % mechanics.length];
    if (take(stepFor(m, games, rounds, config.mature, used, `${config.seed}:${i}`, invent)) && m === 'invent') invent++;
  }
  return steps;
}
