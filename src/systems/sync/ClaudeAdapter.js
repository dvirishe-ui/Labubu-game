/**
 * ClaudeAdapter.js
 * Cloud saves when the game runs as a published claude.ai Artifact: the save
 * lives in the viewer's private `data/users/<id>/save` document of the page's
 * `db` capability, keyed by their Claude account. Signing in to Claude on any
 * phone or computer therefore brings the same progress back - that is the
 * game's "login". The leaderboard is a shared `scores` collection where each
 * player writes only their own row.
 *
 * Publish the page with:
 *   capabilities: {
 *     db: { rules: [ { path: 'scores', read: 'view', write: 'owner' },
 *                    { path: 'scores/{self}', write: 'interact' },
 *                    { path: 'codes', read: 'view', write: 'interact' } ] },
 *     user: { scopes: ['profile'] }
 *   }
 *
 * `codes` holds the short save codes players choose (see SaveNames.js).
 */
import { refreshSaveName } from '../SaveNames.js';

const CONNECT_TIMEOUT_MS = 8000;

export class ClaudeAdapter {
  constructor(db, user, uid, accountName) {
    this.kind = 'claude';
    this.enabled = true;
    this.db = db;
    this.user = user;
    this.uid = uid;
    this.accountName = accountName;
    this.readOnly = false;
  }

  /**
   * Resolves an adapter when the page is running inside claude.ai with the
   * viewer signed in, otherwise null (local dev, the native app, signed out).
   */
  static async connect(timeoutMs = CONNECT_TIMEOUT_MS) {
    const claude = typeof window !== 'undefined' ? window.claude : null;
    if (!claude?.use) return null;
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const both = Promise.all([claude.use('db'), claude.use('user')]).catch(() => null);
    const res = await Promise.race([both, timeout]);
    if (!res) return null;
    const [db, user] = res;
    if (!db || !user) return null;
    const me = await user.me();
    if (!me?.id) return null;
    return new ClaudeAdapter(db, user, me.id, me.name || '');
  }

  _saveRef() {
    return this.db.doc(`data/users/${this.uid}/save`);
  }

  async ensureAuth() {
    return this.uid;
  }

  async fetchSave() {
    const snap = await this._saveRef().get();
    if (!snap.exists) return null;
    try {
      return JSON.parse(snap.data().json);
    } catch {
      return null;
    }
  }

  async pushSave(save) {
    if (this.readOnly) return;
    try {
      await this._saveRef().set({ json: JSON.stringify(save), updatedAt: save.meta.updatedAt, v: 1 });
      refreshSaveName(this, save).catch(() => {});
    } catch (err) {
      // invalid_argument here = this viewer may read but not write (view-only link).
      if (err?.code === 'invalid_argument') this.readOnly = true;
      throw err;
    }
  }

  async submitScore({ displayName, score, dollId }) {
    if (this.readOnly) return;
    try {
      await this.db.doc(`scores/${this.uid}`).set({ name: String(displayName).slice(0, 18), score: Math.floor(score), doll: dollId, at: Date.now() });
    } catch {
      /* leaderboard rows are best-effort */
    }
  }

  async fetchLeaderboard(limit = 50) {
    const snap = await this.db.collection('scores').orderBy('score', 'desc').limit(limit).get();
    return snap.docs.map((d) => {
      const row = d.data() || {};
      return { name: row.name || 'Labubu', score: Number(row.score) || 0, doll: row.doll, isMe: d.id === this.uid };
    });
  }
}
