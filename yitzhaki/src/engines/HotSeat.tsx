import { useEffect, useState } from 'react';
import { PassScreen } from '../components/ui';
import { scoreHotSeat } from '../lib/scoring';
import { sfx } from '../lib/sound';
import { NextButton, PromptCard, VoteGrid, type EngineProps } from './common';

/** Purely theatrical needle — it never measures anything. */
function Needle({ wild }: { wild: boolean }) {
  const [pts, setPts] = useState<number[]>(() => Array(40).fill(20));
  useEffect(() => {
    const t = setInterval(() => setPts((p) => [...p.slice(1), 20 + (Math.random() - 0.5) * (wild ? 34 : 8)]), 70);
    return () => clearInterval(t);
  }, [wild]);
  return (
    <svg viewBox="0 0 200 40" className="h-20 w-full rounded-2xl bg-ink-950" aria-hidden>
      <polyline fill="none" stroke="#e0243f" strokeWidth="1.5" points={pts.map((y, i) => `${i * 5},${y}`).join(' ')} />
    </svg>
  );
}

export default function HotSeat({ round, game, participants, roundIndex, onDone }: EngineProps) {
  const seat = participants[roundIndex % participants.length];
  const judges = participants.filter((p) => p.id !== seat.id);
  const [step, setStep] = useState<'cover' | 'truth' | 'said' | 'judge' | 'machine' | 'reveal'>('cover');
  const [truth, setTruth] = useState<'yes' | 'no' | null>(null);
  const [said, setSaid] = useState<'yes' | 'no' | null>(null);
  const [judgments, setJudgments] = useState<Record<string, string>>({});
  const toldTruth = truth === said;
  const deltas = step === 'reveal' ? scoreHotSeat(seat.id, toldTruth, judgments) : {};

  const prompt = (
    <PromptCard game={game}>
      <span className="text-amber-300">{seat.name}</span>, {round.prompt}
    </PromptCard>
  );
  const disclaimer = <p className="text-center text-xs text-ink-400">🎭 בידור בלבד — האפליקציה לא מזהה שקרים ולא מודדת כלום.</p>;

  if (step === 'cover') return <PassScreen name={seat.name} note="את/ה בכיסא החם. קודם כל — תגיד/י לטלפון את האמת, בסתר." onReady={() => setStep('truth')} />;

  if (step === 'truth')
    return (
      <div className="space-y-4">
        {prompt}
        <p className="text-center text-lg">האמת (רק הטלפון יודע):</p>
        <div className="grid grid-cols-2 gap-3">
          {(['yes', 'no'] as const).map((v, i) => (
            <button
              key={v}
              className={i === 0 ? 'btn-amber min-h-[72px] text-2xl' : 'btn-cherry min-h-[72px] text-2xl'}
              onClick={() => {
                sfx.lock();
                setTruth(v);
                setStep('said');
              }}
            >
              {game.options[v]}
            </button>
          ))}
        </div>
      </div>
    );

  if (step === 'said')
    return (
      <div className="space-y-4">
        {prompt}
        <p className="text-center text-lg">
          עכשיו {seat.name} עונה <b>בקול</b> — מותר לשקר. מה נאמר?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(['yes', 'no'] as const).map((v) => (
            <button
              key={v}
              className="btn-ghost min-h-[64px] text-2xl"
              onClick={() => {
                setSaid(v);
                setStep('judge');
              }}
            >
              אמר/ה {game.options[v]}
            </button>
          ))}
        </div>
        {disclaimer}
      </div>
    );

  if (step === 'judge')
    return (
      <div className="space-y-4">
        {prompt}
        <p className="text-center text-ink-400">השופטים: אמת או שקר?</p>
        <VoteGrid
          participants={judges}
          options={[
            ['truth', 'אמת'],
            ['lie', 'שקר']
          ]}
          votes={judgments}
          onVote={(pid, v) => setJudgments((j) => ({ ...j, [pid]: v }))}
        />
        <button
          className="btn-cherry w-full text-xl"
          disabled={!Object.keys(judgments).length}
          onClick={() => {
            setStep('machine');
            sfx.reveal();
            setTimeout(() => setStep('reveal'), 2200);
          }}
        >
          מפעילים את ״המכונה״
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      {prompt}
      <Needle wild={step === 'machine' || !toldTruth} />
      {step === 'machine' ? (
        <p className="animate-pulse text-center font-display text-2xl text-amber-400">״מנתחים״…</p>
      ) : (
        <div className="animate-pop space-y-3">
          <div className={`rounded-3xl p-6 text-center ${toldTruth ? 'bg-amber-400 text-ink-950' : 'bg-cherry-500 text-white'}`}>
            <div className="font-display text-5xl">{toldTruth ? 'אמת' : 'שקר!'}</div>
            <div className="text-sm font-bold opacity-80">לפי מה ש{seat.name} סימן/ה בסתר</div>
          </div>
          <p className="text-center text-ink-200">
            {deltas[seat.id] ? `${seat.name} עבד/ה על רוב השופטים: +2` : 'צדקו: ' + (judges.filter((j) => deltas[j.id]).map((j) => j.name).join(', ') || 'אף אחד')}
          </p>
          {disclaimer}
          <NextButton onClick={() => onDone(deltas, { fooled: deltas[seat.id] ? { [seat.id]: judges.length - judges.filter((j) => deltas[j.id]).length } : {} })} />
        </div>
      )}
    </div>
  );
}
