import { useEffect, useMemo, useState } from 'react';
import { Timer } from '../components/ui';
import { openSecret } from '../lib/deck';
import { scoreBinary } from '../lib/scoring';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, VoteGrid, useSecretTurns, type EngineProps } from './common';

export default function RealFake({ round, game, participants, config, onDone }: EngineProps) {
  const options = Object.entries(game.options) as [string, string][];
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'vote' | 'drum' | 'reveal'>('vote');
  const secret = useSecretTurns<string>(participants);
  const allIn = participants.every((p) => votes[p.id]);

  useEffect(() => {
    if (config.secretVotes && secret.done && phase === 'vote') {
      setVotes(secret.results);
      lock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret.done]);

  const lock = () => {
    sfx.reveal();
    setPhase('drum');
    setTimeout(() => setPhase('reveal'), 1300);
  };

  const s = useMemo(() => (phase === 'reveal' ? openSecret(round) : null), [phase, round]);
  const deltas = s?.a ? scoreBinary(votes, s.a) : {};

  useEffect(() => {
    if (phase !== 'reveal' || !s?.a) return;
    Object.values(deltas).some((d) => d > 0) ? sfx.good() : sfx.bad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (config.secretVotes && !secret.done) {
    return (
      <>
        {secret.cover('בחרו בסתר. אף אחד לא רואה.')}
        <PromptCard game={game}>{round.prompt}</PromptCard>
        <p className="mt-4 text-center text-ink-400">
          {secret.current.name}, מה דעתך? ({secret.index + 1}/{participants.length})
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {options.map(([k, label], i) => (
            <button key={k} className={i === 0 ? 'btn-amber min-h-[72px] text-xl' : 'btn-cherry min-h-[72px] text-xl'} onClick={() => secret.submit(k)}>
              {label}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <PromptCard game={game}>{round.prompt}</PromptCard>
      {phase === 'vote' && (
        <>
          <Timer seconds={config.timer} running={phase === 'vote'} onEnd={lock} keyId={round.id} />
          <VoteGrid participants={participants} options={options} votes={votes} onVote={(pid, v) => setVotes((x) => ({ ...x, [pid]: v }))} />
          <button className="btn-amber w-full text-xl" disabled={!Object.keys(votes).length} onClick={lock}>
            {allIn ? 'נועלים — חשיפה!' : `חשיפה (${Object.keys(votes).length}/${participants.length} הצביעו)`}
          </button>
        </>
      )}
      {phase === 'drum' && (
        <div className="card animate-pulse p-8 text-center font-display text-3xl text-amber-400" aria-live="polite">
          והתשובה היא…
        </div>
      )}
      {phase === 'reveal' && s && (
        <div className="animate-pop" aria-live="polite">
          <div className={`rounded-3xl p-6 text-center ${s.a === options[0][0] ? 'bg-amber-400 text-ink-950' : 'bg-cherry-500 text-white'}`}>
            <div className="text-sm font-bold opacity-80">לפי מה שנחשף בפודקאסט</div>
            <div className="font-display text-5xl">{s.a ? game.options[s.a] : '—'}</div>
            {s.ar && <div className="mt-1 text-lg font-bold">{s.ar}</div>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {participants.map((p) =>
              votes[p.id] ? (
                <span key={p.id} className={`chip ${deltas[p.id] ? 'border-amber-400 text-amber-300' : 'border-ink-600 text-ink-400 line-through'}`}>
                  {deltas[p.id] ? '✓' : '✗'} {p.name}
                </span>
              ) : null
            )}
          </div>
          {s.rv && (
            <PodcastNote title="מה נאמר בחשיפה (מתוך הכתוביות האוטומטיות)">
              <p className="italic">״{s.rv}״</p>
              {s.rn && <p className="mt-1 text-sm text-ink-400">{s.rn}</p>}
            </PodcastNote>
          )}
          {!!s.gs.length && (
            <PodcastNote title="מה ניחשו באולפן">
              <ul className="list-inside list-disc text-sm">
                {s.gs.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </PodcastNote>
          )}
          <NextButton onClick={() => onDone(deltas, { correct: Object.keys(deltas).filter((k) => deltas[k] > 0), answeredBy: Object.keys(votes) })} />
        </div>
      )}
    </div>
  );
}
