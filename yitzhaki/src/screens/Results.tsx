import { useEffect } from 'react';
import { Avatar } from '../components/Avatar';
import { CoinIcon, fmt } from '../components/Coins';
import { Confetti, Scoreboard, Screen, TopBar } from '../components/ui';
import type { RewardEvent } from '../lib/economy';
import { buildRecap } from '../lib/recap';
import type { Session } from '../lib/session';
import { sfx } from '../lib/sound';
import { useProfile } from '../lib/store';

export default function Results({ session, rewards, onAgain, onHome }: { session: Session; rewards: RewardEvent[]; onAgain: () => void; onHome: () => void }) {
  const p = useProfile();
  const recap = buildRecap(session);
  const name = (id: string) => session.participants.find((x) => x.id === id)?.name ?? '';
  const ownerWon = recap.winners.includes(session.participants[0]?.id);
  const coins = rewards.reduce((n, e) => n + (e.type === 'coins' || e.type === 'achievement' || e.type === 'level' ? e.amount : 0), 0);
  const achievements = rewards.filter((e) => e.type === 'achievement') as Extract<RewardEvent, { type: 'achievement' }>[];
  const night = !!session.config.minutes;

  useEffect(() => {
    if (recap.winners.length) sfx.win();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const awards: [string, string, string][] = [];
  if (recap.mostCorrect) awards.push(['🧠', 'הכי הרבה תשובות נכונות', `${name(recap.mostCorrect.id)} · ${recap.mostCorrect.n}`]);
  if (recap.bestBluffer) awards.push(['🃏', 'מלך/ת הבלוף', `${name(recap.bestBluffer.id)} · ${recap.bestBluffer.n} שוכנעו`]);
  if (recap.mostUnpopular) awards.push(['🐑', 'הדעות הכי לא פופולריות', `${name(recap.mostUnpopular.id)} · ${recap.mostUnpopular.n} פעמים במיעוט`]);
  if (recap.comeback) awards.push(['🚀', 'הקאמבק של הערב', `${name(recap.comeback.id)} · חזר/ה מפיגור של ${recap.comeback.from}`]);

  return (
    <Screen>
      {recap.winners.length > 0 && <Confetti />}
      <TopBar onBack={onHome} title={night ? 'סיכום הערב על הגג' : 'סוף המשחק'} />
      <section className="my-4 text-center animate-pop">
        {ownerWon && (
          <div className="frame frame-gold mx-auto mb-3 w-40">
            <div>
              <Avatar charId={p.equipped.char} skinId={p.equipped.skin} size={154} />
            </div>
          </div>
        )}
        {recap.winners.length ? (
          <>
            <p className="text-lg text-ink-400">{recap.winners.length > 1 ? 'תיקו על הגג!' : 'המנצח/ת:'}</p>
            <p className="font-display text-5xl text-amber-400">{recap.winners.map(name).join(' · ')}</p>
          </>
        ) : (
          <p className="font-display text-4xl text-amber-400">סיימתם!</p>
        )}
      </section>

      {awards.length > 0 && (
        <section className="mb-5 grid gap-2">
          {awards.map(([icon, title, who], i) => (
            <div key={title} className="card flex items-center gap-3 p-3 animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="text-3xl" aria-hidden>
                {icon}
              </span>
              <span>
                <span className="block text-xs font-bold uppercase tracking-wider text-ink-400">{title}</span>
                <span className="font-display text-lg text-white">{who}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      <Scoreboard items={session.participants} />

      {(coins > 0 || rewards.some((r) => r.type === 'capped')) && (
        <section className="card mt-5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-ink-200">הרווחת במכשיר הזה</span>
            <span className="inline-flex items-center gap-1 font-display text-2xl text-amber-300">
              <CoinIcon /> +{fmt(coins)}
            </span>
          </div>
          {achievements.map((a) => (
            <p key={a.id} className="mt-1 text-sm text-amber-300">
              🏆 {a.title}
            </p>
          ))}
          {rewards
            .filter((r) => r.type === 'capped')
            .map((r, i) => (
              <p key={i} className="mt-1 text-xs text-ink-400">
                {(r as { label: string }).label}
              </p>
            ))}
        </section>
      )}

      <div className="mt-6 grid gap-3">
        <button className="btn-amber text-xl" onClick={onAgain}>
          {night ? 'עוד ערב' : 'עוד סיבוב — שאלות חדשות'}
        </button>
        <button className="btn-ghost" onClick={onHome}>
          למסך הבית
        </button>
      </div>
    </Screen>
  );
}
