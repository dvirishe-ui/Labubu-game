import { useEffect } from 'react';
import { Confetti, Scoreboard, Screen, TopBar, Wordmark } from '../components/ui';
import type { Session } from '../lib/session';
import { standings } from '../lib/scoring';
import { sfx } from '../lib/sound';

export default function Results({ session, onAgain, onHome }: { session: Session; onAgain: () => void; onHome: () => void }) {
  const { leaders } = standings(session.participants);
  const anyPoints = session.participants.some((p) => p.score > 0);
  useEffect(() => {
    if (anyPoints) sfx.win();
  }, [anyPoints]);
  return (
    <Screen>
      {anyPoints && <Confetti />}
      <TopBar onBack={onHome} />
      <Wordmark small />
      <section className="my-6 text-center animate-pop">
        {anyPoints ? (
          <>
            <p className="text-lg text-ink-400">{leaders.length > 1 ? 'תיקו על הגג!' : 'המנצח/ת:'}</p>
            <p className="font-display text-5xl text-amber-400">{leaders.map((l) => l.name).join(' · ')}</p>
          </>
        ) : (
          <p className="font-display text-4xl text-amber-400">סיימתם!</p>
        )}
      </section>
      <Scoreboard items={session.participants} />
      <div className="mt-6 grid gap-3">
        <button className="btn-amber text-xl" onClick={onAgain}>
          עוד סיבוב — שאלות חדשות
        </button>
        <button className="btn-ghost" onClick={onHome}>
          למסך הבית
        </button>
      </div>
    </Screen>
  );
}
