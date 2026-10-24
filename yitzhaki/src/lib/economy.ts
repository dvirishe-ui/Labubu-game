import { CHARACTERS, CROWN_SKIN, charById, isSecret, SECRET_CHARACTER, SECRET_SKIN, skinById } from './characters';
import { levelOf, type Profile } from './profile';
import { dayKey, weekKey } from './time';

/** Coin amounts. Tuned so an engaged player earns roughly 300–500 a day. */
export const REWARDS = {
  gameComplete: 40,
  gameWin: 60,
  perfectGame: 100,
  daily: 100,
  dailyPerfect: 100,
  weekly: 500,
  soloPerCorrect: 3,
  soloLevel: 30,
  soloBoss: 50,
  decisionPredict: 5,
  duel: 40,
  duelWin: 60,
  partyNight: 80,
  levelUp: 50
};

/** Daily ceilings so replaying the same short game can't farm coins. */
export const CAPS = { gameRewardsPerDay: 8, soloCoinsPerDay: 250, decisionCoinsPerDay: 60 };
export const MIN_GAME = { answered: 5, durationMs: 60_000 };

export const WEEKLY_GOALS = [
  { id: 'correct', label: 'תשובות נכונות', target: 60 },
  { id: 'games', label: 'משחקים שהסתיימו', target: 5 },
  { id: 'dailies', label: 'אתגרים יומיים', target: 3 }
] as const;

export type RewardEvent =
  | { type: 'coins'; amount: number; label: string }
  | { type: 'achievement'; id: string; title: string; amount: number }
  | { type: 'level'; level: number; amount: number }
  | { type: 'capped'; label: string };

export interface Result {
  profile: Profile;
  events: RewardEvent[];
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  reward: number;
  /** Hidden achievements show as "???" until unlocked. */
  secret?: boolean;
  test: (p: Profile) => boolean;
}

/** Roster characters owned (the secret character doesn't count toward the 8). */
export const rosterOwned = (p: Profile) => p.owned.filter((id) => !isSecret(id));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-game', title: 'הדייר החדש', desc: 'סיימת משחק ראשון', reward: 100, test: (p) => p.stats.games >= 1 },
  { id: 'correct-100', title: 'מלך הניחושים', desc: '100 תשובות נכונות', reward: 300, test: (p) => p.stats.correct >= 100 },
  { id: 'correct-500', title: 'אנציקלופדיה של הגג', desc: '500 תשובות נכונות', reward: 500, test: (p) => p.stats.correct >= 500 },
  { id: 'streak-10', title: 'בלתי מנוצח', desc: '10 תשובות נכונות ברצף', reward: 300, test: (p) => p.stats.bestStreak >= 10 },
  { id: 'first-daily', title: 'בוקר טוב גג', desc: 'אתגר יומי ראשון', reward: 100, test: (p) => p.stats.dailies >= 1 },
  { id: 'daily-perfect', title: '10 מתוך 10', desc: 'אתגר יומי מושלם', reward: 300, test: (p) => p.stats.dailyPerfect >= 1 },
  { id: 'solo-5', title: 'עולה במסלול', desc: 'הגעת לשלב 5 במסלול של יצחקי', reward: 200, test: (p) => p.stats.soloBestLevel >= 5 },
  { id: 'boss', title: 'מפיל בוסים', desc: 'ניצחת סיבוב בוס', reward: 200, test: (p) => p.stats.bossesBeaten >= 1 },
  { id: 'crowd', title: 'נגד כולם', desc: 'צדקת בשאלה שרוב השחקנים טעו בה', reward: 200, test: (p) => p.stats.crowdBeats >= 1 },
  { id: 'duel', title: 'תנצח אותי', desc: 'ניצחת חבר באתגר', reward: 200, test: (p) => p.stats.duelsWon >= 1 },
  { id: 'bluff', title: 'מלך הבלוף', desc: 'עבדת על 10 שחקנים בבלוף', reward: 300, test: (p) => p.stats.bluffWins >= 10 },
  { id: 'party-night', title: 'ערב על הגג', desc: 'סיימת ערב על הגג', reward: 200, test: (p) => p.stats.partyNights >= 1 },
  { id: 'first-skin', title: 'סטייל', desc: 'קנית סקין ראשון', reward: 100, test: (p) => p.skins.some((s) => !s.endsWith(':classic')) },
  { id: 'collector-3', title: 'אספן מתחיל', desc: '3 דמויות באוסף', reward: 300, test: (p) => rosterOwned(p).length >= 3 },
  { id: 'full-panel', title: 'הפאנל המלא', desc: 'כל 8 הדמויות', reward: 500, test: (p) => rosterOwned(p).length >= CHARACTERS.length },
  { id: 'roof-legend', title: 'אגדת הגג', desc: 'הסקין "מלך הגג" של אסף', reward: 500, test: (p) => p.skins.includes(CROWN_SKIN.id) },
  { id: 'time-travel', title: 'נוסע בזמן', desc: 'פגשת את נועם אונגר מהעתיד', reward: 500, secret: true, test: (p) => p.owned.includes(SECRET_CHARACTER.id) }
];

function clone(p: Profile): Profile {
  return JSON.parse(JSON.stringify(p));
}

/** Roll the per-day and per-week counters over and prune old reward keys. */
export function rollover(p: Profile, now = Date.now()): Profile {
  const d = dayKey(now);
  const w = weekKey(now);
  if (p.day.key === d && p.week.key === w) return p;
  const q = clone(p);
  if (q.day.key !== d) q.day = { key: d, gameRewards: 0, soloCoins: 0, decisionCoins: 0 };
  if (q.week.key !== w) q.week = { key: w, correct: 0, games: 0, dailies: 0 };
  const cutoff = now - 60 * 86400000;
  for (const [k, t] of Object.entries(q.claimed)) if (/^(game|solo|dec):/.test(k) && t < cutoff) delete q.claimed[k];
  return q;
}

function pay(q: Profile, events: RewardEvent[], key: string, amount: number, label: string): boolean {
  if (amount <= 0 || q.claimed[key]) return false;
  q.claimed[key] = Date.now();
  q.coins += amount;
  q.coinsEarned += amount;
  events.push({ type: 'coins', amount, label });
  return true;
}

/** Achievements, level-ups and the weekly challenge, after any change. */
function settle(q: Profile, events: RewardEvent[], xpGain = 0): Result {
  const before = levelOf(q.xp).level;
  q.xp += xpGain;
  const after = levelOf(q.xp).level;
  for (let L = before + 1; L <= after; L++) {
    if (pay(q, [], `lvl:${L}`, REWARDS.levelUp, '')) events.push({ type: 'level', level: L, amount: REWARDS.levelUp });
  }
  if (WEEKLY_GOALS.every((g) => q.week[g.id] >= g.target)) pay(q, events, `weekly:${q.week.key}`, REWARDS.weekly, 'האתגר השבועי הושלם');
  for (const a of ACHIEVEMENTS) {
    if (q.achievements[a.id] || !a.test(q)) continue;
    q.achievements[a.id] = Date.now();
    if (pay(q, [], `ach:${a.id}`, a.reward, '')) events.push({ type: 'achievement', id: a.id, title: a.title, amount: a.reward });
  }
  q.rev += 1;
  return { profile: q, events };
}

/** One answered question with a verifiable answer (guessing games). */
export function recordAnswer(p: Profile, qid: string | null, choice: string | null, correct: boolean, now = Date.now()): Result {
  const q = rollover(clone(p), now);
  q.stats.answered += 1;
  if (correct) {
    q.stats.correct += 1;
    q.week.correct += 1;
    q.stats.streak += 1;
    q.stats.bestStreak = Math.max(q.stats.bestStreak, q.stats.streak);
  } else q.stats.streak = 0;
  if (qid && choice && !(qid in q.answered)) q.answered[qid] = choice;
  return settle(q, [], correct ? 10 : 2);
}

export interface GameSummary {
  sessionId: string;
  answered: number;
  durationMs: number;
  won: boolean;
  perfect: boolean;
}

/** End of a normal (one-phone / teams / party) game on this device. */
export function finishGame(p: Profile, g: GameSummary, now = Date.now()): Result {
  if (p.claimed[`game:${g.sessionId}:done`]) return { profile: p, events: [] };
  const q = rollover(clone(p), now);
  const events: RewardEvent[] = [];
  q.claimed[`game:${g.sessionId}:done`] = now;
  q.stats.games += 1;
  q.week.games += 1;
  if (g.won) q.stats.wins += 1;
  const eligible = g.answered >= MIN_GAME.answered && g.durationMs >= MIN_GAME.durationMs;
  if (!eligible) events.push({ type: 'capped', label: 'משחק קצר מדי לפרס מטבעות' });
  else if (q.day.gameRewards >= CAPS.gameRewardsPerDay) events.push({ type: 'capped', label: 'הגעתם לתקרת פרסי המשחקים להיום' });
  else if (!q.claimed[`game:${g.sessionId}`]) {
    q.day.gameRewards += 1;
    pay(q, events, `game:${g.sessionId}`, REWARDS.gameComplete, 'סיימת משחק');
    if (g.won) pay(q, events, `game:${g.sessionId}:win`, REWARDS.gameWin, 'ניצחון');
    if (g.perfect) {
      q.stats.perfectGames += 1;
      pay(q, events, `game:${g.sessionId}:perfect`, REWARDS.perfectGame, 'משחק מושלם');
    }
  }
  return settle(q, events, 40 + (g.won ? 30 : 0));
}

/** Solo coins (per correct answer, level clears, bosses) share one daily ceiling. */
export function soloCoins(p: Profile, key: string, amount: number, label: string, now = Date.now()): Result {
  const q = rollover(clone(p), now);
  const events: RewardEvent[] = [];
  const room = Math.max(0, CAPS.soloCoinsPerDay - q.day.soloCoins);
  const grant = Math.min(room, amount);
  if (grant > 0 && pay(q, events, `solo:${key}`, grant, label)) q.day.soloCoins += grant;
  else if (!room && !q.claimed[`solo:${key}`]) events.push({ type: 'capped', label: 'הגעת לתקרת מטבעות המסלול להיום' });
  return settle(q, events);
}

export function decisionCoins(p: Profile, key: string, now = Date.now()): Result {
  const q = rollover(clone(p), now);
  const events: RewardEvent[] = [];
  if (q.day.decisionCoins + REWARDS.decisionPredict <= CAPS.decisionCoinsPerDay && pay(q, events, `dec:${key}`, REWARDS.decisionPredict, 'ניחשת את הרוב'))
    q.day.decisionCoins += REWARDS.decisionPredict;
  return settle(q, events, 3);
}

export function finishSoloRun(p: Profile, score: number, level: number, now = Date.now()): Result {
  const q = rollover(clone(p), now);
  q.stats.soloBest = Math.max(q.stats.soloBest, score);
  q.stats.soloBestLevel = Math.max(q.stats.soloBestLevel, level);
  q.solo = { ...q.solo, run: null };
  return settle(q, [], 30);
}

export function finishDaily(p: Profile, day: string, score: number, correct: number, total: number, now = Date.now()): Result {
  const q = rollover(clone(p), now);
  const events: RewardEvent[] = [];
  if (q.daily[day]) return { profile: p, events };
  q.daily[day] = { score, correct, at: now };
  q.stats.dailies += 1;
  q.week.dailies += 1;
  pay(q, events, `daily:${day}`, REWARDS.daily, 'אתגר יומי');
  if (correct === total) {
    q.stats.dailyPerfect += 1;
    pay(q, events, `daily:${day}:perfect`, REWARDS.dailyPerfect, 'אתגר יומי מושלם');
  }
  return settle(q, events, 80);
}

export function finishDuel(p: Profile, code: string, score: number, correct: number, now = Date.now()): Result {
  const q = rollover(clone(p), now);
  const events: RewardEvent[] = [];
  if (q.duels[code]) return { profile: p, events };
  q.duels[code] = { score, correct, at: now };
  pay(q, events, `duel:${code}`, REWARDS.duel, 'אתגר חבר');
  return settle(q, events, 40);
}

/** Paid once per duel, when this player's finished score beats the opponent's. */
export function duelWon(p: Profile, code: string): Result {
  const q = clone(p);
  const events: RewardEvent[] = [];
  if (!pay(q, events, `duelwin:${code}`, REWARDS.duelWin, 'ניצחת באתגר')) return { profile: p, events: [] };
  q.stats.duelsWon += 1;
  return settle(q, events);
}

export function finishPartyNight(p: Profile, sessionId: string, now = Date.now()): Result {
  const q = rollover(clone(p), now);
  const events: RewardEvent[] = [];
  if (pay(q, events, `night:${sessionId}`, REWARDS.partyNight, 'ערב על הגג')) q.stats.partyNights += 1;
  return settle(q, events, 60);
}

export function bumpStats(p: Profile, patch: Partial<Profile['stats']>): Result {
  const q = clone(p);
  for (const [k, v] of Object.entries(patch)) (q.stats as Record<string, number>)[k] += v as number;
  return settle(q, []);
}

// ---- shop ----

export type BuyError = 'owned' | 'coins' | 'locked' | 'unknown';

export function priceOf(itemId: string): number | null {
  const c = charById(itemId);
  if (c) return c.price;
  const s = skinById(itemId);
  return s ? s.price : null;
}

export function canBuy(p: Profile, itemId: string): BuyError | null {
  // The secret character and its skin are never for sale.
  if (isSecret(itemId) || itemId === SECRET_SKIN.id) return p.owned.includes(SECRET_CHARACTER.id) ? 'owned' : 'locked';
  const c = charById(itemId);
  if (c) return p.owned.includes(c.id) ? 'owned' : p.coins < c.price ? 'coins' : null;
  const s = skinById(itemId);
  if (!s) return 'unknown';
  if (s.tier === 'classic' || p.skins.includes(s.id)) return 'owned';
  if (!p.owned.includes(s.charId)) return 'locked';
  return p.coins < s.price ? 'coins' : null;
}

export function buy(p: Profile, itemId: string): Result & { error: BuyError | null } {
  const error = canBuy(p, itemId);
  if (error) return { profile: p, events: [], error };
  const q = clone(p);
  const price = priceOf(itemId)!;
  q.coins -= price;
  if (charById(itemId)) {
    q.owned.push(itemId);
    q.skins.push(`${itemId}:classic`);
    if (!q.equipped.char) q.equipped = { char: itemId, skin: `${itemId}:classic` };
  } else q.skins.push(itemId);
  if (q.wish === itemId) q.wish = null;
  return { ...settle(q, []), error: null };
}

/** Called by the time-machine mini-game when 2028 is reached. Idempotent. */
export function unlockSecret(p: Profile): Result {
  if (p.owned.includes(SECRET_CHARACTER.id)) return { profile: p, events: [] };
  const q = clone(p);
  q.owned.push(SECRET_CHARACTER.id);
  q.skins.push(SECRET_SKIN.id);
  return settle(q, [], 150);
}

export function equip(p: Profile, skinId: string): Profile {
  const s = skinById(skinId);
  if (!s || !p.owned.includes(s.charId) || !(s.tier === 'classic' || p.skins.includes(s.id))) return p;
  // equipping works the same for the secret character once it's unlocked
  return { ...p, equipped: { char: s.charId, skin: s.id }, rev: p.rev + 1 };
}

/** The next thing worth saving for: the player's wish, else the cheapest unowned character. */
export function nextGoal(p: Profile): { id: string; name: string; price: number } | null {
  if (p.wish && !canBuy(p, p.wish)?.match(/owned|unknown|locked/)) {
    const c = charById(p.wish);
    const s = skinById(p.wish);
    const price = priceOf(p.wish);
    if (price != null) return { id: p.wish, name: c ? c.name : `${charById(s!.charId)!.name} · ${s!.name}`, price };
  }
  const c = CHARACTERS.filter((x) => !p.owned.includes(x.id)).sort((a, b) => a.price - b.price)[0];
  return c ? { id: c.id, name: c.name, price: c.price } : null;
}
