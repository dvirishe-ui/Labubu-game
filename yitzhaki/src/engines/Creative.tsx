import { useMemo, useState } from 'react';
import { openSecret } from '../lib/deck';
import { shuffle } from '../lib/rng';
import { scoreCreative } from '../lib/scoring';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, useSecretTurns, type EngineProps } from './common';

export default function Creative({ round, game, participants, onDone }: EngineProps) {
  const writes = useSecretTurns<string>(participants);
  const votes = useSecretTurns<string>(participants);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);

  // Anonymous answer ids: shuffled per round so position doesn't give the author away.
  const answers = useMemo(() => {
    if (!writes.done) return [];
    const list = participants.filter((p) => writes.results[p.id]?.trim()).map((p) => ({ id: 'a-' + p.id, author: p.id, text: writes.results[p.id].trim() }));
    return shuffle(list, round.id + ':answers');
  }, [writes.done, writes.results, participants, round.id]);
  const authors = Object.fromEntries(answers.map((a) => [a.id, a.author]));
  const deltas = votes.done ? scoreCreative(authors, votes.results) : {};
  const info = useMemo(() => (revealed ? openSecret(round) : null), [revealed, round]);

  const prompt = <PromptCard game={game}>{round.prompt}</PromptCard>;

  if (!writes.done) {
    const submit = () => {
      writes.submit(draft.trim() || '…');
      setDraft('');
    };
    return (
      <div className="space-y-4">
        {writes.cover('כותבים בסתר. אף אחד לא יודע מי כתב מה.')}
        {prompt}
        <label className="label" htmlFor="creative-answer">
          {writes.current.name}, התשובה שלך:
        </label>
        <textarea id="creative-answer" className="input min-h-[120px] py-3" maxLength={220} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="הכי מצחיק שאפשר…" />
        <button className="btn-amber w-full text-xl" disabled={!draft.trim()} onClick={submit}>
          שליחה
        </button>
      </div>
    );
  }

  if (!votes.done) {
    const mine = 'a-' + votes.current.id;
    return (
      <div className="space-y-4">
        {votes.cover('הצבעה סודית. אי אפשר להצביע לעצמך.')}
        {prompt}
        <p className="text-center text-ink-400">{votes.current.name}, מה הכי מצחיק?</p>
        <div className="space-y-2">
          {answers.map((a) => (
            <button
              key={a.id}
              disabled={a.id === mine}
              onClick={() => votes.submit(a.id)}
              className="card w-full p-4 text-start text-lg text-white transition active:scale-[.98] disabled:opacity-40"
            >
              {a.text}
              {a.id === mine && <span className="ms-2 text-sm text-ink-400">(שלך)</span>}
            </button>
          ))}
        </div>
        {answers.length < 2 && (
          <button className="btn-ghost w-full" onClick={() => votes.submit('')}>
            אין למי להצביע — דלג
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prompt}
      {!revealed ? (
        <button
          className="btn-amber w-full text-xl"
          onClick={() => {
            sfx.reveal();
            setRevealed(true);
          }}
        >
          מי כתב מה? חשיפה!
        </button>
      ) : (
        <div className="space-y-2 animate-pop">
          {answers
            .slice()
            .sort((a, b) => (deltas[b.author] ?? 0) - (deltas[a.author] ?? 0))
            .map((a, i) => (
              <div key={a.id} className={`card p-4 ${i === 0 && deltas[a.author] ? 'border-amber-400' : ''}`}>
                <p className="text-lg text-white">{a.text}</p>
                <p className="mt-1 text-sm text-ink-400">
                  {participants.find((p) => p.id === a.author)?.name} · {deltas[a.author] ?? 0} קולות {i === 0 && deltas[a.author] ? '🏆' : ''}
                </p>
              </div>
            ))}
          {!!info?.pn.length && (
            <PodcastNote title="השראה מהאולפן (לא 'התשובה הנכונה')">
              <ul className="list-inside list-disc text-sm">
                {info.pn.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </PodcastNote>
          )}
          <NextButton onClick={() => onDone(deltas)} />
        </div>
      )}
    </div>
  );
}
