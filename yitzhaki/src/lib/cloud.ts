import type { AdminOverrides } from './deck';
import { seal, unseal } from './obfuscate';
import { clientId, partyAvailable } from './party';
import type { Profile } from './profile';

/** What other players can see about you (leaderboards, duels, rooms). */
export interface PublicPlayer {
  id: string;
  name: string;
  char: string | null;
  skin: string | null;
  level: number;
  days: Record<string, { score: number; correct: number }>;
  duels: Record<string, { score: number; correct: number; at: number }>;
  updatedAt: number;
}

export interface CrowdStats {
  /** Players whose answers are counted (excluding you). */
  players: number;
  byQuestion: Record<string, Record<string, number>>;
}

export interface Cloud {
  kind: 'artifact' | 'server';
  userId: string;
  loadProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  savePlayer(p: PublicPlayer): Promise<void>;
  saveAnswers(a: Record<string, string>): Promise<void>;
  loadPlayers(): Promise<PublicPlayer[]>;
  loadAnswers(): Promise<{ id: string; a: Record<string, string> }[]>;
  /** Editor changes shared with every player (only the owner / editor can write them). */
  loadEditor(): Promise<AdminOverrides | null>;
  saveEditor(o: AdminOverrides, key: string): Promise<boolean>;
}

// Edits can include answers, so the shared copy is sealed like the deck.
const sealEditor = (o: AdminOverrides) => ({ v: 1, x: seal('editor', o), updatedAt: o.updatedAt ?? Date.now() });
const openEditor = (doc: unknown): AdminOverrides | null => {
  try {
    const d = doc as { x?: string } | null;
    return d?.x ? unseal<AdminOverrides>('editor', d.x) : null;
  } catch {
    return null;
  }
};

export function aggregate(rows: { id: string; a: Record<string, string> }[], selfId: string): CrowdStats {
  const byQuestion: CrowdStats['byQuestion'] = {};
  let players = 0;
  for (const row of rows) {
    if (row.id === selfId || !row.a) continue;
    players++;
    for (const [q, c] of Object.entries(row.a)) {
      const t = (byQuestion[q] ??= {});
      t[c] = (t[c] ?? 0) + 1;
    }
  }
  return { players, byQuestion };
}

/** Serialize writes per document: the store wants one write at a time per doc. */
function serial() {
  const chains = new Map<string, Promise<unknown>>();
  return (key: string, job: () => Promise<unknown>) => {
    const next = (chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(job);
    chains.set(key, next);
    return next.then(() => undefined);
  };
}

// ---- inside a claude.ai viewer: the artifact's db ----

type Doc = { exists: boolean; id: string; data(): Record<string, unknown> | undefined };
type DbLike = {
  doc(path: string): { get(): Promise<Doc>; set(d: Record<string, unknown>): Promise<void> };
  collection(path: string): { limit(n: number): { get(): Promise<{ docs: Doc[] }> } };
};
type UserLike = { id(): Promise<string | null> };

async function artifactCloud(): Promise<Cloud | null> {
  const claude = (globalThis as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  const [db, user] = (await Promise.all([claude.use('db'), claude.use('user')])) as [DbLike | null, UserLike | null];
  if (!db || !user) return null;
  const id = await user.id().catch(() => null);
  if (!id) return null;
  try {
    db.doc(`players/${id}`);
  } catch {
    return null;
  }
  const run = serial();
  const write = (path: string, body: Record<string, unknown>) => run(path, () => db.doc(path).set(body));
  return {
    kind: 'artifact',
    userId: id,
    async loadProfile() {
      const d = await db.doc(`data/users/${id}/profile`).get();
      return d.exists ? (d.data() as unknown as Profile) : null;
    },
    saveProfile: (p) => write(`data/users/${id}/profile`, p as unknown as Record<string, unknown>),
    savePlayer: (p) => write(`players/${id}`, { ...p, id } as unknown as Record<string, unknown>),
    saveAnswers: (a) => write(`crowd/${id}`, { a }),
    async loadPlayers() {
      const s = await db.collection('players').limit(1000).get();
      return s.docs.filter((d) => d.exists).map((d) => ({ ...(d.data() as unknown as PublicPlayer), id: d.id }));
    },
    async loadAnswers() {
      const s = await db.collection('crowd').limit(1000).get();
      return s.docs.filter((d) => d.exists).map((d) => ({ id: d.id, a: ((d.data() ?? {}) as { a?: Record<string, string> }).a ?? {} }));
    },
    async loadEditor() {
      const d = await db.doc('editor/overrides').get();
      return d.exists ? openEditor(d.data()) : null;
    },
    async saveEditor(o) {
      // Access rules let only the artifact's owner write here; anyone else keeps edits on their device.
      return run('editor/overrides', () => db.doc('editor/overrides').set(sealEditor(o))).then(
        () => true,
        () => false
      );
    }
  };
}

// ---- self-hosted: the party server's small JSON store ----

async function serverCloud(): Promise<Cloud | null> {
  if (!(await partyAvailable())) return null;
  const id = clientId();
  const run = serial();
  const put = (path: string, body: unknown) =>
    run(path, () => fetch(`./api/store/${path}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const get = async <T,>(path: string): Promise<T> => {
    const r = await fetch(`./api/store/${path}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<T>;
  };
  return {
    kind: 'server',
    userId: id,
    loadProfile: () => get<Profile | null>(`profile/${id}`).catch(() => null),
    saveProfile: (p) => put(`profile/${id}`, p),
    savePlayer: (p) => put(`players/${id}`, { ...p, id }),
    saveAnswers: (a) => put(`crowd/${id}`, { a }),
    loadPlayers: () => get<PublicPlayer[]>('players'),
    loadAnswers: () => get<{ id: string; a: Record<string, string> }[]>('crowd'),
    loadEditor: () => get<unknown>('editor/shared').then(openEditor, () => null),
    saveEditor: async (o, key) => {
      const r = await fetch('./api/store/editor/shared', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-editor-key': key }, body: JSON.stringify(sealEditor(o)) }).catch(() => null);
      return !!r?.ok;
    }
  };
}

let pending: Promise<Cloud | null> | null = null;

/** Resolves the best available shared backend, or null (progress then stays on this device only). */
export function connectCloud(): Promise<Cloud | null> {
  pending ??= (async () => (await artifactCloud().catch(() => null)) ?? (await serverCloud().catch(() => null)))();
  return pending;
}
