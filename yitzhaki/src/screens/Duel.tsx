import { useEffect, useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { ChallengeRun } from '../components/ChallengeRun';
import { CoinPill, fmt } from '../components/Coins';
import { Confetti, copyText, Screen, TopBar } from '../components/ui';
import { duelBoard, duelHash, duelRounds, isDuelCode, newDuelCode, type BoardRow } from '../lib/challenges';
import { duelWon, finishDuel } from '../lib/economy';
import { shareBase } from '../lib/share';
import { getPlayers, profileStore, useProfileState } from '../lib/store';
import type { GameMeta, Round } from '../lib/types';

export default function Duel({ games, rounds, initial, onBack }: { games: GameMeta[]; rounds: Round[]; initial: { code: string; score: number | null } | null; onBack: () => void }) {
  const { profile: p, cloud } = useProfileState();
  const [code, setCode] = useState<string | null>(initial?.code ?? null);
  const [entry, setEntry] = useState('');
  const [playing, setPlaying] = useState(false);
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);
  const set = useMemo(() => (code ? duelRounds(rounds, games, code) : []), [code, rounds, games]);
  const mine = code ? p.duels[code] : undefined;

  useEffect(() => {
    if (!code || playing) return;
    getPlayers(true).then((ps) => setRows(ps ? duelBoard(ps, code) : null));
  }, [code, playing, mine]);

  // Opponents: everyone else on the board, plus the score carried in the link when storage isn't shared.
  const others = (rows ?? []).filter((r) => r.id !== cloud?.userId);
  const linkScore = initial && initial.code === code ? initial.score : null;
  const best = Math.max(-1, ...others.map((r) => r.score), linkScore ?? -1);
  const won = !!mine && best >= 0 && mine.score > best;

  useEffect(() => {
    if (won && code) profileStore.apply((x) => duelWon(x, code));
  }, [won, code]);

  if (playing && code)
    return (
      <Screen>
        <TopBar title="תנצח אותי" />
        <ChallengeRun
          rounds={set}
          games={games}
          onFinish={(r) => {
            profileStore.apply((x) => finishDuel(x, code, r.score, r.correct));
            setPlaying(false);
          }}
        />
      </Screen>
    );

  const link = code && mine ? shareBase() + duelHash(code, mine.score) : '';
  const text = code && mine ? `אתגרתי אותך במשחקייה על הגג! עשיתי ${fmt(mine.score)} נקודות. קוד האתגר: ${code}\n${link}` : '';

  return (
    <Screen>
      <TopBar onBack={onBack} title="תנצח אותי" right={<CoinPill coins={p.coins} />} />
      {won && <Confetti />}
      {!code ? (
        <>
          <section className="card mb-4 space-y-3 p-5 text-center">
            <h2 className="font-display text-3xl text-white">אתגר חבר</h2>
            <p className="text-ink-200">משחקים 10 שאלות, שולחים קישור, והחבר מקבל בדיוק את אותן שאלות — מתי שבא לו.</p>
            <button
              className="btn-amber w-full text-xl"
              onClick={() => {
                setCode(newDuelCode());
                setPlaying(true);
              }}
            >
              יוצרים אתגר חדש
            </button>
          </section>
          <form
            className="card space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const c = entry.trim().toUpperCase();
              if (isDuelCode(c)) setCode(c);
            }}
          >
            <label className="label" htmlFor="duel-code">
              קיבלת קוד מחבר?
            </label>
            <input id="duel-code" className="input text-center font-display text-3xl uppercase tracking-[.3em]" maxLength={6} value={entry} onChange={(e) => setEntry(e.target.value.toUpperCase())} />
            <button className="btn-ghost w-full" disabled={!isDuelCode(entry.trim().toUpperCase())}>
              לאתגר
            </button>
          </form>
        </>
      ) : (
        <>
          <section className="card mb-4 p-5 text-center">
            <p className="text-sm text-ink-400">קוד אתגר</p>
            <p className="font-display text-5xl tracking-[.25em] text-amber-400">{code}</p>
            {mine ? (
              <>
                <p className="mt-3 font-display text-3xl tabular-nums text-white">{fmt(mine.score)} נקודות</p>
                {best >= 0 && <p className={`font-display text-xl ${won ? 'text-amber-300' : mine.score === best ? 'text-ink-200' : 'text-cherry-400'}`}>{won ? 'ניצחת!' : mine.score === best ? 'תיקו' : 'הפעם הפסדת'}</p>}
              </>
            ) : (
              <>
                {best >= 0 && <p className="mt-2 text-ink-200">התוצאה לנצח: {fmt(best)}</p>}
                <button className="btn-amber mt-4 w-full text-xl" onClick={() => setPlaying(true)} disabled={set.length < 10}>
                  משחקים
                </button>
              </>
            )}
          </section>
          {mine && (
            <section className="card mb-4 space-y-2 p-4">
              <span className="label">שולחים לחבר</span>
              <textarea className="input min-h-[96px] py-2 text-sm" readOnly value={text} onFocus={(e) => e.target.select()} aria-label="הודעה לשליחה" />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-ghost text-base" onClick={async () => setCopied((await copyText(text)) ? 'text' : null)}>
                  {copied === 'text' ? 'הועתק ✓' : 'העתקת הודעה'}
                </button>
                <button className="btn-ghost text-base" onClick={async () => setCopied((await copyText(link)) ? 'link' : null)}>
                  {copied === 'link' ? 'הועתק ✓' : 'העתקת קישור'}
                </button>
              </div>
            </section>
          )}
          <span className="label">תוצאות</span>
          <Board rows={rows} me={cloud?.userId ?? null} empty="עוד אף אחד אחר לא שיחק את האתגר הזה." />
          <button className="mt-6 w-full text-sm text-ink-400 underline" onClick={() => (setCode(null), setRows(null))}>
            אתגר אחר
          </button>
        </>
      )}
    </Screen>
  );
}
