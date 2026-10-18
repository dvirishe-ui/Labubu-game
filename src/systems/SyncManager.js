/**
 * SyncManager.js
 * Dual-state offline/online synchronisation.
 *
 * OFFLINE: SaveManager keeps writing to localStorage and flags `meta.isDirty`.
 *          Nothing here blocks gameplay; the status pill simply reads "Offline".
 * ONLINE:  `online` events, app resume and every save (debounced) trigger a
 *          background sync while `isDirty === true`:
 *            1. authenticate (anonymous Supabase session / REST player id)
 *            2. download the cloud save
 *            3. resolve conflicts with the latest-timestamp strategy
 *               (Math.max(localTimestamp, cloudTimestamp) wins)
 *            4. upload the winner, submit the high score, clear isDirty
 *          Failures back off exponentially; local play is never interrupted
 *          (optimistic updates: the UI already shows the local result).
 */
import { EVENTS, SYNC } from '../config/GameConfig.js';
import { migrateSave } from './SaveManager.js';
import { SupabaseAdapter } from './sync/SupabaseAdapter.js';
import { RestAdapter, NullAdapter } from './sync/RestAdapter.js';

const LEADERBOARD_CACHE_KEY = 'labubu_leaderboard_cache_v1';

/** Picks the backend from Vite env vars: Supabase > REST > none. */
export function createAdapterFromEnv(env = {}) {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    return new SupabaseAdapter(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  }
  if (env.VITE_SYNC_REST_URL) return new RestAdapter(env.VITE_SYNC_REST_URL);
  return new NullAdapter();
}

/**
 * Latest-timestamp conflict resolution.
 * The document with the greater `meta.updatedAt` wins wholesale. On top of
 * that, strictly-monotonic data is unioned so no device can ever "lose" an
 * unlocked figure or a personal best: inventory (union), stats (max) and the
 * local run history (merged top 10).
 *
 * @returns {{ winner: 'local'|'cloud', merged: object, latest: number, cloudNeedsUpdate: boolean, localNeedsUpdate: boolean }}
 */
export function resolveConflict(local, cloud) {
  const localTs = local?.meta?.updatedAt || 0;
  if (!cloud) {
    return { winner: 'local', merged: local, latest: localTs, cloudNeedsUpdate: true, localNeedsUpdate: false };
  }
  const cloudTs = cloud?.meta?.updatedAt || 0;
  const latest = Math.max(localTs, cloudTs);
  const winner = cloudTs > localTs ? 'cloud' : 'local';
  const base = JSON.parse(JSON.stringify(winner === 'cloud' ? cloud : local));
  const other = winner === 'cloud' ? local : cloud;

  // Union inventories (earliest unlock time wins for duplicates).
  const byId = new Map(base.inventory.map((e) => [e.id, e]));
  let unionAdded = false;
  for (const entry of other.inventory || []) {
    const mine = byId.get(entry.id);
    if (!mine) {
      byId.set(entry.id, { ...entry });
      unionAdded = true;
    } else if (entry.unlockedAt < mine.unlockedAt) {
      mine.unlockedAt = entry.unlockedAt;
    }
  }
  base.inventory = [...byId.values()];

  // Monotonic stats never go backwards.
  let statsRaised = false;
  for (const key of ['highScore', 'totalRuns', 'boxesOpened', 'coinsCollectedTotal', 'totalDistance', 'bestDistance']) {
    const best = Math.max(base.stats?.[key] || 0, other.stats?.[key] || 0);
    if (best !== (base.stats?.[key] || 0)) statsRaised = true;
    base.stats[key] = best;
  }

  // Merge local top-10 run histories.
  const runs = [...(base.runHistory || []), ...(other.runHistory || [])];
  const seen = new Set();
  base.runHistory = runs
    .filter((r) => {
      const k = `${r.at}|${r.score}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  base.meta = { ...base.meta, updatedAt: latest };
  const mergedChangedWinner = unionAdded || statsRaised;
  return {
    winner,
    merged: base,
    latest,
    // Upload when local won, or when the union added something the cloud lacked.
    cloudNeedsUpdate: winner === 'local' || mergedChangedWinner,
    // Replace local when the cloud won, or when the union added something local lacked.
    localNeedsUpdate: winner === 'cloud' || mergedChangedWinner
  };
}

export class SyncManager {
  /**
   * @param {object} opts
   * @param {import('./SaveManager.js').SaveManager} opts.saveManager
   * @param {import('./EventBus.js').EventBus} opts.bus
   * @param {object} [opts.adapter] SupabaseAdapter | RestAdapter | NullAdapter
   */
  constructor({ saveManager, bus, adapter = new NullAdapter(), now = () => Date.now() }) {
    this.save = saveManager;
    this.bus = bus;
    this.adapter = adapter;
    this.now = now;
    this.status = 'idle';
    this.lastError = null;
    this._timer = null;
    this._inFlight = null;
    this._again = false;
    this._retryDelay = SYNC.RETRY_BASE_MS;
    this._onOnline = () => this._handleOnline();
    this._onOffline = () => this._handleOffline();
    this._onSaveChanged = (e) => {
      if (e?.reason === 'cloud') return; // our own replace - no echo
      this._refreshIdleStatus();
      this.requestSync();
    };
  }

  /** True when the browser/WebView reports connectivity. */
  isOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  }

  /** Wires network listeners and kicks an initial sync if online. */
  start() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._onOnline);
      window.addEventListener('offline', this._onOffline);
    }
    this.bus.on(EVENTS.SAVE_CHANGED, this._onSaveChanged, this);
    this._refreshIdleStatus();
    if (this.isOnline() && this.adapter.enabled) this.requestSync(500);
  }

  stop() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._onOnline);
      window.removeEventListener('offline', this._onOffline);
    }
    this.bus.off(EVENTS.SAVE_CHANGED, this._onSaveChanged, this);
    clearTimeout(this._timer);
  }

  _setStatus(status, extra = {}) {
    this.status = status;
    this.bus.emit(EVENTS.SYNC_STATUS, { status, adapter: this.adapter.kind, ...extra });
  }

  /** Status shown while no request is running. */
  _refreshIdleStatus() {
    if (this._inFlight) return;
    if (!this.adapter.enabled) return this._setStatus('local');
    if (!this.isOnline()) return this._setStatus('offline');
    return this._setStatus(this.save.data?.meta?.isDirty ? 'pending' : 'synced');
  }

  _handleOnline() {
    this._retryDelay = SYNC.RETRY_BASE_MS;
    this._refreshIdleStatus();
    this.requestSync(300);
  }

  _handleOffline() {
    clearTimeout(this._timer);
    this._refreshIdleStatus();
  }

  /** Debounced trigger - many quick saves collapse into one upload. */
  requestSync(delay = SYNC.DEBOUNCE_MS) {
    if (!this.adapter.enabled || !this.isOnline()) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.syncNow(), delay);
  }

  /**
   * Performs one full sync round-trip. Concurrent calls coalesce: if a sync is
   * already running, another round is queued for when it finishes.
   * @param {{force?: boolean}} [opts] force = sync even when not dirty (pull)
   */
  async syncNow({ force = false } = {}) {
    if (!this.adapter.enabled) return this._refreshIdleStatus();
    if (!this.isOnline()) return this._refreshIdleStatus();
    if (this._inFlight) {
      this._again = true;
      return this._inFlight;
    }
    const firstRun = !this._hasSyncedThisSession;
    if (!force && !firstRun && !this.save.data.meta.isDirty) return this._refreshIdleStatus();

    this._inFlight = this._doSync()
      .then(() => {
        this._hasSyncedThisSession = true;
        this._retryDelay = SYNC.RETRY_BASE_MS;
        this.lastError = null;
      })
      .catch((err) => {
        this.lastError = err;
        console.warn('[SyncManager] sync failed, will retry', err);
        this._setStatus('error', { message: err?.message });
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this.syncNow(), this._retryDelay);
        this._retryDelay = Math.min(this._retryDelay * 2, SYNC.RETRY_MAX_MS);
      })
      .finally(() => {
        this._inFlight = null;
        if (this.status !== 'error') this._refreshIdleStatus();
        if (this._again) {
          this._again = false;
          this.requestSync(200);
        }
      });
    return this._inFlight;
  }

  async _doSync() {
    this._setStatus('syncing');
    const local = this.save.data;
    const snapshotTs = local.meta.updatedAt;
    await this.adapter.ensureAuth(local.profile.playerId);

    const cloudRaw = await this.adapter.fetchSave();
    // Read the timestamp BEFORE migration: migrateSave fills missing fields with "now".
    const cloudTs = Number(cloudRaw?.meta?.updatedAt) || 0;
    const cloud = cloudRaw ? migrateSave(cloudRaw) : null;
    if (cloud) cloud.meta.updatedAt = cloudTs;
    const result = resolveConflict(local, cloud);

    // A local mutation landed while we were downloading -> start over.
    if (this.save.data.meta.updatedAt !== snapshotTs) {
      this._again = true;
      return;
    }

    if (result.localNeedsUpdate) this.save.replaceWith(result.merged);
    if (result.cloudNeedsUpdate) {
      const toUpload = { ...this.save.data, meta: { ...this.save.data.meta, isDirty: false } };
      await this.adapter.pushSave(toUpload);
    }

    // Leaderboard: submit when the personal best or display name changed.
    const d = this.save.data;
    let submitted;
    if (d.stats.highScore > 0 && (d.stats.highScore > (d.meta.lastSubmittedScore || 0) || d.meta.nameDirty)) {
      await this.adapter.submitScore({
        displayName: d.profile.displayName,
        score: d.stats.highScore,
        dollId: d.equipped.baseDoll
      });
      submitted = d.stats.highScore;
      d.meta.nameDirty = false;
    }

    // Only clear dirty if nothing changed during the upload.
    if (this.save.data.meta.updatedAt === result.latest || this.save.data.meta.updatedAt === snapshotTs) {
      this.save.markSynced(this.now(), submitted);
    } else {
      this._again = true;
    }
  }

  // ------------------------------------------------------------------ leaderboard

  /**
   * Top 50 global scores. Falls back to the last cached board, then to the
   * device's personal bests, so the modal always has something to show.
   * @returns {Promise<{ source: 'cloud'|'cache'|'local', entries: Array }>}
   */
  async fetchLeaderboard() {
    if (this.adapter.enabled && this.isOnline()) {
      try {
        await this.adapter.ensureAuth(this.save.data.profile.playerId);
        const entries = await this.adapter.fetchLeaderboard(SYNC.LEADERBOARD_SIZE);
        try {
          localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({ at: this.now(), entries }));
        } catch {
          /* cache is best-effort */
        }
        return { source: 'cloud', entries };
      } catch (err) {
        console.warn('[SyncManager] leaderboard fetch failed', err);
      }
    }
    try {
      const cached = JSON.parse(localStorage.getItem(LEADERBOARD_CACHE_KEY) || 'null');
      if (cached?.entries?.length) return { source: 'cache', entries: cached.entries, at: cached.at };
    } catch {
      /* ignore */
    }
    return { source: 'local', entries: this.localLeaderboard() };
  }

  /** Personal best runs on this device, formatted like leaderboard rows. */
  localLeaderboard() {
    const name = this.save.data.profile.displayName;
    return this.save.data.runHistory.map((r) => ({ name, score: r.score, doll: r.doll, isMe: true }));
  }

  /** Renames the player; the next sync re-submits the leaderboard row. */
  setDisplayName(name) {
    const clean = String(name || '')
      .replace(/[^\p{L}\p{N} _#.-]/gu, '')
      .trim()
      .slice(0, 18);
    if (!clean) return false;
    this.save.data.profile.displayName = clean;
    this.save.data.meta.nameDirty = true;
    this.save.save('rename');
    return true;
  }
}
