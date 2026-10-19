import { describe, it, expect } from 'vitest';
import { resolveConflict, isPristine, SyncManager } from '../src/systems/SyncManager.js';
import { exportSaveCode, decodeSaveCode, importSaveCode } from '../src/systems/SaveCode.js';
import { ClaudeAdapter } from '../src/systems/sync/ClaudeAdapter.js';
import { makeSave } from './helpers.js';

/** In-memory stand-in for the artifact `db` capability. */
function fakeDb({ readOnly = false } = {}) {
  const docs = new Map();
  const ref = (path) => ({
    async get() {
      const d = docs.get(path);
      return { id: path.split('/').pop(), exists: Boolean(d), data: () => d };
    },
    async set(body) {
      if (readOnly) throw { code: 'invalid_argument', message: 'no write' };
      docs.set(path, JSON.parse(JSON.stringify(body)));
    }
  });
  return {
    docs,
    doc: ref,
    collection: (path) => ({
      orderBy: () => ({
        limit: () => ({
          async get() {
            const rows = [...docs.entries()].filter(([k]) => k.startsWith(`${path}/`)).map(([k, d]) => ({ id: k.split('/').pop(), data: () => d }));
            rows.sort((a, b) => b.data().score - a.data().score);
            return { docs: rows };
          }
        })
      })
    })
  };
}

const played = (save) => {
  save.data.stats.totalRuns = 12;
  save.data.progress.xp = 900;
  save.data.currencies.popCoins = 4321;
  save.unlockItem('golden_labubu');
  save.save('test');
};

describe('fresh device never overwrites real progress', () => {
  it('a pristine local save loses even when its timestamp is newer', () => {
    const { save: cloud } = makeSave();
    played(cloud);
    const { save: phone } = makeSave(Date.now() + 1e7);
    expect(isPristine(phone.data)).toBe(true);
    const r = resolveConflict(phone.data, cloud.data);
    expect(r.winner).toBe('cloud');
    expect(r.merged.currencies.popCoins).toBe(4321);
  });

  it('signing in on a new phone brings the account progress back', async () => {
    const db = fakeDb();
    const { save: first, bus: bus1 } = makeSave();
    const sync1 = new SyncManager({ saveManager: first, bus: bus1, adapter: new ClaudeAdapter(db, null, 'u_me', 'Dvir') });
    played(first);
    await sync1.syncNow({ force: true });
    expect(db.docs.has('data/users/u_me/save')).toBe(true);

    const { save: phone, bus: bus2 } = makeSave(Date.now() + 5e6);
    const sync2 = new SyncManager({ saveManager: phone, bus: bus2, adapter: new ClaudeAdapter(db, null, 'u_me', 'Dvir') });
    await sync2.syncNow({ force: true });
    expect(phone.data.currencies.popCoins).toBe(4321);
    expect(phone.hasItem('golden_labubu')).toBe(true);
  });

  it('a view-only viewer falls back to local without retry loops', async () => {
    const db = fakeDb({ readOnly: true });
    const { save, bus } = makeSave();
    const sync = new SyncManager({ saveManager: save, bus, adapter: new ClaudeAdapter(db, null, 'u_x', '') });
    await sync.syncNow({ force: true });
    expect(sync.adapter.readOnly).toBe(true);
    expect(sync.adapter.enabled).toBe(false);
    expect(sync.status).toBe('local');
  });

  it('the leaderboard lists scores, marking mine', async () => {
    const db = fakeDb();
    const a = new ClaudeAdapter(db, null, 'u_a', '');
    const b = new ClaudeAdapter(db, null, 'u_b', '');
    await a.submitScore({ displayName: 'Ann', score: 500, dollId: 'labubu_classic' });
    await b.submitScore({ displayName: 'Ben', score: 900, dollId: 'labubu_classic' });
    const rows = await a.fetchLeaderboard(50);
    expect(rows.map((r) => r.name)).toEqual(['Ben', 'Ann']);
    expect(rows[1].isMe).toBe(true);
  });
});

describe('save codes', () => {
  it('round-trips a save', async () => {
    const { save } = makeSave();
    played(save);
    const code = await exportSaveCode(save.data);
    expect(code.startsWith('LABUBU1.')).toBe(true);
    const back = await decodeSaveCode(code);
    expect(back.currencies.popCoins).toBe(4321);
  });

  it('imports into another device and keeps both collections', async () => {
    const { save: a } = makeSave();
    played(a);
    const code = await exportSaveCode(a.data);
    const { save: b } = makeSave();
    b.unlockItem('raincoat');
    await importSaveCode(b, code);
    expect(b.data.currencies.popCoins).toBe(4321);
    expect(b.hasItem('golden_labubu')).toBe(true);
    expect(b.hasItem('raincoat')).toBe(true);
  });

  it('rejects junk', async () => {
    await expect(decodeSaveCode('hello')).rejects.toThrow();
  });
});
