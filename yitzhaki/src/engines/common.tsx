import { useState, type ReactNode } from 'react';
import { PassScreen } from '../components/ui';
import { sfx } from '../lib/sound';
import type { GameMeta, Participant, Round, SessionConfig } from '../lib/types';

export interface EngineProps {
  round: Round;
  game: GameMeta;
  participants: Participant[];
  config: SessionConfig;
  roundIndex: number;
  onDone: (deltas: Record<string, number>) => void;
}

export function PromptCard({ game, children, footer }: { game: GameMeta; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="card relative overflow-hidden p-5 animate-pop">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-400">
        <span className="text-xl" aria-hidden>
          {game.emoji}
        </span>
        <span className="font-bold text-amber-300">{game.title}</span>
        <span>· {game.subtitle}</span>
      </div>
      <div className="whitespace-pre-line font-display text-[1.65rem] leading-snug text-white">{children}</div>
      {footer}
    </section>
  );
}

export function VoteGrid({
  participants,
  options,
  votes,
  onVote,
  disabled
}: {
  participants: Participant[];
  options: [string, string][];
  votes: Record<string, string>;
  onVote: (pid: string, v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {participants.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-2xl bg-ink-800/80 p-2">
          <span className="w-20 shrink-0 truncate ps-2 font-bold text-white sm:w-28">{p.name}</span>
          <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
            {options.map(([k, label], i) => {
              const on = votes[p.id] === k;
              return (
                <button
                  key={k}
                  disabled={disabled}
                  data-vote
                  aria-pressed={on}
                  onClick={() => {
                    sfx.tap();
                    onVote(p.id, k);
                  }}
                  className={`min-h-[48px] rounded-xl px-2 text-base font-bold transition active:scale-95 ${
                    on ? (i === 0 ? 'bg-amber-400 text-ink-950' : 'bg-cherry-500 text-white') : 'bg-ink-700 text-ink-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Runs a private pass-the-phone turn for each participant in order. */
export function useSecretTurns<T>(participants: Participant[]) {
  const [i, setI] = useState(0);
  const [covered, setCovered] = useState(true);
  const [results, setResults] = useState<Record<string, T>>({});
  const current = participants[i];
  const done = i >= participants.length;
  const submit = (value: T) => {
    sfx.lock();
    setResults((r) => ({ ...r, [current.id]: value }));
    setI((n) => n + 1);
    setCovered(true);
  };
  const cover = (note?: string) =>
    !done && covered ? <PassScreen name={current.name} note={note} onReady={() => setCovered(false)} /> : null;
  return { current, done, results, submit, cover, index: i };
}

export function NextButton({ onClick, label = 'הבא ←' }: { onClick: () => void; label?: string }) {
  return (
    <button className="btn-amber mt-4 w-full text-xl" onClick={onClick} autoFocus>
      {label}
    </button>
  );
}

export function PodcastNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border border-ink-700 bg-ink-950/60 p-4 text-ink-200">
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-400">{title}</div>
      {children}
    </div>
  );
}
