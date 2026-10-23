import { loadSeen, playablePool, resetSeen } from './deck';
import { buildSteps } from './plan';
import { newSeed } from './rng';
import { load, remove, save } from './storage';
import type { GameMeta, Participant, Round, SessionConfig, Step } from './types';

/** What an engine reports besides points, for recaps and coin eligibility. */
export interface RoundMeta {
  /** Participants who answered a factual question correctly this round. */
  correct?: string[];
  /** Participants who answered a factual question at all. */
  answeredBy?: string[];
  /** Points won by bluffing / fooling others. */
  fooled?: Record<string, number>;
  /** Participants who voted with the minority on a dilemma. */
  unpopular?: string[];
}

export interface StepLog {
  deltas: Record<string, number>;
  meta: RoundMeta;
  scores: Record<string, number>;
  skipped?: boolean;
}

export interface Session {
  id: string;
  config: SessionConfig;
  steps: Step[];
  index: number;
  participants: Participant[];
  recycled: boolean;
  startedAt: number;
  log: StepLog[];
}

export function createSession(config: SessionConfig, games: GameMeta[], rounds: Round[]): Session {
  let seen = loadSeen();
  const pool = playablePool(rounds, config.gameIds, config.mature);
  if (config.length === 'marathon' && !config.mechanics?.length && pool.every((r) => seen.has(r.id))) {
    resetSeen(pool.map((r) => r.id));
    seen = loadSeen();
  }
  let steps = buildSteps(config, games, rounds, seen);
  const fresh = steps.every((s) => s.roundIds.every((id) => !seen.has(id)));
  if (!fresh && !config.minutes && !config.mechanics?.length) resetSeen(pool.map((r) => r.id));
  if (!steps.length) steps = buildSteps({ ...config, seed: config.seed + ':retry' }, games, rounds, new Set());
  return {
    id: newSeed() + newSeed(),
    config,
    steps,
    index: 0,
    participants: config.participants.map((p) => ({ ...p, score: 0 })),
    recycled: !fresh,
    startedAt: Date.now(),
    log: []
  };
}

export function rematch(s: Session, games: GameMeta[], rounds: Round[]): Session {
  return createSession({ ...s.config, seed: newSeed() }, games, rounds);
}

/** Party night ends once its time is used up (checked after each round). */
export function timeUp(s: Session, now = Date.now()): boolean {
  return !!s.config.minutes && now - s.startedAt >= s.config.minutes * 60_000;
}

export const saveSession = (s: Session | null) => (s ? save('session.v2', s) : remove('session.v2'));
export const loadSession = () => {
  const s = load<Session | null>('session.v2', null);
  return s && Array.isArray(s.steps) ? s : null;
};
