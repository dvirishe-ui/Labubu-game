import { useState } from 'react';
import { charById, skinsFor, TIER_META, type SkinDef } from '../lib/characters';
import { buy, canBuy, equip } from '../lib/economy';
import { sfx } from '../lib/sound';
import { profileStore, useProfile } from '../lib/store';
import { Avatar } from './Avatar';
import { CoinIcon, fmt, Price } from './Coins';

/** Full-screen character viewer with skin previews, buying (with confirmation + reveal) and equipping. */
export function CharacterView({ charId, onClose }: { charId: string; onClose: () => void }) {
  const p = useProfile();
  const c = charById(charId)!;
  const skins = skinsFor(charId);
  const owned = p.owned.includes(charId);
  const [sel, setSel] = useState<SkinDef>(() => skins.find((s) => s.id === p.equipped.skin) ?? skins[0]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ skin: SkinDef; isChar: boolean } | null>(null);
  const meta = TIER_META[sel.tier];
  const skinOwned = owned && (sel.tier === 'classic' || p.skins.includes(sel.id));
  const buyTarget = owned ? sel.id : charId;
  const err = canBuy(p, buyTarget);
  // Price of what the buy button buys (the character first, then skins).
  const price = owned ? sel.price : c.price;
  // Price of the skin being looked at; the classic skin comes with the character.
  const skinPrice = (s: SkinDef) => (s.tier === 'classic' ? c.price : s.price);
  const equipped = p.equipped.skin === sel.id;

  const doBuy = () => {
    const r = profileStore.apply((x) => {
      const res = buy(x, buyTarget);
      return { profile: res.profile, events: res.events };
    });
    setConfirm(null);
    if (r.profile.coins !== p.coins) {
      sfx.win();
      setReveal({ skin: owned ? sel : skins[0], isChar: !owned });
      if (!owned) setSel(skins[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-950" role="dialog" aria-modal aria-label={c.name}>
      <div className="mx-auto flex min-h-fill max-w-xl flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-3 flex items-center justify-between">
          <button className="btn-ghost min-h-[44px] px-3 text-base" onClick={onClose}>
            → חזרה
          </button>
          <span className="inline-flex items-center gap-1 font-display text-lg text-amber-300">
            <CoinIcon /> {fmt(p.coins)}
          </span>
        </div>

        <div className="text-center">
          <span className="chip border-ink-600 text-xs" style={{ color: meta.color, borderColor: meta.color }}>
            {c.rarity} · {meta.label}
          </span>
          <h2 className="mt-2 font-display text-4xl text-white">{c.name}</h2>
          <p className="text-ink-400">{sel.name}</p>
        </div>

        <div className={`frame frame-${sel.tier} mx-auto my-4 w-full max-w-[300px] animate-pop`} key={sel.id} style={{ boxShadow: `0 20px 60px ${meta.glow}` }}>
          <div>
            <Avatar charId={charId} skinId={sel.id} size={294} locked={!owned} />
          </div>
        </div>

        <div className="mb-4 flex justify-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="סקינים">
          {skins.map((s) => {
            const have = owned && (s.tier === 'classic' || p.skins.includes(s.id));
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={sel.id === s.id}
                onClick={() => (sfx.tap(), setSel(s))}
                className={`flex w-[64px] shrink-0 flex-col items-center gap-1 transition ${sel.id === s.id ? 'scale-105' : 'opacity-75'}`}
                title={`${s.name} · ${TIER_META[s.tier].label}`}
                aria-label={`סקין ${TIER_META[s.tier].label}: ${s.name}${have ? '' : ` — ${fmt(skinPrice(s))} מטבעות`}`}
              >
                <span className="relative block w-full overflow-hidden rounded-xl border-2" style={{ borderColor: sel.id === s.id ? TIER_META[s.tier].color : '#29252f' }}>
                  <Avatar charId={charId} skinId={s.id} size={60} animated={false} />
                  {!have && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[10px] text-ink-200">🔒</span>}
                </span>
                <span className="text-[11px] font-bold leading-none" style={{ color: TIER_META[s.tier].color }}>
                  {TIER_META[s.tier].label}
                </span>
                <span className="text-[11px] tabular-nums leading-none text-ink-200">{have ? '✓' : fmt(skinPrice(s))}</span>
              </button>
            );
          })}
        </div>

        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="font-bold" style={{ color: meta.color }}>
              {meta.label}
            </span>
            {skinOwned ? <span className="text-sm text-ink-400">באוסף שלך</span> : <Price value={skinPrice(sel)} dim={err === 'coins'} />}
          </div>
          {skinOwned ? (
            <button
              className={equipped ? 'btn-ghost w-full' : 'btn-amber w-full text-xl'}
              disabled={equipped}
              onClick={() => {
                sfx.lock();
                profileStore.update((x) => equip(x, sel.id));
              }}
            >
              {equipped ? 'מצויד ✓' : 'לצייד'}
            </button>
          ) : err === 'locked' ? (
            <p className="text-center text-sm text-ink-400">כדי לקנות סקין צריך קודם את {c.name}.</p>
          ) : (
            <>
              {!owned && sel.tier !== 'classic' && (
                <p className="text-center text-sm text-ink-400">
                  קודם קונים את {c.name} ב־{fmt(c.price)} מטבעות, ואז אפשר לקנות את הסקין הזה.
                </p>
              )}
            <>
              <button className="btn-amber w-full text-xl" disabled={!!err} onClick={() => setConfirm(buyTarget)}>
                {owned ? 'לקנות סקין' : `לקנות את ${c.name}`}
              </button>
              {err === 'coins' && (
                <>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (p.coins / price) * 100)}%` }} />
                  </div>
                  <p className="text-center text-sm text-ink-400">עוד {fmt(price - p.coins)} מטבעות</p>
                  <button className="btn-ghost w-full text-base" onClick={() => profileStore.update((x) => ({ ...x, wish: buyTarget }))} disabled={p.wish === buyTarget}>
                    {p.wish === buyTarget ? '🎯 זאת המטרה שלך' : '🎯 לקבוע כמטרה'}
                  </button>
                </>
              )}
            </>
            </>
          )}
          {owned && (
            <button className="w-full text-sm text-ink-400 underline" onClick={() => profileStore.update((x) => ({ ...x, favorite: x.favorite === charId ? null : charId }))}>
              {p.favorite === charId ? '★ הדמות האהובה שלך' : '☆ לסמן כדמות אהובה'}
            </button>
          )}
          <p className="text-center text-xs text-ink-400">סקינים הם קוסמטיים בלבד — לא נותנים יתרון במשחק.</p>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setConfirm(null)}>
          <div className="card w-full max-w-sm space-y-4 p-5 text-center animate-rise" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-2xl text-white">{owned ? `${c.name} · ${sel.name}` : c.name}</p>
            <p className="flex items-center justify-center gap-2 text-ink-200">
              במחיר <Price value={price} />
            </p>
            <p className="text-sm text-ink-400">ישארו לך {fmt(p.coins - price)} מטבעות</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => setConfirm(null)}>
                ביטול
              </button>
              <button className="btn-amber" onClick={doBuy} autoFocus>
                קונים!
              </button>
            </div>
          </div>
        </div>
      )}

      {reveal && <Reveal charId={charId} skin={reveal.skin} isChar={reveal.isChar} onDone={(eq) => {
        if (eq) profileStore.update((x) => equip(x, reveal.skin.id));
        setReveal(null);
      }} />}
    </div>
  );
}

function Reveal({ charId, skin, isChar, onDone }: { charId: string; skin: SkinDef; isChar: boolean; onDone: (equip: boolean) => void }) {
  const c = charById(charId)!;
  const meta = TIER_META[skin.tier];
  return (
    <div className="fixed inset-0 z-[58] flex flex-col items-center justify-center gap-5 overflow-hidden bg-black/90 p-6 text-center" role="dialog" aria-modal aria-label="פתיחה חדשה">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 animate-burst" style={{ background: `repeating-conic-gradient(${meta.glow} 0 8deg, transparent 8deg 22deg)` }} />
      <p className="relative font-display text-xl tracking-widest" style={{ color: meta.color }}>
        {isChar ? 'דמות חדשה!' : `סקין ${meta.label}!`}
      </p>
      <div className={`frame frame-${skin.tier} relative w-[260px] animate-reveal-card`} style={{ boxShadow: `0 0 80px ${meta.glow}` }}>
        <div>
          <Avatar charId={charId} skinId={skin.id} size={254} />
        </div>
      </div>
      <p className="relative font-display text-3xl text-white">
        {c.name}
        {!isChar && <span className="block text-lg text-ink-200">{skin.name}</span>}
      </p>
      <p className="relative text-ink-200">{isChar ? 'הצטרף/ה לאוסף שלך' : 'נוסף לאוסף שלך'}</p>
      <div className="relative grid w-full max-w-xs grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={() => onDone(false)}>
          אחר כך
        </button>
        <button className="btn-amber" onClick={() => onDone(true)} autoFocus>
          לצייד עכשיו
        </button>
      </div>
    </div>
  );
}
