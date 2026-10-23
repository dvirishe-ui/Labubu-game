import { useEffect, useState } from 'react';
import { ConfirmButton, Confetti, Modal, Screen, Timer, TopBar } from '../components/ui';
import { createNotes, guessed, NOTE_ROUNDS, SAMPLE_SLIPS, skipped, startTurn, timeUp, totals, type NotesState } from '../lib/notes';
import { newSeed, shuffle } from '../lib/rng';
import { sfx } from '../lib/sound';
import { load, remove, save } from '../lib/storage';

export default function Notes({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<NotesState | null>(() => load<NotesState | null>('notes', null));
  useEffect(() => {
    if (state) save('notes', state);
    else remove('notes');
  }, [state]);
  if (!state) return <NotesSetup onBack={onBack} onStart={setState} />;
  return <NotesGame state={state} setState={setState} onBack={onBack} />;
}

function NotesSetup({ onBack, onStart }: { onBack: () => void; onStart: (s: NotesState) => void }) {
  const [teams, setTeams] = useState(['כחולים', 'אדומים']);
  const [slips, setSlips] = useState<string[]>([]);
  const [word, setWord] = useState('');
  const [seconds, setSeconds] = useState(45);
  const [penalty, setPenalty] = useState(false);
  const [rules, setRules] = useState(false);
  const add = () => {
    const w = word.trim();
    if (w && !slips.includes(w)) setSlips((s) => [...s, w]);
    setWord('');
  };
  return (
    <Screen>
      <TopBar onBack={onBack} title="פתקים על הגג" right={<button className="btn-ghost min-h-[44px] px-3" onClick={() => setRules(true)}>?</button>} />
      <span className="chip mb-4 self-start border-amber-400 text-amber-300">משחק בונוס מקורי — לא פינה מהפודקאסט</span>

      <span className="label">קבוצות</span>
      <div className="mb-6 space-y-2">
        {teams.map((t, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" value={t} maxLength={16} aria-label={`קבוצה ${i + 1}`} onChange={(e) => setTeams((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="btn-ghost w-14 shrink-0 px-0" disabled={teams.length <= 2} onClick={() => setTeams((ts) => ts.filter((_, j) => j !== i))} aria-label="הסרה">
              ✕
            </button>
          </div>
        ))}
        {teams.length < 4 && (
          <button className="btn-ghost w-full" onClick={() => setTeams((t) => [...t, `קבוצה ${t.length + 1}`])}>
            + קבוצה
          </button>
        )}
      </div>

      <span className="label">פתקים ({slips.length})</span>
      <p className="mb-2 text-sm text-ink-400">כל אחד מוסיף בסתר כמה מילים, שמות או ביטויים. או שמוסיפים פתקים מוכנים.</p>
      <form
        className="mb-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input" type="password" autoComplete="off" value={word} maxLength={40} placeholder="פתק חדש (מוסתר)" onChange={(e) => setWord(e.target.value)} />
        <button className="btn-amber shrink-0" disabled={!word.trim()}>
          הוסף
        </button>
      </form>
      <div className="mb-6 flex gap-2">
        <button className="btn-ghost flex-1 text-base" onClick={() => setSlips((s) => [...new Set([...s, ...shuffle(SAMPLE_SLIPS, newSeed()).slice(0, 10)])])}>
          + 10 פתקים מוכנים
        </button>
        <button className="btn-ghost text-base" disabled={!slips.length} onClick={() => setSlips([])}>
          איפוס
        </button>
      </div>

      <span className="label">זמן לתור</span>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[30, 45, 60].map((s) => (
          <button key={s} aria-pressed={seconds === s} onClick={() => setSeconds(s)} className={`min-h-[52px] rounded-2xl font-bold ${seconds === s ? 'bg-amber-400 text-ink-950' : 'bg-ink-800'}`}>
            {s} שניות
          </button>
        ))}
      </div>
      <label className="mb-8 flex min-h-[48px] items-center justify-between">
        <span>דילוג עולה נקודה</span>
        <input type="checkbox" className="h-6 w-6 accent-amber-400" checked={penalty} onChange={(e) => setPenalty(e.target.checked)} />
      </label>

      <button
        className="btn-amber w-full text-2xl"
        disabled={slips.length < 5 || teams.some((t) => !t.trim())}
        onClick={() => onStart(createNotes(slips, teams.map((t) => t.trim()), seconds, penalty, newSeed()))}
      >
        {slips.length < 5 ? `צריך לפחות 5 פתקים` : 'מתחילים'}
      </button>
      <RulesModal open={rules} onClose={() => setRules(false)} />
    </Screen>
  );
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="איך משחקים">
      <ol className="list-inside list-decimal space-y-2">
        <li>שמים את כל הפתקים בקופה. אותם פתקים משחקים בכל שלושת הסיבובים.</li>
        {NOTE_ROUNDS.map((r) => (
          <li key={r.title}>
            <b>{r.title}:</b> {r.rule}
          </li>
        ))}
        <li>בכל תור: נציג אחד מסביר לקבוצה שלו כמה שיותר פתקים עד שנגמר הזמן. ✓ = נקודה.</li>
      </ol>
    </Modal>
  );
}

function NotesGame({ state, setState, onBack }: { state: NotesState; setState: (s: NotesState | null) => void; onBack: () => void }) {
  const [running, setRunning] = useState(false);
  const [rules, setRules] = useState(false);
  const team = state.teams[state.turnTeam];
  const r = NOTE_ROUNDS[state.round];
  const scores = totals(state);

  if (state.finished) {
    const best = Math.max(...scores);
    return (
      <Screen>
        <Confetti />
        <TopBar onBack={onBack} title="פתקים על הגג" />
        <p className="my-6 text-center font-display text-5xl text-amber-400 animate-pop">{state.teams.filter((_, i) => scores[i] === best).map((t) => t.name).join(' · ')}</p>
        <div className="card p-4">
          <table className="w-full text-center">
            <thead>
              <tr className="text-sm text-ink-400">
                <th className="text-start">קבוצה</th>
                <th>1</th>
                <th>2</th>
                <th>3</th>
                <th>סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {state.teams.map((t, i) => (
                <tr key={t.name} className="border-t border-ink-700 text-lg">
                  <td className="py-2 text-start font-bold text-white">{t.name}</td>
                  {t.scores.map((s, j) => (
                    <td key={j}>{s}</td>
                  ))}
                  <td className="font-display text-amber-400">{scores[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-amber mt-6 w-full" onClick={() => setState(createNotes(state.slips, state.teams.map((t) => t.name), state.seconds, state.skipPenalty, newSeed()))}>
          משחק חוזר עם אותם פתקים
        </button>
        <button className="btn-ghost mt-3 w-full" onClick={() => setState(null)}>
          פתקים חדשים
        </button>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar onBack={onBack} title={r.title} right={<button className="btn-ghost min-h-[44px] px-3" onClick={() => setRules(true)}>?</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {state.teams.map((t, i) => (
          <span key={t.name} className={`chip ${i === state.turnTeam ? 'border-amber-400 text-amber-300' : 'text-ink-400'}`}>
            {t.name}: {scores[i]}
          </span>
        ))}
        <span className="chip text-ink-400">נשארו {state.remaining.length}</span>
      </div>

      {!running ? (
        <div className="card flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center animate-pop">
          <p className="text-ink-400">התור של</p>
          <p className="font-display text-5xl text-amber-400">{team.name}</p>
          <p className="max-w-xs">{r.rule}</p>
          <button
            className="btn-amber w-full max-w-xs text-2xl"
            onClick={() => {
              setState(startTurn(state));
              setRunning(true);
              sfx.lock();
            }}
          >
            ▶ {state.seconds} שניות
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <Timer
            seconds={state.seconds}
            running={running}
            keyId={`${state.turnCount}`}
            onEnd={() => {
              sfx.bad();
              setRunning(false);
              setState(timeUp(state));
            }}
          />
          <div className="card flex min-h-[220px] flex-1 items-center justify-center p-6 text-center">
            <span className="font-display text-5xl leading-tight text-white animate-pop" key={state.current ?? ''}>
              {state.current}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              className="btn-ghost min-h-[80px] text-xl"
              onClick={() => {
                sfx.tap();
                setState(skipped(state));
              }}
            >
              דלג {state.skipPenalty && '(−1)'}
            </button>
            <button
              className="btn-amber min-h-[80px] text-2xl"
              onClick={() => {
                sfx.good();
                const next = guessed(state);
                if (next.round !== state.round || next.finished) setRunning(false);
                setState(next);
              }}
            >
              ✓ ניחשו
            </button>
          </div>
        </div>
      )}
      <ConfirmButton className="mt-6 self-center text-sm text-ink-400 underline" label="סיום משחק" confirmLabel="לסיים? הקישו שוב" onConfirm={() => setState(null)} />
      <RulesModal open={rules} onClose={() => setRules(false)} />
    </Screen>
  );
}
