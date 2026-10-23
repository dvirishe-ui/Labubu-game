import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { CoinPill, fmt } from '../components/Coins';
import { CountdownBar, CrowdLine, useCountdown } from '../components/Countdown';
import { Confetti, Screen, TopBar } from '../components/ui';
import { crowdFor } from '../lib/challenges';
import type { CrowdStats } from '../lib/cloud';
import { openSecret } from '../lib/deck';
import { bumpStats, finishSoloRun, recordAnswer, REWARDS, soloCoins } from '../lib/economy';
import type { PowerUp, SoloRunState } from '../lib/profile';
import { newSeed } from '../lib/rng';
import {
  BOSS_QUESTIONS,
  fiftyFifty,
  kindOf,
  MAX_LIVES,
  newRun,
  pickSingle,
  pickTriple,
  pointsFor,
  POWERUPS,
  randomPowerUp,
  ROUNDS_PER_LEVEL,
  soloPool,
  START_LIVES,
  timerFor,
  type SoloQ
} from '../lib/solo';
import { sfx } from '../lib/sound';
import { getCrowd, profileStore, useProfile } from '../lib/store';
import type { GameMeta, Round } from '../lib/types';
import SoloDecisions from './SoloDecisions';

interface Summary {
  score: number;
  level: number;
  correct: number;
  coins: number;
  newBest: boolean;
  exhausted: boolean;
}

export default function Solo({ games, rounds, mature, onBack }: { games: GameMeta[]; rounds: Round[]; mature: boolean; onBack: () => void }) {
  const p = useProfile();
  const [view, setView] = useState<'menu' | 'run' | 'decide'>('menu');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [startLevel, setStartLevel] = useState(p.solo.unlockedLevel);
  const pool = useMemo(() => soloPool(rounds, games, mature), [rounds, games, mature]);
  const run = p.solo.run;

  const saveRun = (r: SoloRunState | null) =>
    profileStore.update((x) => ({ ...x, solo: { unlockedLevel: Math.max(x.solo.unlockedLevel, r?.level ?? 1), run: r } }));

  const end = (r: SoloRunState, exhausted: boolean) => {
    const newBest = r.score > p.stats.soloBest;
    profileStore.apply((x) => finishSoloRun(x, r.score, r.level));
    setSummary({ score: r.score, level: r.level, correct: r.correct, coins: r.coins, newBest, exhausted });
    setView('menu');
  };

  if (view === 'decide') return <SoloDecisions games={games} rounds={rounds} mature={mature} onBack={() => setView('menu')} />;
  if (view === 'run' && run) return <Run key={run.seed} run={run} pool={pool} games={games} save={saveRun} onEnd={end} onExit={() => setView('menu')} />;

  return (
    <Screen>
      <TopBar onBack={onBack} title="משחק לבד" right={<CoinPill coins={p.coins} />} />
      {summary && (
        <section className="card mb-5 p-5 text-center animate-pop">
          {summary.newBest && <Confetti />}
          <p className="text-sm font-bold uppercase tracking-wider text-ink-400">{summary.exhausted ? 'עברת את כל השאלות!' : 'נגמרו הלבבות'}</p>
          <p className="my-1 font-display text-5xl tabular-nums text-amber-400">{fmt(summary.score)}</p>
          {summary.newBest && <p className="font-display text-xl text-cherry-400">שיא אישי חדש!</p>}
          <p className="mt-2 text-ink-200">
            שלב {summary.level} · {summary.correct} תשובות נכונות · {fmt(summary.coins)} מטבעות
          </p>
        </section>
      )}

      <section className="card relative mb-5 overflow-hidden p-5">
        <div className="flex items-center gap-4">
          <div className="frame frame-classic w-28 shrink-0">
            <div>
              <Avatar charId={p.equipped.char} skinId={p.equipped.skin} size={112} />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-3xl leading-tight text-white">המסלול של יצחקי</h2>
            <p className="text-sm text-ink-400">3 לבבות. כל 5 סיבובים אתגר מיוחד, כל 10 — בוס. כמה רחוק תגיע/י?</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-ink-800 p-3">
            <div className="font-display text-2xl tabular-nums text-amber-400">{fmt(p.stats.soloBest)}</div>
            <div className="text-xs text-ink-400">שיא ניקוד</div>
          </div>
          <div className="rounded-2xl bg-ink-800 p-3">
            <div className="font-display text-2xl tabular-nums text-amber-400">{p.stats.soloBestLevel || '—'}</div>
            <div className="text-xs text-ink-400">השלב הכי רחוק</div>
          </div>
        </div>
      </section>

      {run && (
        <button className="btn-cherry mb-3 w-full text-xl" onClick={() => setView('run')}>
          ממשיכים: שלב {run.level}, סיבוב {run.round} · {'❤️'.repeat(Math.max(0, run.lives))}
        </button>
      )}

      <section className="mb-4">
        <span className="label">מתחילים משלב</span>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: Math.min(p.solo.unlockedLevel, 20) }, (_, i) => i + 1).map((L) => (
            <button key={L} aria-pressed={startLevel === L} onClick={() => setStartLevel(L)} className={`h-12 w-12 rounded-xl font-display text-lg ${startLevel === L ? 'bg-amber-400 text-ink-950' : 'bg-ink-800 text-ink-200'}`}>
              {L}
            </button>
          ))}
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-dashed border-ink-600 text-ink-400" aria-label="השלב הבא נעול">
            🔒
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-400">שלב גבוה = פחות זמן ויותר נקודות. כל שלב שעוברים נפתח לתמיד.</p>
      </section>

      <button
        className="btn-amber w-full text-2xl"
        disabled={!pool.length}
        onClick={() => {
          setSummary(null);
          saveRun(newRun(startLevel, newSeed()));
          setView('run');
        }}
      >
        {run ? 'ריצה חדשה' : 'יאללה, לשלב ' + startLevel}
      </button>

      <button className="card mt-5 flex w-full items-center gap-4 p-4 text-start" onClick={() => setView('decide')}>
        <span className="text-4xl" aria-hidden>
          ⚖️
        </span>
        <span>
          <span className="block font-display text-xl text-white">דילמות נגד כולם</span>
          <span className="text-sm text-ink-400">מה את/ה היית עושה — ומה כל השאר בחרו? מטבעות על ניחוש הרוב.</span>
        </span>
      </button>

      <section className="mt-6">
        <span className="label">כוחות מיוחדים</span>
        <ul className="grid grid-cols-2 gap-2">
          {POWERUPS.map((x) => (
            <li key={x.id} className="rounded-2xl bg-ink-900 p-3 text-sm">
              <span className="me-1">{x.icon}</span>
              <b className="text-white">{x.label}</b>
              <span className="block text-xs text-ink-400">{x.hint}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-400">כל ריצה מתחילה עם אחד מכל סוג, ועוד אחד בכל שלב שעוברים.</p>
      </section>
    </Screen>
  );
}

function Hearts({ lives }: { lives: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${lives} לבבות`}>
      {Array.from({ length: Math.max(START_LIVES, lives) }, (_, i) => (
        <span key={i} className={`text-xl transition ${i < lives ? '' : 'opacity-25 grayscale'}`}>
          ❤️
        </span>
      ))}
    </div>
  );
}

type Phase = 'intro' | 'ask' | 'reveal';

function Run({ run, pool, games, save, onEnd, onExit }: { run: SoloRunState; pool: Round[]; games: GameMeta[]; save: (r: SoloRunState) => void; onEnd: (r: SoloRunState, exhausted: boolean) => void; onExit: () => void }) {
  const kind = kindOf(run.round);
  const [bossStep, setBossStep] = useState(0);
  const [bossHits, setBossHits] = useState(0);
  const [phase, setPhase] = useState<Phase>(kind === 'normal' ? 'ask' : 'intro');
  const [doubled, setDoubled] = useState(false);
  const [hidden, setHidden] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; picked: string | number | null; points: number } | null>(null);
  const [crowd, setCrowd] = useState<CrowdStats | null>(null);
  const [crowdLoading, setCrowdLoading] = useState(true);
  const [lostHeart, setLostHeart] = useState(false);
  const stepKey = `${run.level}:${run.round}:${bossStep}`;
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  useEffect(() => {
    getCrowd().then((c) => {
      setCrowd(c);
      setCrowdLoading(false);
    });
  }, []);

  const q: SoloQ | null = useMemo(() => {
    const used = new Set(run.used);
    const seed = `${run.seed}:${stepKey}`;
    if (kind === 'special') {
      const t = pickTriple(pool, games, used, seed);
      if (t) return t;
    }
    const r = pickSingle(pool, used, seed);
    return r ? { type: 'single', round: r } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const seconds = timerFor(run.level, kind);
  const timer = useCountdown(seconds, phase === 'ask' && !!q, stepKey, () => answer(null));

  useEffect(() => {
    if (!q && phase !== 'reveal') onEnd(run, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  if (!q) return null;

  const game = gameById.get(q.type === 'single' ? q.round.gameId : q.gameId)!;
  const ids = q.type === 'single' ? [q.round.id] : q.items.map((r) => r.id);
  const truth = q.type === 'single' ? openSecret(q.round).a : null;

  function answer(picked: string | number | null) {
    if (phase !== 'ask' || !q) return;
    const correct = q.type === 'single' ? picked === truth : picked === q.answerIndex;
    const points = correct ? pointsFor(run.level, run.streak, timer.left, timer.max, kind, doubled) : 0;
    const lose = correct ? 0 : doubled ? 2 : 1;
    const next: SoloRunState = {
      ...run,
      lives: run.lives - lose,
      score: run.score + points,
      streak: correct ? run.streak + 1 : 0,
      correct: run.correct + (correct ? 1 : 0),
      used: [...run.used, ...ids],
      powerups: doubled ? { ...run.powerups, double: run.powerups.double - 1 } : run.powerups
    };
    profileStore.apply((x) => recordAnswer(x, q.type === 'single' ? q.round.id : null, typeof picked === 'string' ? picked : null, correct));
    if (correct) {
      const res = profileStore.apply((x) => soloCoins(x, `${run.seed}:${stepKey}`, REWARDS.soloPerCorrect, 'תשובה נכונה'));
      next.coins += res.events.reduce((n, e) => n + (e.type === 'coins' ? e.amount : 0), 0);
      if (kind === 'boss') setBossHits((h) => h + 1);
      const stat = q.type === 'single' ? crowdFor(crowd, q.round.id, truth, 5) : null;
      if (stat && stat.pct < 30) profileStore.apply((x) => bumpStats(x, { crowdBeats: 1 }));
      sfx.good();
    } else {
      sfx.bad();
      setLostHeart(true);
      setTimeout(() => setLostHeart(false), 700);
    }
    setResult({ correct, picked, points });
    setPhase('reveal');
    save(next);
  }

  function skip() {
    if (phase !== 'ask' || run.powerups.skip < 1) return;
    sfx.tap();
    save({ ...run, used: [...run.used, ...ids], powerups: { ...run.powerups, skip: run.powerups.skip - 1 } });
    advance({ ...run, used: [...run.used, ...ids], powerups: { ...run.powerups, skip: run.powerups.skip - 1 } }, false);
  }

  function advance(cur: SoloRunState, countedBoss = true) {
    setResult(null);
    setDoubled(false);
    setHidden(null);
    if (cur.lives <= 0) return onEnd(cur, false);
    if (kind === 'boss' && bossStep < BOSS_QUESTIONS - 1) {
      setBossStep((b) => b + 1);
      setPhase('ask');
      return;
    }
    let next = { ...cur };
    if (cur.round >= ROUNDS_PER_LEVEL) {
      const perfectBoss = countedBoss && bossHits >= BOSS_QUESTIONS;
      if (perfectBoss) {
        next.lives = Math.min(MAX_LIVES, next.lives + 1);
        profileStore.apply((x) => bumpStats(x, { bossesBeaten: 1 }));
        const r = profileStore.apply((x) => soloCoins(x, `${run.seed}:boss:${run.level}`, REWARDS.soloBoss, 'ניצחת את הבוס'));
        next.coins += r.events.reduce((n, e) => n + (e.type === 'coins' ? e.amount : 0), 0);
      }
      const lv = profileStore.apply((x) => soloCoins(x, `${run.seed}:level:${run.level}`, REWARDS.soloLevel, `עברת את שלב ${run.level}`));
      next.coins += lv.events.reduce((n, e) => n + (e.type === 'coins' ? e.amount : 0), 0);
      const gift = randomPowerUp(`${run.seed}:gift:${run.level}`);
      next = { ...next, level: next.level + 1, round: 1, powerups: { ...next.powerups, [gift]: next.powerups[gift] + 1 } };
      setBossStep(0);
      setBossHits(0);
    } else next = { ...next, round: next.round + 1 };
    save(next);
    setPhase(kindOf(next.round) === 'normal' ? 'ask' : 'intro');
  }

  const use = (pu: PowerUp) => {
    if (phase !== 'ask' || run.powerups[pu] < 1) return;
    sfx.tap();
    if (pu === 'skip') return skip();
    if (pu === 'double') return setDoubled((d) => !d);
    if (pu === 'time') {
      timer.add(10);
      save({ ...run, powerups: { ...run.powerups, time: run.powerups.time - 1 } });
    }
    if (pu === 'fifty' && q.type === 'triple' && hidden == null) {
      setHidden(fiftyFifty(q, `${run.seed}:${stepKey}`));
      save({ ...run, powerups: { ...run.powerups, fifty: run.powerups.fifty - 1 } });
    }
  };

  const optionEntries = Object.entries(game.options);
  const header = (
    <div className="mb-3 flex items-center gap-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-ink-800">
        <AvatarMini />
      </div>
      <div className="min-w-0 flex-1">
        <div className={lostHeart ? 'animate-shake' : ''}>
          <Hearts lives={run.lives} />
        </div>
        <div className="text-xs text-ink-400">
          שלב {run.level} · סיבוב {run.round}/{ROUNDS_PER_LEVEL}
          {kind === 'boss' && ` · בוס ${bossStep + 1}/${BOSS_QUESTIONS}`}
        </div>
      </div>
      <div className="text-left">
        <div className="font-display text-2xl tabular-nums text-amber-400">{fmt(run.score)}</div>
        {run.streak >= 3 && <div className="text-xs font-bold text-cherry-300">🔥 רצף {run.streak}</div>}
      </div>
    </div>
  );

  if (phase === 'intro')
    return (
      <Screen>
        <TopBar onBack={onExit} title="המסלול של יצחקי" />
        {header}
        <div className={`card flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center animate-pop ${kind === 'boss' ? 'border-cherry-500' : 'border-amber-400'}`}>
          <span className="text-6xl" aria-hidden>
            {kind === 'boss' ? '👹' : '⚡'}
          </span>
          <h2 className="font-display text-4xl text-white">{kind === 'boss' ? 'סיבוב בוס!' : 'אתגר מיוחד!'}</h2>
          <p className="max-w-xs text-ink-200">
            {kind === 'boss'
              ? `${BOSS_QUESTIONS} שאלות בזק ברצף, ניקוד כפול שלוש. עוברים את שלושתן — מקבלים לב נוסף.`
              : q.type === 'triple'
                ? 'שלוש אפשרויות, רק אחת נכונה. ניקוד כפול — וכאן אפשר להשתמש ב־50/50.'
                : 'פחות זמן, ניקוד כפול.'}
          </p>
          <button className="btn-amber w-full max-w-xs text-xl" onClick={() => setPhase('ask')} autoFocus>
            מוכנים
          </button>
        </div>
      </Screen>
    );

  return (
    <Screen>
      <TopBar onBack={onExit} title="המסלול של יצחקי" />
      {header}
      <section className={`card p-5 animate-pop ${kind === 'boss' ? 'border-cherry-500/70' : kind === 'special' ? 'border-amber-400/70' : ''}`} key={stepKey}>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-400">
          <span aria-hidden>{game.emoji}</span>
          <span className="font-bold text-amber-300">{game.title}</span>
          {doubled && <span className="chip border-cherry-400 py-0 text-cherry-300">🎲 כפול או כלום</span>}
        </div>
        {q.type === 'single' ? (
          <p className="whitespace-pre-line font-display text-[1.6rem] leading-snug text-white">{q.round.prompt}</p>
        ) : (
          <p className="font-display text-2xl text-white">
            איזה מהם — <span className="text-amber-300">{game.options[q.target]}</span>?
          </p>
        )}
      </section>

      {phase === 'ask' && <div className="my-3"><CountdownBar left={timer.left} max={timer.max} /></div>}

      {q.type === 'single' ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {optionEntries.map(([k, label], i) => {
            const isTruth = phase === 'reveal' && k === truth;
            const isWrongPick = phase === 'reveal' && result?.picked === k && k !== truth;
            return (
              <button
                key={k}
                disabled={phase !== 'ask'}
                onClick={() => answer(k)}
                className={`${i === 0 ? 'btn-amber' : 'btn-cherry'} min-h-[76px] text-xl disabled:opacity-100 ${phase === 'reveal' && !isTruth ? 'opacity-40' : ''} ${isTruth ? 'ring-4 ring-white' : ''} ${isWrongPick ? 'animate-shake' : ''}`}
              >
                {isTruth && '✓ '}
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {q.items.map((r, i) =>
            hidden === i ? null : (
              <button
                key={r.id}
                disabled={phase !== 'ask'}
                onClick={() => answer(i)}
                className={`card w-full p-4 text-start text-lg text-white transition active:scale-[.98] ${
                  phase === 'reveal' ? (i === q.answerIndex ? 'border-amber-400 bg-amber-400/10' : result?.picked === i ? 'border-cherry-500 opacity-70' : 'opacity-50') : ''
                }`}
              >
                {phase === 'reveal' && i === q.answerIndex && <span className="me-1 text-amber-300">✓</span>}
                {r.prompt}
              </button>
            )
          )}
        </div>
      )}

      {phase === 'ask' && (
        <div className="mt-5 grid grid-cols-4 gap-2" aria-label="כוחות מיוחדים">
          {POWERUPS.map((pu) => {
            const n = run.powerups[pu.id];
            const off = n < 1 || (pu.id === 'fifty' && (q.type !== 'triple' || hidden != null));
            return (
              <button
                key={pu.id}
                disabled={off}
                onClick={() => use(pu.id)}
                aria-pressed={pu.id === 'double' ? doubled : undefined}
                title={pu.hint}
                className={`relative flex min-h-[60px] flex-col items-center justify-center rounded-2xl border text-xs font-bold transition active:scale-95 disabled:opacity-30 ${
                  pu.id === 'double' && doubled ? 'border-cherry-400 bg-cherry-500/20 text-cherry-200' : 'border-ink-700 bg-ink-900 text-ink-200'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {pu.icon}
                </span>
                {pu.label}
                <span className="absolute -top-1.5 left-1 rounded-full bg-ink-700 px-1.5 text-[11px] tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {phase === 'reveal' && result && (
        <div className="mt-4 space-y-3 animate-rise">
          <div className={`rounded-3xl p-4 text-center ${result.correct ? 'bg-amber-400 text-ink-950' : 'bg-cherry-500 text-white'}`}>
            <div className="font-display text-3xl">{result.correct ? `+${fmt(result.points)}` : result.picked == null ? 'נגמר הזמן' : 'לא הפעם'}</div>
            {!result.correct && <div className="text-sm font-bold">{doubled ? 'הכפול עלה לך שני לבבות' : 'הלך לב'}</div>}
          </div>
          {q.type === 'single' && <CrowdLine stat={crowdFor(crowd, q.round.id, truth)} loading={crowdLoading} />}
          {q.type === 'single' && openSecret(q.round).rv && (
            <p className="rounded-2xl bg-ink-950/60 p-3 text-sm italic text-ink-400">מהחשיפה בפודקאסט: ״{openSecret(q.round).rv}״</p>
          )}
          <button className="btn-amber w-full text-xl" onClick={() => advance(run)} autoFocus>
            {run.lives <= 0 ? 'לסיכום' : 'הבא ←'}
          </button>
        </div>
      )}
    </Screen>
  );
}

function AvatarMini() {
  const p = useProfile();
  return <Avatar charId={p.equipped.char} skinId={p.equipped.skin} size={48} animated={false} />;
}
