import { useEffect, useMemo, useState } from 'react';
import { challengePoints, CHALLENGE_SECONDS, crowdFor } from '../lib/challenges';
import type { CrowdStats } from '../lib/cloud';
import { openSecret } from '../lib/deck';
import { recordAnswer } from '../lib/economy';
import { sfx } from '../lib/sound';
import { getCrowd, profileStore } from '../lib/store';
import type { GameMeta, Round } from '../lib/types';
import { fmt } from './Coins';
import { CountdownBar, CrowdLine, useCountdown } from './Countdown';

export interface ChallengeResult {
  score: number;
  correct: number;
  total: number;
}

/** Ten timed real/fake questions with live "against everyone" statistics after each answer. */
export interface ChallengeProgress {
  i: number;
  score: number;
  correct: number;
}

export function ChallengeRun({
  rounds,
  games,
  onFinish,
  resume,
  onProgress
}: {
  rounds: Round[];
  games: GameMeta[];
  onFinish: (r: ChallengeResult) => void;
  resume?: ChallengeProgress | null;
  onProgress?: (p: ChallengeProgress) => void;
}) {
  const [i, setI] = useState(resume?.i ?? 0);
  const [score, setScore] = useState(resume?.score ?? 0);
  const [correct, setCorrect] = useState(resume?.correct ?? 0);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [gain, setGain] = useState(0);
  const [crowd, setCrowd] = useState<CrowdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const round = rounds[i];
  const game = useMemo(() => games.find((g) => g.id === round?.gameId), [games, round]);
  const answered = picked !== undefined;
  const truth = round ? openSecret(round).a : null;
  const timer = useCountdown(CHALLENGE_SECONDS, !answered, String(i), () => choose(null));

  useEffect(() => {
    getCrowd().then((c) => {
      setCrowd(c);
      setLoading(false);
    });
  }, []);

  function choose(k: string | null) {
    if (answered || !round) return;
    const ok = k === truth;
    const pts = challengePoints(ok, timer.left);
    setPicked(k);
    setGain(pts);
    setScore((s) => s + pts);
    if (ok) setCorrect((c) => c + 1);
    // Saved as answered, so a reload continues from the next question instead of retrying this one.
    onProgress?.({ i: i + 1, score: score + pts, correct: correct + (ok ? 1 : 0) });
    ok ? sfx.good() : sfx.bad();
    profileStore.apply((x) => recordAnswer(x, round.id, k, ok));
  }

  useEffect(() => {
    if (!round && rounds.length) onFinish({ score, correct, total: rounds.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  if (!round || !game) return null;
  const last = i === rounds.length - 1;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-400">
        <span>
          שאלה {i + 1}/{rounds.length}
        </span>
        <span className="font-display text-2xl tabular-nums text-amber-400">{fmt(score)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-cherry-500 transition-[width]" style={{ width: `${(i / rounds.length) * 100}%` }} />
      </div>
      <section className="card p-5 animate-pop" key={round.id}>
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-400">
          <span aria-hidden>{game.emoji}</span>
          <span className="font-bold text-amber-300">{game.title}</span>
          <span>· {game.subtitle}</span>
        </div>
        <p className="whitespace-pre-line font-display text-[1.6rem] leading-snug text-white">{round.prompt}</p>
      </section>
      {!answered && <CountdownBar left={timer.left} max={timer.max} />}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(game.options).map(([k, l], idx) => {
          const isTruth = answered && k === truth;
          return (
            <button
              key={k}
              disabled={answered}
              onClick={() => choose(k)}
              className={`${idx === 0 ? 'btn-amber' : 'btn-cherry'} min-h-[76px] text-xl disabled:opacity-100 ${answered && !isTruth ? 'opacity-40' : ''} ${isTruth ? 'ring-4 ring-white' : ''}`}
            >
              {isTruth && '✓ '}
              {l}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="space-y-3 animate-rise">
          <p className={`text-center font-display text-3xl ${gain ? 'text-amber-400' : 'text-cherry-400'}`}>{gain ? `+${gain}` : picked === null ? 'נגמר הזמן' : 'טעות'}</p>
          <CrowdLine stat={crowdFor(crowd, round.id, truth)} loading={loading} />
          <button
            className="btn-amber w-full text-xl"
            autoFocus
            onClick={() => {
              if (last) return onFinish({ score, correct, total: rounds.length });
              setI((n) => n + 1);
              setPicked(undefined);
              setGain(0);
            }}
          >
            {last ? 'לתוצאה' : 'הבא ←'}
          </button>
        </div>
      )}
    </div>
  );
}
