import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { CoinPill, fmt, Price } from '../components/Coins';
import { ProfileChip } from '../components/Profile';
import { Modal, MuteButton, Screen, Skyline, Wordmark } from '../components/ui';
import { CHARACTERS } from '../lib/characters';
import { nextGoal, rosterOwned } from '../lib/economy';
import type { Session } from '../lib/session';
import { useProfile } from '../lib/store';
import { dayKey } from '../lib/time';
import type { GameMeta } from '../lib/types';
import { CATEGORIES, type SetupPreset } from './Setup';

export type Nav = 'solo' | 'friends' | 'daily' | 'shop' | 'collection' | 'notes' | 'party' | 'admin' | 'night' | 'timemachine';

export default function Home({
  games,
  mature,
  resume,
  partyAvailable,
  onPlay,
  onResume,
  onNav,
  onMature
}: {
  games: GameMeta[];
  mature: boolean;
  resume: Session | null;
  partyAvailable: boolean;
  onPlay: (preset: SetupPreset) => void;
  onResume: () => void;
  onNav: (n: Nav) => void;
  onMature: () => void;
}) {
  const p = useProfile();
  const [about, setAbout] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const playable = games.filter((g) => g.count > 0);
  const total = playable.reduce((n, g) => n + g.count, 0);
  const dailyDone = !!p.daily[dayKey()];
  const goal = nextGoal(p);
  // Secret: five quick taps on the logo open the time machine.
  const taps = useRef<number[]>([]);
  const tapLogo = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      onNav('timemachine');
    }
  };

  const tile = (n: Nav, icon: string, title: string, sub: string, extra = '') => (
    <button
      onClick={() => onNav(n)}
      className={`card group relative flex min-h-[112px] flex-col items-start justify-between overflow-hidden p-4 text-start transition hover:border-amber-400/60 active:scale-[.98] ${extra}`}
    >
      <span className="text-3xl transition group-hover:scale-110" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block font-display text-xl leading-tight text-white">{title}</span>
        <span className="block text-xs text-ink-400">{sub}</span>
      </span>
    </button>
  );

  return (
    <Screen>
      <Skyline />
      <div className="mb-2 flex items-center gap-2">
        <ProfileChip onClick={() => onNav('collection')} />
        <span className="flex-1" />
        <CoinPill coins={p.coins} onClick={() => onNav('shop')} />
        <MuteButton />
      </div>
      <div onClick={tapLogo} className="cursor-default">
        <Wordmark small />
      </div>

      <button
        onClick={() => onNav('night')}
        className="group relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-l from-cherry-600 via-cherry-500 to-amber-500 p-[2px] text-start shadow-[0_14px_40px_rgba(224,36,63,.35)] active:scale-[.98]"
      >
        <span className="flex items-center gap-4 rounded-[22px] bg-gradient-to-l from-cherry-600/95 to-amber-500/90 px-5 py-5">
          <span className="text-5xl drop-shadow" aria-hidden>
            🌃
          </span>
          <span>
            <span className="block font-display text-[1.75rem] leading-tight text-white drop-shadow">מתחילים ערב על הגג</span>
            <span className="block text-sm text-white/85">ניחושים, דילמות, בלופים ומתחזה — 10 עד 60 דקות</span>
          </span>
        </span>
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/25 to-transparent transition duration-700 group-hover:translate-x-full" />
      </button>

      {resume && (
        <button className="card mt-3 flex items-center justify-between p-4 text-start animate-rise" onClick={onResume}>
          <span>
            <span className="block font-bold text-white">להמשיך את המשחק הקודם</span>
            <span className="text-sm text-ink-400">
              סבב {resume.index + 1} · {resume.participants.map((x) => x.name).join(', ')}
            </span>
          </span>
          <span className="text-2xl">↩</span>
        </button>
      )}

      <nav className="mt-4 grid grid-cols-2 gap-3" aria-label="ניווט ראשי">
        {tile('solo', '🎯', 'משחק לבד', p.stats.soloBest ? `שיא: ${fmt(p.stats.soloBest)}` : 'המסלול של יצחקי')}
        {tile('friends', '🎉', 'משחק עם חברים', 'טלפון אחד, קבוצות, מסיבה')}
        <button onClick={() => onNav('daily')} className="card col-span-2 flex items-center gap-4 p-4 text-start transition hover:border-amber-400/60 active:scale-[.98]">
          <span className="text-3xl" aria-hidden>
            📅
          </span>
          <span className="flex-1">
            <span className="block font-display text-xl text-white">אתגר יומי</span>
            <span className="block text-xs text-ink-400">{dailyDone ? `היום: ${fmt(p.daily[dayKey()].score)} נקודות · טבלת מובילים` : '10 שאלות, ניסיון אחד, אותן שאלות לכולם'}</span>
          </span>
          <span className={`chip ${dailyDone ? 'border-amber-400 text-amber-300' : 'border-cherry-400 text-cherry-300'}`}>{dailyDone ? '✓' : 'חדש'}</span>
        </button>
        <button onClick={() => onNav('shop')} className="card relative flex min-h-[132px] flex-col justify-between overflow-hidden p-4 text-start active:scale-[.98]">
          <span className="absolute -left-3 -top-2 opacity-90" aria-hidden>
            <Avatar charId={CHARACTERS[0].id} skinId="assaf:gold" size={78} animated={false} />
          </span>
          <span className="mt-auto">
            <span className="block font-display text-xl text-white">חנות הגג</span>
            {goal ? <Price value={goal.price} /> : <span className="text-xs text-ink-400">האוסף מלא!</span>}
          </span>
        </button>
        <button onClick={() => onNav('collection')} className="card flex min-h-[132px] flex-col justify-between p-4 text-start active:scale-[.98]">
          <span className="flex -space-x-3 space-x-reverse" aria-hidden>
            {(rosterOwned(p).length ? rosterOwned(p) : ['tzach', 'tal', 'dor']).slice(0, 3).map((id) => (
              <span key={id} className="h-10 w-10 overflow-hidden rounded-full border-2 border-ink-900 bg-ink-800">
                <Avatar charId={id} skinId={`${id}:classic`} size={40} animated={false} locked={!p.owned.includes(id)} />
              </span>
            ))}
          </span>
          <span>
            <span className="block font-display text-xl text-white">האוסף שלי</span>
            <span className="block text-xs text-ink-400">
              {rosterOwned(p).length}/{CHARACTERS.length} דמויות · {Object.keys(p.achievements).length} הישגים
            </span>
          </span>
        </button>
      </nav>

      {goal && (
        <button onClick={() => onNav('shop')} className="mt-3 w-full rounded-2xl bg-ink-900/80 p-3 text-start">
          <div className="mb-1 flex justify-between text-xs text-ink-400">
            <span>🎯 עוד {fmt(Math.max(0, goal.price - p.coins))} ל{goal.name}</span>
            <span className="tabular-nums">{Math.min(100, Math.round((p.coins / goal.price) * 100))}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (p.coins / goal.price) * 100)}%` }} />
          </div>
        </button>
      )}

      <button className="mt-6 flex w-full items-center justify-between text-start" onClick={() => setCatalog((c) => !c)} aria-expanded={catalog}>
        <h2 className="font-display text-2xl text-white">כל הפינות</h2>
        <span className="text-sm text-ink-400">
          {playable.length} משחקים · {total} שאלות {catalog ? '▲' : '▼'}
        </span>
      </button>
      {catalog && (
        <div className="mt-3 space-y-5">
          {CATEGORIES.map((cat) => (
            <section key={cat.id}>
              <span className="label">{cat.title}</span>
              <div className="grid grid-cols-2 gap-2">
                {playable
                  .filter((g) => cat.engines.includes(g.engine))
                  .map((g) => (
                    <button key={g.id} className="card flex min-h-[86px] flex-col items-start gap-0.5 p-3 text-start active:scale-[.98]" onClick={() => (g.mature && !mature ? onMature() : onPlay({ gameIds: [g.id] }))}>
                      <span className="flex w-full items-center justify-between">
                        <span aria-hidden>{g.emoji}</span>
                        {g.mature && <span className="text-[10px] font-bold text-cherry-300">18+</span>}
                      </span>
                      <span className="font-bold leading-tight text-white">{g.title}</span>
                      <span className="text-[11px] text-amber-300">{g.count} שאלות</span>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <button className="card mt-6 flex w-full items-center gap-4 border-amber-400/40 p-4 text-start" onClick={() => onNav('notes')}>
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
        <button className="card mt-3 flex w-full items-center gap-4 p-4 text-start" onClick={() => onNav('party')}>
          <span className="text-4xl" aria-hidden>
            📡
          </span>
          <span>
            <span className="block font-display text-xl text-white">חדר מסיבה</span>
            <span className="block text-sm text-ink-400">כל אחד מצביע מהטלפון שלו</span>
          </span>
        </button>
      )}

      <footer className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-ink-400">
        <button className={`underline ${mature ? 'text-cherry-300' : ''}`} onClick={onMature}>
          {mature ? '18+ פעיל' : 'הפעלת 18+'}
        </button>
        <button className="underline" onClick={() => setAbout(true)}>
          אודות
        </button>
        <button className="underline" onClick={() => onNav('admin')}>
          מצב עורך
        </button>
      </footer>

      <Modal open={about} onClose={() => setAbout(false)} title="אודות">
        <div className="space-y-3 leading-relaxed">
          <p>אתר מעריצים לא רשמי, בהשראת פינות משחק מפודקאסט קומי ישראלי. אין קשר, חסות או אישור מטעם היוצרים.</p>
          <p>השאלות חולצו מתמלילים אוטומטיים. ״התשובה הנכונה״ היא מה שנחשף בפודקאסט — לא בדיקת עובדות. שאלות בלי חשיפה ברורה לא נכנסו למשחק.</p>
          <p>מכניקות כמו המתחזה, הבלוף ו״מי כתב את זה?״ הן משחקים חדשים שמשתמשים בתוכן מהפודקאסט. מה ששחקנים כותבים מסומן כתוכן שחקנים.</p>
          <p>הדמויות בחנות הן איורים מקוריים בהשראת חברי הפאנל — לא תמונות שלהם ולא מוצר רשמי. מטבעות הגג מרוויחים רק במשחק.</p>
          <p>סטטיסטיקות ״נגד כולם״ וטבלאות המובילים מבוססות רק על שחקנים אמיתיים, ומוצגות רק כשיש מספיק תשובות.</p>
          <p>״מכונת האמת״ היא בידור בלבד. שום דבר באפליקציה לא מזהה שקרים.</p>
        </div>
      </Modal>
    </Screen>
  );
}
