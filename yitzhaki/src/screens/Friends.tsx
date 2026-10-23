import { CoinPill } from '../components/Coins';
import { Screen, TopBar } from '../components/ui';
import { MECHANICS } from '../lib/plan';
import { useProfile } from '../lib/store';
import type { Mechanic } from '../lib/types';
import type { Nav } from './Home';
import type { SetupPreset } from './Setup';

export default function Friends({ partyAvailable, onPlay, onNav, onDuel, onBack }: { partyAvailable: boolean; onPlay: (p: SetupPreset) => void; onNav: (n: Nav) => void; onDuel: () => void; onBack: () => void }) {
  const p = useProfile();
  const all = MECHANICS.filter((m) => !m.teamsOnly).map((m) => m.id) as Mechanic[];
  return (
    <Screen>
      <TopBar onBack={onBack} title="משחק עם חברים" right={<CoinPill coins={p.coins} />} />
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-amber col-span-2 min-h-[72px] text-xl" onClick={() => onPlay({})}>
          🎛️ משחק מהפינות — טלפון אחד
        </button>
        <button className="btn-cherry min-h-[64px] text-base" onClick={() => onPlay({ mechanics: all })}>
          🎲 מיקס מסיבה
        </button>
        <button className="btn-ghost min-h-[64px] text-base" onClick={onDuel}>
          🥊 תנצח אותי
        </button>
      </div>

      <h2 className="mb-2 mt-6 font-display text-2xl text-white">משחקי מסיבה</h2>
      <p className="mb-3 text-sm text-ink-400">מכניקות חדשות על תוכן אמיתי מהפודקאסט.</p>
      <div className="space-y-2">
        {MECHANICS.map((m) => (
          <button key={m.id} className="card flex w-full items-center gap-3 p-4 text-start active:scale-[.98]" onClick={() => onPlay({ mechanics: [m.id] })}>
            <span className="text-3xl" aria-hidden>
              {m.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg text-white">{m.title}</span>
              <span className="block text-xs text-ink-400">{m.blurb}</span>
            </span>
            <span className="text-xs text-ink-400">{m.teamsOnly ? '2 קבוצות' : `${m.minPlayers}+`}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3">
        <button className="card flex items-center gap-4 p-4 text-start" onClick={() => onNav('notes')}>
          <span className="text-3xl" aria-hidden>
            📝
          </span>
          <span>
            <span className="block font-display text-lg text-white">פתקים על הגג</span>
            <span className="text-xs text-amber-300">משחק בונוס מקורי</span>
          </span>
        </button>
        {partyAvailable && (
          <button className="card flex items-center gap-4 p-4 text-start" onClick={() => onNav('party')}>
            <span className="text-3xl" aria-hidden>
              📡
            </span>
            <span>
              <span className="block font-display text-lg text-white">חדר מסיבה</span>
              <span className="text-xs text-ink-400">כל אחד מהטלפון שלו, עם קוד או QR</span>
            </span>
          </button>
        )}
      </div>
    </Screen>
  );
}
