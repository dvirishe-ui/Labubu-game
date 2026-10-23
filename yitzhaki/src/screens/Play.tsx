import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Modal, Scoreboard, Screen, TopBar } from '../components/ui';
import { markSeen } from '../lib/deck';
import { INVENT_PROMPTS } from '../lib/plan';
import { applyDeltas } from '../lib/scoring';
import { timeUp, type RoundMeta, type Session } from '../lib/session';
import type { GameMeta, Round, StepEngine } from '../lib/types';
import type { EngineProps } from '../engines/common';

const ENGINES: Record<StepEngine, React.LazyExoticComponent<(p: EngineProps) => JSX.Element | null>> = {
  realfake: lazy(() => import('../engines/RealFake')),
  dilemma: lazy(() => import('../engines/Dilemma')),
  fmk: lazy(() => import('../engines/Fmk')),
  creative: lazy(() => import('../engines/Creative')),
  hotseat: lazy(() => import('../engines/HotSeat')),
  impostor: lazy(() => import('../engines/Impostor')),
  whowrote: lazy(() => import('../engines/WhoWrote')),
  bluff: lazy(() => import('../engines/Bluff')),
  knows: lazy(() => import('../engines/KnowsGroup')),
  battle: lazy(() => import('../engines/Battle')),
  invent: lazy(() => import('../engines/Invent'))
};

export const RULES: Record<StepEngine, string> = {
  realfake: 'מקריאים בקול. כל אחד בוחר — אמיתי או המצאה. אחרי שכולם בחרו: חשיפה. נקודה לכל תשובה נכונה. התשובה היא מה שנחשף בפודקאסט, לא בדיקת עובדות.',
  dilemma: 'אין תשובה נכונה. מתווכחים ומצביעים. לפי המצב: הרוב קובע (נקודה לרוב), הכבשה השחורה (נקודה למיעוט), ניחוש הרוב, או מי בחר מה.',
  fmk: 'שלושה שמות. כל שחקן מחלק בסתר F, M ו־K — כל אות פעם אחת. בסוף רואים מי בחר מה. אין ניקוד, רק ויכוחים.',
  creative: 'כל אחד כותב בסתר את התשובה הכי מצחיקה. כל התשובות מוצגות בלי שמות, מצביעים (לא לעצמכם), וכל קול = נקודה.',
  hotseat: 'מי שבכיסא החם מסמן לטלפון בסתר את האמת, ואז עונה בקול — מותר לשקר. השופטים מחליטים: אמת או שקר? נקודה לשופט שצדק, 2 נקודות לשקרן שעבד על רוב השופטים. זה משחק — אין פה גלאי שקר אמיתי.',
  impostor: 'כל אחד רואה בסתר פריט מהפודקאסט. כולם קיבלו אותו פריט — חוץ מאחד. כל אחד נותן רמז קצר, ואז מצביעים מי המתחזה. נתפס? נקודה למי שזיהה. ברח? +2 למתחזה.',
  whowrote: 'כל אחד כותב בסתר פריט מזויף באותו סגנון. כל הפריטים מוצגים יחד עם המקורי. מי שמזהה את המקורי: +2. על כל שחקן שהזיוף שלך הטעה: +1.',
  bluff: 'שחקן אחד רואה את התשובה האמיתית ובוחר אם לשכנע באמת או לבלף. כל השאר מצביעים. נקודה לכל מי שצדק, ולבלופר — נקודה על כל מי ששכנע.',
  knows: 'שחקן אחד בוחר בסתר תשובה לדילמה מהפודקאסט. כולם מנחשים מה בחר/ה. נקודה לכל ניחוש נכון.',
  battle: 'הקבוצות עונות לסירוגין. תשובה נכונה: +2. הקבוצה השנייה יכולה לערער: ערעור נכון +2 לה, ערעור שגוי +1 בונוס לקבוצה שענתה.',
  invent: 'כותבים בסתר המצאה בסגנון הפינות (כותרת, שיר, סדנה...). הכל מוצג בלי שמות ומצביעים. כל קול = נקודה. זה תוכן שחקנים, לא מהפודקאסט.'
};

function Clock({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, until - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className={`chip tabular-nums ${left < 60000 ? 'border-cherry-400 text-cherry-300' : 'text-ink-200'}`} aria-label="זמן שנשאר לערב">
      ⏳ {left ? `${m}:${String(s).padStart(2, '0')}` : 'סבב אחרון'}
    </span>
  );
}

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
  const step = session.steps[session.index];
  const game = step && gameById.get(step.gameId);
  const stepRounds: Round[] = !step
    ? []
    : step.engine === 'invent'
      ? [{ id: `invent-${session.id}-${session.index}`, gameId: step.gameId, prompt: INVENT_PROMPTS[step.promptIndex ?? 0].text, choices: null, mature: false, usable: true, confidence: 'player', sealed: '' }]
      : step.roundIds.map((id) => byId.get(id)).filter((r): r is Round => !!r);
  const missing = !step || !game || !stepRounds.length || stepRounds.length < step.roundIds.length;

  const finishStep = (deltas: Record<string, number>, meta: RoundMeta = {}, skipped = false) => {
    markSeen(step.roundIds);
    const participants = applyDeltas(session.participants, deltas);
    const next: Session = {
      ...session,
      participants,
      index: session.index + 1,
      log: [...session.log, { deltas, meta, skipped, scores: Object.fromEntries(participants.map((p) => [p.id, p.score])) }]
    };
    if (next.index >= session.steps.length || timeUp(next)) onFinish(next);
    else onUpdate(next);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    // A round removed in the editor since this session was saved: skip it.
    if (missing && step) finishStep({}, {}, true);
    else if (!step) onFinish(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, session.index]);
  if (missing) return null;

  const EngineView = ENGINES[step.engine];
  const total = session.config.minutes ? null : session.steps.length;
  return (
    <Screen>
      <TopBar
        onBack={onExit}
        title={total ? `סבב ${session.index + 1}/${total}` : `סבב ${session.index + 1}`}
        right={
          <>
            {session.config.minutes && <Clock until={session.startedAt + session.config.minutes * 60000} />}
            <button className="btn-ghost min-h-[44px] px-3 text-base" onClick={() => setShowRules(true)} aria-label="חוקים">
              ?
            </button>
            <button className="btn-ghost min-h-[44px] px-3 text-base" onClick={() => setShowScores(true)} aria-label="ניקוד">
              🏆
            </button>
          </>
        }
      />
      {total && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-cherry-500 transition-[width] duration-500" style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
      )}
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <EngineView
          key={`${session.index}:${stepRounds[0].id}`}
          round={stepRounds[0]}
          rounds={stepRounds}
          step={step}
          game={game}
          participants={session.participants}
          config={session.config}
          roundIndex={session.index}
          onDone={(d, m) => finishStep(d, m)}
        />
      </Suspense>
      <button className="mt-6 self-center text-sm text-ink-400 underline" onClick={() => finishStep({}, {}, true)}>
        דלגו על הסבב
      </button>
      <Modal open={showScores} onClose={() => setShowScores(false)} title="ניקוד">
        <Scoreboard items={session.participants} />
      </Modal>
      <Modal open={showRules} onClose={() => setShowRules(false)} title="איך משחקים">
        <p className="text-lg leading-relaxed">{(step.engine === game.engine && game.rules) || RULES[step.engine]}</p>
      </Modal>
    </Screen>
  );
}
