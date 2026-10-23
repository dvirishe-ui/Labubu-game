import { useState } from 'react';
import { Modal, MuteButton, Screen, Skyline, Wordmark } from '../components/ui';
import type { Session } from '../lib/session';
import type { GameMeta, Length } from '../lib/types';

export default function Home({
  games,
  mature,
  resume,
  partyAvailable,
  onPlay,
  onResume,
  onNotes,
  onParty,
  onAdmin,
  onMature
}: {
  games: GameMeta[];
  mature: boolean;
  resume: Session | null;
  partyAvailable: boolean;
  onPlay: (preset: { gameIds?: string[]; length?: Length }) => void;
  onResume: () => void;
  onNotes: () => void;
  onParty: () => void;
  onAdmin: () => void;
  onMature: () => void;
}) {
  const [quick, setQuick] = useState(false);
  const [about, setAbout] = useState(false);
  const playable = games.filter((g) => g.count > 0);
  const soon = games.filter((g) => g.count === 0);
  const total = playable.reduce((n, g) => n + g.count, 0);

  return (
    <Screen>
      <Skyline />
      <div className="flex justify-between">
        <button className={`chip min-h-[44px] ${mature ? 'border-cherry-400 text-cherry-300' : 'text-ink-400'}`} onClick={onMature} aria-pressed={mature}>
          {mature ? '18+ פעיל' : '18+ כבוי'}
        </button>
        <MuteButton />
      </div>
      <Wordmark />
      <p className="mb-6 text-center text-ink-400">
        {playable.length} משחקים · {total} שאלות מהפינות של הגג. לא רשמי, באהבה.
      </p>

      {resume && (
        <button className="card mb-4 flex items-center justify-between p-4 text-start animate-rise" onClick={onResume}>
          <span>
            <span className="block font-bold text-white">להמשיך את המשחק הקודם</span>
            <span className="text-sm text-ink-400">
              סבב {resume.index + 1} מתוך {resume.roundIds.length} · {resume.participants.map((p) => p.name).join(', ')}
            </span>
          </span>
          <span className="text-2xl">↩</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-amber col-span-2 min-h-[72px] text-2xl" onClick={() => setQuick(true)}>
          ⚡ משחק מהיר
        </button>
        <button className="btn-cherry text-base" onClick={() => onPlay({ length: 'marathon', gameIds: playable.map((g) => g.id) })}>
          🏃 מרתון
        </button>
        <button className="btn-ghost text-base" onClick={() => onPlay({})}>
          🎛️ משחק מותאם
        </button>
      </div>

      <h2 className="mb-3 mt-8 font-display text-2xl text-white">הפינות</h2>
      <div className="grid grid-cols-2 gap-3">
        {playable.map((g, i) => (
          <button
            key={g.id}
            className="card group flex min-h-[132px] flex-col items-start gap-1 p-3 text-start transition hover:border-amber-400 active:scale-[.98] animate-rise"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            onClick={() => (g.mature && !mature ? onMature() : onPlay({ gameIds: [g.id] }))}
          >
            <span className="flex w-full items-center justify-between">
              <span className="text-3xl transition group-hover:scale-110" aria-hidden>
                {g.emoji}
              </span>
              {g.mature && <span className="chip border-cherry-500 px-2 py-0 text-xs text-cherry-300">18+</span>}
            </span>
            <span className="font-display text-lg leading-tight text-white">{g.title}</span>
            <span className="text-xs leading-snug text-ink-400">{g.subtitle}</span>
            <span className="mt-auto text-xs font-bold text-amber-300">{g.count} שאלות</span>
          </button>
        ))}
      </div>

      <button className="card mt-6 flex w-full items-center gap-4 border-amber-400/40 p-4 text-start" onClick={onNotes}>
        <span className="text-4xl" aria-hidden>
          📝
        </span>
        <span>
          <span className="block font-display text-xl text-white">פתקים על הגג</span>
          <span className="block text-sm text-ink-400">תיאור · מילה אחת · פנטומימה</span>
          <span className="chip mt-1 border-amber-400 px-2 py-0 text-xs text-amber-300">משחק בונוס מקורי</span>
        </span>
      </button>

      {partyAvailable && (
        <button className="card mt-3 flex w-full items-center gap-4 p-4 text-start" onClick={onParty}>
          <span className="text-4xl" aria-hidden>
            📡
          </span>
          <span>
            <span className="block font-display text-xl text-white">חדר מסיבה</span>
            <span className="block text-sm text-ink-400">כל אחד מצביע מהטלפון שלו. מסך אחד מנחה.</span>
          </span>
        </button>
      )}

      {soon.length > 0 && (
        <p className="mt-6 text-center text-xs text-ink-400">
          עוד בדרך (אין מספיק חומר ברור בתמלילים): {soon.map((g) => g.title).join(' · ')}
        </p>
      )}

      <footer className="mt-8 flex justify-center gap-4 text-sm text-ink-400">
        <button className="underline" onClick={() => setAbout(true)}>
          אודות
        </button>
        <button className="underline" onClick={onAdmin}>
          מצב עורך
        </button>
      </footer>

      <Modal open={quick} onClose={() => setQuick(false)} title="משחק מהיר">
        <p className="mb-4 text-ink-400">מיקס של כל הפינות. כמה שאלות?</p>
        <div className="grid grid-cols-3 gap-3">
          {([5, 10, 15] as const).map((n) => (
            <button
              key={n}
              className="btn-amber min-h-[72px] text-3xl"
              onClick={() => {
                setQuick(false);
                onPlay({ length: n, gameIds: playable.filter((g) => g.engine === 'realfake' || g.engine === 'dilemma').map((g) => g.id) });
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={about} onClose={() => setAbout(false)} title="אודות">
        <div className="space-y-3 leading-relaxed">
          <p>אתר מעריצים לא רשמי, בהשראת פינות משחק מפודקאסט קומי ישראלי. אין קשר, חסות או אישור מטעם היוצרים.</p>
          <p>השאלות חולצו מתמלילים אוטומטיים. ״התשובה הנכונה״ היא מה שנחשף בפודקאסט — לא בדיקת עובדות. שאלות שלא נמצאה להן חשיפה ברורה לא נכנסו למשחק.</p>
          <p>״מכונת האמת״ היא בידור בלבד. שום דבר באפליקציה לא מזהה שקרים.</p>
          <p>תוכן למבוגרים מוסתר עד שמפעילים מצב 18+.</p>
          <p className="text-sm text-ink-400">״פתקים על הגג״ הוא משחק בונוס מקורי, לא פינה מהפודקאסט.</p>
        </div>
      </Modal>
    </Screen>
  );
}
