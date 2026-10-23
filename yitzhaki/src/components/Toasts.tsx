import { useEffect } from 'react';
import { profileStore, useProfileState } from '../lib/store';
import { sfx } from '../lib/sound';
import { CoinIcon, fmt } from './Coins';

/** Reward pop-ups (coins, achievements, level-ups) queued by the profile store. */
export function Toasts() {
  const { toasts } = useProfileState();
  const t = toasts[0];
  useEffect(() => {
    if (!t) return;
    if (t.type === 'achievement' || t.type === 'level') sfx.win();
    else if (t.type === 'coins') sfx.good();
    const id = setTimeout(() => profileStore.dismissToast(t.key), t.type === 'achievement' ? 3600 : 2200);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+12px)] z-[60] flex justify-center px-4" aria-live="polite">
      <button
        key={t.key}
        className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-amber-400/50 bg-ink-900/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.5)] backdrop-blur animate-toast"
        onClick={() => profileStore.dismissToast(t.key)}
      >
        {t.type === 'coins' && (
          <>
            <CoinIcon size={28} />
            <span className="text-start">
              <span className="block font-display text-xl text-amber-300">+{fmt(t.amount)}</span>
              <span className="text-sm text-ink-200">{t.label}</span>
            </span>
          </>
        )}
        {t.type === 'achievement' && (
          <>
            <span className="text-3xl" aria-hidden>
              🏆
            </span>
            <span className="text-start">
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-300">הישג חדש</span>
              <span className="block font-display text-lg text-white">{t.title}</span>
              <span className="text-sm text-amber-300">+{fmt(t.amount)} מטבעות</span>
            </span>
          </>
        )}
        {t.type === 'level' && (
          <>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-cherry-500 font-display text-xl text-white">{t.level}</span>
            <span className="text-start">
              <span className="block font-display text-lg text-white">עלית לרמה {t.level}!</span>
              <span className="text-sm text-amber-300">+{fmt(t.amount)} מטבעות</span>
            </span>
          </>
        )}
        {t.type === 'capped' && <span className="text-sm text-ink-200">{t.label}</span>}
      </button>
    </div>
  );
}
