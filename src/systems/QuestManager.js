/**
 * QuestManager.js
 * Event-driven mission engine.
 *
 * - Listens on the shared EventBus for EVENT_DISTANCE_TICK, EVENT_COIN_COLLECTED,
 *   EVENT_BOX_OPENED, EVENT_OBSTACLE_DODGED (and a few extras) and advances any
 *   active quest whose template subscribes to that event.
 * - Daily quests refresh when `lastRefreshDate !== today`; weekly quests when the
 *   ISO week key changes. Completed-but-unclaimed quests are moved into an
 *   inbox so a reset never eats a reward the player already earned.
 * - Quest selection is seeded by (date, playerId) so the daily set is stable for
 *   the whole day even across reinstalls / cloud restores.
 */
import { EVENTS } from '../config/GameConfig.js';
import { RARITY_TIERS } from '../config/GachaDropTable.js';
import { QUEST_TEMPLATES, DAILY_QUEST_COUNT, WEEKLY_QUEST_COUNT, getQuestTemplate } from '../config/QuestCatalog.js';

/** Local calendar date "YYYY-MM-DD" (local time so resets happen at the player's midnight). */
export function toDateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO-8601 week key, e.g. "2026-W42". */
export function toWeekKey(ts = Date.now()) {
  const d = new Date(ts);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Milliseconds until the next local midnight (for the "resets in" label). */
export function msUntilMidnight(ts = Date.now()) {
  const d = new Date(ts);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next.getTime() - ts;
}

/** Small deterministic PRNG (mulberry32) + string hash for seeded quest picks. */
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher-Yates pick of `count` templates for a scope. */
export function pickQuests(scope, count, seedKey) {
  const rng = mulberry32(hashString(seedKey));
  const pool = QUEST_TEMPLATES.filter((t) => t.scope === scope);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map((t) => ({
    id: t.id,
    scope,
    progress: 0,
    target: t.target,
    claimed: false,
    completedAt: null,
    reward: { ...t.reward }
  }));
}

/** Events the manager subscribes to. */
const TRACKED_EVENTS = [
  EVENTS.DISTANCE_TICK,
  EVENTS.COIN_COLLECTED,
  EVENTS.BOX_OPENED,
  EVENTS.OBSTACLE_DODGED,
  EVENTS.RUN_ENDED,
  EVENTS.TICKET_COLLECTED
];

export class QuestManager {
  /**
   * @param {import('./SaveManager.js').SaveManager} saveManager
   * @param {import('./EventBus.js').EventBus} bus
   * @param {() => number} [now]
   */
  constructor(saveManager, bus, now = () => Date.now()) {
    this.save = saveManager;
    this.bus = bus;
    this.now = now;
    this._handlers = [];
  }

  /** Subscribes to gameplay events and runs the daily/weekly reset check. */
  start() {
    this.stop();
    for (const event of TRACKED_EVENTS) {
      const handler = (payload) => this.handleEvent(event, payload || {});
      this.bus.on(event, handler, this);
      this._handlers.push([event, handler]);
    }
    this.refreshIfNeeded();
  }

  stop() {
    for (const [event, handler] of this._handlers) this.bus.off(event, handler, this);
    this._handlers = [];
  }

  get state() {
    return this.save.data.quests;
  }

  /** All quests currently on the board (daily first). */
  allActive() {
    return [...this.state.activeQuests, ...this.state.weeklyQuests];
  }

  /**
   * Date-check routine: rolls daily/weekly boards when the period changed,
   * moving completed-but-unclaimed rewards to the inbox. Returns true if
   * anything was reset. Safe to call often (menu open, app resume).
   */
  refreshIfNeeded() {
    const q = this.state;
    const now = this.now();
    const today = toDateKey(now);
    const week = toWeekKey(now);
    const pid = this.save.data.profile.playerId;
    let changed = false;

    if (q.lastRefreshDate !== today) {
      this._archiveUnclaimed(q.activeQuests);
      q.activeQuests = pickQuests('daily', DAILY_QUEST_COUNT, `${today}|${pid}`);
      q.lastRefreshDate = today;
      changed = true;
    }
    if (q.weeklyRefreshKey !== week) {
      this._archiveUnclaimed(q.weeklyQuests);
      q.weeklyQuests = pickQuests('weekly', WEEKLY_QUEST_COUNT, `${week}|${pid}`);
      q.weeklyRefreshKey = week;
      changed = true;
    }
    if (changed) this.save.save('quest_refresh');
    return changed;
  }

  _archiveUnclaimed(quests = []) {
    for (const quest of quests) {
      if (quest.progress >= quest.target && !quest.claimed) {
        this.state.inbox.push({
          id: quest.id,
          title: getQuestTemplate(quest.id)?.title || quest.id,
          reward: { ...quest.reward },
          archivedAt: this.now()
        });
      }
    }
  }

  /** Core progress routine - invoked for every tracked bus event. */
  handleEvent(event, payload) {
    // A run can straddle midnight; make sure progress lands on the right board.
    this.refreshIfNeeded();
    let progressed = false;
    let completedAny = false;

    for (const quest of this.allActive()) {
      const tpl = getQuestTemplate(quest.id);
      if (!tpl || tpl.event !== event || quest.claimed || quest.progress >= quest.target) continue;
      if (!this._passesFilter(tpl, payload)) continue;

      const before = quest.progress;
      if (tpl.mode === 'count') quest.progress += 1;
      else if (tpl.mode === 'sum') quest.progress += Number(payload[tpl.field]) || 0;
      else if (tpl.mode === 'max') quest.progress = Math.max(quest.progress, Number(payload[tpl.field]) || 0);
      quest.progress = Math.min(quest.target, Math.floor(quest.progress));

      if (quest.progress !== before) progressed = true;
      if (quest.progress >= quest.target && !quest.completedAt) {
        quest.completedAt = this.now();
        completedAny = true;
        this.bus.emit(EVENTS.QUEST_COMPLETED, { quest, title: tpl.title });
      }
    }

    // Completions are critical -> save now. Ticks are batched to spare storage I/O.
    if (completedAny) this.save.save('quest_complete');
    else if (progressed) this.save.saveSoon('quest_progress');
  }

  _passesFilter(tpl, payload) {
    if (!tpl.filter) return true;
    if (tpl.filter.minRarityRank !== undefined) {
      const rank = RARITY_TIERS[payload.rarity]?.rank ?? -1;
      if (rank < tpl.filter.minRarityRank) return false;
    }
    return true;
  }

  /** Grants the reward of a completed quest. Returns the reward or null. */
  claim(questId) {
    const quest = this.allActive().find((q) => q.id === questId);
    if (!quest || quest.claimed || quest.progress < quest.target) return null;
    quest.claimed = true;
    this._grant(quest.reward);
    this.save.save('quest_claim');
    return quest.reward;
  }

  /** Claims every reward waiting in the inbox. Returns the list of rewards. */
  claimInbox() {
    const rewards = this.state.inbox.map((entry) => entry.reward);
    if (!rewards.length) return [];
    rewards.forEach((r) => this._grant(r));
    this.state.inbox = [];
    this.save.save('inbox_claim');
    return rewards;
  }

  _grant(reward) {
    const c = this.save.data.currencies;
    if (reward && reward.type in c) c[reward.type] += reward.amount;
  }

  /** Number of rewards ready to collect (menu badge). */
  claimableCount() {
    return this.allActive().filter((q) => q.progress >= q.target && !q.claimed).length + this.state.inbox.length;
  }
}
