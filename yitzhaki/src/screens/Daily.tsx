import { useEffect, useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { ChallengeRun, type ChallengeProgress, type ChallengeResult } from '../components/ChallengeRun';
import { CoinPill, fmt } from '../components/Coins';
import { Confetti, Screen, TopBar } from '../components/ui';
import { dailyBoard, dailyRounds, weeklyBoard, CHALLENGE_SIZE, type BoardRow } from '../lib/challenges';
import { finishDaily, REWARDS } from '../lib/economy';
import { getPlayers, profileStore, useProfileState } from '../lib/store';
import { dayKey, weekDays } from '../lib/time';
import type { GameMeta, Round } from '../lib/types';

export default function Daily({ games, rounds, onBack, onDuel }: { games: GameMeta[]; rounds: Round[]; onBack: () => void; onDuel: () => void }) {
  const { profile: p, cloud } = useProfileState();
  const today = dayKey();
  const set = useMemo(() => dailyRounds(rounds, games, today), [rounds, games, today]);
  const mine = p.daily[today];
  const progress = p.dailyProgress;
  const resume: ChallengeProgress | null = progress?.day === today && !mine ? progress : null;
  const [playing, setPlaying] = useState(!!resume);
  const [justDone, setJustDone] = useState<ChallengeResult | null>(null);
  const [tab, setTab] = useState<'day' | 'week'>('day');
  const [rows, setRows] = useState<{ day: BoardRow[]; week: BoardRow[] } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (playing) return;
    getPlayers(true).then((ps) => {
      setRows(ps ? { day: dailyBoard(ps, today), week: weeklyBoard(ps, weekDays()) } : null);
      setLoaded(true);
    });
  }, [playing, today, mine]);

  if (playing)
    return (
      <Screen>
        <TopBar title="האתגר היומי" />
        <ChallengeRun
          rounds={set}
          games={games}
          resume={resume}
          onProgress={(pr) => profileStore.update((x) => ({ ...x, dailyProgress: { ...pr, day: today } }))}
          onFinish={(r) => {
            profileStore.apply((x) => finishDaily({ ...x, dailyProgress: null }, today, r.score, r.correct, r.total));
            setJustDone(r);
            setPlaying(false);
          }}
        />
      </Screen>
    );

  const myRank = rows && cloud ? rows.day.findIndex((r) => r.id === cloud.userId) + 1 : 0;
  return (
    <Screen>
      <TopBar onBack={onBack} title="האתגר היומי" right={<CoinPill coins={p.coins} />} />
      {justDone && justDone.correct === justDone.total && <Confetti />}
      <section className="card mb-5 overflow-hidden p-5 text-center">
        <p className="text-sm text-ink-400">{new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        {mine ? (
          <>
            <p className="mt-2 font-display text-6xl tabular-nums text-amber-400 animate-pop">{fmt(mine.score)}</p>
            <p className="text-ink-200">
              {mine.correct}/{CHALLENGE_SIZE} נכונות {myRank ? `· מקום ${myRank} היום` : ''}
            </p>
            <p className="mt-2 text-xs text-ink-400">ניסיון אחד מדורג ביום. אתגר חדש מחר בחצות.</p>
          </>
        ) : (
          <>
            <h2 className="mt-2 font-display text-3xl text-white">{CHALLENGE_SIZE} שאלות. ניסיון אחד.</h2>
            <p className="mt-1 text-ink-200">אותן שאלות לכל השחקנים היום. מהירות שווה נקודות.</p>
            <p className="mt-1 text-sm text-amber-300">
              +{REWARDS.daily} מטבעות על סיום, +{REWARDS.dailyPerfect} על 10/10
            </p>
            <button
              className="btn-amber mt-4 w-full text-2xl"
              onClick={() => {
                profileStore.update((x) => ({ ...x, dailyProgress: { day: today, i: 0, score: 0, correct: 0 } }));
                setPlaying(true);
              }}
              disabled={set.length < CHALLENGE_SIZE}
            >
              {resume ? 'ממשיכים מאיפה שעצרת' : 'מתחילים'}
            </button>
          </>
        )}
      </section>

      {mine && (
        <button className="btn-cherry mb-5 w-full" onClick={onDuel}>
          🥊 תנצח אותי — לאתגר חבר
        </button>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-ink-800 p-1" role="tablist">
        {(['day', 'week'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-[44px] rounded-xl font-bold ${tab === t ? 'bg-amber-400 text-ink-950' : ''}`}>
            {t === 'day' ? 'היום' : 'השבוע'}
          </button>
        ))}
      </div>
      {loaded ? (
        <Board rows={rows ? rows[tab] : null} me={cloud?.userId ?? null} empty={tab === 'day' ? 'עוד אף אחד לא שיחק היום. תהיו ראשונים.' : 'עוד אין תוצאות השבוע.'} />
      ) : (
        <p className="text-center text-sm text-ink-400">טוענים טבלה…</p>
      )}
    </Screen>
  );
}
