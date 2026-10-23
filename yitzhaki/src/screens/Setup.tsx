import { useMemo, useState } from 'react';
import { Screen, TopBar } from '../components/ui';
import { playablePool } from '../lib/deck';
import { mechanicAvailable, MECHANICS } from '../lib/plan';
import { newSeed } from '../lib/rng';
import { load, save } from '../lib/storage';
import { useProfile } from '../lib/store';
import type { DecisionMode, GameMeta, Length, Mechanic, Participant, Round, SessionConfig } from '../lib/types';

const DEFAULT_PLAYERS = ['שחקן 2', 'שחקן 3'];
const DEFAULT_TEAMS = ['הגג', 'המרפסת'];
let uid = 0;
const mk = (name: string): Participant => ({ id: `p${Date.now().toString(36)}${uid++}`, name, score: 0 });

export interface SetupPreset {
  gameIds?: string[];
  mechanics?: Mechanic[];
  length?: Length;
  minutes?: number;
}

export const CATEGORIES: { id: string; title: string; engines: GameMeta['engine'][] }[] = [
  { id: 'guess', title: 'משחקי ניחוש', engines: ['realfake'] },
  { id: 'decide', title: 'משחקי החלטות', engines: ['dilemma', 'fmk'] },
  { id: 'party', title: 'משחקי מסיבה', engines: ['creative', 'hotseat'] }
];

const DECISION_MODES: { id: DecisionMode; label: string }[] = [
  { id: 'free', label: 'רק להצביע' },
  { id: 'majority', label: 'הרוב קובע' },
  { id: 'minority', label: 'הכבשה השחורה' },
  { id: 'predict', label: 'נחש את הרוב' },
  { id: 'whochose', label: 'מי בחר מה' }
];

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
  const profile = useProfile();
  const saved = load<{ mode: 'players' | 'teams'; players: string[]; teams: string[]; timer: number; secretVotes: boolean; decisionMode?: DecisionMode } | null>('setup.v2', null);
  const [mode, setMode] = useState<'players' | 'teams'>(preset.mechanics?.includes('battle') ? 'teams' : (saved?.mode ?? 'players'));
  const [players, setPlayers] = useState<Participant[]>(() => [mk(profile.name || 'אני'), ...(saved?.players ?? DEFAULT_PLAYERS).map(mk)]);
  const [teams, setTeams] = useState<Participant[]>((saved?.teams ?? DEFAULT_TEAMS).map(mk));
  const playable = games.filter((g) => g.count > 0);
  const [gameIds, setGameIds] = useState<string[]>(preset.gameIds ?? playable.filter((g) => g.engine === 'realfake' || g.engine === 'dilemma').map((g) => g.id));
  const [mechanics, setMechanics] = useState<Mechanic[]>(preset.mechanics ?? []);
  const [length, setLength] = useState<Length>(preset.length ?? 10);
  const [minutes, setMinutes] = useState<number | undefined>(preset.minutes);
  const [timer, setTimer] = useState(saved?.timer ?? 0);
  const [secretVotes, setSecretVotes] = useState(saved?.secretVotes ?? false);
  const [decisionMode, setDecisionMode] = useState<DecisionMode>(saved?.decisionMode ?? 'free');

  const night = minutes != null;
  const mechMode = !night && mechanics.length > 0;
  const list = mode === 'players' ? players : teams;
  const setList = mode === 'players' ? setPlayers : setTeams;
  const [min, max] = mode === 'players' ? [2, 10] : [2, 4];
  const names = list.map((p) => p.name.trim());
  const dupNames = new Set(names.filter((n, i) => n && names.indexOf(n) !== i));
  const validNames = names.every(Boolean) && !dupNames.size && list.length >= min && list.length <= max;
  const selected = playable.filter((g) => gameIds.includes(g.id) && (mature || !g.mature));
  const blocked = (g: GameMeta) => (g.engine === 'hotseat' && list.length < 3 ? 'צריך לפחות 3' : null);
  const usableMechs = mechanics.filter((m) => mechanicAvailable(MECHANICS.find((x) => x.id === m)!, mode, list.length));
  const poolSize = useMemo(
    () => playablePool(rounds, selected.filter((g) => !blocked(g)).map((g) => g.id), mature).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rounds, gameIds, mature, list.length]
  );
  const hasDilemmas = night || selected.some((g) => g.engine === 'dilemma');
  const canStart = validNames && (night || (mechMode ? usableMechs.length > 0 : poolSize > 0));
  const title = night ? 'ערב על הגג' : mechMode && mechanics.length === 1 ? MECHANICS.find((m) => m.id === mechanics[0])!.title : 'משחק עם חברים';

  const start = () => {
    save('setup.v2', { mode, players: players.slice(1).map((p) => p.name), teams: teams.map((p) => p.name), timer, secretVotes, decisionMode });
    onStart({
      mode,
      participants: list.map((p) => ({ ...p, name: p.name.trim(), score: 0 })),
      gameIds: night ? playable.map((g) => g.id) : selected.filter((g) => !blocked(g)).map((g) => g.id),
      mechanics: mechMode ? usableMechs : undefined,
      length: night ? 'marathon' : length,
      minutes,
      secretVotes,
      timer,
      predictMajority: decisionMode === 'predict',
      decisionMode,
      mature,
      seed: newSeed()
    });
  };

  const toggle = (id: string) => setGameIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const toggleMech = (id: Mechanic) => setMechanics((ms) => (ms.includes(id) ? ms.filter((x) => x !== id) : [...ms, id]));

  return (
    <Screen>
      <TopBar onBack={onBack} title={title} />
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-4 mb-5 bg-ink-950/95 px-4 pb-3 pt-1 backdrop-blur">
        <button className="btn-amber w-full text-2xl" disabled={!canStart} onClick={start}>
          {night ? 'מתחילים ערב על הגג!' : 'יאללה, מתחילים!'}
        </button>
      </div>

      {night && (
        <section className="mb-6">
          <span className="label">כמה זמן?</span>
          <div className="grid grid-cols-4 gap-2">
            {[10, 20, 30, 60].map((m) => (
              <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={`min-h-[56px] rounded-2xl font-display text-xl ${minutes === m ? 'bg-amber-400 text-ink-950' : 'bg-ink-800'}`}>
                {m}′
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-400">מתחלפים בין ניחושים, דילמות, בלופים, מתחזה ויצירה. ניקוד רציף וסיכום בסוף.</p>
        </section>
      )}

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
            <div key={p.id} className="flex items-center gap-2">
              <input
                className={`input ${dupNames.has(p.name.trim()) ? 'border-cherry-500' : ''}`}
                value={p.name}
                maxLength={18}
                aria-label={`שם ${i + 1}`}
                onChange={(e) => setList((l) => l.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
              />
              {i === 0 && mode === 'players' ? (
                <span className="chip shrink-0 border-amber-400 text-amber-300">את/ה</span>
              ) : (
                <button className="btn-ghost w-14 shrink-0 px-0" disabled={list.length <= min} onClick={() => setList((l) => l.filter((x) => x.id !== p.id))} aria-label={`הסרת ${p.name}`}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {list.length < max && (
            <button className="btn-ghost w-full" onClick={() => setList((l) => [...l, mk(mode === 'players' ? `שחקן ${l.length + 1}` : `קבוצה ${l.length + 1}`)])}>
              + {mode === 'players' ? 'שחקן' : 'קבוצה'}
            </button>
          )}
          {dupNames.size > 0 && <p className="text-sm text-cherry-300">יש שני שמות זהים.</p>}
          <p className="text-xs text-ink-400">המטבעות נכנסים לפרופיל של המכשיר הזה (השחקן הראשון).</p>
        </div>
      </section>

      {mechMode && (
        <section className="mb-6">
          <span className="label">משחקי מסיבה</span>
          <div className="space-y-2">
            {MECHANICS.map((m) => {
              const on = mechanics.includes(m.id);
              const ok = mechanicAvailable(m, mode, list.length);
              return (
                <button key={m.id} aria-pressed={on} onClick={() => toggleMech(m.id)} className={`card flex w-full items-center gap-3 p-3 text-start ${on ? 'border-amber-400' : 'opacity-70'}`}>
                  <span className="text-2xl" aria-hidden>
                    {m.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-white">{m.title}</span>
                    <span className="block text-xs text-ink-400">{m.blurb}</span>
                    {on && !ok && <span className="block text-xs text-cherry-300">{m.teamsOnly ? 'רק בשתי קבוצות' : `צריך לפחות ${m.minPlayers}`}</span>}
                  </span>
                  <span className={`h-6 w-6 shrink-0 rounded-full border-2 ${on ? 'border-amber-400 bg-amber-400' : 'border-ink-600'}`} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-400">המכניקות חדשות; התוכן (פריטים, דילמות ותשובות) מגיע מהפודקאסט. מה שהשחקנים כותבים מסומן כתוכן שחקנים.</p>
        </section>
      )}

      {!night && !mechMode && (
        <section className="mb-6 space-y-4">
          {CATEGORIES.map((cat) => {
            const gs = playable.filter((g) => cat.engines.includes(g.engine));
            return (
              <div key={cat.id}>
                <span className="label">{cat.title}</span>
                <div className="flex flex-wrap gap-2">
                  {gs.map((g) => {
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
              </div>
            );
          })}
          <div className="flex gap-3 text-sm">
            <button className="text-amber-300 underline" onClick={() => setGameIds(playable.map((g) => g.id))}>
              הכל
            </button>
            <button className="text-ink-400 underline" onClick={() => setGameIds([])}>
              נקה
            </button>
          </div>
        </section>
      )}

      {!night && (
        <section className="mb-6">
          <span className="label">אורך</span>
          <div className="grid grid-cols-4 gap-2">
            {([5, 10, 15, 'marathon'] as Length[]).map((l) => (
              <button key={l} aria-pressed={length === l} onClick={() => setLength(l)} className={`min-h-[52px] rounded-2xl font-bold ${length === l ? 'bg-amber-400 text-ink-950' : 'bg-ink-800'}`}>
                {l === 'marathon' ? 'מרתון' : l}
              </button>
            ))}
          </div>
          {!mechMode && <p className="mt-2 text-sm text-ink-400">{length === 'marathon' ? `כל ${poolSize} השאלות שעוד לא ראיתם, בלי חזרות.` : `${poolSize} שאלות זמינות במשחקים שנבחרו.`}</p>}
        </section>
      )}

      {hasDilemmas && !mechMode && (
        <section className="mb-6">
          <span className="label">ניקוד בדילמות</span>
          <div className="flex flex-wrap gap-2">
            {DECISION_MODES.map((d) => (
              <button key={d.id} aria-pressed={decisionMode === d.id} onClick={() => setDecisionMode(d.id)} className={`chip min-h-[44px] text-base ${decisionMode === d.id ? 'border-amber-400 bg-amber-400/15 text-amber-300' : 'text-ink-400'}`}>
                {d.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">בדילמות אין תשובה נכונה — הניקוד הוא רק על מי שבחר כמו הרוב/המיעוט או ניחש נכון.</p>
        </section>
      )}

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
        <Toggle label="מצב 18+" on={mature} set={() => onNeedMature()} />
      </section>
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
