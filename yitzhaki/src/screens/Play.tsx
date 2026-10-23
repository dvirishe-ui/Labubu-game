import { lazy, Suspense, useMemo, useState } from 'react';
import { Modal, Scoreboard, Screen, TopBar } from '../components/ui';
import { markSeen } from '../lib/deck';
import { applyDeltas } from '../lib/scoring';
import type { Session } from '../lib/session';
import type { Engine, GameMeta, Round } from '../lib/types';
import type { EngineProps } from '../engines/common';

const ENGINES: Record<Engine, React.LazyExoticComponent<(p: EngineProps) => JSX.Element>> = {
  realfake: lazy(() => import('../engines/RealFake')),
  dilemma: lazy(() => import('../engines/Dilemma')),
  fmk: lazy(() => import('../engines/Fmk')),
  creative: lazy(() => import('../engines/Creative')),
  hotseat: lazy(() => import('../engines/HotSeat'))
};

export const RULES: Record<Engine, string> = {
  realfake: 'מקריאים בקול. כל אחד בוחר — אמיתי או המצאה. אחרי שכולם בחרו: חשיפה. נקודה לכל תשובה נכונה. התשובה היא מה שנחשף בפודקאסט, לא בדיקת עובדות.',
  dilemma: 'אין תשובה נכונה. מתווכחים, מצביעים (אפשר בסתר), ורואים איך התחלקה החבורה. במצב "ניחוש הרוב" — נקודה למי שצפה מה הרוב יבחר.',
  fmk: 'שלושה שמות. כל שחקן מחלק בסתר F, M ו־K — כל אות פעם אחת. בסוף רואים מי בחר מה. אין ניקוד, רק ויכוחים.',
  creative: 'כל אחד כותב בסתר את התשובה הכי מצחיקה. כל התשובות מוצגות בלי שמות, מצביעים (לא לעצמכם), וכל קול = נקודה.',
  hotseat: 'מי שבכיסא החם מסמן לטלפון בסתר את האמת, ואז עונה בקול — מותר לשקר. השופטים מחליטים: אמת או שקר? נקודה לשופט שצדק, 2 נקודות לשקרן שעבד על רוב השופטים. זה משחק — אין פה גלאי שקר אמיתי.'
};

export default function Play({
  session,
  games,
  rounds,
  onUpdate,
  onFinish,
  onExit
}: {
  session: Session;
  games: GameMeta[];
  rounds: Round[];
  onUpdate: (s: Session) => void;
  onFinish: (s: Session) => void;
  onExit: () => void;
}) {
  const [showScores, setShowScores] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const byId = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const round = byId.get(session.roundIds[session.index]);
  const game = round && gameById.get(round.gameId);

  // A round deleted/disabled in the editor since the session was saved: skip it.
  if (!round || !game) {
    const next = { ...session, index: session.index + 1 };
    queueMicrotask(() => (next.index >= session.roundIds.length ? onFinish(next) : onUpdate(next)));
    return null;
  }

  const EngineView = ENGINES[game.engine];
  const total = session.roundIds.length;
  const done = (deltas: Record<string, number>) => {
    markSeen([round.id]);
    const next: Session = { ...session, participants: applyDeltas(session.participants, deltas), index: session.index + 1 };
    if (next.index >= total) onFinish(next);
    else onUpdate(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <Screen>
      <TopBar
        onBack={onExit}
        title={`סבב ${session.index + 1}/${total}`}
        right={
          <>
            <button className="btn-ghost min-h-[44px] px-3 text-base" onClick={() => setShowRules(true)} aria-label="חוקים">
              ?
            </button>
            <button className="btn-ghost min-h-[44px] px-3 text-base" onClick={() => setShowScores(true)} aria-label="ניקוד">
              🏆
            </button>
          </>
        }
      />
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-cherry-500 transition-[width] duration-500" style={{ width: `${(session.index / total) * 100}%` }} />
      </div>
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <EngineView key={round.id} round={round} game={game} participants={session.participants} config={session.config} roundIndex={session.index} onDone={done} />
      </Suspense>
      <button className="mt-6 self-center text-sm text-ink-400 underline" onClick={() => done({})}>
        דלגו על השאלה
      </button>
      <Modal open={showScores} onClose={() => setShowScores(false)} title="ניקוד">
        <Scoreboard items={session.participants} />
      </Modal>
      <Modal open={showRules} onClose={() => setShowRules(false)} title={game.title}>
        <p className="text-lg leading-relaxed">{game.rules || RULES[game.engine]}</p>
      </Modal>
    </Screen>
  );
}
