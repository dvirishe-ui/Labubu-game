import { useMemo, useState } from 'react';
import { Screen, TopBar } from '../components/ui';
import { findDuplicates, importRounds } from '../lib/admin';
import { resolveDeck, saveOverrides, openSecret, type AdminOverrides, type CustomRound } from '../lib/deck';
import { unseal } from '../lib/obfuscate';
import type { GameMeta, Round } from '../lib/types';

type Tab = 'overview' | 'rounds' | 'import' | 'dupes' | 'rules';

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
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const { games, rounds } = useMemo(() => resolveDeck(overrides), [overrides]);
  const update = (o: AdminOverrides) => {
    saveOverrides(o);
    onChange(o);
  };

  if (!ok)
    return (
      <Screen>
        <TopBar onBack={onBack} title="מצב עורך" />
        <div className="card space-y-4 p-6 text-center">
          <p className="text-5xl">⚠️</p>
          <p className="font-display text-2xl text-cherry-400">יש פה ספוילרים</p>
          <p className="text-ink-400">מצב העורך מציג שאלות, תשובות וראיות מהתמלילים. מי שמתכנן לשחק — לא להיכנס.</p>
          <button className="btn-cherry w-full" onClick={() => setOk(true)}>
            אני העורך/ת, להמשיך
          </button>
        </div>
      </Screen>
    );

  return (
    <Screen className="max-w-3xl">
      <TopBar onBack={onBack} title="מצב עורך" />
      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-ink-800 p-1" role="tablist">
        {(
          [
            ['overview', 'סקירה'],
            ['rounds', 'שאלות'],
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
      {tab === 'rounds' && <Rounds games={games} rounds={rounds} overrides={overrides} update={update} />}
      {tab === 'import' && <Import games={games} overrides={overrides} update={update} />}
      {tab === 'dupes' && <Dupes rounds={rounds} overrides={overrides} update={update} />}
      {tab === 'rules' && <Rules games={games} overrides={overrides} update={update} />}
    </Screen>
  );
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Overview({ games, rounds, overrides, onReset, onLoad }: { games: GameMeta[]; rounds: Round[]; overrides: AdminOverrides; onReset: () => void; onLoad: (o: AdminOverrides) => void }) {
  const usable = rounds.filter((r) => r.usable).length;
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
        <button className="btn-ghost text-base" onClick={() => download('editor-overrides.json', overrides)}>
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
                alert('קובץ לא תקין');
              }
            }}
          />
        </label>
        <button className="btn-ghost text-base text-cherry-300" onClick={() => confirm('למחוק את כל השינויים מהמכשיר?') && onReset()}>
          איפוס שינויים
        </button>
      </div>
      <p className="text-sm text-ink-400">השינויים נשמרים במכשיר הזה. כדי להכניס אותם למאגר הקבוע: ייצוא → מיזוג לתיקיית data/extraction → npm run build.</p>
    </div>
  );
}

function Rounds({ games, rounds, overrides, update }: { games: GameMeta[]; rounds: Round[]; overrides: AdminOverrides; update: (o: AdminOverrides) => void }) {
  const [game, setGame] = useState(games[0]?.id ?? '');
  const [filter, setFilter] = useState<'all' | 'usable' | 'review'>('review');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(25);
  const list = rounds.filter((r) => (!game || r.gameId === game) && (filter === 'all' || (filter === 'usable') === r.usable) && (!q || r.prompt.includes(q) || r.id.includes(q)));
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <select className="input" value={game} onChange={(e) => setGame(e.target.value)} aria-label="משחק">
          <option value="">כל המשחקים</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title} ({g.count}/{g.count + g.unresolved})
            </option>
          ))}
        </select>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="סינון">
          <option value="review">לבדיקה</option>
          <option value="usable">פעילות</option>
          <option value="all">הכל</option>
        </select>
        <input className="input" placeholder="חיפוש" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="text-sm text-ink-400">{list.length} שאלות</p>
      {list.slice(0, limit).map((r) => (
        <RoundEditor key={r.id} round={r} game={games.find((g) => g.id === r.gameId)!} overrides={overrides} update={update} />
      ))}
      {list.length > limit && (
        <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + 25)}>
          עוד
        </button>
      )}
    </div>
  );
}

let evidenceCache: Record<string, string> | null = null;

function RoundEditor({ round, game, overrides, update }: { round: Round; game: GameMeta; overrides: AdminOverrides; update: (o: AdminOverrides) => void }) {
  const edit = overrides.edits[round.id] ?? {};
  const [ev, setEv] = useState<Evidence | null>(null);
  const secret = useMemo(() => openSecret(round), [round]);
  const set = (patch: Partial<typeof edit>) => update({ ...overrides, edits: { ...overrides.edits, [round.id]: { ...edit, ...patch } } });
  const loadEvidence = async () => {
    if (round.custom) {
      const c = overrides.custom.find((x) => x.id === round.id);
      setEv({ src: c?.source?.name ?? 'הוזן ידנית', ls: c?.source?.ls ?? 0, le: c?.source?.le ?? 0, t0: null, t1: null, raw: c?.source?.raw ?? null, st: 'admin', why: null, notes: '', cand: null, dis: null, dup: null });
      return;
    }
    evidenceCache ??= (await import('../generated/evidence.json')).default as Record<string, string>;
    setEv(unseal<Evidence>('ev:' + round.id, evidenceCache[round.id]));
  };
  return (
    <details className="card p-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <span className={`chip ${round.usable ? 'border-amber-400 text-amber-300' : 'text-cherry-300'}`}>{round.usable ? 'פעיל' : 'לבדיקה'}</span>
        <span className="chip text-ink-400">{round.confidence}</span>
        {round.mature && <span className="chip text-cherry-300">18+</span>}
        <span className="text-xs text-ink-400">{round.id}</span>
        <span className="w-full truncate text-white">{round.prompt || '(אין טקסט)'}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <textarea className="input min-h-[90px] py-2 text-base" defaultValue={round.prompt} onBlur={(e) => e.target.value !== round.prompt && set({ p: e.target.value })} aria-label="טקסט השאלה" />
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
          <button className="btn-ghost min-h-[44px] text-base" onClick={() => set({ approve: !edit.approve })} aria-pressed={!!edit.approve}>
            {edit.approve ? '✓ אושר ידנית' : 'אישור ידני'}
          </button>
          <button className="btn-ghost min-h-[44px] text-base" onClick={() => set({ disabled: !edit.disabled })} aria-pressed={!!edit.disabled}>
            {edit.disabled ? 'מושבת — להפעיל' : 'השבתה'}
          </button>
          <button className="btn-ghost min-h-[44px] text-base" onClick={loadEvidence}>
            ראיות מהמקור
          </button>
          {round.custom && (
            <button className="btn-ghost min-h-[44px] text-base text-cherry-300" onClick={() => update({ ...overrides, custom: overrides.custom.filter((c) => c.id !== round.id) })}>
              מחיקה
            </button>
          )}
        </div>
        {ev && (
          <div className="rounded-2xl bg-ink-950 p-3 text-sm">
            <p>
              <b>מקור:</b> {ev.src} · שורות {ev.ls}–{ev.le} {ev.t0 && `· ${ev.t0}–${ev.t1 ?? ''}`}
            </p>
            <p>
              <b>מצב:</b> {ev.st} {ev.why && `· ${ev.why}`} {ev.cand && `· מועמד: ${ev.cand}`}
            </p>
            {ev.dis && <p className="text-cherry-300">{ev.dis}</p>}
            {ev.raw && <p className="mt-2 whitespace-pre-wrap text-ink-400">{ev.raw}</p>}
            {ev.notes && <p className="mt-2 text-ink-400">הערות: {ev.notes}</p>}
          </div>
        )}
      </div>
    </details>
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
