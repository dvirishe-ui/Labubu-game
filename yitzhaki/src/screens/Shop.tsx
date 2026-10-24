import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { CharacterView } from '../components/CharacterView';
import { CoinPill, fmt, Price } from '../components/Coins';
import { EggCard } from '../components/Eggs';
import { Screen, TopBar } from '../components/ui';
import { EGGS, hasEgg } from '../lib/eggs';
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
  const hero = CHARACTERS[0];
  const starter = CHARACTERS[CHARACTERS.length - 1];
  const middle = CHARACTERS.slice(1, -1);

  const card = (id: string, wide: false | 'hero' | 'starter' = false) => {
    const c = CHARACTERS.find((x) => x.id === id)!;
    const owned = p.owned.includes(id);
    const tier = owned ? bestTier(p.skins, id) : 'classic';
    const shownSkin = owned ? (p.equipped.char === id ? p.equipped.skin : `${id}:${tier}`) : wide === 'hero' ? `${id}:legendary` : `${id}:classic`;
    const ownedSkins = owned ? skinsFor(id).filter((s) => s.tier === 'classic' || p.skins.includes(s.id)).length : 0;
    const info = (
      <>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: RARITY_COLOR[c.rarity] }}>
          {wide === 'starter' && !owned ? 'הדמות הראשונה שלך?' : c.rarity}
        </span>
        <span className={`block font-display leading-tight text-white ${wide ? 'text-3xl' : 'text-xl'}`}>{c.name}</span>
        {owned ? (
          <span className="text-xs text-ink-200">
            {ownedSkins}/{skinsFor(id).length} סקינים
          </span>
        ) : (
          <Price value={c.price} dim={p.coins < c.price} />
        )}
        {wide === 'hero' && <span className="mt-2 block text-sm text-ink-400">הדמות הכי יוקרתית בגג, עם סקין בלעדי: מלך הגג.</span>}
        {wide === 'starter' && !owned && <span className="mt-2 block text-sm text-ink-400">הכי נגישה בחנות — מטרה מצוינת להתחלה.</span>}
      </>
    );
    return (
      <button
        key={id}
        onClick={() => setOpen(id)}
        className={`frame frame-${owned ? tier : wide === 'hero' ? 'legendary' : 'classic'} group text-start transition active:scale-[.98] ${wide ? 'col-span-2' : ''}`}
        aria-label={`${c.name}${owned ? ' — באוסף' : ` — ${fmt(c.price)} מטבעות`}`}
      >
        <div className={`relative h-full bg-ink-900 ${wide ? 'grid grid-cols-[1fr_42%] items-end' : ''}`}>
          {wide && <div className="min-w-0 self-center p-4">{info}</div>}
          <div className="relative">
            <Avatar charId={id} skinId={shownSkin} fluid animated={!!wide || owned} locked={!owned && wide !== 'hero'} />
            {!owned && <span className="absolute left-2 top-2 text-xl drop-shadow" aria-hidden>🔒</span>}
          </div>
          {p.equipped.char === id && <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-ink-950">מצויד</span>}
          {!wide && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-8">{info}</div>}
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
        {card(hero.id, 'hero')}
        {middle.map((c) => card(c.id))}
        {card(starter.id, 'starter')}
      </div>
      <section className="mt-8" aria-labelledby="eggs-title">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="eggs-title" className="font-display text-2xl text-white">
            🥚 איסטר אגים
          </h2>
          <span className="text-sm text-ink-400">
            {EGGS.filter((e) => hasEgg(p, e.id)).length}/{EGGS.length}
          </span>
        </div>
        <p className="mb-3 text-sm text-ink-400">כל איסטר אג פותח כוח במסלול של יצחקי — בלעדיהם אין כוחות. קונים כל אחד לבד, לא משנה איזו דמות יש לך.</p>
        <div className="space-y-2">
          {EGGS.map((e) => (
            <EggCard key={e.id} egg={e} />
          ))}
        </div>
      </section>
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
