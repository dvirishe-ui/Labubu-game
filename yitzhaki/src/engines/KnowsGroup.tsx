import { useMemo, useState } from 'react';
import { PassScreen } from '../components/ui';
import { openSecret } from '../lib/deck';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, VoteGrid, type EngineProps } from './common';

/** מי הכי מכיר את החבורה?: predict how one friend answers a podcast dilemma. */
export default function KnowsGroup({ round, game, participants, roundIndex, onDone }: EngineProps) {
  const subject = participants[roundIndex % participants.length];
  const others = participants.filter((p) => p.id !== subject.id);
  const options: [string, string][] = round.choices?.length === 2 ? [['a', round.choices[0]], ['b', round.choices[1]]] : (Object.entries(game.options) as [string, string][]);
  const fee = useMemo(() => openSecret(round).fee, [round]);
  const [step, setStep] = useState<'cover' | 'pick' | 'guess' | 'reveal'>('cover');
  const [choice, setChoice] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const card = (
    <PromptCard
      game={{ ...game, title: 'מי הכי מכיר את החבורה?', subtitle: `${game.title} · מה ${subject.name} יבחר/תבחר?`, emoji: '🔮' }}
      footer={fee ? <div className="mt-3 inline-block rounded-full bg-amber-400 px-4 py-1 font-display text-xl text-ink-950">💰 {fee}</div> : null}
    >
      {round.prompt}
    </PromptCard>
  );

  if (step === 'cover') return <PassScreen name={subject.name} note="בוחרים בסתר. כולם ינסו לנחש." onReady={() => setStep('pick')} />;
  if (step === 'pick')
    return (
      <div className="space-y-4">
        {card}
        <div className="grid grid-cols-2 gap-3">
          {options.map(([k, l], i) => (
            <button key={k} className={i === 0 ? 'btn-amber min-h-[72px] text-xl' : 'btn-cherry min-h-[72px] text-xl'} onClick={() => (sfx.lock(), setChoice(k), setStep('guess'))}>
              {l}
            </button>
          ))}
        </div>
      </div>
    );
  if (step === 'guess')
    return (
      <div className="space-y-4">
        {card}
        <p className="text-center text-lg">
          מחזירים את הטלפון לכולם. מה <b className="text-amber-300">{subject.name}</b> בחר/ה?
        </p>
        <VoteGrid participants={others} options={options} votes={guesses} onVote={(pid, v) => setGuesses((g) => ({ ...g, [pid]: v }))} />
        <button className="btn-amber w-full text-xl" disabled={!Object.keys(guesses).length} onClick={() => (sfx.reveal(), setStep('reveal'))}>
          חשיפה
        </button>
      </div>
    );

  const deltas = Object.fromEntries(Object.entries(guesses).map(([pid, g]) => [pid, g === choice ? 1 : 0]));
  const label = Object.fromEntries(options);
  return (
    <div className="space-y-4 animate-pop">
      {card}
      <div className="rounded-3xl bg-amber-400 p-6 text-center text-ink-950">
        <div className="text-sm font-bold opacity-80">{subject.name} בחר/ה</div>
        <div className="font-display text-4xl">{label[choice!]}</div>
      </div>
      <p className="text-center">צדקו: {others.filter((o) => deltas[o.id]).map((o) => o.name).join(', ') || 'אף אחד — מכירים בכלל?'}</p>
      {!!openSecret(round).pn.length && (
        <PodcastNote title="מה אמרו באולפן (דעה)">
          <p className="text-sm">{openSecret(round).pn.join(' · ')}</p>
        </PodcastNote>
      )}
      <NextButton onClick={() => onDone(deltas)} />
    </div>
  );
}
