import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { CharacterView } from '../components/CharacterView';
import { CoinPill, fmt } from '../components/Coins';
import { NameSheet, XpBar } from '../components/Profile';
import { Screen, TopBar } from '../components/ui';
import { ALL_SKINS, CHARACTERS, skinsFor, TIER_META } from '../lib/characters';
import { ACHIEVEMENTS, WEEKLY_GOALS, REWARDS } from '../lib/economy';
import { useProfile } from '../lib/store';
import { weekKey } from '../lib/time';
import { bestTier } from './Shop';

export default function Collection({ onBack, onShop }: { onBack: () => void; onShop: () => void }) {
  const p = useProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [rename, setRename] = useState(false);
  const paidSkins = ALL_SKINS.filter((s) => s.tier !== 'classic');
  const ownedPaid = paidSkins.filter((s) => p.skins.includes(s.id)).length;
  const pct = Math.round(((p.owned.length + ownedPaid) / (CHARACTERS.length + paidSkins.length)) * 100);
  const week = p.week.key === weekKey() ? p.week : { key: '', correct: 0, games: 0, dailies: 0 };
  const weeklyDone = !!p.claimed[`weekly:${weekKey()}`];
  const eqTier = p.equipped.skin ? ALL_SKINS.find((s) => s.id === p.equipped.skin)?.tier ?? 'classic' : 'classic';

  return (
    <Screen>
      <TopBar onBack={onBack} title="האוסף שלי" right={<CoinPill coins={p.coins} />} />

      <section className="card mb-5 flex items-center gap-4 p-4">
        <div className={`frame frame-${eqTier} w-28 shrink-0`}>
          <div>
            <Avatar charId={p.equipped.char} skinId={p.equipped.skin} size={108} />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <button className="block max-w-full truncate text-start font-display text-2xl text-white" onClick={() => setRename(true)}>
            {p.name || 'אורח/ת'} <span className="text-sm text-ink-400">✎</span>
          </button>
          <XpBar />
          <p className="text-sm text-ink-400">
            סה״כ הרווחת <b className="text-amber-300">{fmt(p.coinsEarned)}</b> מטבעות
          </p>
        </div>
      </section>

      <section className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-white">
            {p.owned.length}/{CHARACTERS.length} דמויות
          </h2>
          <span className="text-sm text-ink-400">{pct}% מהאוסף המלא</span>
        </div>
        <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-ink-800">
          <div className="h-full rounded-full bg-gradient-to-l from-fuchsia-500 via-amber-400 to-amber-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CHARACTERS.map((c) => {
            const owned = p.owned.includes(c.id);
            const tier = owned ? bestTier(p.skins, c.id) : 'classic';
            return (
              <button key={c.id} onClick={() => (owned ? setOpen(c.id) : onShop())} className={`frame frame-${tier} relative`} aria-label={c.name}>
                <div className="bg-ink-900">
                  <Avatar charId={c.id} skinId={p.equipped.char === c.id ? p.equipped.skin : `${c.id}:${tier}`} size={80} animated={false} locked={!owned} />
                  {p.favorite === c.id && <span className="absolute left-1 top-1 text-sm">★</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {p.owned.length > 0 && (
        <section className="mb-5">
          <span className="label">סקינים</span>
          <div className="space-y-2">
            {p.owned.map((id) => {
              const c = CHARACTERS.find((x) => x.id === id)!;
              return (
                <button key={id} className="card flex w-full items-center gap-3 p-3 text-start" onClick={() => setOpen(id)}>
                  <span className="min-w-0 flex-1 font-bold text-white">{c.name}</span>
                  <span className="flex gap-1">
                    {skinsFor(id).map((s) => {
                      const have = s.tier === 'classic' || p.skins.includes(s.id);
                      return <span key={s.id} className="h-3.5 w-3.5 rounded-full" title={s.name} style={{ background: have ? TIER_META[s.tier].color : '#29252f' }} />;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="card mb-5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-xl text-white">האתגר השבועי</span>
          <span className={`text-sm ${weeklyDone ? 'text-amber-300' : 'text-ink-400'}`}>{weeklyDone ? 'הושלם ✓' : `+${REWARDS.weekly} מטבעות`}</span>
        </div>
        <div className="space-y-2">
          {WEEKLY_GOALS.map((g) => {
            const v = Math.min(g.target, week[g.id]);
            return (
              <div key={g.id}>
                <div className="flex justify-between text-sm">
                  <span>{g.label}</span>
                  <span className="tabular-nums text-ink-400">
                    {v}/{g.target}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                  <div className="h-full rounded-full bg-cherry-500" style={{ width: `${(v / g.target) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-400">לא חובה — מתאפס בכל יום שני.</p>
      </section>

      <section className="mb-5 grid grid-cols-3 gap-2 text-center">
        {[
          ['משחקים', p.stats.games],
          ['ניצחונות', p.stats.wins],
          ['תשובות נכונות', p.stats.correct],
          ['רצף שיא', p.stats.bestStreak],
          ['שיא במסלול', fmt(p.stats.soloBest)],
          ['אתגרים יומיים', p.stats.dailies]
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl bg-ink-900 p-3">
            <div className="font-display text-xl tabular-nums text-amber-400">{v}</div>
            <div className="text-xs text-ink-400">{l}</div>
          </div>
        ))}
      </section>

      <section>
        <span className="label">
          הישגים {Object.keys(p.achievements).length}/{ACHIEVEMENTS.length}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const on = !!p.achievements[a.id];
            return (
              <div key={a.id} className={`rounded-2xl border p-3 ${on ? 'border-amber-400/50 bg-amber-400/10' : 'border-ink-700 bg-ink-900 opacity-60'}`}>
                <div className="flex items-center gap-2">
                  <span aria-hidden>{on ? '🏆' : '🔒'}</span>
                  <span className="font-bold text-white">{a.title}</span>
                </div>
                <p className="text-xs text-ink-400">{a.desc}</p>
                <p className="text-xs text-amber-300">+{a.reward}</p>
              </div>
            );
          })}
        </div>
      </section>
      {open && <CharacterView charId={open} onClose={() => setOpen(null)} />}
      <NameSheet open={rename} onClose={() => setRename(false)} />
    </Screen>
  );
}
