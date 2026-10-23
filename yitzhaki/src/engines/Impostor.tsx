import { useEffect, useMemo, useState } from 'react';
import { Timer } from '../components/ui';
import { hashSeed } from '../lib/rng';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, useSecretTurns, type EngineProps } from './common';

/** המתחזה של יצחקי: everyone gets the same podcast item except one player, who gets a similar one. */
export default function Impostor({ rounds, game, participants, config, onDone }: EngineProps) {
  const [shared, odd] = rounds;
  const impostor = useMemo(() => participants[hashSeed(shared.id + odd.id + participants.length) % participants.length], [shared, odd, participants]);
  const peek = useSecretTurns<true>(participants);
  const votes = useSecretTurns<string>(participants);
  const [phase, setPhase] = useState<'peek' | 'clues' | 'vote' | 'reveal'>('peek');
  useEffect(() => {
    if (phase === 'peek' && peek.done) setPhase('clues');
    if (phase === 'vote' && votes.done) {
      sfx.reveal();
      setPhase('reveal');
    }
  }, [phase, peek.done, votes.done]);
  const card = (
    <PromptCard game={{ ...game, title: 'המתחזה של יצחקי', subtitle: `פריטים מתוך: ${game.title}`, emoji: '🕵️' }}>
      <span className="text-xl">רמז אחד כל אחד/ת — בלי להסגיר את הפריט.</span>
    </PromptCard>
  );

  if (phase === 'peek') {
    if (peek.done) return null;
    const mine = peek.current.id === impostor.id ? odd : shared;
    return (
      <div className="space-y-4">
        {peek.cover('רק את/ה רואה את הפריט הזה.')}
        <p className="text-center text-ink-400">{peek.current.name}, הפריט שלך:</p>
        <section className="card p-5">
          <p className="whitespace-pre-line font-display text-2xl leading-snug text-white">{mine.prompt}</p>
        </section>
        <p className="text-center text-sm text-ink-400">אחד מכם קיבל פריט אחר — ואולי זה את/ה.</p>
        <button className="btn-amber w-full text-xl" onClick={() => peek.submit(true)}>
          זכרתי, להעביר הלאה
        </button>
      </div>
    );
  }

  if (phase === 'clues')
    return (
      <div className="space-y-4">
        {card}
        <p className="text-center text-lg">בסבב: כל אחד אומר מילה או שתיים על הפריט שלו.</p>
        <Timer seconds={config.timer ? Math.max(config.timer, 45) : 0} running keyId={shared.id + ':clues'} onEnd={() => setPhase('vote')} />
        <button className="btn-amber w-full text-xl" onClick={() => setPhase('vote')}>
          להצבעה — מי המתחזה?
        </button>
      </div>
    );

  if (phase === 'vote' && !votes.done)
    return (
      <div className="space-y-4">
        {votes.cover('הצבעה סודית: מי המתחזה?')}
        {card}
        <p className="text-center text-ink-400">{votes.current.name}, מי לדעתך המתחזה?</p>
        <div className="grid grid-cols-2 gap-2">
          {participants
            .filter((x) => x.id !== votes.current.id)
            .map((x) => (
              <button key={x.id} className="btn-ghost min-h-[60px]" onClick={() => votes.submit(x.id)}>
                {x.name}
              </button>
            ))}
        </div>
      </div>
    );

  const counts: Record<string, number> = {};
  for (const v of Object.values(votes.results)) counts[v] = (counts[v] ?? 0) + 1;
  const most = Math.max(0, ...Object.values(counts));
  const caught = (counts[impostor.id] ?? 0) === most && Object.values(counts).filter((n) => n === most).length === 1;
  const deltas: Record<string, number> = {};
  if (caught) for (const [pid, v] of Object.entries(votes.results)) deltas[pid] = v === impostor.id ? 1 : 0;
  else deltas[impostor.id] = 2;

  return (
    <div className="space-y-4 animate-pop">
      <div className={`rounded-3xl p-6 text-center ${caught ? 'bg-amber-400 text-ink-950' : 'bg-cherry-500 text-white'}`}>
        <div className="text-sm font-bold opacity-80">המתחזה היה/תה</div>
        <div className="font-display text-5xl">{impostor.name}</div>
        <div className="mt-1 font-bold">{caught ? 'נתפס/ה! נקודה לכל מי שזיהה' : 'ברח/ה! +2 למתחזה'}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {participants.map((x) => (
          <span key={x.id} className="chip">
            {x.name}: {counts[x.id] ?? 0} קולות
          </span>
        ))}
      </div>
      <PodcastNote title={`הפריט של כולם (מהפודקאסט · ${game.title})`}>
        <p>{shared.prompt}</p>
      </PodcastNote>
      <PodcastNote title="הפריט של המתחזה (מהפודקאסט)">
        <p>{odd.prompt}</p>
      </PodcastNote>
      <NextButton onClick={() => onDone(deltas, { fooled: caught ? {} : { [impostor.id]: Object.values(votes.results).filter((v) => v !== impostor.id).length } })} />
    </div>
  );
}
