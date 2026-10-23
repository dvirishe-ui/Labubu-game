import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { CharacterView } from '../components/CharacterView';
import { CoinPill, fmt, Price } from '../components/Coins';
import { Screen, TopBar } from '../components/ui';
import { CHARACTERS, skinsFor, TIER_META, type Tier } from '../lib/characters';
import { nextGoal } from '../lib/economy';
import { useProfile } from '../lib/store';

const RARITY_COLOR: Record<string, string> = { מיתי: '#fff1a8', אגדי: '#a855f7', אפי: '#22d3ee', נדיר: '#9ca3af' };

export function bestTier(skins: string[], charId: string): Tier {
  const order: Tier[] = ['crown', 'gold', 'legendary', 'special'];
  return order.find((t) => skins.includes(`${charId}:${t}`)) ?? 'classic';
}

export default function Shop({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const [open, setOpen] = useState<string | null>(null);
  const goal = nextGoal(p);
  const [hero, ...rest] = CHARACTERS;

  const card = (id: string, big = false) => {
    const c = CHARACTERS.find((x) => x.id === id)!;
    const owned = p.owned.includes(id);
    const tier = owned ? bestTier(p.skins, id) : 'classic';
    const equippedSkin = p.equipped.char === id ? p.equipped.skin : `${id}:${tier}`;
    const ownedSkins = owned ? skinsFor(id).filter((s) => s.tier === 'classic' || p.skins.includes(s.id)).length : 0;
    return (
      <button
        key={id}
        onClick={() => setOpen(id)}
        className={`frame frame-${owned ? tier : 'classic'} group text-start transition active:scale-[.98] ${big ? 'col-span-2' : ''}`}
        aria-label={`${c.name}${owned ? ' — באוסף' : ` — ${fmt(c.price)} מטבעות`}`}
      >
        <div className={`relative bg-ink-900 ${big ? 'flex items-end' : ''}`}>
          <div className={big ? 'w-1/2' : ''}>
            <Avatar charId={id} skinId={owned ? equippedSkin : `${id}:classic`} size={big ? 200 : 170} animated={big || owned} locked={!owned} />
          </div>
          {!owned && <span className="absolute left-2 top-2 text-2xl" aria-hidden>🔒</span>}
          {p.equipped.char === id && <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-ink-950">מצויד</span>}
          <div className={`${big ? 'flex-1 p-4' : 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-8'}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: RARITY_COLOR[c.rarity] }}>
              {c.rarity}
            </span>
            <span className={`block font-display leading-tight text-white ${big ? 'text-3xl' : 'text-xl'}`}>{c.name}</span>
            {owned ? (
              <span className="text-xs text-ink-200">
                {ownedSkins}/{skinsFor(id).length} סקינים
              </span>
            ) : (
              <Price value={c.price} dim={p.coins < c.price} />
            )}
            {big && <span className="mt-2 block text-sm text-ink-400">הדמות הכי יוקרתית בגג. כולל סקין בלעדי: מלך הגג.</span>}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Screen>
      <TopBar onBack={onBack} title="חנות הגג" right={<CoinPill coins={p.coins} />} />
      {goal && (
        <section className="card mb-5 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-ink-200">
              🎯 המטרה הבאה: <b className="text-white">{goal.name}</b>
            </span>
            <Price value={goal.price} />
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-gradient-to-l from-amber-300 to-amber-500 transition-[width] duration-700" style={{ width: `${Math.min(100, (p.coins / goal.price) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-400">{p.coins >= goal.price ? 'יש לך מספיק — לכו על זה!' : `עוד ${fmt(goal.price - p.coins)} מטבעות`}</p>
        </section>
      )}
      <div className="grid grid-cols-2 gap-3">
        {card(hero.id, true)}
        {rest.map((c) => card(c.id))}
      </div>
      <section className="card mt-6 p-4 text-sm text-ink-400">
        <p className="mb-2 font-bold text-ink-200">דרגות סקינים</p>
        <div className="flex flex-wrap gap-2">
          {(['classic', 'special', 'legendary', 'gold', 'crown'] as Tier[]).map((t) => (
            <span key={t} className="chip" style={{ color: TIER_META[t].color, borderColor: TIER_META[t].color }}>
              {TIER_META[t].label}
            </span>
          ))}
        </div>
        <p className="mt-3">מטבעות הגג מרוויחים רק במשחק. אין רכישות בכסף אמיתי ואין קופסאות הפתעה.</p>
        <p className="mt-1">הדמויות הן איורים מקוריים בהשראת חברי הפאנל — לא תמונות ולא מוצר רשמי.</p>
      </section>
      {open && <CharacterView charId={open} onClose={() => setOpen(null)} />}
    </Screen>
  );
}
