export type Engine = 'realfake' | 'dilemma' | 'fmk' | 'creative' | 'hotseat';

export interface GameMeta {
  id: string;
  title: string;
  subtitle: string;
  engine: Engine;
  emoji: string;
  options: Record<string, string>;
  mature: boolean;
  count: number;
  unresolved: number;
  rules?: string;
}

/** Round as stored in the shipped deck. Everything revealed after the vote lives in the sealed `x`. */
export interface DeckRound {
  id: string;
  g: string;
  p: string | null;
  o: string[] | null;
  m: boolean;
  u: boolean;
  c: string;
  x: string;
}

export interface Secret {
  a: string | null;
  rv: string | null;
  gs: string[];
  pn: string[];
  fee: string | null;
  ar: string | null;
  rn: string | null;
}

export interface Round {
  id: string;
  gameId: string;
  prompt: string;
  /** For fmk / two-way choice rounds; otherwise the game's option keys are used. */
  choices: string[] | null;
  mature: boolean;
  usable: boolean;
  confidence: string;
  custom?: boolean;
  /** Sealed payload, opened only at reveal time. */
  sealed: string;
  /** Plain secret for admin-created rounds or admin answer overrides. */
  plain?: Partial<Secret>;
}

export interface Participant {
  id: string;
  name: string;
  score: number;
}

export type Length = 5 | 10 | 15 | 'marathon';

export interface SessionConfig {
  mode: 'players' | 'teams';
  participants: Participant[];
  gameIds: string[];
  length: Length;
  secretVotes: boolean;
  timer: number;
  predictMajority: boolean;
  mature: boolean;
  seed: string;
}
