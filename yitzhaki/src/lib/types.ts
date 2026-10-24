export type Engine = 'realfake' | 'dilemma' | 'fmk' | 'creative' | 'hotseat';

/** New party mechanics layered on podcast content (not podcast segments themselves). */
export type Mechanic = 'impostor' | 'whowrote' | 'bluff' | 'knows' | 'battle' | 'invent' | 'majority' | 'minority';

export type StepEngine = Engine | Exclude<Mechanic, 'majority' | 'minority'>;

export type DecisionMode = 'free' | 'majority' | 'minority' | 'predict' | 'whochose';

export interface Step {
  engine: StepEngine;
  gameId: string;
  roundIds: string[];
  /** Decision scoring for dilemma steps; index into INVENT_PROMPTS for invent steps. */
  mode?: DecisionMode;
  promptIndex?: number;
}

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
  /** Why the round isn't playable (build reason code), or null. */
  r?: string | null;
  /** Source status: verified_in_transcript | ambiguous_autocaption | no_reveal_found | needs_media. */
  st?: string;
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
  reason?: string | null;
  sourceStatus?: string;
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
  /** Party mechanics to mix in (from the friends hub or party night). */
  mechanics?: Mechanic[];
  decisionMode?: DecisionMode;
  /** Party night length in minutes; the session ends after the round in which time runs out. */
  minutes?: number;
}
