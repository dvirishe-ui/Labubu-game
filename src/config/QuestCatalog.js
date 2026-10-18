/**
 * QuestCatalog.js
 * Daily and weekly mission templates. QuestManager instantiates a few of these
 * every day/week and advances them by listening to gameplay events.
 *
 * Progress modes:
 *  - 'sum'   : progress += payload[field]          (e.g. meters across all runs)
 *  - 'count' : progress += 1 per matching event    (e.g. boxes opened)
 *  - 'max'   : progress = max(progress, payload[field]) (best single-run value)
 */
import { EVENTS } from './GameConfig.js';

export const DAILY_QUEST_COUNT = 3;
export const WEEKLY_QUEST_COUNT = 2;

export const QUEST_TEMPLATES = [
  // ------------------------------------------------------------------ daily
  {
    id: 'run_1000m',
    scope: 'daily',
    title: 'Run 1,000 m in total',
    event: EVENTS.DISTANCE_TICK,
    mode: 'sum',
    field: 'meters',
    target: 1000,
    reward: { type: 'popCoins', amount: 200 }
  },
  {
    id: 'reach_500m_one_run',
    scope: 'daily',
    title: 'Reach 500 m in a single run',
    event: EVENTS.DISTANCE_TICK,
    mode: 'max',
    field: 'runDistance',
    target: 500,
    reward: { type: 'popCoins', amount: 150 }
  },
  {
    id: 'collect_50_coins_one_run',
    scope: 'daily',
    title: 'Collect 50 coins in one run',
    event: EVENTS.COIN_COLLECTED,
    mode: 'max',
    field: 'runCoins',
    target: 50,
    reward: { type: 'popCoins', amount: 100 }
  },
  {
    id: 'collect_200_coins',
    scope: 'daily',
    title: 'Collect 200 coins in total',
    event: EVENTS.COIN_COLLECTED,
    mode: 'sum',
    field: 'amount',
    target: 200,
    reward: { type: 'popCoins', amount: 150 }
  },
  {
    id: 'open_2_boxes',
    scope: 'daily',
    title: 'Open 2 blind boxes',
    event: EVENTS.BOX_OPENED,
    mode: 'count',
    target: 2,
    reward: { type: 'blindBoxTickets', amount: 1 }
  },
  {
    id: 'pull_rare_or_better',
    scope: 'daily',
    title: 'Unbox a Rare or better',
    event: EVENTS.BOX_OPENED,
    mode: 'count',
    filter: { minRarityRank: 1 },
    target: 1,
    reward: { type: 'popCoins', amount: 120 }
  },
  {
    id: 'dodge_30_obstacles',
    scope: 'daily',
    title: 'Dodge 30 obstacles',
    event: EVENTS.OBSTACLE_DODGED,
    mode: 'count',
    target: 30,
    reward: { type: 'popCoins', amount: 120 }
  },
  {
    id: 'play_3_runs',
    scope: 'daily',
    title: 'Finish 3 runs',
    event: EVENTS.RUN_ENDED,
    mode: 'count',
    target: 3,
    reward: { type: 'popCoins', amount: 100 }
  },
  {
    id: 'grab_a_ticket',
    scope: 'daily',
    title: 'Grab a ticket during a run',
    event: EVENTS.TICKET_COLLECTED,
    mode: 'count',
    target: 1,
    reward: { type: 'popCoins', amount: 80 }
  },

  // ------------------------------------------------------------------ weekly
  {
    id: 'weekly_run_10000m',
    scope: 'weekly',
    title: 'Run 10,000 m this week',
    event: EVENTS.DISTANCE_TICK,
    mode: 'sum',
    field: 'meters',
    target: 10000,
    reward: { type: 'goldenKeys', amount: 1 }
  },
  {
    id: 'weekly_open_10_boxes',
    scope: 'weekly',
    title: 'Open 10 blind boxes this week',
    event: EVENTS.BOX_OPENED,
    mode: 'count',
    target: 10,
    reward: { type: 'blindBoxTickets', amount: 2 }
  },
  {
    id: 'weekly_dodge_300',
    scope: 'weekly',
    title: 'Dodge 300 obstacles this week',
    event: EVENTS.OBSTACLE_DODGED,
    mode: 'count',
    target: 300,
    reward: { type: 'popCoins', amount: 500 }
  },
  {
    id: 'weekly_reach_2000m',
    scope: 'weekly',
    title: 'Reach 2,000 m in a single run',
    event: EVENTS.DISTANCE_TICK,
    mode: 'max',
    field: 'runDistance',
    target: 2000,
    reward: { type: 'goldenKeys', amount: 1 }
  }
];

export const getQuestTemplate = (id) => QUEST_TEMPLATES.find((q) => q.id === id) || null;

export const REWARD_LABELS = {
  popCoins: 'Pop Coins',
  blindBoxTickets: 'Ticket',
  goldenKeys: 'Golden Key'
};
