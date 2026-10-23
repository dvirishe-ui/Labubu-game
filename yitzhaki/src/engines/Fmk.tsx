import { useMemo, useState } from 'react';
import { openSecret } from '../lib/deck';
import { assign, type Role } from '../lib/fmk';
import { sfx } from '../lib/sound';
import { NextButton, PodcastNote, PromptCard, useSecretTurns, type EngineProps } from './common';

const ROLES = [
  ['f', 'F', 'bg-cherry-500 text-white'],
  ['m', 'M', 'bg-amber-400 text-ink-950'],
  ['k', 'K', 'bg-ink-200 text-ink-950']
] as const;
export default function Fmk({ round, game, participants, onDone }: EngineProps) {
  const names = round.choices ?? [];
  const [pick, setPick] = useState<Record<number, Role>>({});
  const secret = useSecretTurns<Record<number, Role>>(participants);
  const info = useMemo(() => (secret.done ? openSecret(round) : null), [secret.done, round]);
  const complete = Object.keys(pick).length === 3;

  const prompt = (
    <PromptCard game={game}>
      {round.prompt || 'פאק, מארי או קיל?'}
      <div className="mt-2 text-base font-body text-ink-400">כל אחד מקבל בדיוק אחד: F · M · K</div>
    </PromptCard>
  );

  if (!secret.done) {
    return (
      <div className="space-y-4">
        {secret.cover('בחירה סודית — יוצג לכולם רק בסוף.')}
        {prompt}
        <p className="text-center text-ink-400">{secret.current?.name}, תחלק/י:</p>
        <div className="space-y-2">
          {names.map((n, i) => (
            <div key={n} className="flex items-center gap-2 rounded-2xl bg-ink-800 p-2">
              <span className="flex-1 ps-2 text-lg font-bold text-white">{n}</span>
              {ROLES.map(([r, l, cls]) => (
                <button
                  key={r}
                  aria-pressed={pick[i] === r}
                  aria-label={`${l} ל${n}`}
                  onClick={() => {
                    sfx.tap();
                    setPick((p) => assign(p, i, r));
                  }}
                  className={`h-12 w-12 rounded-xl font-display text-xl transition active:scale-90 ${pick[i] === r ? cls : 'bg-ink-700 text-ink-400'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button
          className="btn-amber w-full text-xl"
          disabled={!complete}
          onClick={() => {
            secret.submit(pick);
            setPick({});
          }}
        >
          נעילה
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prompt}
      <div className="card overflow-x-auto p-3 animate-pop">
        <table className="w-full text-center">
          <thead>
            <tr className="text-sm text-ink-400">
              <th className="p-2 text-start">שחקן</th>
              {names.map((n) => (
                <th key={n} className="p-2">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-t border-ink-700">
                <td className="p-2 text-start font-bold text-white">{p.name}</td>
                {names.map((_, i) => {
                  const r = secret.results[p.id]?.[i];
                  const meta = ROLES.find((x) => x[0] === r);
                  return (
                    <td key={i} className="p-2">
                      {meta && <span className={`inline-block h-9 w-9 rounded-lg pt-1 font-display ${meta[2]}`}>{meta[1]}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!info?.pn.length && (
        <PodcastNote title="מה בחרו באולפן (דעה בלבד)">
          <ul className="list-inside list-disc text-sm">
            {info.pn.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </PodcastNote>
      )}
      <NextButton onClick={() => onDone({})} />
    </div>
  );
}
