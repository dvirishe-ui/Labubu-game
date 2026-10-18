import { describe, it, expect } from 'vitest';
import { resolveConflict, SyncManager } from '../src/systems/SyncManager.js';
import { makeSave } from './helpers.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

describe('resolveConflict (latest timestamp wins)', () => {
  it('keeps local when there is no cloud save', () => {
    const { save } = makeSave();
    const r = resolveConflict(save.data, null);
    expect(r.winner).toBe('local');
    expect(r.cloudNeedsUpdate).toBe(true);
  });

  it('picks the document with Math.max(localTs, cloudTs)', () => {
    const { save } = makeSave();
    const local = clone(save.data);
    const cloud = clone(save.data);
    local.meta.updatedAt = 1000;
    cloud.meta.updatedAt = 2000;
    cloud.currencies.popCoins = 9999;
    const r = resolveConflict(local, cloud);
    expect(r.winner).toBe('cloud');
    expect(r.latest).toBe(2000);
    expect(r.merged.currencies.popCoins).toBe(9999);
    expect(r.localNeedsUpdate).toBe(true);
  });

  it('never loses unlocked items or personal bests from the older copy', () => {
    const { save } = makeSave();
    const local = clone(save.data);
    const cloud = clone(save.data);
    local.meta.updatedAt = 5000;
    cloud.meta.updatedAt = 4000;
    cloud.inventory.push({ id: 'beaver_labubu_secret', type: 'secret_chase', unlockedAt: 1 });
    cloud.stats.highScore = 4321;
    const r = resolveConflict(local, cloud);
    expect(r.winner).toBe('local');
    expect(r.merged.inventory.some((e) => e.id === 'beaver_labubu_secret')).toBe(true);
    expect(r.merged.stats.highScore).toBe(4321);
    expect(r.localNeedsUpdate).toBe(true);
  });
});

/** In-memory backend implementing the adapter contract. */
class FakeAdapter {
  constructor() {
    this.kind = 'fake';
    this.enabled = true;
    this.cloud = null;
    this.scores = [];
  }
  async ensureAuth() {}
  async fetchSave() {
    return this.cloud ? clone(this.cloud) : null;
  }
  async pushSave(save) {
    this.cloud = clone(save);
  }
  async submitScore(row) {
    this.scores.push(row);
  }
  async fetchLeaderboard() {
    return this.scores.map((s) => ({ name: s.displayName, score: s.score }));
  }
}

describe('SyncManager', () => {
  it('uploads a dirty local save, submits the high score and clears isDirty', async () => {
    const { save, bus } = makeSave();
    save.data.stats.highScore = 900;
    save.save('test');
    const adapter = new FakeAdapter();
    const sync = new SyncManager({ saveManager: save, bus, adapter });
    await sync.syncNow({ force: true });
    expect(adapter.cloud.currencies.popCoins).toBe(save.data.currencies.popCoins);
    expect(adapter.scores[0].score).toBe(900);
    expect(save.data.meta.isDirty).toBe(false);
    expect(sync.status).toBe('synced');
  });

  it('adopts a newer cloud save', async () => {
    const { save, bus, clock } = makeSave();
    const adapter = new FakeAdapter();
    adapter.cloud = clone(save.data);
    adapter.cloud.currencies.popCoins = 7777;
    adapter.cloud.meta.updatedAt = clock.t + 60000;
    const sync = new SyncManager({ saveManager: save, bus, adapter });
    let replaced = false;
    bus.on('save:replaced', () => (replaced = true));
    await sync.syncNow({ force: true });
    expect(save.data.currencies.popCoins).toBe(7777);
    expect(replaced).toBe(true);
  });

  it('falls back to local personal bests when the cloud is disabled', async () => {
    const { save, bus } = makeSave();
    save.recordRun({ distance: 321, coins: 5 });
    const sync = new SyncManager({ saveManager: save, bus });
    const lb = await sync.fetchLeaderboard();
    expect(lb.source).toBe('local');
    expect(lb.entries[0].score).toBe(321);
  });
});
