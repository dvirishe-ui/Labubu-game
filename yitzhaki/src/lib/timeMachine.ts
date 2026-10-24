import { mulberry32, hashSeed } from './rng';

/**
 * "מכונת הזמן" — the hidden mini-game that unlocks the secret character.
 * A one-button flyer: tap to thrust, pass through gaps in the "calendar walls" from today to 2028,
 * where the older Noam comes from. Era bounds are months (year * 12 + month - 1).
 * Pure simulation in a normalized world (height 1, width = aspect), stepped at a fixed rate.
 */

export interface Era {
  name: string;
  from: number;
  to: number;
  gates: number;
  speed: number;
  gap: number;
  spacing: number;
  /** Vertical sway of the gaps (0 = static). */
  sway: number;
}

const ym = (y: number, m: number) => y * 12 + m - 1;

export const ERAS: Era[] = [
  { name: 'הגג של היום', from: ym(2026, 10), to: ym(2027, 6), gates: 12, speed: 0.42, gap: 0.36, spacing: 0.66, sway: 0 },
  { name: 'שנה הבאה על הגג', from: ym(2027, 6), to: ym(2028, 1), gates: 12, speed: 0.5, gap: 0.32, spacing: 0.62, sway: 0 },
  { name: 'הגג של 2028', from: ym(2028, 1), to: ym(2028, 8), gates: 12, speed: 0.56, gap: 0.31, spacing: 0.6, sway: 0.05 }
];

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
/** "אוקטובר 2026" for a month index. */
export const monthLabel = (m: number) => `${MONTHS[m % 12]} ${Math.floor(m / 12)}`;

export const G = 1.7;
export const FLAP = -0.6;
export const PLAYER_X = 0.26;
export const R = 0.042;
export const WALL_W = 0.1;
export const LIVES = 3;
export const STEP = 1 / 120;

export interface Wall {
  x: number;
  gapY: number;
  gapH: number;
  phase: number;
  passed: boolean;
}

export interface Clock {
  x: number;
  y: number;
  taken: boolean;
}

export type TMStatus = 'ready' | 'play' | 'eraClear' | 'over' | 'done';

export interface TMState {
  w: number;
  era: number;
  passed: number;
  spawned: number;
  y: number;
  vy: number;
  t: number;
  lives: number;
  invuln: number;
  walls: Wall[];
  clocks: Clock[];
  clocksTaken: number;
  crashes: number;
  status: TMStatus;
  seed: string;
  rand: () => number;
}

export function newGame(seed: string, w = 0.6, era = 0): TMState {
  return { w, era, passed: 0, spawned: 0, y: 0.5, vy: 0, t: 0, lives: LIVES, invuln: 0, walls: [], clocks: [], clocksTaken: 0, crashes: 0, status: 'ready', seed, rand: mulberry32(hashSeed(`${seed}:${era}`)) };
}

/** Month index shown on the dashboard. */
export function monthOf(s: TMState): number {
  const e = ERAS[s.era];
  return Math.round(e.from + ((e.to - e.from) * s.passed) / e.gates);
}

export const yearOf = (s: TMState) => Math.floor(monthOf(s) / 12);

export function flap(s: TMState): TMState {
  if (s.status === 'ready') return { ...s, status: 'play', vy: FLAP };
  if (s.status !== 'play') return s;
  return { ...s, vy: FLAP };
}

/** Start the next era after a clear, or retry the same era after running out of lives. */
export function proceed(s: TMState): TMState {
  if (s.status === 'eraClear') return { ...newGame(s.seed, s.w, s.era + 1), clocksTaken: s.clocksTaken, crashes: s.crashes };
  if (s.status === 'over') return { ...newGame(s.seed + ':retry' + s.crashes, s.w, s.era), clocksTaken: s.clocksTaken, crashes: s.crashes };
  return s;
}

export function gapAt(wall: Wall, t: number, era: Era): number {
  return wall.gapY + Math.sin(t * 1.6 + wall.phase) * era.sway;
}

/** Advance by `dt` seconds (in fixed sub-steps). */
export function step(s0: TMState, dt: number): TMState {
  if (s0.status !== 'play') return s0;
  let s = { ...s0, walls: s0.walls.map((w) => ({ ...w })), clocks: s0.clocks.map((c) => ({ ...c })) };
  const era = ERAS[s.era];
  for (let left = dt; left > 1e-9 && s.status === 'play'; left -= STEP) {
    const h = Math.min(STEP, left);
    s.t += h;
    s.vy = Math.min(1.4, s.vy + G * h);
    s.y += s.vy * h;
    s.invuln = Math.max(0, s.invuln - h);
    for (const w of s.walls) w.x -= era.speed * h;
    for (const c of s.clocks) c.x -= era.speed * h;
    s.walls = s.walls.filter((w) => w.x > -WALL_W);
    s.clocks = s.clocks.filter((c) => c.x > -0.05 && !c.taken);

    // spawn walls at a fixed spacing until the era's quota is out
    const last = s.walls[s.walls.length - 1];
    if (s.spawned < era.gates && (!last || last.x < s.w + WALL_W - era.spacing)) {
      const margin = era.gap / 2 + 0.08 + era.sway;
      const gapY = margin + s.rand() * (1 - margin * 2);
      s.walls.push({ x: s.w + WALL_W, gapY, gapH: era.gap, phase: s.rand() * Math.PI * 2, passed: false });
      if (s.rand() < 0.6) s.clocks.push({ x: s.w + WALL_W + era.spacing / 2, y: gapY, taken: false });
      s.spawned++;
    }

    for (const w of s.walls) {
      if (!w.passed && w.x + WALL_W / 2 < PLAYER_X - R) {
        w.passed = true;
        s.passed++;
      }
    }
    for (const c of s.clocks) {
      if (!c.taken && Math.hypot(c.x - PLAYER_X, c.y - s.y) < R + 0.03) {
        c.taken = true;
        s.clocksTaken++;
      }
    }

    if (s.invuln <= 0 && hits(s, era)) {
      s.lives -= 1;
      s.crashes += 1;
      s.invuln = 1.4;
      s.vy = FLAP * 0.6;
      if (s.lives <= 0) s.status = 'over';
    }
    // stay inside the screen
    if (s.y < R) {
      s.y = R;
      s.vy = Math.max(0, s.vy);
    }
    if (s.y > 1 - R) {
      s.y = 1 - R;
      s.vy = Math.min(0, s.vy);
    }
    if (s.status === 'play' && s.passed >= era.gates) s.status = s.era === ERAS.length - 1 ? 'done' : 'eraClear';
  }
  return s;
}

function hits(s: TMState, era: Era): boolean {
  if (s.y - R <= 0.001 || s.y + R >= 0.999) return true;
  for (const w of s.walls) {
    const dx = Math.abs(w.x - PLAYER_X);
    if (dx > WALL_W / 2 + R) continue;
    const gy = gapAt(w, s.t, era);
    const top = gy - w.gapH / 2;
    const bottom = gy + w.gapH / 2;
    if (s.y - R < top || s.y + R > bottom) return true;
  }
  return false;
}

/** The next wall the player still has to pass (used by tests' autopilot and the HUD). */
export function nextWall(s: TMState): Wall | undefined {
  return s.walls.find((w) => w.x + WALL_W / 2 >= PLAYER_X - R);
}
