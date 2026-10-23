import { drawRounds, loadSeen, playablePool, resetSeen } from './deck';
import { newSeed } from './rng';
import { load, remove, save } from './storage';
import type { Participant, Round, SessionConfig } from './types';

export interface Session {
  config: SessionConfig;
  roundIds: string[];
  index: number;
  participants: Participant[];
  recycled: boolean;
}

export function createSession(config: SessionConfig, rounds: Round[]): Session {
  const pool = playablePool(rounds, config.gameIds, config.mature);
  let seen = loadSeen();
  if (config.length === 'marathon' && pool.every((r) => seen.has(r.id))) {
    resetSeen(pool.map((r) => r.id));
    seen = loadSeen();
  }
  const { picked, recycled } = drawRounds(pool, config.length === 'marathon' ? 'all' : config.length, seen, config.seed);
  if (recycled) resetSeen(pool.map((r) => r.id));
  return {
    config,
    roundIds: picked.map((r) => r.id),
    index: 0,
    participants: config.participants.map((p) => ({ ...p, score: 0 })),
    recycled
  };
}

export function rematch(s: Session, rounds: Round[]): Session {
  return createSession({ ...s.config, seed: newSeed() }, rounds);
}

export const saveSession = (s: Session | null) => (s ? save('session', s) : remove('session'));
export const loadSession = () => load<Session | null>('session', null);
