import { describe, it, expect } from 'vitest';
import { QuestManager, toDateKey, toWeekKey } from '../src/systems/QuestManager.js';
import { EVENTS } from '../src/config/GameConfig.js';
import { makeSave } from './helpers.js';

function setup() {
  const ctx = makeSave();
  const qm = new QuestManager(ctx.save, ctx.bus, () => ctx.clock.t);
  qm.start();
  return { ...ctx, qm };
}

/** Replaces the daily board with specific quests for deterministic tests. */
function forceDaily(qm, ...quests) {
  qm.state.activeQuests = quests.map(([id, target, reward]) => ({ id, scope: 'daily', progress: 0, target, claimed: false, completedAt: null, reward }));
}

describe('QuestManager', () => {
  it('creates a daily and weekly board on first start', () => {
    const { qm, clock } = setup();
    expect(qm.state.activeQuests).toHaveLength(3);
    expect(qm.state.weeklyQuests).toHaveLength(2);
    expect(qm.state.lastRefreshDate).toBe(toDateKey(clock.t));
    expect(qm.state.weeklyRefreshKey).toBe(toWeekKey(clock.t));
  });

  it('advances sum / count / max quests from bus events', () => {
    const { qm, bus } = setup();
    forceDaily(
      qm,
      ['run_1000m', 1000, { type: 'popCoins', amount: 200 }],
      ['open_2_boxes', 2, { type: 'blindBoxTickets', amount: 1 }],
      ['collect_50_coins_one_run', 50, { type: 'popCoins', amount: 100 }]
    );
    for (let i = 0; i < 45; i++) bus.emit(EVENTS.DISTANCE_TICK, { meters: 10, runDistance: (i + 1) * 10 });
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'common' });
    bus.emit(EVENTS.COIN_COLLECTED, { amount: 1, runCoins: 30 });
    bus.emit(EVENTS.COIN_COLLECTED, { amount: 1, runCoins: 12 }); // a new, worse run
    const [run, boxes, coins] = qm.state.activeQuests;
    expect(run.progress).toBe(450);
    expect(boxes.progress).toBe(1);
    expect(coins.progress).toBe(30);
  });

  it('emits QUEST_COMPLETED once and allows a single claim', () => {
    const { qm, bus, save } = setup();
    forceDaily(qm, ['open_2_boxes', 2, { type: 'blindBoxTickets', amount: 1 }]);
    const completed = [];
    bus.on(EVENTS.QUEST_COMPLETED, (e) => completed.push(e.quest.id));
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'rare' });
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'rare' });
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'rare' });
    expect(completed).toEqual(['open_2_boxes']);
    const tickets = save.data.currencies.blindBoxTickets;
    expect(qm.claim('open_2_boxes')).toEqual({ type: 'blindBoxTickets', amount: 1 });
    expect(qm.claim('open_2_boxes')).toBeNull();
    expect(save.data.currencies.blindBoxTickets).toBe(tickets + 1);
  });

  it('respects rarity filters', () => {
    const { qm, bus } = setup();
    forceDaily(qm, ['pull_rare_or_better', 1, { type: 'popCoins', amount: 120 }]);
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'common' });
    expect(qm.state.activeQuests[0].progress).toBe(0);
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'epic' });
    expect(qm.state.activeQuests[0].progress).toBe(1);
  });

  it('daily reset moves completed-but-unclaimed rewards into the inbox', () => {
    const { qm, bus, clock, save } = setup();
    forceDaily(
      qm,
      ['open_2_boxes', 2, { type: 'blindBoxTickets', amount: 1 }],
      ['run_1000m', 1000, { type: 'popCoins', amount: 200 }]
    );
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'common' });
    bus.emit(EVENTS.BOX_OPENED, { rarity: 'common' });
    bus.emit(EVENTS.DISTANCE_TICK, { meters: 10, runDistance: 10 }); // unfinished -> dropped

    clock.t += 24 * 3600 * 1000;
    expect(qm.refreshIfNeeded()).toBe(true);
    expect(qm.state.inbox).toHaveLength(1);
    expect(qm.state.inbox[0].reward).toEqual({ type: 'blindBoxTickets', amount: 1 });
    expect(qm.state.activeQuests.every((q) => q.progress === 0)).toBe(true);

    const tickets = save.data.currencies.blindBoxTickets;
    qm.claimInbox();
    expect(save.data.currencies.blindBoxTickets).toBe(tickets + 1);
    expect(qm.state.inbox).toHaveLength(0);
  });

  it('keeps the same board for the whole day', () => {
    const { qm, clock } = setup();
    const ids = qm.state.activeQuests.map((q) => q.id);
    clock.t += 3600 * 1000;
    expect(qm.refreshIfNeeded()).toBe(false);
    expect(qm.state.activeQuests.map((q) => q.id)).toEqual(ids);
  });
});
