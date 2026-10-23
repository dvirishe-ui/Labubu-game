import { useState } from 'react';
import { openSecret } from '../lib/deck';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, type EngineProps } from './common';

/** הקרב על הגג: teams take turns; the other team may appeal the answer before the reveal. */
export default function Battle({ round, game, participants, roundIndex, onDone }: EngineProps) {
  const active = participants[roundIndex % 2];
  const rival = participants[(roundIndex + 1) % 2];
  const truth = openSecret(round).a!;
  const [answer, setAnswer] = useState<string | null>(null);
  const [appeal, setAppeal] = useState<boolean | null>(null);
  const card = (
    <PromptCard game={{ ...game, title: 'הקרב על הגג', subtitle: `${game.title} · תור: ${active.name}`, emoji: '⚔️' }}>{round.prompt}</PromptCard>
  );

  if (!answer)
    return (
      <div className="space-y-4">
        {card}
        <p className="text-center text-lg">
          <b className="text-amber-300">{active.name}</b>, מה התשובה?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(game.options).map(([k, l], i) => (
            <button key={k} className={i === 0 ? 'btn-amber min-h-[72px] text-xl' : 'btn-cherry min-h-[72px] text-xl'} onClick={() => (sfx.lock(), setAnswer(k))}>
              {l}
            </button>
          ))}
        </div>
      </div>
    );

  if (appeal === null)
    return (
      <div className="space-y-4">
        {card}
        <p className="text-center text-lg">
          {active.name} ענו: <b>{game.options[answer]}</b>.<br />
          <b className="text-cherry-300">{rival.name}</b> — מערערים?
        </p>
        <p className="text-center text-sm text-ink-400">ערעור נכון: +2 לכם. ערעור שגוי: +1 בונוס ליריבה.</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost min-h-[64px]" onClick={() => (sfx.reveal(), setAppeal(false))}>
            מסכימים
          </button>
          <button className="btn-cherry min-h-[64px]" onClick={() => (sfx.reveal(), setAppeal(true))}>
            מערערים!
          </button>
        </div>
      </div>
    );

  const right = answer === truth;
  const deltas: Record<string, number> = { [active.id]: (right ? 2 : 0) + (appeal && right ? 1 : 0), [rival.id]: appeal && !right ? 2 : 0 };
  return (
    <div className="space-y-4 animate-pop">
      {card}
      <div className={`rounded-3xl p-6 text-center ${right ? 'bg-amber-400 text-ink-950' : 'bg-cherry-500 text-white'}`}>
        <div className="text-sm font-bold opacity-80">לפי מה שנחשף בפודקאסט</div>
        <div className="font-display text-5xl">{game.options[truth]}</div>
      </div>
      <p className="text-center text-lg">
        {active.name} +{deltas[active.id]} · {rival.name} +{deltas[rival.id]}
      </p>
      {openSecret(round).rv && (
        <PodcastNote title="מה נאמר בחשיפה">
          <p className="italic">״{openSecret(round).rv}״</p>
        </PodcastNote>
      )}
      <NextButton onClick={() => onDone(deltas, { correct: right ? [active.id] : [], answeredBy: [active.id] })} />
    </div>
  );
}
