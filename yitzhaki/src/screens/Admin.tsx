import { useEffect, useMemo, useState } from 'react';
import { ConfirmButton, copyText, Screen, TopBar } from '../components/ui';
import { findDuplicates, importRounds, normalize } from '../lib/admin';
import { FLAG_LABELS, REASON_LABELS, resolveDeck, reviewFlags, saveOverrides, openSecret, type AdminOverrides, type CustomRound, type ReviewFlag } from '../lib/deck';
import { checkEditorPassword, serverKey } from '../lib/hash';
import { profileStore } from '../lib/store';
import { unseal } from '../lib/obfuscate';
import { load, save } from '../lib/storage';
import type { GameMeta, Round } from '../lib/types';

type Tab = 'review' | 'rounds' | 'overview' | 'import' | 'dupes' | 'rules';
type Sync = 'idle' | 'saving' | 'shared' | 'local';

interface Evidence {
  src: string;
  ls: number;
  le: number;
  t0: string | null;
  t1: string | null;
  raw: string | null;
  st: string;
  why: string | null;
  notes: string;
  cand: string | null;
  dis: string | null;
  dup: string | null;
}

export default function Admin({ overrides, onChange, onBack }: { overrides: AdminOverrides; onChange: (o: AdminOverrides) => void; onBack: () => void }) {
  const [ok, setOk] = useState(() => load<boolean>('editor.unlocked', false));
  const [pw, setPw] = useState('');
  const [wrong, setWrong] = useState(false);
  const [tab, setTab] = useState<Tab>('review');
  const [sync, setSync] = useState<Sync>('idle');
  const { games, rounds } = useMemo(() => resolveDeck(overrides), [overrides]);
  const update = (o: AdminOverrides) => {
    const next = { ...o, updatedAt: Date.now() };
    saveOverrides(next);
    onChange(next);
    // Share the change with every player (works for the page's owner / with the server's editor key).
    const cloud = profileStore.get().cloud;
    if (!cloud) return setSync('local');
    setSync('saving');
    cloud.saveEditor(next, load<string>('editor.key', '')).then((ok) => setSync(ok ? 'shared' : 'local'));
  };
  const reviewCount = rounds.filter((r) => reviewFlags(r).length && !overrides.edits[r.id]?.reviewed).length;

  if (!ok)
    return (
      <Screen>
        <TopBar onBack={onBack} title="מצב עורך" />
        <div className="card space-y-4 p-6 text-center">
          <p className="text-5xl">⚠️</p>
          <p className="font-display text-2xl text-cherry-400">יש פה ספוילרים</p>
          <p className="text-ink-400">מצב העורך מציג שאלות, תשובות וראיות מהתמלילים. מי שמתכנן לשחק — לא להיכנס.</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (checkEditorPassword(pw)) {
                save('editor.unlocked', true);
                save('editor.key', serverKey(pw));
                setOk(true);
              } else {
                setWrong(true);
                setPw('');
              }
            }}
          >
            <label className="label" htmlFor="editor-password">
              סיסמה
            </label>
            <input
              id="editor-password"
              className={`input text-center tracking-[.3em] ${wrong ? 'animate-shake border-cherry-500' : ''}`}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setWrong(false);
              }}
            />
            {wrong && (
              <p className="text-sm text-cherry-300" role="alert">
                סיסמה שגויה. נסו שוב.
              </p>
            )}
            <button className="btn-cherry w-full" disabled={!pw.trim()}>
              כניסה למצב עורך
            </button>
          </form>
        </div>
      </Screen>
    );

  return (
    <Screen className="max-w-3xl">
      <TopBar
        onBack={onBack}
        title="מצב עורך"
        right={
          <>
          <SyncChip sync={sync} />
          <button
            className="btn-ghost min-h-[44px] px-3 text-base"
            onClick={() => {
              save('editor.unlocked', false);
              setOk(false);
            }}
          >
            נעילה
          </button>
          </>
        }
      />
      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-ink-800 p-1" role="tablist">
        {(
          [
            ['review', `לבדיקה (${reviewCount})`],
            ['rounds', 'כל השאלות'],
            ['overview', 'סקירה'],
            ['import', 'ייבוא'],
            ['dupes', 'כפילויות'],
            ['rules', 'חוקים']
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-3 font-bold ${tab === t ? 'bg-amber-400 text-ink-950' : ''}`}>
            {l}
          </button>
        ))}
      </nav>
      {tab === 'overview' && <Overview games={games} rounds={rounds} overrides={overrides} onReset={() => update({ edits: {}, custom: [], rules: {} })} onLoad={update} />}
      {tab === 'review' && <Questions mode="review" games={games} rounds={rounds} overrides={overrides} update={update} />}
      {tab === 'rounds' && <Questions mode="all" games={games} rounds={rounds} overrides={overrides} update={update} />}
      {tab === 'import' && <Import games={games} overrides={overrides} update={update} />}
      {tab === 'dupes' && <Dupes rounds={rounds} overrides={overrides} update={update} />}
      {tab === 'rules' && <Rules games={games} overrides={overrides} update={update} />}
    </Screen>
  );
}

function Overview({ games, rounds, overrides, onReset, onLoad }: { games: GameMeta[]; rounds: Round[]; overrides: AdminOverrides; onReset: () => void; onLoad: (o: AdminOverrides) => void }) {
  const usable = rounds.filter((r) => r.usable).length;
  const [exported, setExported] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['שאלות', rounds.length],
          ['ניתנות למשחק', usable],
          ['לבדיקה', rounds.length - usable]
        ].map(([l, n]) => (
          <div key={l} className="card p-3">
            <div className="font-display text-3xl text-amber-400">{n}</div>
            <div className="text-sm text-ink-400">{l}</div>
          </div>
        ))}
      </div>
      <table className="card w-full overflow-hidden text-sm">
        <thead>
          <tr className="text-ink-400">
            <th className="p-2 text-start">משחק</th>
            <th>מנוע</th>
            <th>פעיל</th>
            <th>לבדיקה</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id} className="border-t border-ink-700">
              <td className="p-2">
                {g.emoji} {g.title}
              </td>
              <td className="text-center text-ink-400">{g.engine}</td>
              <td className="text-center font-bold text-amber-300">{g.count}</td>
              <td className="text-center text-ink-400">{g.unresolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          className="btn-ghost text-base"
          onClick={async () => {
            const json = JSON.stringify(overrides, null, 2);
            setExported(json);
            setMsg((await copyText(json)) ? 'השינויים הועתקו ללוח.' : 'סמנו והעתיקו את הטקסט למטה.');
          }}
        >
          ייצוא שינויים
        </button>
        <label className="btn-ghost cursor-pointer text-base">
          טעינת שינויים
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const o = JSON.parse(await f.text());
                onLoad({ edits: o.edits ?? {}, custom: o.custom ?? [], rules: o.rules ?? {} });
              } catch {
                setMsg('הקובץ לא תקין — צריך JSON שיוצא ממצב העורך.');
              }
            }}
          />
        </label>
        <ConfirmButton className="btn-ghost text-base text-cherry-300" label="איפוס שינויים" confirmLabel="למחוק הכל? הקישו שוב" onConfirm={onReset} />
      </div>
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
      {exported && <textarea className="input min-h-[160px] py-2 font-mono text-xs" dir="ltr" readOnly value={exported} onFocus={(e) => e.target.select()} aria-label="שינויים מיוצאים" />}
      <p className="text-sm text-ink-400">השינויים נשמרים במכשיר הזה. כדי להכניס אותם למאגר הקבוע: ייצוא → מיזוג לתיקיית data/extraction → npm run build.</p>
    </div>
  );
}

function SyncChip({ sync }: { sync: Sync }) {
  if (sync === 'idle') return null;
  const txt = { saving: 'שומר…', shared: 'נשמר לכל השחקנים ✓', local: 'נשמר רק במכשיר הזה' }[sync];
  return <span className={`chip hidden text-xs sm:inline-flex ${sync === 'shared' ? 'border-amber-400 text-amber-300' : sync === 'local' ? 'text-cherry-300' : 'text-ink-400'}`}>{txt}</span>;
}

type StatusFilter = 'all' | 'playable' | 'off' | 'edited' | 'disabled' | 'reviewed';

/** Search + filters over the questions; "review" mode shows only what needs a human look. */
function Questions({ mode, games, rounds, overrides, update }: { mode: 'review' | 'all'; games: GameMeta[]; rounds: Round[]; overrides: AdminOverrides; update: (o: AdminOverrides) => void }) {
  const [q, setQ] = useState('');
  const [game, setGame] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [flag, setFlag] = useState<ReviewFlag | ''>('');
  const [adult, setAdult] = useState<'any' | 'general' | 'mature'>('any');
  const [showReviewed, setShowReviewed] = useState(false);
  const [limit, setLimit] = useState(30);
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const withFlags = useMemo(() => rounds.map((r) => ({ r, flags: reviewFlags(r) })), [rounds]);
  const base = withFlags.filter(({ r, flags }) => mode === 'all' || (flags.length > 0 && (showReviewed || !overrides.edits[r.id]?.reviewed)));
  const terms = normalize(q);
  const list = base.filter(({ r, flags }) => {
    const e = overrides.edits[r.id];
    if (game && r.gameId !== game) return false;
    if (flag && !flags.includes(flag)) return false;
    if (adult !== 'any' && (adult === 'mature') !== r.mature) return false;
    if (status === 'playable' && !r.usable) return false;
    if (status === 'off' && r.usable) return false;
    if (status === 'edited' && !(e?.p !== undefined || e?.a !== undefined)) return false;
    if (status === 'disabled' && !e?.disabled) return false;
    if (status === 'reviewed' && !e?.reviewed) return false;
    if (terms.length) {
      const hay = new Set([...normalize(r.prompt), ...normalize(gameById.get(r.gameId)?.title ?? ''), r.id.toLowerCase()]);
      const text = normalize(r.prompt).join(' ');
      if (!terms.every((t) => hay.has(t) || text.includes(t) || r.id.toLowerCase().includes(t))) return false;
    }
    return true;
  });
  useEffect(() => setLimit(30), [q, game, status, flag, adult, mode]);
  const flagCounts = useMemo(() => {
    const c: Partial<Record<ReviewFlag, number>> = {};
    for (const { flags } of base) for (const f of flags) c[f] = (c[f] ?? 0) + 1;
    return c;
  }, [base]);

  return (
    <div className="space-y-3">
      {mode === 'review' && (
        <p className="text-sm text-ink-400">שאלות שכדאי לבדוק: לא נכנסו למשחק, חסרה בהן מילה, נקטעו, או שהכתוביות היו לא ברורות. מתקנים, ואז "סומן כנבדק" כדי להוציא מהרשימה.</p>
      )}
      <div className="relative">
        <input className="input ps-11" type="search" placeholder="חיפוש בטקסט, במשחק או במזהה…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש שאלות" />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden>
          🔍
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className="input text-base" value={game} onChange={(e) => setGame(e.target.value)} aria-label="משחק">
          <option value="">כל המשחקים</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <select className="input text-base" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="מצב">
          <option value="all">כל המצבים</option>
          <option value="playable">במשחק</option>
          <option value="off">לא במשחק</option>
          <option value="edited">ערכתי</option>
          <option value="disabled">הושבת ידנית</option>
          <option value="reviewed">סומן כנבדק</option>
        </select>
        <select className="input text-base" value={adult} onChange={(e) => setAdult(e.target.value as typeof adult)} aria-label="תוכן">
          <option value="any">כל התוכן</option>
          <option value="general">רגיל</option>
          <option value="mature">18+</option>
        </select>
        {mode === 'review' ? (
          <label className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-ink-600 px-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-amber-400" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />
            להציג גם נבדקות
          </label>
        ) : (
          <span />
        )}
      </div>
      {mode === 'review' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="סיבה">
          <button aria-pressed={!flag} onClick={() => setFlag('')} className={`chip min-h-[40px] ${!flag ? 'border-amber-400 text-amber-300' : 'text-ink-400'}`}>
            הכל ({base.length})
          </button>
          {(Object.keys(FLAG_LABELS) as ReviewFlag[])
            .filter((f) => flagCounts[f])
            .map((f) => (
              <button key={f} aria-pressed={flag === f} onClick={() => setFlag(flag === f ? '' : f)} className={`chip min-h-[40px] ${flag === f ? 'border-amber-400 text-amber-300' : 'text-ink-400'}`}>
                {FLAG_LABELS[f]} ({flagCounts[f]})
              </button>
            ))}
        </div>
      )}
      <p className="text-sm text-ink-400">{list.length} שאלות</p>
      {list.slice(0, limit).map(({ r, flags }) => (
        <RoundEditor key={r.id} round={r} flags={flags} game={gameById.get(r.gameId)!} overrides={overrides} update={update} />
      ))}
      {list.length > limit && (
        <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + 30)}>
          עוד {Math.min(30, list.length - limit)}
        </button>
      )}
      {!list.length && <p className="card p-6 text-center text-ink-400">{mode === 'review' ? 'אין שאלות שמחכות לבדיקה עם הסינון הזה 🎉' : 'לא נמצאו שאלות.'}</p>}
    </div>
  );
}

let evidenceCache: Record<string, string> | null = null;

function RoundEditor({ round, flags, game, overrides, update }: { round: Round; flags: ReviewFlag[]; game: GameMeta; overrides: AdminOverrides; update: (o: AdminOverrides) => void }) {
  const edit = overrides.edits[round.id] ?? {};
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(round.prompt);
  const [ev, setEv] = useState<Evidence | null>(null);
  const secret = useMemo(() => openSecret(round), [round]);
  const original = useMemo(() => (edit.p !== undefined ? resolveDeck().rounds.find((x) => x.id === round.id)?.prompt ?? null : null), [edit.p, round.id]);
  useEffect(() => setDraft(round.prompt), [round.prompt]);
  const set = (patch: Partial<typeof edit>) => {
    const next = { ...edit, ...patch };
    for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] === undefined) delete next[k];
    update({ ...overrides, edits: { ...overrides.edits, [round.id]: next } });
  };
  const loadEvidence = async () => {
    if (round.custom) {
      const c = overrides.custom.find((x) => x.id === round.id);
      setEv({ src: c?.source?.name ?? 'הוזן ידנית', ls: c?.source?.ls ?? 0, le: c?.source?.le ?? 0, t0: null, t1: null, raw: c?.source?.raw ?? null, st: 'admin', why: null, notes: '', cand: null, dis: null, dup: null });
      return;
    }
    evidenceCache ??= (await import('../generated/evidence.json')).default as Record<string, string>;
    setEv(unseal<Evidence>('ev:' + round.id, evidenceCache[round.id]));
  };
  const dirty = draft.trim() !== round.prompt.trim();

  return (
    <article className={`card p-4 ${edit.reviewed ? 'opacity-70' : ''}`}>
      <button className="w-full text-start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-amber-300">
            {game.emoji} {game.title}
          </span>
          <span className={`chip py-0 ${round.usable ? 'border-amber-400/60 text-amber-300' : 'text-cherry-300'}`}>{round.usable ? 'במשחק' : 'לא במשחק'}</span>
          {!round.usable && round.reason && <span className="chip py-0 text-ink-400">{REASON_LABELS[round.reason] ?? round.reason}</span>}
          {flags
            .filter((f) => f !== 'not-playable')
            .map((f) => (
              <span key={f} className="chip border-cherry-500/50 py-0 text-cherry-200">
                {FLAG_LABELS[f]}
              </span>
            ))}
          {(edit.p !== undefined || edit.a !== undefined) && <span className="chip border-cyan-400/60 py-0 text-cyan-300">נערך</span>}
          {edit.reviewed && <span className="chip py-0 text-ink-400">✓ נבדק</span>}
          {round.mature && <span className="chip py-0 text-cherry-300">18+</span>}
        </div>
        <p className="text-white">{round.prompt || '(אין טקסט)'}</p>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-ink-700 pt-3">
          <label className="label" htmlFor={`edit-${round.id}`}>
            טקסט השאלה
          </label>
          <textarea id={`edit-${round.id}`} className="input min-h-[100px] py-2 text-base" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-amber min-h-[44px] text-base" disabled={!dirty || !draft.trim()} onClick={() => set({ p: draft.trim() })}>
              שמירת הטקסט
            </button>
            {dirty && (
              <button className="btn-ghost min-h-[44px] text-base" onClick={() => setDraft(round.prompt)}>
                ביטול
              </button>
            )}
            {edit.p !== undefined && (
              <button className="btn-ghost min-h-[44px] text-base" onClick={() => set({ p: undefined })}>
                חזרה לטקסט המקורי
              </button>
            )}
          </div>
          {original && <p className="text-xs text-ink-400">המקורי: {original}</p>}
          {game.engine === 'realfake' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-400">תשובה:</span>
              {Object.entries(game.options).map(([k, l]) => (
                <button key={k} aria-pressed={secret.a === k} onClick={() => set({ a: k })} className={`chip min-h-[40px] ${secret.a === k ? 'border-amber-400 text-amber-300' : ''}`}>
                  {l}
                </button>
              ))}
              <button onClick={() => set({ a: null })} className={`chip min-h-[40px] ${secret.a == null ? 'border-cherry-400 text-cherry-300' : ''}`}>
                לא ידוע
              </button>
            </div>
          )}
          {round.choices && <p className="text-sm text-ink-400">אפשרויות: {round.choices.join(' / ')}</p>}
          {secret.rv && <p className="text-sm italic text-ink-400">חשיפה: ״{secret.rv}״</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost min-h-[44px] text-base" onClick={() => set({ reviewed: edit.reviewed ? undefined : true })} aria-pressed={!!edit.reviewed}>
              {edit.reviewed ? '✓ סומן כנבדק' : 'סימון כנבדק'}
            </button>
            {!round.usable && !edit.disabled && (
              <button className="btn-ghost min-h-[44px] text-base" onClick={() => set({ approve: !edit.approve })} aria-pressed={!!edit.approve}>
                {edit.approve ? '✓ הוכנס למשחק' : 'להכניס למשחק'}
              </button>
            )}
            <button className="btn-ghost min-h-[44px] text-base" onClick={() => set({ disabled: edit.disabled ? undefined : true })} aria-pressed={!!edit.disabled}>
              {edit.disabled ? 'מושבת — להחזיר' : 'להוציא מהמשחק'}
            </button>
            <button className="btn-ghost min-h-[44px] text-base" onClick={loadEvidence}>
              מה נאמר בפודקאסט
            </button>
            {round.custom && (
              <button className="btn-ghost min-h-[44px] text-base text-cherry-300" onClick={() => update({ ...overrides, custom: overrides.custom.filter((c) => c.id !== round.id) })}>
                מחיקה
              </button>
            )}
          </div>
          {edit.approve && game.engine === 'realfake' && secret.a == null && <p className="text-sm text-cherry-300">כדי שהשאלה תיכנס למשחק צריך לבחור תשובה.</p>}
          {ev && (
            <div className="rounded-2xl bg-ink-950 p-3 text-sm">
              <p>
                <b>מקור:</b> {ev.src} · שורות {ev.ls}–{ev.le} {ev.t0 && `· ${ev.t0}–${ev.t1 ?? ''}`}
              </p>
              {ev.cand && <p>תשובה אפשרית (לא ודאית): {game.options[ev.cand] ?? ev.cand}</p>}
              {ev.dis && <p className="text-cherry-300">{ev.dis}</p>}
              {ev.raw && <p className="mt-2 whitespace-pre-wrap text-ink-400">{ev.raw}</p>}
              {ev.notes && <p className="mt-2 text-ink-400">הערות: {ev.notes}</p>}
            </div>
          )}
          <p className="text-[11px] text-ink-400">מזהה: {round.id}</p>
        </div>
      )}
    </article>
  );
}

function Import({ games, overrides, update }: { games: GameMeta[]; overrides: AdminOverrides; update: (o: AdminOverrides) => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string[]>([]);
  const [lines, setLines] = useState<string[] | null>(null);
  const [name, setName] = useState('');
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [game, setGame] = useState(games[0]?.id ?? '');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const g = games.find((x) => x.id === game);

  const readFile = async (f: File) => {
    setName(f.name);
    const t = await f.text();
    if (/\.(json|csv)$/i.test(f.name)) setText(t);
    else setLines(t.split(/\r?\n/));
  };
  const addStructured = () => {
    const { rounds, errors } = importRounds(text, games);
    update({ ...overrides, custom: [...overrides.custom, ...rounds] });
    setMsg([`נוספו ${rounds.length} שאלות.`, ...errors]);
    if (rounds.length) setText('');
  };
  const pick = (i: number) => {
    if (!sel || sel[0] !== sel[1]) return setSel([i, i]);
    const s: [number, number] = [Math.min(sel[0], i), Math.max(sel[0], i)];
    setSel(s);
    setPrompt(lines!.slice(s[0], s[1] + 1).join(' ').trim());
  };
  const addFromTranscript = () => {
    if (!sel || !lines) return;
    const c: CustomRound = {
      id: `tx-${Date.now().toString(36)}`,
      gameId: game,
      prompt: prompt.trim(),
      answer: g?.engine === 'realfake' ? answer : null,
      choices: null,
      mature: !!g?.mature,
      source: { name: name || 'תמליל מודבק', ls: sel[0] + 1, le: sel[1] + 1, raw: lines.slice(sel[0], sel[1] + 1).join('\n') }
    };
    update({ ...overrides, custom: [...overrides.custom, c] });
    setMsg([`נוספה שאלה (שורות ${c.source!.ls}–${c.source!.le}).`]);
    setSel(null);
    setPrompt('');
  };

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-4">
        <h3 className="font-display text-xl text-white">JSON / CSV</h3>
        <p className="text-sm text-ink-400">
          עמודות CSV: <code>game_id,prompt,answer,mature</code>. JSON: מערך של אותם שדות (אפשר גם <code>options</code>). מזהי משחקים: {games.map((x) => x.id).join(', ')}
        </p>
        <textarea className="input min-h-[120px] py-2 font-mono text-sm" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder="הדביקו כאן…" />
        <div className="flex gap-2">
          <label className="btn-ghost flex-1 cursor-pointer text-base">
            קובץ (TXT / JSON / CSV)
            <input type="file" accept=".txt,.json,.csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          <button className="btn-amber flex-1 text-base" disabled={!text.trim()} onClick={addStructured}>
            ייבוא
          </button>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h3 className="font-display text-xl text-white">תמליל חדש</h3>
        <p className="text-sm text-ink-400">אין פה חילוץ אוטומטי: מדביקים תמליל, מסמנים שורת התחלה ושורת סוף, ויוצרים שאלה עם ראיה מהמקור.</p>
        {!lines ? (
          <>
            <textarea className="input min-h-[120px] py-2 text-sm" placeholder="הדביקו תמליל…" onBlur={(e) => e.target.value.trim() && setLines(e.target.value.split(/\r?\n/))} />
          </>
        ) : (
          <>
            <div className="max-h-72 overflow-y-auto rounded-2xl bg-ink-950 p-2 text-sm">
              {lines.map((l, i) => {
                const on = sel && i >= sel[0] && i <= sel[1];
                return (
                  <button key={i} onClick={() => pick(i)} className={`block w-full rounded px-2 py-1 text-start ${on ? 'bg-amber-400/20 text-amber-200' : 'text-ink-200'}`}>
                    <span className="me-2 text-ink-400">{i + 1}</span>
                    {l}
                  </button>
                );
              })}
            </div>
            <button className="text-sm text-ink-400 underline" onClick={() => (setLines(null), setSel(null))}>
              תמליל אחר
            </button>
            {sel && (
              <div className="space-y-2">
                <select className="input" value={game} onChange={(e) => setGame(e.target.value)} aria-label="משחק">
                  {games.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
                <textarea className="input min-h-[80px] py-2" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="טקסט השאלה (ערוך)" />
                {g?.engine === 'realfake' && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(g.options).map(([k, l]) => (
                      <button key={k} onClick={() => setAnswer(k)} className={`chip min-h-[40px] ${answer === k ? 'border-amber-400 text-amber-300' : ''}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                <button className="btn-amber w-full text-base" disabled={!prompt.trim() || (g?.engine === 'realfake' && !answer)} onClick={addFromTranscript}>
                  יצירת שאלה משורות {sel[0] + 1}–{sel[1] + 1}
                </button>
              </div>
            )}
          </>
        )}
      </section>
      {msg.map((m) => (
        <p key={m} className="text-sm text-amber-300">
          {m}
        </p>
      ))}
    </div>
  );
}

function Dupes({ rounds, overrides, update }: { rounds: Round[]; overrides: AdminOverrides; update: (o: AdminOverrides) => void }) {
  const pairs = useMemo(() => findDuplicates(rounds.filter((r) => r.usable)), [rounds]);
  const byId = new Map(rounds.map((r) => [r.id, r]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-400">{pairs.length ? `${pairs.length} זוגות דומים בין השאלות הפעילות.` : 'לא נמצאו כפילויות בין השאלות הפעילות.'}</p>
      {pairs.map(([a, b, s]) => (
        <div key={a + b} className="card space-y-2 p-4 text-sm">
          <p className="text-ink-400">דמיון {Math.round(s * 100)}%</p>
          {[a, b].map((id) => (
            <div key={id} className="flex items-start gap-2">
              <span className="chip shrink-0 text-xs">{id}</span>
              <span className="flex-1">{byId.get(id)?.prompt}</span>
              <button className="btn-ghost min-h-[40px] shrink-0 px-3 text-sm" onClick={() => update({ ...overrides, edits: { ...overrides.edits, [id]: { ...overrides.edits[id], disabled: true } } })}>
                השבתה
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Rules({ games, overrides, update }: { games: GameMeta[]; overrides: AdminOverrides; update: (o: AdminOverrides) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-400">טקסט חוקים מותאם לכל משחק (ריק = ברירת המחדל).</p>
      {games.map((g) => (
        <label key={g.id} className="block">
          <span className="label">
            {g.emoji} {g.title}
          </span>
          <textarea
            className="input min-h-[70px] py-2 text-base"
            defaultValue={overrides.rules[g.id] ?? ''}
            onBlur={(e) => {
              const rules = { ...overrides.rules };
              if (e.target.value.trim()) rules[g.id] = e.target.value.trim();
              else delete rules[g.id];
              update({ ...overrides, rules });
            }}
          />
        </label>
      ))}
    </div>
  );
}
