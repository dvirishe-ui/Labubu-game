import { useMemo, useState } from 'react';
import { Screen, TopBar } from '../components/ui';
import { playablePool } from '../lib/deck';
import { newSeed } from '../lib/rng';
import { load, save } from '../lib/storage';
import type { GameMeta, Length, Participant, Round, SessionConfig } from '../lib/types';

const DEFAULT_PLAYERS = ['שחקן 1', 'שחקן 2', 'שחקן 3'];
const DEFAULT_TEAMS = ['הגג', 'המרפסת'];
let uid = 0;
const mk = (name: string): Participant => ({ id: `p${Date.now().toString(36)}${uid++}`, name, score: 0 });

export interface SetupPreset {
  gameIds?: string[];
  length?: Length;
}

export default function Setup({
  games,
  rounds,
  preset,
  mature,
  onNeedMature,
  onStart,
  onBack
}: {
  games: GameMeta[];
  rounds: Round[];
  preset: SetupPreset;
  mature: boolean;
  onNeedMature: () => void;
  onStart: (c: SessionConfig) => void;
  onBack: () => void;
}) {
  const saved = load<{ mode: 'players' | 'teams'; players: string[]; teams: string[]; timer: number; secretVotes: boolean; predictMajority: boolean } | null>('setup', null);
  const [mode, setMode] = useState<'players' | 'teams'>(saved?.mode ?? 'players');
  const [players, setPlayers] = useState<Participant[]>((saved?.players ?? DEFAULT_PLAYERS).map(mk));
  const [teams, setTeams] = useState<Participant[]>((saved?.teams ?? DEFAULT_TEAMS).map(mk));
  const playable = games.filter((g) => g.count > 0);
  const [gameIds, setGameIds] = useState<string[]>(preset.gameIds ?? playable.filter((g) => g.engine === 'realfake' || g.engine === 'dilemma').map((g) => g.id));
  const [length, setLength] = useState<Length>(preset.length ?? 10);
  const [timer, setTimer] = useState(saved?.timer ?? 0);
  const [secretVotes, setSecretVotes] = useState(saved?.secretVotes ?? false);
  const [predictMajority, setPredictMajority] = useState(saved?.predictMajority ?? false);

  const list = mode === 'players' ? players : teams;
  const setList = mode === 'players' ? setPlayers : setTeams;
  const [min, max] = mode === 'players' ? [2, 10] : [2, 4];
  const names = list.map((p) => p.name.trim());
  const dupNames = new Set(names.filter((n, i) => n && names.indexOf(n) !== i));
  const validNames = names.every(Boolean) && !dupNames.size && list.length >= min && list.length <= max;
  const selected = playable.filter((g) => gameIds.includes(g.id) && (mature || !g.mature));
  const blocked = (g: GameMeta) => (g.engine === 'hotseat' && list.length < 3 ? 'צריך לפחות 3' : null);
  const poolSize = useMemo(
    () => playablePool(rounds, selected.filter((g) => !blocked(g)).map((g) => g.id), mature).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rounds, gameIds, mature, list.length]
  );

  const start = () => {
    save('setup', { mode, players: players.map((p) => p.name), teams: teams.map((p) => p.name), timer, secretVotes, predictMajority });
    onStart({
      mode,
      participants: list.map((p) => ({ ...p, name: p.name.trim(), score: 0 })),
      gameIds: selected.filter((g) => !blocked(g)).map((g) => g.id),
      length,
      secretVotes,
      timer,
      predictMajority: predictMajority && secretVotes,
      mature,
      seed: newSeed()
    });
  };

  const toggle = (id: string) => setGameIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Screen>
      <TopBar onBack={onBack} title="מכינים משחק" />

      <section className="mb-6">
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-ink-800 p-1" role="tablist">
          {(['players', 'teams'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`min-h-[48px] rounded-xl font-bold ${mode === m ? 'bg-amber-400 text-ink-950' : 'text-ink-200'}`}>
              {m === 'players' ? 'שחקנים (2–10)' : 'קבוצות (2–4)'}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {list.map((p, i) => (
            <div key={p.id} className="flex gap-2">
              <input
                className={`input ${dupNames.has(p.name.trim()) ? 'border-cherry-500' : ''}`}
                value={p.name}
                maxLength={18}
                aria-label={`שם ${i + 1}`}
                onChange={(e) => setList((l) => l.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
              />
              <button className="btn-ghost w-14 shrink-0 px-0" disabled={list.length <= min} onClick={() => setList((l) => l.filter((x) => x.id !== p.id))} aria-label={`הסרת ${p.name}`}>
                ✕
              </button>
            </div>
          ))}
          {list.length < max && (
            <button className="btn-ghost w-full" onClick={() => setList((l) => [...l, mk(mode === 'players' ? `שחקן ${l.length + 1}` : `קבוצה ${l.length + 1}`)])}>
              + {mode === 'players' ? 'שחקן' : 'קבוצה'}
            </button>
          )}
          {dupNames.size > 0 && <p className="text-sm text-cherry-300">יש שני שמות זהים.</p>}
        </div>
      </section>

      <section className="mb-6">
        <span className="label">משחקים</span>
        <div className="flex flex-wrap gap-2">
          {playable.map((g) => {
            const locked = g.mature && !mature;
            const on = gameIds.includes(g.id) && !locked;
            const why = blocked(g);
            return (
              <button
                key={g.id}
                aria-pressed={on}
                onClick={() => (locked ? onNeedMature() : toggle(g.id))}
                className={`chip min-h-[44px] text-base transition ${on && !why ? 'border-amber-400 bg-amber-400/15 text-amber-300' : 'text-ink-400'} ${why && on ? 'opacity-50' : ''}`}
              >
                <span aria-hidden>{g.emoji}</span> {g.title}
                {locked && <span className="text-xs text-cherry-300">18+🔒</span>}
                {why && on && <span className="text-xs">({why})</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-3 text-sm">
          <button className="text-amber-300 underline" onClick={() => setGameIds(playable.map((g) => g.id))}>
            הכל
          </button>
          <button className="text-ink-400 underline" onClick={() => setGameIds([])}>
            נקה
          </button>
        </div>
      </section>

      <section className="mb-6">
        <span className="label">אורך</span>
        <div className="grid grid-cols-4 gap-2">
          {([5, 10, 15, 'marathon'] as Length[]).map((l) => (
            <button key={l} aria-pressed={length === l} onClick={() => setLength(l)} className={`min-h-[52px] rounded-2xl font-bold ${length === l ? 'bg-amber-400 text-ink-950' : 'bg-ink-800'}`}>
              {l === 'marathon' ? 'מרתון' : l}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-400">{length === 'marathon' ? `כל ${poolSize} השאלות שעוד לא ראיתם, בלי חזרות.` : `${poolSize} שאלות זמינות במשחקים שנבחרו.`}</p>
      </section>

      <section className="mb-8 space-y-3">
        <span className="label">הגדרות</span>
        <div className="flex items-center justify-between gap-3">
          <span>טיימר</span>
          <div className="flex gap-1">
            {[0, 20, 30, 45].map((t) => (
              <button key={t} aria-pressed={timer === t} onClick={() => setTimer(t)} className={`min-h-[44px] min-w-[52px] rounded-xl px-2 font-bold ${timer === t ? 'bg-amber-400 text-ink-950' : 'bg-ink-800'}`}>
                {t ? `${t}ש׳` : 'בלי'}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="הצבעה סודית (מעבירים את הטלפון)" on={secretVotes} set={setSecretVotes} />
        <Toggle label="נקודה למי שמנחש את דעת הרוב (בדילמות)" on={predictMajority && secretVotes} set={(v) => (setPredictMajority(v), v && setSecretVotes(true))} />
        <Toggle label="מצב 18+" on={mature} set={() => onNeedMature()} />
      </section>

      <button className="btn-amber sticky bottom-4 w-full text-2xl" disabled={!validNames || !poolSize} onClick={start}>
        יאללה, מתחילים!
      </button>
    </Screen>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => set(!on)} className="flex min-h-[48px] w-full items-center justify-between gap-3 text-start">
      <span>{label}</span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-amber-400' : 'bg-ink-700'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${on ? 'right-7' : 'right-1'}`} />
      </span>
    </button>
  );
}
