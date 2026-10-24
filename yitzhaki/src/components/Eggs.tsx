import { charById } from '../lib/characters';
import { buy, canBuy } from '../lib/economy';
import { DUO, type EggDef, hasEgg } from '../lib/eggs';
import { sfx } from '../lib/sound';
import { profileStore, useProfile } from '../lib/store';
import { fmt, Price } from './Coins';
import { ConfirmButton } from './ui';

/** One Easter egg with its buy button (or, for the duo, what unlocks it). */
export function EggCard({ egg, compact = false }: { egg: EggDef; compact?: boolean }) {
  const p = useProfile();
  const have = hasEgg(p, egg.id);
  const err = canBuy(p, egg.id);
  const owner = egg.chars.map((c) => charById(c)!.name).join(' + ');
  return (
    <article className={`card flex gap-3 p-3 ${have ? 'border-amber-400/70' : ''}`}>
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink-950 text-3xl ${have ? '' : 'grayscale-[.4]'}`} aria-hidden>
        {egg.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <h3 className="font-display text-lg leading-tight text-white">{egg.name}</h3>
          {have ? <span className="text-sm font-bold text-amber-300">✓ אצלך</span> : egg.price > 0 && <Price value={egg.price} dim={err === 'coins'} />}
        </div>
        {!compact && <p className="text-xs text-ink-400">האיסטר אג של {owner}</p>}
        <p className="mt-1 text-sm text-ink-200">
          <b className="text-amber-300">{egg.label}:</b> {egg.desc}
        </p>
        {!have && egg.id === DUO.id && (
          <p className="mt-2 text-xs text-ink-400">
            לא נמכר — נפתח כשיש לך את שניהם:{' '}
            {DUO.chars.map((c) => (
              <span key={c} className={`me-2 ${p.owned.includes(c) ? 'text-amber-300' : ''}`}>
                {p.owned.includes(c) ? '✓' : '🔒'} {charById(c)!.name}
              </span>
            ))}
          </p>
        )}
        {!have && egg.id !== DUO.id && (
          <div className="mt-2">
            {err === 'coins' ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                <span>עוד {fmt(egg.price - p.coins)} מטבעות</span>
                <button className="underline" onClick={() => profileStore.update((x) => ({ ...x, wish: egg.id }))} disabled={p.wish === egg.id}>
                  {p.wish === egg.id ? '🎯 זאת המטרה שלך' : '🎯 לקבוע כמטרה'}
                </button>
              </div>
            ) : (
              <ConfirmButton
                className="btn-amber min-h-[44px] w-full text-base"
                label={`לקנות · ${fmt(egg.price)}`}
                confirmLabel={`לקנות ב־${fmt(egg.price)}? הקישו שוב`}
                onConfirm={() => {
                  const r = profileStore.apply((x) => {
                    const res = buy(x, egg.id);
                    return { profile: res.profile, events: res.events };
                  });
                  if (hasEgg(r.profile, egg.id)) sfx.win();
                }}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
