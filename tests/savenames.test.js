import { describe, it, expect } from 'vitest';
import { normalizeSaveName, claimSaveName, loadAnyCode, refreshSaveName, isLongCode } from '../src/systems/SaveNames.js';
import { exportSaveCode } from '../src/systems/SaveCode.js';
import { ClaudeAdapter } from '../src/systems/sync/ClaudeAdapter.js';
import { makeSave } from './helpers.js';

function fakeDb({ readOnly = false } = {}) {
  const docs = new Map();
  return {
    docs,
    doc: (path) => ({
      async get() {
        const d = docs.get(path);
        return { exists: Boolean(d), data: () => d };
      },
      async set(body) {
        if (readOnly) throw { code: 'invalid_argument' };
        docs.set(path, JSON.parse(JSON.stringify(body)));
      },
      async delete() {
        docs.delete(path);
      }
    })
  };
}
const syncWith = (adapter) => ({ adapter });

describe('save code names', () => {
  it('normalizes names and rejects bad ones', () => {
    expect(normalizeSaveName(' Dvir 123 ')).toBe('dvir123');
    expect(normalizeSaveName('ab')).toBe(null);
    expect(normalizeSaveName('no/slash')).toBe(null);
    expect(normalizeSaveName('x'.repeat(17))).toBe(null);
    expect(isLongCode('LABUBU1.zabc')).toBe(true);
    expect(isLongCode('dvir123')).toBe(false);
  });

  it('claims a name and loads it on another device', async () => {
    const db = fakeDb();
    const { save: mine } = makeSave();
    mine.data.currencies.popCoins = 9876;
    mine.unlockItem('golden_labubu');
    await claimSaveName(new ClaudeAdapter(db, null, 'u_me', ''), mine, 'Dvir123');
    expect(mine.data.profile.saveName).toBe('dvir123');
    expect(db.docs.get('codes/dvir123').owner).toBe('u_me');

    // Sister: view-only, different account, types the short code.
    const { save: hers } = makeSave(Date.now() + 1e6);
    await loadAnyCode(syncWith(new ClaudeAdapter(fakeDb({ readOnly: true }), null, 'u_sis', '')), hers, 'x').catch((e) => expect(e.message).toBe('invalid'));
    const view = new ClaudeAdapter(db, null, 'u_sis', '');
    view.readOnly = true;
    await loadAnyCode(syncWith(view), hers, 'DVIR123');
    expect(hers.data.currencies.popCoins).toBe(9876);
    expect(hers.hasItem('golden_labubu')).toBe(true);
    expect(hers.data.profile.saveName).toBe(''); // the name stays with its owner
  });

  it("can't take someone else's name, and frees the old one on rename", async () => {
    const db = fakeDb();
    const { save: a } = makeSave();
    const { save: b } = makeSave();
    await claimSaveName(new ClaudeAdapter(db, null, 'u_a', ''), a, 'star');
    await expect(claimSaveName(new ClaudeAdapter(db, null, 'u_b', ''), b, 'star')).rejects.toThrow('taken');
    await claimSaveName(new ClaudeAdapter(db, null, 'u_a', ''), a, 'star2');
    await new Promise((r) => setTimeout(r, 0));
    expect(db.docs.has('codes/star')).toBe(false);
    expect(db.docs.has('codes/star2')).toBe(true);
  });

  it('keeps the named save up to date and still accepts long codes', async () => {
    const db = fakeDb();
    const adapter = new ClaudeAdapter(db, null, 'u_me', '');
    const { save } = makeSave();
    await claimSaveName(adapter, save, 'kiki');
    save.data.currencies.gems = 777;
    await refreshSaveName(adapter, save.data);
    const { save: other } = makeSave();
    await loadAnyCode(syncWith(adapter), other, 'kiki');
    expect(other.data.currencies.gems).toBe(777);

    const { save: guest } = makeSave();
    await loadAnyCode(syncWith({ kind: 'null' }), guest, await exportSaveCode(save.data));
    expect(guest.data.currencies.gems).toBe(777);
    await expect(loadAnyCode(syncWith({ kind: 'null' }), guest, 'kiki')).rejects.toThrow('no_account');
    await expect(loadAnyCode(syncWith(adapter), guest, 'nobody')).rejects.toThrow('not_found');
  });

  it('view-only viewers cannot claim a name', async () => {
    const adapter = new ClaudeAdapter(fakeDb({ readOnly: true }), null, 'u_v', '');
    const { save } = makeSave();
    await expect(claimSaveName(adapter, save, 'mine')).rejects.toThrow('read_only');
    expect(save.data.profile.saveName).toBe('');
  });
});
