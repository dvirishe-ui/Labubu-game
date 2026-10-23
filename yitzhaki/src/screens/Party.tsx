import { useMemo, useState } from 'react';
import { ConfirmButton, copyText, Scoreboard, Screen, TopBar } from '../components/ui';
import { drawRounds, loadSeen, markSeen, openSecret, playablePool } from '../lib/deck';
import { useParty } from '../lib/party';
import { newSeed } from '../lib/rng';
import { tally } from '../lib/scoring';
import { sfx } from '../lib/sound';
import type { GameMeta, Round } from '../lib/types';

/** Party Room only supports two-option rounds (real/fake and dilemmas). */
const partyGames = (games: GameMeta[]) => games.filter((g) => g.count > 0 && (g.engine === 'realfake' || g.engine === 'dilemma'));

export default function Party({ games, rounds, mature, onBack }: { games: GameMeta[]; rounds: Round[]; mature: boolean; onBack: () => void }) {
  const p = useParty();
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [name, setName] = useState('');

  const exit = () => {
    p.leave();
    onBack();
  };

  if (!p.state || !p.role) {
    return (
      <Screen>
        <TopBar onBack={exit} title="חדר מסיבה" />
        {!p.connected && <p className="mb-4 text-center text-ink-400">מתחברים לשרת…</p>}
        <section className="card mb-4 space-y-3 p-5">
          <h2 className="font-display text-2xl text-white">מצטרפים</h2>
          <input className="input text-center font-display text-3xl uppercase tracking-[.4em]" placeholder="קוד" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="קוד חדר" />
          <input className="input" placeholder="השם שלך" maxLength={18} value={name} onChange={(e) => setName(e.target.value)} aria-label="שם" />
          <button className="btn-amber w-full" disabled={!p.connected || code.length !== 4 || !name.trim()} onClick={() => p.join(code, name)}>
            כניסה לחדר
          </button>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-display text-2xl text-white">פותחים חדר</h2>
          <p className="text-ink-400">המכשיר הזה יהיה המסך של המנחה — הוא מחזיק את השאלות והתשובות. כולם מצביעים מהטלפון שלהם.</p>
          <button className="btn-cherry w-full" disabled={!p.connected} onClick={p.create}>
            פתיחת חדר חדש
          </button>
        </section>
        {p.error && <p className="mt-4 text-center text-cherry-300" role="alert">{p.error}</p>}
      </Screen>
    );
  }

  return p.role === 'host' ? <Host p={p} games={games} rounds={rounds} mature={mature} onExit={exit} /> : <Player p={p} onExit={exit} />;
}

type P = ReturnType<typeof useParty>;

function Host({ p, games, rounds, mature, onExit }: { p: P; games: GameMeta[]; rounds: Round[]; mature: boolean; onExit: () => void }) {
  const s = p.state!;
  const available = partyGames(games).filter((g) => mature || !g.mature);
  const [gameIds, setGameIds] = useState(available.map((g) => g.id));
  const [queue, setQueue] = useState<Round[] | null>(null);
  const [current, setCurrent] = useState<Round | null>(null);
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const joinUrl = `${location.origin}${location.pathname}?room=${s.code}`;

  const next = () => {
    let q = queue;
    if (!q || !q.length) {
      const pool = playablePool(rounds, gameIds, mature);
      q = drawRounds(pool, 'all', loadSeen(), newSeed()).picked;
      if (!q.length) q = drawRounds(pool, pool.length, new Set(), newSeed()).picked;
    }
    const [r, ...rest] = q;
    if (!r) return;
    const g = gameById.get(r.gameId)!;
    const options = r.choices?.length === 2 ? { a: r.choices[0], b: r.choices[1] } : g.options;
    const fee = g.engine === 'dilemma' ? openSecret(r).fee : null;
    p.send({ t: 'publish', round: { id: r.id, prompt: fee ? `${r.prompt}\n💰 ${fee}` : r.prompt, options, game: g.title, engine: g.engine } });
    setQueue(rest);
    setCurrent(r);
    sfx.lock();
  };

  const reveal = () => {
    if (!current) return;
    const g = gameById.get(current.gameId)!;
    const sec = openSecret(current);
    p.send({ t: 'reveal', answer: g.engine === 'realfake' ? sec.a : null, note: g.engine === 'realfake' ? sec.rv : sec.pn.join(' · ') || null });
    markSeen([current.id]);
    sfx.reveal();
  };

  const voted = s.players.filter((x) => x.voted).length;

  return (
    <Screen>
      <TopBar onBack={onExit} title={`חדר ${s.code}`} right={!p.connected ? <span className="chip text-cherry-300">מנותק…</span> : undefined} />
      {s.phase === 'lobby' && (
        <section className="card mb-4 p-5 text-center">
          <p className="text-ink-400">נכנסים מהטלפון לכתובת הזאת ומקלידים את הקוד:</p>
          <p className="my-2 break-all text-sm text-amber-300">{joinUrl}</p>
          <p className="font-display text-7xl tracking-[.3em] text-amber-400">{s.code}</p>
          <button className="btn-ghost mt-3 text-base" onClick={() => void copyText(joinUrl)}>
            העתקת קישור
          </button>
        </section>
      )}

      {s.phase === 'lobby' && (
        <section className="mb-4">
          <span className="label">משחקים בחדר</span>
          <div className="flex flex-wrap gap-2">
            {available.map((g) => (
              <button
                key={g.id}
                aria-pressed={gameIds.includes(g.id)}
                onClick={() => setGameIds((ids) => (ids.includes(g.id) ? ids.filter((x) => x !== g.id) : [...ids, g.id]))}
                className={`chip min-h-[44px] ${gameIds.includes(g.id) ? 'border-amber-400 text-amber-300' : 'text-ink-400'}`}
              >
                {g.emoji} {g.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {s.round && s.phase !== 'lobby' && (
        <section className="card mb-4 p-5 animate-pop">
          <p className="mb-2 text-sm font-bold text-amber-300">{s.round.game}</p>
          <p className="whitespace-pre-line font-display text-2xl text-white">{s.round.prompt}</p>
          {s.phase === 'vote' && (
            <p className="mt-3 text-ink-400">
              הצביעו {voted}/{s.players.length}
            </p>
          )}
          {s.phase === 'reveal' && s.votes && <Distribution options={s.round.options} votes={s.votes} answer={s.reveal?.answer ?? null} note={s.reveal?.note ?? null} />}
        </section>
      )}

      <div className="mb-6 grid gap-3">
        {s.phase === 'vote' ? (
          <button className="btn-cherry text-xl" onClick={reveal} disabled={!voted}>
            חשיפה
          </button>
        ) : (
          <button className="btn-amber text-xl" onClick={next} disabled={!s.players.length || !gameIds.length}>
            {s.phase === 'lobby' ? (s.players.length ? 'מתחילים!' : 'מחכים לשחקנים…') : 'שאלה הבאה'}
          </button>
        )}
      </div>

      <span className="label">שחקנים</span>
      <Scoreboard items={s.players.map((x) => ({ id: x.id, name: `${x.online ? '' : '💤 '}${x.name}${s.phase === 'vote' && x.voted ? ' ✓' : ''}`, score: x.score }))} />
      <ConfirmButton
        className="btn-ghost mt-6 w-full"
        label="סגירת החדר"
        confirmLabel="לסגור לכולם? הקישו שוב"
        onConfirm={() => {
          p.send({ t: 'end' });
          onExit();
        }}
      />
    </Screen>
  );
}

function Distribution({ options, votes, answer, note }: { options: Record<string, string>; votes: Record<string, string>; answer: string | null; note: string | null }) {
  const t = tally(votes);
  const total = Object.values(t).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="mt-4 space-y-2">
      {answer && <p className="font-display text-3xl text-amber-400">התשובה: {options[answer]}</p>}
      {Object.entries(options).map(([k, l]) => (
        <div key={k}>
          <div className="flex justify-between text-sm">
            <span>
              {l} {answer === k && '✓'}
            </span>
            <span>{t[k] ?? 0}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-ink-700">
            <div className={`h-full rounded-full ${answer === k ? 'bg-amber-400' : 'bg-cherry-500'}`} style={{ width: `${((t[k] ?? 0) / total) * 100}%` }} />
          </div>
        </div>
      ))}
      {note && <p className="pt-2 text-sm italic text-ink-400">״{note}״</p>}
    </div>
  );
}

function Player({ p, onExit }: { p: P; onExit: () => void }) {
  const s = p.state!;
  const me = s.players.find((x) => x.id === p.id);
  const myVote = s.votes?.[p.id];
  if (s.phase === 'ended')
    return (
      <Screen>
        <TopBar onBack={onExit} title="החדר נסגר" />
        <Scoreboard items={s.players} />
      </Screen>
    );
  return (
    <Screen>
      <TopBar onBack={onExit} title={`${me?.name ?? ''} · ${me?.score ?? 0} נק׳`} right={!p.connected ? <span className="chip text-cherry-300">מתחבר…</span> : undefined} />
      {s.phase === 'lobby' && <p className="mt-20 text-center font-display text-3xl text-amber-400 animate-flicker">מחכים למנחה…</p>}
      {s.round && s.phase === 'vote' && (
        <div className="space-y-4">
          <section className="card p-5 animate-pop">
            <p className="mb-2 text-sm font-bold text-amber-300">{s.round.game}</p>
            <p className="whitespace-pre-line font-display text-2xl text-white">{s.round.prompt}</p>
          </section>
          {me?.voted ? (
            <p className="text-center text-xl text-ink-200">ההצבעה נקלטה ✓ מחכים לאחרים…</p>
          ) : (
            <div className="grid gap-3">
              {Object.entries(s.round.options).map(([k, l], i) => (
                <button key={k} className={i === 0 ? 'btn-amber min-h-[80px] text-2xl' : 'btn-cherry min-h-[80px] text-2xl'} onClick={() => (sfx.lock(), p.send({ t: 'vote', choice: k }))}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {s.round && s.phase === 'reveal' && (
        <div className="mt-6 space-y-4 text-center animate-pop">
          {s.reveal?.answer ? (
            <p className={`font-display text-5xl ${myVote === s.reveal.answer ? 'text-amber-400' : 'text-cherry-400'}`}>{myVote === s.reveal.answer ? 'צדקת! +1' : myVote ? 'לא הפעם' : 'לא הצבעת'}</p>
          ) : (
            <p className="font-display text-3xl text-amber-400">רואים את התוצאות על מסך המנחה</p>
          )}
          <Distribution options={s.round.options} votes={s.votes ?? {}} answer={s.reveal?.answer ?? null} note={null} />
        </div>
      )}
      {p.error && <p className="mt-4 text-center text-cherry-300">{p.error}</p>}
    </Screen>
  );
}
