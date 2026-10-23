import { useEffect, useMemo, useState } from 'react';
import { CoinPill } from '../components/Coins';
import { PromptCard } from '../engines/common';
import { crowdSplit } from '../lib/challenges';
import type { CrowdStats } from '../lib/cloud';
import { openSecret, playablePool } from '../lib/deck';
import { decisionCoins } from '../lib/economy';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sound';
import { getCrowd, profileStore, useProfile } from '../lib/store';
import type { GameMeta, Round } from '../lib/types';
import { Screen, TopBar } from '../components/ui';

/** Solo decision mode: your choice + your guess of the majority, against real answers from other players. */
export default function SoloDecisions({ games, rounds, mature, onBack }: { games: GameMeta[]; rounds: Round[]; mature: boolean; onBack: () => void }) {
  const p = useProfile();
  const ids = games.filter((g) => g.engine === 'dilemma').map((g) => g.id);
  const deck = useMemo(() => shuffle(playablePool(rounds, ids, mature), Date.now().toString(36)), [rounds, mature]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(() => Math.max(0, deck.findIndex((r) => !(r.id in p.answered))));
  const [mine, setMine] = useState<string | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  const [crowd, setCrowd] = useState<CrowdStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    getCrowd(true).then((c) => {
      setCrowd(c);
      setLoaded(true);
    });
  }, []);

  const round = deck[i % Math.max(1, deck.length)];
  if (!round)
    return (
      <Screen>
        <TopBar onBack={onBack} title="דילמות נגד כולם" />
        <p className="text-center text-ink-400">אין דילמות זמינות כרגע.</p>
      </Screen>
    );
  const game = games.find((g) => g.id === round.gameId)!;
  const options: [string, string][] = round.choices?.length === 2 ? [['a', round.choices[0]], ['b', round.choices[1]]] : (Object.entries(game.options) as [string, string][]);
  const fee = openSecret(round).fee;
  const split = crowdSplit(crowd, round.id);
  const done = mine && guess;
  const ranked = split ? Object.entries(split.counts).sort((a, b) => b[1] - a[1]) : [];
  const crowdMajority = ranked[0] && (!ranked[1] || ranked[1][1] < ranked[0][1]) ? ranked[0][0] : null;

  const finish = (g: string) => {
    setGuess(g);
    sfx.reveal();
    // Your own vote joins the statistics the first time you answer a dilemma.
    profileStore.update((x) => (round.id in x.answered ? x : { ...x, answered: { ...x.answered, [round.id]: mine! } }));
    if (split && crowdMajority && g === crowdMajority) profileStore.apply((x) => decisionCoins(x, round.id));
  };

  return (
    <Screen>
      <TopBar onBack={onBack} title="דילמות נגד כולם" right={<CoinPill coins={p.coins} />} />
      <PromptCard game={game} footer={fee ? <div className="mt-3 inline-block rounded-full bg-amber-400 px-4 py-1 font-display text-xl text-ink-950">💰 {fee}</div> : null}>
        {round.prompt}
      </PromptCard>
      {!mine && (
        <>
          <p className="mt-4 text-center text-lg">מה את/ה עושה?</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {options.map(([k, l], idx) => (
              <button key={k} className={idx === 0 ? 'btn-amber min-h-[72px] text-xl' : 'btn-cherry min-h-[72px] text-xl'} onClick={() => (sfx.tap(), setMine(k))}>
                {l}
              </button>
            ))}
          </div>
        </>
      )}
      {mine && !guess && (
        <>
          <p className="mt-4 text-center text-lg">ומה רוב השחקנים בחרו?</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {options.map(([k, l]) => (
              <button key={k} className="btn-ghost min-h-[64px] text-xl" onClick={() => finish(k)}>
                {l}
              </button>
            ))}
          </div>
        </>
      )}
      {done && (
        <div className="mt-4 space-y-3 animate-rise">
          {split ? (
            <div className="card space-y-3 p-4">
              <p className="text-center text-sm text-ink-400">{split.total} שחקנים אמיתיים ענו</p>
              {options.map(([k, l], idx) => {
                const n = split.counts[k] ?? 0;
                const pct = Math.round((n / split.total) * 100);
                return (
                  <div key={k}>
                    <div className="mb-1 flex justify-between font-bold">
                      <span>
                        {l} {k === mine && <span className="text-xs text-amber-300">(הבחירה שלך)</span>}
                      </span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-ink-700">
                      <div className={`h-full rounded-full ${idx === 0 ? 'bg-amber-400' : 'bg-cherry-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-center font-display text-xl text-white">{crowdMajority ? (guess === crowdMajority ? 'ניחשת את הרוב!' : 'הרוב חשב אחרת') : 'תיקו מושלם'}</p>
            </div>
          ) : (
            <p className="card p-4 text-center text-ink-400">{loaded ? 'עוד אין מספיק שחקנים שענו על הדילמה הזאת. ההצבעה שלך נספרה — חזרו בהמשך.' : 'טוענים…'}</p>
          )}
          {!!openSecret(round).pn.length && (
            <p className="rounded-2xl bg-ink-950/60 p-3 text-sm text-ink-400">באולפן: {openSecret(round).pn.join(' · ')}</p>
          )}
          <button
            className="btn-amber w-full text-xl"
            onClick={() => {
              setMine(null);
              setGuess(null);
              setI((n) => n + 1);
            }}
          >
            הדילמה הבאה ←
          </button>
        </div>
      )}
    </Screen>
  );
}
