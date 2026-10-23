import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Qr } from '../components/Qr';
import { ConfirmButton, copyText, Screen, TopBar } from '../components/ui';
import { useParty, type PartyPlayer } from '../lib/party';
import { tally } from '../lib/scoring';
import { sfx } from '../lib/sound';
import { useProfile } from '../lib/store';
import type { GameMeta, Round } from '../lib/types';

/** Party Room only supports two-option rounds (real/fake and dilemmas). */
const partyGames = (games: GameMeta[]) => games.filter((g) => g.count > 0 && (g.engine === 'realfake' || g.engine === 'dilemma'));

export default function Party({ games, mature, onBack }: { games: GameMeta[]; rounds: Round[]; mature: boolean; onBack: () => void }) {
  const p = useParty();
  const me = useProfile();
  const [code, setCode] = useState(() => {
    try {
      return new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
    } catch {
      return '';
    }
  });
  const [name, setName] = useState(me.name);

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
          <button className="btn-amber w-full" disabled={!p.connected || code.length !== 4 || !name.trim()} onClick={() => p.join(code, name, me.equipped.char, me.equipped.skin)}>
            כניסה לחדר
          </button>
          <p className="text-xs text-ink-400">הדמות שלך מצטרפת איתך לחדר.</p>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-display text-2xl text-white">פותחים חדר</h2>
          <p className="text-ink-400">המכשיר הזה יהיה המסך של המנחה. השרת שומר את השאלות והתשובות, מנהל את הטיימר ואת הניקוד — כולם מצביעים מהטלפון שלהם.</p>
          <button className="btn-cherry w-full" disabled={!p.connected} onClick={() => p.create({ mature, gameIds: partyGames(games).filter((g) => g.engine === 'realfake' && (mature || !g.mature)).map((g) => g.id) })}>
            פתיחת חדר חדש
          </button>
        </section>
        {p.error && (
          <p className="mt-4 text-center text-cherry-300" role="alert">
            {p.error}
          </p>
        )}
      </Screen>
    );
  }

  return p.role === 'host' ? <Host p={p} games={games} mature={mature} onExit={exit} /> : <Player p={p} onExit={exit} />;
}

type P = ReturnType<typeof useParty>;

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Countdown({ deadline }: { deadline: number | null }) {
  const now = useNow(!!deadline);
  if (!deadline) return null;
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <span className={`font-display text-3xl tabular-nums ${left <= 5 ? 'text-cherry-400' : 'text-white'}`}>{left}</span>;
}

function PlayerRow({ x, highlight, voting }: { x: PartyPlayer; highlight?: boolean; voting?: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${highlight ? 'border border-amber-400/60 bg-amber-400/10' : 'bg-ink-800'} ${x.online ? '' : 'opacity-50'}`}>
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-ink-900">
        <Avatar charId={x.char} skinId={x.skin} size={40} animated={false} />
      </span>
      <span className="min-w-0 flex-1 truncate font-bold text-white">
        {x.name} {!x.online && <span className="text-xs text-ink-400">(מתחבר/ת…)</span>}
      </span>
      {voting && <span className={`text-sm ${x.voted ? 'text-amber-300' : 'text-ink-400'}`}>{x.voted ? '✓ הצביע/ה' : '…'}</span>}
      <span className="font-display text-xl tabular-nums text-amber-400">{x.score}</span>
    </li>
  );
}

function Host({ p, games, mature, onExit }: { p: P; games: GameMeta[]; mature: boolean; onExit: () => void }) {
  const s = p.state!;
  const available = partyGames(games).filter((g) => mature || !g.mature);
  const [copied, setCopied] = useState(false);
  const joinUrl = `${location.origin}${location.pathname}?room=${s.code}`;
  const ranked = s.players.slice().sort((a, b) => b.score - a.score);
  const voted = s.players.filter((x) => x.voted).length;

  useEffect(() => {
    if (s.phase === 'reveal') sfx.reveal();
  }, [s.phase, s.index]);

  const setSettings = (patch: Partial<typeof s.settings>) => p.send({ t: 'settings', settings: { ...s.settings, ...patch } });
  const toggle = (id: string) => setSettings({ gameIds: s.settings.gameIds.includes(id) ? s.settings.gameIds.filter((x) => x !== id) : [...s.settings.gameIds, id] });

  return (
    <Screen>
      <TopBar onBack={onExit} title={`חדר ${s.code}`} right={!p.connected ? <span className="chip text-cherry-300">מנותק…</span> : undefined} />
      {s.phase === 'lobby' && (
        <>
          <section className="card mb-4 flex flex-col items-center gap-3 p-5 text-center">
            <Qr text={joinUrl} size={180} />
            <p className="font-display text-6xl tracking-[.3em] text-amber-400">{s.code}</p>
            <p className="break-all text-xs text-ink-400">{joinUrl}</p>
            <button className="btn-ghost text-base" onClick={async () => setCopied(await copyText(joinUrl))}>
              {copied ? 'הועתק ✓' : 'העתקת קישור'}
            </button>
          </section>
          <section className="mb-4 space-y-3">
            <span className="label">משחקים בחדר ({s.remaining} שאלות)</span>
            <div className="flex flex-wrap gap-2">
              {available.map((g) => (
                <button key={g.id} aria-pressed={s.settings.gameIds.includes(g.id)} onClick={() => toggle(g.id)} className={`chip min-h-[44px] ${s.settings.gameIds.includes(g.id) ? 'border-amber-400 text-amber-300' : 'text-ink-400'}`}>
                  {g.emoji} {g.title}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>טיימר</span>
              <div className="flex gap-1">
                {[0, 15, 20, 30].map((t) => (
                  <button key={t} aria-pressed={s.settings.timer === t} onClick={() => setSettings({ timer: t })} className={`min-h-[44px] min-w-[52px] rounded-xl px-2 font-bold ${s.settings.timer === t ? 'bg-amber-400 text-ink-950' : 'bg-ink-800'}`}>
                    {t ? `${t}ש׳` : 'בלי'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>בדילמות</span>
              <div className="flex gap-1">
                {(['free', 'majority'] as const).map((d) => (
                  <button key={d} aria-pressed={s.settings.decisionMode === d} onClick={() => setSettings({ decisionMode: d })} className={`min-h-[44px] rounded-xl px-3 font-bold ${s.settings.decisionMode === d ? 'bg-amber-400 text-ink-950' : 'bg-ink-800'}`}>
                    {d === 'free' ? 'רק להצביע' : 'הרוב קובע'}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {s.round && s.phase !== 'lobby' && (
        <section className="card mb-4 p-5 animate-pop" key={s.round.id}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-amber-300">
              {s.round.emoji} {s.round.game}
            </span>
            {s.phase === 'vote' && <Countdown deadline={s.deadline} />}
          </div>
          <p className="whitespace-pre-line font-display text-2xl text-white">{s.round.prompt}</p>
          {s.phase === 'vote' && (
            <p className="mt-3 text-ink-400">
              הצביעו {voted}/{s.players.length}
            </p>
          )}
          {s.phase === 'reveal' && s.votes && <Distribution options={s.round.options} votes={s.votes} answer={s.reveal?.answer ?? null} note={s.reveal?.note ?? null} />}
        </section>
      )}

      {s.phase === 'ended' ? (
        <p className="card mb-4 p-4 text-center text-ink-200">נגמרו השאלות במשחקים שנבחרו. כל הכבוד!</p>
      ) : (
        <div className="mb-6 grid gap-3">
          {s.phase === 'vote' ? (
            <button className="btn-cherry text-xl" onClick={() => p.send({ t: 'reveal' })} disabled={!voted}>
              חשיפה עכשיו
            </button>
          ) : (
            <button className="btn-amber text-xl" onClick={() => p.send({ t: 'next' })} disabled={!s.players.length || !s.remaining}>
              {s.phase === 'lobby' ? (s.players.length ? 'מתחילים!' : 'מחכים לשחקנים…') : 'שאלה הבאה'}
            </button>
          )}
        </div>
      )}

      <span className="label">{s.phase === 'lobby' ? `בחדר (${s.players.length})` : 'ניקוד'}</span>
      <ol className="space-y-2">
        {ranked.map((x) => (
          <PlayerRow key={x.id} x={x} voting={s.phase === 'vote'} />
        ))}
      </ol>
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
  const meP = s.players.find((x) => x.id === p.id);
  const myVote = s.votes?.[p.id];
  if (s.phase === 'ended')
    return (
      <Screen>
        <TopBar onBack={onExit} title="המשחק נגמר" />
        <ol className="space-y-2">
          {s.players
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((x) => (
              <PlayerRow key={x.id} x={x} highlight={x.id === p.id} />
            ))}
        </ol>
      </Screen>
    );
  return (
    <Screen>
      <TopBar onBack={onExit} title={`${meP?.name ?? ''} · ${meP?.score ?? 0} נק׳`} right={!p.connected ? <span className="chip text-cherry-300">מתחבר…</span> : undefined} />
      {s.phase === 'lobby' && (
        <div className="mt-6 space-y-4 text-center">
          {meP && (
            <div className="mx-auto w-40">
              <Avatar charId={meP.char} skinId={meP.skin} size={160} />
            </div>
          )}
          <p className="font-display text-3xl text-amber-400 animate-flicker">מחכים למנחה…</p>
          <ol className="space-y-2 text-start">
            {s.players.map((x) => (
              <PlayerRow key={x.id} x={x} highlight={x.id === p.id} />
            ))}
          </ol>
        </div>
      )}
      {s.round && s.phase === 'vote' && (
        <div className="space-y-4">
          <section className="card p-5 animate-pop" key={s.round.id}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-amber-300">
                {s.round.emoji} {s.round.game}
              </span>
              <Countdown deadline={s.deadline} />
            </div>
            <p className="whitespace-pre-line font-display text-2xl text-white">{s.round.prompt}</p>
          </section>
          {meP?.voted ? (
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
            <p className="font-display text-3xl text-amber-400">{s.reveal?.majority ? (myVote === s.reveal.majority ? 'הלכת עם הרוב! +1' : 'במיעוט הפעם') : 'ככה החבורה הצביעה'}</p>
          )}
          <Distribution options={s.round.options} votes={s.votes ?? {}} answer={s.reveal?.answer ?? null} note={null} />
        </div>
      )}
      {p.error && <p className="mt-4 text-center text-cherry-300">{p.error}</p>}
    </Screen>
  );
}
