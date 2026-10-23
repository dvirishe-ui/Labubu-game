import { useEffect, useMemo, useState } from 'react';
import { Timer } from '../components/ui';
import { openSecret } from '../lib/deck';
import { majority, minorityVoters, scoreMajority, scoreMajorityPrediction, scoreMinority, tally } from '../lib/scoring';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, VoteGrid, useSecretTurns, type EngineProps } from './common';

interface Ballot {
  vote: string;
  predict?: string;
}

export default function Dilemma({ round, game, participants, config, step, roundIndex, onDone }: EngineProps) {
  const options: [string, string][] = round.choices?.length === 2 ? [['a', round.choices[0]], ['b', round.choices[1]]] : (Object.entries(game.options) as [string, string][]);
  const label = Object.fromEntries(options);
  const secretInfo = useMemo(() => openSecret(round), [round]);
  const [phase, setPhase] = useState<'debate' | 'vote' | 'reveal'>('debate');
  const [openVotes, setOpenVotes] = useState<Record<string, string>>({});
  const [handCount, setHandCount] = useState(0);
  const [stage, setStage] = useState<'vote' | 'predict'>('vote');
  const [pending, setPending] = useState<string | null>(null);
  const secret = useSecretTurns<Ballot>(participants);
  const mode = step.mode ?? config.decisionMode ?? (config.predictMajority ? 'predict' : 'free');
  const useSecret = config.secretVotes || mode === 'predict' || mode === 'whochose';
  const handMode = !useSecret && mode === 'free' && config.mode === 'players' && participants.length > 4;
  const target = participants[roundIndex % participants.length];
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [guessDone, setGuessDone] = useState(false);

  useEffect(() => {
    if (useSecret && secret.done && phase === 'vote') reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret.done]);

  const reveal = () => {
    sfx.reveal();
    setPhase('reveal');
  };

  const votes: Record<string, string> = useSecret
    ? Object.fromEntries(Object.entries(secret.results).map(([k, b]) => [k, b.vote]))
    : handMode
      ? Object.fromEntries(participants.map((p, i) => [p.id, i < handCount ? options[0][0] : options[1][0]]))
      : openVotes;
  const predictions: Record<string, string> = useSecret
    ? Object.fromEntries(Object.entries(secret.results).flatMap(([k, b]) => (b.predict ? [[k, b.predict]] : [])))
    : {};
  const deltas: Record<string, number> =
    mode === 'predict'
      ? scoreMajorityPrediction(votes, predictions)
      : mode === 'majority'
        ? scoreMajority(votes)
        : mode === 'minority'
          ? scoreMinority(votes)
          : mode === 'whochose' && guessDone
            ? Object.fromEntries(Object.entries(guesses).map(([pid, g]) => [pid, g === votes[target.id] ? 1 : 0]))
            : {};
  const modeNote: Record<string, string> = {
    majority: 'הרוב קובע: נקודה למי שבחר כמו הרוב.',
    minority: 'הכבשה השחורה: נקודה למי שבחר כמו המיעוט.',
    predict: 'נקודה למי שניחש מה הרוב יבחר.',
    whochose: `אחרי ההצבעה: מנחשים מה ${target.name} בחר/ה.`
  };

  const prompt = (
    <PromptCard
      game={game}
      footer={secretInfo.fee ? <div className="mt-3 inline-block rounded-full bg-amber-400 px-4 py-1 font-display text-xl text-ink-950">💰 {secretInfo.fee}</div> : null}
    >
      {round.prompt}
    </PromptCard>
  );

  if (phase === 'debate') {
    return (
      <div className="space-y-4">
        {prompt}
        <p className="text-center text-ink-400">אין פה תשובה נכונה. תתווכחו — ואז מצביעים.</p>
        {modeNote[mode] && <p className="text-center text-sm font-bold text-amber-300">{modeNote[mode]}</p>}
        <Timer seconds={config.timer} running onEnd={() => setPhase('vote')} keyId={round.id + ':debate'} />
        <button className="btn-amber w-full text-xl" onClick={() => setPhase('vote')}>
          להצבעה
        </button>
      </div>
    );
  }

  if (phase === 'vote' && useSecret && !secret.done) {
    const pick = (v: string) => {
      if (mode !== 'predict') return secret.submit({ vote: v });
      sfx.tap();
      setPending(v);
      setStage('predict');
    };
    return (
      <>
        {secret.cover('הצבעה אנונימית — אף אחד לא רואה מה בחרת.')}
        {prompt}
        <p className="mt-4 text-center text-lg text-ink-200">
          {stage === 'vote' ? `${secret.current.name}, מה את/ה עושה?` : 'ומה הרוב יגיד? (נקודה למי שצודק)'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {options.map(([k, l], i) => (
            <button
              key={k}
              className={i === 0 ? 'btn-amber min-h-[72px] text-xl' : 'btn-cherry min-h-[72px] text-xl'}
              onClick={() => {
                if (stage === 'vote') return pick(k);
                secret.submit({ vote: pending!, predict: k });
                setStage('vote');
                setPending(null);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (phase === 'vote') {
    return (
      <div className="space-y-4">
        {prompt}
        {handMode ? (
          <div className="card p-5 text-center">
            <p className="mb-3 text-lg">ידיים למעלה: כמה {options[0][1]}?</p>
            <div className="flex items-center justify-center gap-4">
              <button className="btn-ghost w-16 text-2xl" onClick={() => setHandCount((n) => Math.max(0, n - 1))} aria-label="פחות">
                −
              </button>
              <span className="w-16 font-display text-5xl text-amber-400 tabular-nums">{handCount}</span>
              <button className="btn-ghost w-16 text-2xl" onClick={() => setHandCount((n) => Math.min(participants.length, n + 1))} aria-label="יותר">
                +
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-400">מתוך {participants.length}</p>
          </div>
        ) : (
          <VoteGrid participants={participants} options={options} votes={openVotes} onVote={(pid, v) => setOpenVotes((x) => ({ ...x, [pid]: v }))} />
        )}
        <button className="btn-amber w-full text-xl" disabled={!handMode && !Object.keys(openVotes).length} onClick={reveal}>
          הראו את התוצאות
        </button>
      </div>
    );
  }

  if (mode === 'whochose' && !guessDone && votes[target.id]) {
    const guessers = participants.filter((x) => x.id !== target.id);
    return (
      <div className="space-y-4">
        {prompt}
        <p className="text-center text-lg">
          מה <b className="text-amber-300">{target.name}</b> בחר/ה?
        </p>
        <VoteGrid participants={guessers} options={options} votes={guesses} onVote={(pid, v) => setGuesses((g) => ({ ...g, [pid]: v }))} />
        <button className="btn-amber w-full text-xl" disabled={!Object.keys(guesses).length} onClick={() => setGuessDone(true)}>
          חשיפה
        </button>
      </div>
    );
  }

  const t = tally(votes);
  const total = Object.values(t).reduce((a, b) => a + b, 0) || 1;
  const m = majority(votes);
  return (
    <div className="space-y-4">
      {prompt}
      <div className="card space-y-3 p-5 animate-pop" aria-live="polite">
        {options.map(([k, l], i) => {
          const n = t[k] ?? 0;
          return (
            <div key={k}>
              <div className="mb-1 flex justify-between text-lg font-bold">
                <span>
                  {l} {m === k && '👑'}
                </span>
                <span className="tabular-nums">{Math.round((n / total) * 100)}%</span>
              </div>
              <div className="h-5 overflow-hidden rounded-full bg-ink-700">
                <div className={`h-full rounded-full transition-[width] duration-700 ${i === 0 ? 'bg-amber-400' : 'bg-cherry-500'}`} style={{ width: `${(n / total) * 100}%` }} />
              </div>
            </div>
          );
        })}
        {!m && <p className="text-center text-ink-400">תיקו מושלם. אין רוב.</p>}
        {!useSecret && !handMode && (
          <div className="flex flex-wrap gap-2 pt-1">
            {participants.map((p) =>
              votes[p.id] ? (
                <span key={p.id} className="chip">
                  {p.name}: {label[votes[p.id]]}
                </span>
              ) : null
            )}
          </div>
        )}
        {mode === 'whochose' && votes[target.id] && (
          <p className="text-sm text-ink-400">
            {target.name} בחר/ה: <b className="text-white">{label[votes[target.id]]}</b> · צדקו: {participants.filter((p) => deltas[p.id]).map((p) => p.name).join(', ') || 'אף אחד'}
          </p>
        )}
        {(mode === 'majority' || mode === 'minority') && (
          <p className="text-sm text-ink-400">נקודה ל: {participants.filter((p) => deltas[p.id]).map((p) => p.name).join(', ') || 'אף אחד (תיקו)'}</p>
        )}
        {mode === 'predict' && (
          <p className="text-sm text-ink-400">נקודה למי שניחש מה הרוב יגיד: {participants.filter((p) => deltas[p.id]).map((p) => p.name).join(', ') || 'אף אחד'}</p>
        )}
      </div>
      {!!secretInfo.pn.length && (
        <PodcastNote title="מה אמרו באולפן (דעה, לא תשובה נכונה)">
          <ul className="list-inside list-disc text-sm">
            {secretInfo.pn.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </PodcastNote>
      )}
      <NextButton onClick={() => onDone(deltas, { unpopular: handMode ? [] : minorityVoters(votes) })} />
    </div>
  );
}
