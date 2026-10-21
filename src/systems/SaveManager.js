/**
 * SaveManager.js
 * Offline-first persistence. The whole player state is ONE JSON document kept
 * in memory and written to localStorage on every critical mutation.
 *
 * - `meta.updatedAt` is the logical timestamp used for cloud conflict resolution.
 * - `meta.isDirty` is set on every local change and cleared by SyncManager once
 *   the cloud has the same document.
 * - Storage failures (private mode, quota) never crash the game: the state keeps
 *   living in memory and we retry on the next save.
 */
import { STORAGE_KEY, SAVE_VERSION, ECONOMY, EVENTS } from '../config/GameConfig.js';
import { CATALOG, SLOTS } from '../config/GachaDropTable.js';

/** RFC-4122 v4 UUID (crypto.randomUUID when available, Math.random fallback). */
export function uuidv4() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Builds a brand-new save for a first-time player. */
export function createDefaultSave(now = Date.now()) {
  const playerId = uuidv4();
  return {
    version: SAVE_VERSION,
    profile: {
      playerId,
      displayName: `Labubu#${playerId.slice(0, 4).toUpperCase()}`,
      createdAt: now,
      lastOnlineTimestamp: now,
      lastIdleClaimTimestamp: now,
      saveName: ''
    },
    currencies: {
      popCoins: ECONOMY.STARTING_COINS,
      blindBoxTickets: ECONOMY.STARTING_TICKETS,
      goldenKeys: 0,
      gems: ECONOMY.STARTING_GEMS
    },
    equipped: {
      baseDoll: 'labubu_classic',
      outfit: null,
      headwear: null,
      tail: null,
      shoes: null,
      back: null
    },
    inventory: [{ id: 'labubu_classic', type: 'base', unlockedAt: now }],
    stats: {
      highScore: 0,
      totalRuns: 0,
      boxesOpened: 0,
      coinsCollectedTotal: 0,
      totalDistance: 0,
      bestDistance: 0,
      duplicatesPulled: 0
    },
    quests: {
      lastRefreshDate: '',
      weeklyRefreshKey: '',
      activeQuests: [],
      weeklyQuests: [],
      inbox: []
    },
    pity: {
      classic: { sinceEpic: 0, sinceLegendary: 0, sinceSecret: 0 },
      sparkle: { sinceEpic: 0, sinceLegendary: 0, sinceSecret: 0 },
      mega: { sinceEpic: 0, sinceLegendary: 0, sinceSecret: 0 }
    },
    shop: { dealsDate: '', bought: [] },
    // Consumable boosts (a starter one of each) and coin upgrade levels.
    powerups: { headStart: 1, scoreBooster: 1 },
    upgrades: { magnet: 0, star: 0, mushroom: 0, headStart: 0 },
    progress: { xp: 0 },
    pass: { season: '', xp: 0, gold: false, claimed: { free: [], gold: [] } },
    settings: { muted: false, music: true },
    wordHunt: { date: '', collected: [], completed: false },
    luckySpin: { lastSpinDate: '' },
    runHistory: [],
    meta: {
      updatedAt: now,
      isDirty: true,
      lastSyncedAt: 0,
      lastSubmittedScore: 0
    }
  };
}

/** Recursively fills keys missing from `target` with values from `defaults`. */
function fillDefaults(target, defaults) {
  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    if (target[key] === undefined) {
      target[key] = structuredCloneSafe(def);
    } else if (def && typeof def === 'object' && !Array.isArray(def) && typeof target[key] === 'object' && target[key] !== null) {
      fillDefaults(target[key], def);
    }
  }
  return target;
}

function structuredCloneSafe(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Brings any older / partial / tampered save up to the current schema.
 * Exported so the cloud path (SyncManager) can sanitise downloaded saves too.
 */
export function migrateSave(raw, now = Date.now()) {
  const defaults = createDefaultSave(now);
  const src = raw && typeof raw === 'object' ? raw : {};
  // v2 -> v3: single pity counter became per-pack counters.
  if (src.pityCounter && !src.pity) {
    src.pity = { classic: { sinceEpic: src.pityCounter.pullsSinceLastEpic || 0, sinceLegendary: 0, sinceSecret: src.pityCounter.pullsSinceLastSecret || 0 } };
  }
  delete src.pityCounter;
  const data = fillDefaults(src, defaults);

  // A save without identity is useless for sync - keep the generated one.
  if (!data.profile.playerId) data.profile.playerId = defaults.profile.playerId;

  // Inventory: drop unknown ids, dedupe, always own the starter doll.
  const seen = new Set();
  data.inventory = (Array.isArray(data.inventory) ? data.inventory : []).filter((entry) => {
    if (!entry || !CATALOG[entry.id] || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  if (!seen.has('labubu_classic')) data.inventory.unshift({ id: 'labubu_classic', type: 'base', unlockedAt: now });

  // Equipped: every slot must reference an owned item that fits the slot.
  for (const [slot, key] of Object.entries(SLOTS)) {
    const id = data.equipped[key];
    if (id && (!seen.has(id) || CATALOG[id].slot !== slot)) data.equipped[key] = null;
  }
  if (!data.equipped.baseDoll) data.equipped.baseDoll = 'labubu_classic';

  // Currencies can never be negative or non-numeric.
  for (const k of Object.keys(data.currencies)) {
    const v = Number(data.currencies[k]);
    data.currencies[k] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }

  if (!Array.isArray(data.runHistory)) data.runHistory = [];
  data.version = SAVE_VERSION;
  return data;
}

/** localStorage, or null when the browser refuses access (sandboxed frames, privacy modes). */
function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    s?.getItem(STORAGE_KEY);
    return s ?? null;
  } catch {
    return null;
  }
}

export class SaveManager {
  /**
   * @param {object} opts
   * @param {Storage} [opts.storage] localStorage-compatible storage (injectable for tests)
   * @param {import('./EventBus.js').EventBus} [opts.bus]
   * @param {() => number} [opts.now] clock (injectable for tests)
   */
  constructor({ storage = defaultStorage(), bus = null, now = () => Date.now() } = {}) {
    this.storage = storage;
    this.bus = bus;
    this.now = now;
    this.data = null;
    this._saveTimer = null;
  }

  /** Reads the save from storage, creating/migrating as needed. */
  load() {
    let raw = null;
    try {
      const text = this.storage?.getItem(STORAGE_KEY);
      raw = text ? JSON.parse(text) : null;
    } catch (err) {
      console.warn('[SaveManager] corrupt or unreadable save, starting fresh', err);
      raw = null;
    }
    this.data = raw ? migrateSave(raw, this.now()) : createDefaultSave(this.now());
    this._write();
    return this.data;
  }

  /**
   * Persists the current state. Every gameplay mutation funnels through here:
   * it bumps `meta.updatedAt`, flags the document dirty for the SyncManager and
   * notifies listeners (HUDs refresh their currency labels from this event).
   */
  save(reason = 'update') {
    if (!this.data) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    const now = this.now();
    this.data.meta.updatedAt = now;
    this.data.meta.isDirty = true;
    this.data.profile.lastOnlineTimestamp = now;
    this._write();
    this.bus?.emit(EVENTS.SAVE_CHANGED, { reason, data: this.data });
  }

  /** Debounced save for high-frequency, non-critical updates (quest ticks). */
  saveSoon(reason = 'deferred', delayMs = 1000) {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.save(reason);
    }, delayMs);
  }

  /** Flushes a pending debounced save immediately (called on app pause). */
  flush() {
    if (this._saveTimer) this.save('flush');
  }

  /** Runs `fn(data)` and saves. Use for multi-field atomic updates. */
  mutate(fn, reason = 'mutate') {
    const result = fn(this.data);
    this.save(reason);
    return result;
  }

  _write() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[SaveManager] could not persist save (kept in memory)', err);
    }
  }

  // ------------------------------------------------------------------ currencies

  getCurrency(type) {
    return this.data.currencies[type] ?? 0;
  }

  addCurrency(type, amount, reason = `add:${type}`) {
    if (!(type in this.data.currencies) || !Number.isFinite(amount)) return;
    this.data.currencies[type] = Math.max(0, Math.floor(this.data.currencies[type] + amount));
    this.save(reason);
  }

  /** Atomically spends currency. Returns false (and changes nothing) if short. */
  spendCurrency(type, amount, reason = `spend:${type}`) {
    if ((this.data.currencies[type] ?? 0) < amount) return false;
    this.data.currencies[type] -= amount;
    this.save(reason);
    return true;
  }

  // ------------------------------------------------------------------ inventory

  hasItem(id) {
    return this.data.inventory.some((entry) => entry.id === id);
  }

  /** Adds an item to the collection. Returns true if it was new. Does NOT save. */
  unlockItem(id) {
    if (!CATALOG[id] || this.hasItem(id)) return false;
    this.data.inventory.push({ id, type: CATALOG[id].type, unlockedAt: this.now() });
    return true;
  }

  /** Number of unique dolls (base + secret) owned - drives the idle multiplier. */
  uniqueDollCount() {
    return this.data.inventory.filter((e) => CATALOG[e.id]?.slot === 'doll').length;
  }

  /**
   * Equips an owned item into its slot (or clears an accessory slot when
   * `id` is null). Dolls can never be unequipped, only swapped.
   */
  equip(slot, id) {
    const key = SLOTS[slot];
    if (!key) return false;
    if (id === null) {
      if (slot === 'doll') return false;
      this.data.equipped[key] = null;
    } else {
      if (!this.hasItem(id) || CATALOG[id].slot !== slot) return false;
      this.data.equipped[key] = id;
    }
    this.save('equip');
    this.bus?.emit(EVENTS.ITEM_EQUIPPED, { slot, id });
    return true;
  }

  /** Flat list of equipped item ids (no nulls). */
  equippedIds() {
    return Object.values(this.data.equipped).filter(Boolean);
  }

  // ------------------------------------------------------------------ runs

  /**
   * Commits a finished run: stats, payouts and a local top-10 history used by
   * the offline leaderboard. Returns `{ isHighScore }`.
   */
  recordRun({ distance, coins, tickets = 0, score: runScore }) {
    const d = this.data;
    const meters = Math.floor(distance);
    // highScore is the best run SCORE (distance x multiplier); defaults to metres.
    const score = Math.floor(runScore ?? distance);
    const isHighScore = score > d.stats.highScore;
    d.stats.totalRuns += 1;
    d.stats.totalDistance += meters;
    d.stats.bestDistance = Math.max(d.stats.bestDistance || 0, meters);
    d.stats.coinsCollectedTotal += coins;
    if (isHighScore) d.stats.highScore = score;
    d.currencies.popCoins += coins;
    d.currencies.blindBoxTickets += tickets;
    d.runHistory.push({ score, coins, doll: d.equipped.baseDoll, at: this.now() });
    d.runHistory.sort((a, b) => b.score - a.score);
    d.runHistory.length = Math.min(d.runHistory.length, 10);
    this.save('run');
    return { isHighScore, score };
  }

  // ------------------------------------------------------------------ sync hooks

  /** Called by SyncManager after a successful upload; does NOT bump updatedAt. */
  markSynced(at = this.now(), submittedScore) {
    this.data.meta.isDirty = false;
    this.data.meta.lastSyncedAt = at;
    if (submittedScore !== undefined) this.data.meta.lastSubmittedScore = submittedScore;
    this._write();
  }

  /** Replaces the whole document with a (newer) cloud copy. */
  replaceWith(newData) {
    this.data = migrateSave(newData, this.now());
    this._write();
    this.bus?.emit(EVENTS.SAVE_REPLACED, { data: this.data });
    this.bus?.emit(EVENTS.SAVE_CHANGED, { reason: 'cloud', data: this.data });
  }

  /** Stamps "last seen" without marking the doc dirty (app going to background). */
  touchOnline() {
    if (!this.data) return;
    this.data.profile.lastOnlineTimestamp = this.now();
    this._write();
  }

  /** Wipes progress (settings menu / debugging). */
  reset() {
    this.data = createDefaultSave(this.now());
    this._write();
    this.bus?.emit(EVENTS.SAVE_REPLACED, { data: this.data });
  }
}
