import type { CustomRound } from './deck';
import type { GameMeta, Round } from './types';

export function normalize(text: string): string[] {
  return text
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function similarity(a: string, b: string): number {
  const A = new Set(normalize(a));
  const B = new Set(normalize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function findDuplicates(rounds: Pick<Round, 'id' | 'gameId' | 'prompt'>[], threshold = 0.75): [string, string, number][] {
  const out: [string, string, number][] = [];
  const list = rounds.filter((r) => r.prompt?.trim());
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const s = similarity(list[i].prompt, list[j].prompt);
      if (s >= threshold) out.push([list[i].id, list[j].id, s]);
    }
  return out.sort((a, b) => b[2] - a[2]);
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

interface ImportRow {
  game_id?: string;
  gameId?: string;
  prompt?: string;
  display_prompt?: string;
  answer?: string | null;
  correct_answer?: string | null;
  options?: string[];
  mature?: boolean | string;
}

/** Accepts JSON (array, {rounds:[]}, or this app's questions.json) or CSV with a header row. */
export function importRounds(text: string, games: Pick<GameMeta, 'id' | 'engine' | 'options'>[], idPrefix = 'custom'): { rounds: CustomRound[]; errors: string[] } {
  const errors: string[] = [];
  let rows: ImportRow[] = [];
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      rows = Array.isArray(data) ? data : data.rounds ?? [];
    } catch (e) {
      return { rounds: [], errors: ['JSON לא תקין: ' + (e as Error).message] };
    }
  } else {
    const [head, ...body] = parseCsv(trimmed);
    if (!head) return { rounds: [], errors: ['קובץ ריק'] };
    const cols = head.map((h) => h.trim());
    rows = body.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]?.trim() ?? ''])) as ImportRow);
  }
  const rounds: CustomRound[] = [];
  const byId = new Map(games.map((g) => [g.id, g]));
  rows.forEach((r, i) => {
    const gameId = r.game_id ?? r.gameId ?? '';
    const prompt = (r.prompt ?? r.display_prompt ?? '').trim();
    const game = byId.get(gameId);
    if (!game) return errors.push(`שורה ${i + 1}: משחק לא מוכר "${gameId}"`);
    if (!prompt) return errors.push(`שורה ${i + 1}: אין טקסט שאלה`);
    const answer = (r.answer ?? r.correct_answer ?? '') || null;
    if (answer && game.engine === 'realfake' && !(answer in game.options)) return errors.push(`שורה ${i + 1}: תשובה "${answer}" לא קיימת במשחק`);
    // Option lists that are just the game's own keys (e.g. exported questions.json) aren't custom choices.
    const opts = Array.isArray(r.options) ? r.options : [];
    const custom = opts.length && !opts.every((o) => o in game.options);
    const choices = (game.engine === 'fmk' && opts.length === 3) || (game.engine === 'dilemma' && custom && opts.length === 2) ? opts : null;
    rounds.push({
      id: `${idPrefix}-${Date.now().toString(36)}-${i}`,
      gameId,
      prompt,
      answer,
      choices,
      mature: r.mature === true || r.mature === 'true' || r.mature === '1'
    });
  });
  return { rounds, errors };
}
