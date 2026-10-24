import { describe, expect, it } from 'vitest';
import { CHARACTERS, CROWN_SKIN, skinsFor } from '../src/lib/characters';
import { buy, CAPS, canBuy, equip, finishDaily, finishGame, nextGoal, recordAnswer, REWARDS, soloCoins, WEEKLY_GOALS } from '../src/lib/economy';
import { levelOf, newProfile, normalizeProfile, WELCOME_COINS } from '../src/lib/profile';
import { dayKey, weekDays, weekKey } from '../src/lib/time';

const T0 = Date.UTC(2026, 9, 20, 9); // a Tuesday morning in Israel
const game = (id: string, over = {}) => ({ sessionId: id, answered: 10, durationMs: 5 * 60_000, won: false, perfect: false, ...over });

describe('roster', () => {
  it('has exactly the eight approved characters with Assaf most expensive', () => {
    expect(CHARACTERS.map((c) => c.name)).toEqual(['אסף יצחקי', 'יונתן ברק', 'חן מזרחי', 'מתן פרץ', 'נועם אונגר', 'דור יתח', 'טל ראשון', 'צח רוקח']);
    expect(CHARACTERS.map((c) => c.price)).toEqual([20000, 12500, 10500, 10000, 9000, 7500, 7000, 5000]);
    const max = Math.max(...CHARACTERS.map((c) => c.price));
    expect(CHARACTERS.find((c) => c.price === max)!.id).toBe('assaf');
  });
  it('every character has four tiers, each pricier than the last, and no two prices repeat', () => {
    for (const c of CHARACTERS) {
      const s = skinsFor(c.id);
      expect(s.map((x) => x.tier).slice(0, 4)).toEqual(['classic', 'special', 'legendary', 'gold']);
      expect(s[0].price).toBe(0);
      expect(s[1].price).toBeGreaterThan(c.price);
      expect(s[2].price).toBeGreaterThan(s[1].price);
      expect(s[3].price).toBeGreaterThan(s[2].price);
    }
    const prices = [...CHARACTERS.map((c) => c.price), ...CHARACTERS.flatMap((c) => skinsFor(c.id).filter((x) => x.price > 0).map((x) => x.price))];
    expect(new Set(prices).size).toBe(prices.length);
    expect(skinsFor('assaf').at(-1)).toMatchObject({ id: CROWN_SKIN.id, price: 40000 });
    expect(skinsFor('tzach').some((s) => s.tier === 'crown')).toBe(false);
  });
});

describe('earning', () => {
  it('pays a game once, with win and perfect bonuses', () => {
    let p = newProfile(T0);
    const r = finishGame(p, game('s1', { won: true, perfect: true }), T0);
    p = r.profile;
    expect(p.coins).toBe(WELCOME_COINS + REWARDS.gameComplete + REWARDS.gameWin + REWARDS.perfectGame + 100 /* first-game achievement */ + 0);
    const again = finishGame(p, game('s1', { won: true }), T0);
    expect(again.profile.coins).toBe(p.coins);
  });

  it('ignores games that are too short and caps rewarded games per day', () => {
    let p = newProfile(T0);
    p = finishGame(p, game('short', { answered: 2 }), T0).profile;
    expect(p.coins).toBe(WELCOME_COINS + 100); // only the first-game achievement
    const start = p.coins;
    for (let i = 0; i < CAPS.gameRewardsPerDay + 5; i++) p = finishGame(p, game('g' + i), T0).profile;
    const earnedFromGames = p.coins - start - [...Object.keys(p.achievements)].length * 0;
    expect(earnedFromGames).toBeLessThanOrEqual(CAPS.gameRewardsPerDay * REWARDS.gameComplete + 50 * 5 /* possible level-ups */ );
    // next day the cap resets
    const next = finishGame(p, game('tomorrow'), T0 + 86400000);
    expect(next.events.some((e) => e.type === 'coins' && e.amount === REWARDS.gameComplete)).toBe(true);
  });

  it('solo coins stop at the daily ceiling', () => {
    let p = newProfile(T0);
    for (let i = 0; i < 200; i++) p = soloCoins(p, 'r' + i, REWARDS.soloPerCorrect, 'x', T0).profile;
    expect(p.day.soloCoins).toBe(CAPS.soloCoinsPerDay);
  });

  it('daily challenge pays once per day', () => {
    let p = newProfile(T0);
    const d = dayKey(T0);
    p = finishDaily(p, d, 900, 10, 10, T0).profile;
    const coins = p.coins;
    expect(finishDaily(p, d, 1000, 10, 10, T0).profile.coins).toBe(coins);
    expect(p.achievements['first-daily']).toBeTruthy();
    expect(p.achievements['daily-perfect']).toBeTruthy();
  });

  it('weekly challenge pays 500 when all goals are met', () => {
    let p = newProfile(T0);
    for (let i = 0; i < WEEKLY_GOALS[0].target; i++) p = recordAnswer(p, 'q' + i, 'real', true, T0).profile;
    for (let i = 0; i < 5; i++) p = finishGame(p, game('w' + i), T0).profile;
    for (let i = 0; i < 3; i++) p = finishDaily(p, `2026-10-2${i}`, 100, 5, 10, T0).profile;
    expect(p.claimed[`weekly:${weekKey(T0)}`]).toBeTruthy();
  });

  it('streak achievement and first answer is kept for crowd stats', () => {
    let p = newProfile(T0);
    for (let i = 0; i < 10; i++) p = recordAnswer(p, 'q' + i, 'fake', true, T0).profile;
    expect(p.achievements['streak-10']).toBeTruthy();
    p = recordAnswer(p, 'q0', 'real', false, T0).profile;
    expect(p.answered.q0).toBe('fake');
    expect(p.stats.streak).toBe(0);
  });
});

describe('shop', () => {
  const rich = () => ({ ...newProfile(T0), coins: 200_000 });

  it('cannot buy without coins, buys and auto-equips the first character', () => {
    expect(canBuy(newProfile(T0), 'tzach')).toBe('coins');
    const r = buy(rich(), 'tzach');
    expect(r.error).toBeNull();
    expect(r.profile.coins).toBe(200_000 - 5000);
    expect(r.profile.owned).toEqual(['tzach']);
    expect(r.profile.equipped).toEqual({ char: 'tzach', skin: 'tzach:classic' });
    expect(buy(r.profile, 'tzach').error).toBe('owned');
  });

  it('skins need the character; crown needs Assaf; equip validates ownership', () => {
    let p = rich();
    expect(canBuy(p, 'assaf:gold')).toBe('locked');
    expect(canBuy(p, CROWN_SKIN.id)).toBe('locked');
    p = buy(p, 'assaf').profile;
    p = buy(p, CROWN_SKIN.id).profile;
    expect(p.achievements['roof-legend']).toBeTruthy();
    expect(equip(p, 'tzach:gold')).toBe(p);
    expect(equip(p, CROWN_SKIN.id).equipped).toEqual({ char: 'assaf', skin: CROWN_SKIN.id });
  });

  it('collector achievements and next goal', () => {
    let p = rich();
    expect(nextGoal(p)!.id).toBe('tzach');
    for (const c of CHARACTERS) p = buy(p, c.id).profile;
    expect(p.achievements['collector-3']).toBeTruthy();
    expect(p.achievements['full-panel']).toBeTruthy();
    expect(nextGoal(p)).toBeNull();
  });

  it('tampered storage is normalized', () => {
    const p = normalizeProfile({ coins: -50, owned: ['assaf', 'someone-else'], skins: ['x:gold'] });
    expect(p.coins).toBe(0);
    expect(p.owned).toEqual(['assaf']);
    expect(p.skins).toEqual([]);
  });
});

describe('levels and calendar', () => {
  it('levels grow', () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(120).level).toBe(2);
    expect(levelOf(359).level).toBe(2);
    expect(levelOf(360).level).toBe(3);
  });
  it('week has seven days starting Monday', () => {
    const days = weekDays(T0);
    expect(days).toHaveLength(7);
    expect(days).toContain(dayKey(T0));
    expect(new Date(days[0] + 'T12:00:00Z').getUTCDay()).toBe(1);
  });
});

describe('secret character', () => {
  it('cannot be bought, unlocks once from the mini-game, and can be equipped', async () => {
    const { SECRET_CHARACTER, SECRET_SKIN, CHARACTERS: roster } = await import('../src/lib/characters');
    const { unlockSecret, rosterOwned } = await import('../src/lib/economy');
    let p = { ...newProfile(T0), coins: 1_000_000 };
    expect(roster.some((c) => c.id === SECRET_CHARACTER.id)).toBe(false);
    expect(buy(p, SECRET_CHARACTER.id).error).toBe('locked');
    expect(buy(p, SECRET_SKIN.id).error).toBe('locked');
    const r = unlockSecret(p);
    p = r.profile;
    expect(p.owned).toContain(SECRET_CHARACTER.id);
    expect(p.achievements['time-travel']).toBeTruthy();
    expect(rosterOwned(p)).toHaveLength(0);
    expect(p.achievements['collector-3']).toBeFalsy();
    expect(unlockSecret(p).profile).toBe(p);
    expect(equip(p, SECRET_SKIN.id).equipped).toEqual({ char: SECRET_CHARACTER.id, skin: SECRET_SKIN.id });
    expect(normalizeProfile(p).owned).toContain(SECRET_CHARACTER.id);
  });
});
