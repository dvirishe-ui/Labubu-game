import { useEffect, useMemo, useState } from 'react';
import { openSecret } from '../lib/deck';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sound';
import { NextButton, PromptCard, useSecretTurns, type EngineProps } from './common';

/** מי כתב את זה?: players write convincing fakes; everyone tries to spot the item that really aired. */
export default function WhoWrote({ round, game, participants, onDone }: EngineProps) {
  const writes = useSecretTurns<string>(participants);
  const picks = useSecretTurns<string>(participants);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (picks.done) sfx.reveal();
  }, [picks.done]);
  const header = { ...game, title: 'מי כתב את זה?', subtitle: `בסגנון: ${game.title}`, emoji: '✍️' };

  const options = useMemo(() => {
    if (!writes.done) return [];
    const fakes = participants.filter((p) => writes.results[p.id]?.trim()).map((p) => ({ id: 'w-' + p.id, author: p.id as string | null, text: writes.results[p.id].trim() }));
    return shuffle([{ id: 'real', author: null, text: round.prompt }, ...fakes], round.id + ':ww');
  }, [writes.done, writes.results, participants, round]);

  if (!writes.done)
    return (
      <div className="space-y-4">
        {writes.cover('כותבים בסתר.')}
        <PromptCard game={header}>
          <span className="text-xl">כתבו פריט מזויף בסגנון "{game.subtitle}" — כזה שיבלבל את כולם.</span>
        </PromptCard>
        <label className="label" htmlFor="ww-draft">
          {writes.current.name}, הזיוף שלך:
        </label>
        <textarea id="ww-draft" className="input min-h-[110px] py-3" maxLength={160} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button
          className="btn-amber w-full text-xl"
          disabled={!draft.trim()}
          onClick={() => {
            writes.submit(draft.trim());
            setDraft('');
          }}
        >
          שליחה
        </button>
      </div>
    );

  if (!picks.done)
    return (
      <div className="space-y-4">
        {picks.cover('בחירה סודית.')}
        <PromptCard game={header}>
          <span className="text-xl">איזה מהם הופיע באמת בפודקאסט?</span>
        </PromptCard>
        <p className="text-center text-ink-400">{picks.current.name}, מה האמיתי?</p>
        {options.map((o) => (
          <button key={o.id} disabled={o.author === picks.current.id} onClick={() => picks.submit(o.id)} className="card w-full p-4 text-start text-lg text-white disabled:opacity-40">
            {o.text}
            {o.author === picks.current.id && <span className="ms-2 text-sm text-ink-400">(שלך)</span>}
          </button>
        ))}
      </div>
    );

  const deltas: Record<string, number> = {};
  const fooled: Record<string, number> = {};
  for (const [pid, choice] of Object.entries(picks.results)) {
    if (choice === 'real') deltas[pid] = (deltas[pid] ?? 0) + 2;
    else {
      const author = choice.slice(2);
      deltas[author] = (deltas[author] ?? 0) + 1;
      fooled[author] = (fooled[author] ?? 0) + 1;
    }
  }
  const truth = openSecret(round).a;

  return (
    <div className="space-y-3 animate-pop">
      {options.map((o) => {
        const votes = Object.values(picks.results).filter((v) => v === o.id).length;
        return (
          <div key={o.id} className={`card p-4 ${o.author ? '' : 'border-amber-400 bg-amber-400/10'}`}>
            <p className="text-lg text-white">{o.text}</p>
            <p className="mt-1 text-sm text-ink-400">
              {o.author ? `נכתב ע״י ${participants.find((p) => p.id === o.author)?.name} (תוכן שחקנים)` : `מהפודקאסט${truth ? ` · ${game.options[truth] ?? ''}` : ''}`} · {votes} בחרו
            </p>
          </div>
        );
      })}
      <NextButton onClick={() => onDone(deltas, { fooled, correct: Object.keys(picks.results).filter((k) => picks.results[k] === 'real'), answeredBy: Object.keys(picks.results) })} />
    </div>
  );
}
