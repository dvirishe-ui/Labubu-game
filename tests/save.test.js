import { describe, it, expect } from 'vitest';
import { migrateSave, createDefaultSave } from '../src/systems/SaveManager.js';
import { STORAGE_KEY, ECONOMY } from '../src/config/GameConfig.js';
import { computePerks } from '../src/systems/PerkCalculator.js';
import { makeSave, memoryStorage } from './helpers.js';
import { SaveManager } from '../src/systems/SaveManager.js';

describe('SaveManager', () => {
  it('creates the documented schema for new players', () => {
    const d = createDefaultSave(1);
    expect(Object.keys(d)).toEqual(expect.arrayContaining(['profile', 'currencies', 'equipped', 'inventory', 'stats', 'quests', 'pity', 'shop']));
    expect(d.profile.playerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.equipped.baseDoll).toBe('labubu_classic');
  });

  it('persists to storage on every save and marks the doc dirty', () => {
    const storage = memoryStorage();
    const s = new SaveManager({ storage });
    s.load();
    s.markSynced();
    s.addCurrency('popCoins', 5);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(stored.currencies.popCoins).toBe(s.data.currencies.popCoins);
    expect(stored.meta.isDirty).toBe(true);
  });

  it('recovers from a corrupt save', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const s = new SaveManager({ storage });
    expect(s.load().inventory[0].id).toBe('labubu_classic');
  });

  it('migration drops unknown items, fixes bad equips and negative currencies', () => {
    const d = migrateSave({
      inventory: [{ id: 'nope' }, { id: 'raincoat', unlockedAt: 1 }, { id: 'raincoat', unlockedAt: 2 }],
      equipped: { baseDoll: 'zimomo_king', outfit: 'raincoat', headwear: 'beanie' },
      currencies: { popCoins: -50, blindBoxTickets: '3', goldenKeys: NaN }
    });
    expect(d.inventory.map((e) => e.id).sort()).toEqual(['labubu_classic', 'raincoat']);
    expect(d.equipped).toMatchObject({ baseDoll: 'labubu_classic', outfit: 'raincoat', headwear: null });
    expect(d.currencies).toEqual({ popCoins: 0, gems: ECONOMY.STARTING_GEMS, blindBoxTickets: 3, goldenKeys: 0 });
  });

  it('equip only accepts owned items in the right slot', () => {
    const { save } = makeSave();
    expect(save.equip('tail', 'beaver_paddle_tail')).toBe(false);
    save.unlockItem('beaver_paddle_tail');
    expect(save.equip('outfit', 'beaver_paddle_tail')).toBe(false);
    expect(save.equip('tail', 'beaver_paddle_tail')).toBe(true);
    expect(save.equip('doll', null)).toBe(false);
  });
});

describe('PerkCalculator', () => {
  it('applies the costume perks from the design doc', () => {
    const p = computePerks({ baseDoll: 'beaver_labubu_secret', outfit: 'lumberjack_vest', tail: 'beaver_paddle_tail' });
    expect(p.doubleJump).toBe(true);
    expect(p.maxJumps).toBe(3);
    expect(p.floatyFall).toBe(true);
    expect(p.attractRadius).toBeCloseTo(1.2 + 3);
    expect(p.shieldCharges).toBe(1);
    expect(p.coinMultiplier).toBeCloseTo(1);
    expect(p.skinMultiplier).toBe(2); // Mystery skin
  });

  it('gives rarer skins a bigger run multiplier', () => {
    expect(computePerks({ baseDoll: 'labubu_classic' }).skinMultiplier).toBe(1);
    expect(computePerks({ baseDoll: 'golden_labubu' }).skinMultiplier).toBe(1.5);
    expect(computePerks({ baseDoll: 'pirate_captain' }).skinMultiplier).toBe(1.3);
  });
});
