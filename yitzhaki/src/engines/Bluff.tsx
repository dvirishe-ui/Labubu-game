import { useState } from 'react';
import { PassScreen } from '../components/ui';
import { openSecret } from '../lib/deck';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, VoteGrid, type EngineProps } from './common';

/** הבלוף הגדול: one player sees the real answer and argues for the truth — or a bluff. */
export default function Bluff({ round, game, participants, roundIndex, onDone }: EngineProps) {
  const bluffer = participants[roundIndex % participants.length];
  const voters = participants.filter((p) => p.id !== bluffer.id);
  const truth = openSecret(round).a!;
  const other = Object.keys(game.options).find((k) => k !== truth)!;
  const [step, setStep] = useState<'cover' | 'brief' | 'argue' | 'reveal'>('cover');
  const [argue, setArgue] = useState<string>(truth);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const card = (
    <PromptCard game={{ ...game, title: 'הבלוף הגדול', subtitle: `${game.title} · ${bluffer.name} יודע/ת את התשובה`, emoji: '🃏' }}>{round.prompt}</PromptCard>
  );

  if (step === 'cover') return <PassScreen name={bluffer.name} note="את/ה הבלופר/ית בסיבוב הזה." onReady={() => setStep('brief')} />;
  if (step === 'brief')
    return (
      <div className="space-y-4">
        {card}
        <div className="card p-4 text-center">
          <p className="text-ink-400">התשובה האמיתית (לפי הפודקאסט):</p>
          <p className="font-display text-4xl text-amber-400">{game.options[truth]}</p>
        </div>
        <p className="text-center">על מה תשכנע/י את כולם?</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-amber min-h-[64px]" onClick={() => (setArgue(truth), setStep('argue'))}>
            על האמת
          </button>
          <button className="btn-cherry min-h-[64px]" onClick={() => (setArgue(other), setStep('argue'))}>
            בלוף: "{game.options[other]}"
          </button>
        </div>
      </div>
    );

  if (step === 'argue')
    return (
      <div className="space-y-4">
        {card}
        <p className="text-center text-lg">
          {bluffer.name} משכנע/ת עכשיו בקול. אחר כך — כל השאר מצביעים.
        </p>
        <VoteGrid participants={voters} options={Object.entries(game.options)} votes={votes} onVote={(pid, v) => setVotes((x) => ({ ...x, [pid]: v }))} />
        <button
          className="btn-cherry w-full text-xl"
          disabled={!Object.keys(votes).length}
          onClick={() => {
            sfx.reveal();
            setStep('reveal');
          }}
        >
          חשיפה
        </button>
      </div>
    );

  const deltas: Record<string, number> = { [bluffer.id]: 0 };
  let convinced = 0;
  for (const [pid, v] of Object.entries(votes)) {
    deltas[pid] = v === truth ? 1 : 0;
    if (v === argue) convinced++;
  }
  deltas[bluffer.id] = convinced;
  const bluffed = argue !== truth;
  return (
    <div className="space-y-4 animate-pop">
      {card}
      <div className={`rounded-3xl p-6 text-center ${truth === Object.keys(game.options)[0] ? 'bg-amber-400 text-ink-950' : 'bg-cherry-500 text-white'}`}>
        <div className="text-sm font-bold opacity-80">לפי מה שנחשף בפודקאסט</div>
        <div className="font-display text-5xl">{game.options[truth]}</div>
      </div>
      <p className="text-center text-lg">
        {bluffer.name} {bluffed ? 'בלפ/ה' : 'אמר/ה את האמת'} ושכנע/ה {convinced} מתוך {voters.length} (+{convinced})
      </p>
      {openSecret(round).rv && (
        <PodcastNote title="מה נאמר בחשיפה">
          <p className="italic">״{openSecret(round).rv}״</p>
        </PodcastNote>
      )}
      <NextButton
        onClick={() =>
          onDone(deltas, {
            fooled: bluffed ? { [bluffer.id]: convinced } : {},
            correct: Object.keys(votes).filter((k) => votes[k] === truth),
            answeredBy: Object.keys(votes)
          })
        }
      />
    </div>
  );
}
