/**
 * RestAdapter.js
 * Cloud backend for a custom REST server (see server/rest-sync-server.js for a
 * reference implementation). Contract:
 *
 *   GET  {base}/saves/:playerId          -> 200 { save } | 404
 *   PUT  {base}/saves/:playerId          <- { save, updatedAt }
 *   GET  {base}/leaderboard?limit=50     -> [{ playerId, displayName, score, dollId }]
 *   POST {base}/leaderboard              <- { playerId, displayName, score, dollId }
 *
 * Production servers should authenticate requests (e.g. a device token issued
 * at first launch); the header hook is `this.headers`.
 */
const TIMEOUT_MS = 8000;

export class RestAdapter {
  constructor(baseUrl) {
    this.kind = 'rest';
    this.enabled = Boolean(baseUrl);
    this.base = (baseUrl || '').replace(/\/+$/, '');
    this.playerId = null;
    this.headers = { 'Content-Type': 'application/json' };
  }

  /** fetch() with a timeout so a captive portal / dead network can't hang a sync. */
  async _request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.base}${path}`, { ...options, headers: this.headers, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /** REST identity is the local playerId; nothing to sign in to. */
  async ensureAuth(playerId) {
    this.playerId = playerId;
    return playerId;
  }

  async fetchSave() {
    const res = await this._request(`/saves/${encodeURIComponent(this.playerId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`fetchSave HTTP ${res.status}`);
    const body = await res.json();
    return body?.save || null;
  }

  async pushSave(save) {
    const res = await this._request(`/saves/${encodeURIComponent(this.playerId)}`, {
      method: 'PUT',
      body: JSON.stringify({ save, updatedAt: save.meta.updatedAt })
    });
    if (!res.ok) throw new Error(`pushSave HTTP ${res.status}`);
  }

  async submitScore({ displayName, score, dollId }) {
    const res = await this._request('/leaderboard', {
      method: 'POST',
      body: JSON.stringify({ playerId: this.playerId, displayName, score: Math.floor(score), dollId })
    });
    if (!res.ok) throw new Error(`submitScore HTTP ${res.status}`);
  }

  async fetchLeaderboard(limit = 50) {
    const res = await this._request(`/leaderboard?limit=${limit}`);
    if (!res.ok) throw new Error(`fetchLeaderboard HTTP ${res.status}`);
    const rows = await res.json();
    return (rows || []).map((r) => ({
      name: r.displayName,
      score: r.score,
      doll: r.dollId,
      isMe: r.playerId === this.playerId
    }));
  }
}

/** Adapter used when no backend is configured: the game stays 100% local. */
export class NullAdapter {
  constructor() {
    this.kind = 'none';
    this.enabled = false;
  }
}
