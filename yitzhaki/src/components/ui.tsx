import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isMuted, setMuted, sfx } from '../lib/sound';

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <div className={`select-none text-center leading-none ${small ? '' : 'py-2'}`} aria-label="המשחקייה על הגג">
      <div className={`bulbs mx-auto mb-2 h-3 ${small ? 'w-24' : 'w-44'} animate-flicker`} aria-hidden />
      <div className={`font-display ${small ? 'text-2xl' : 'text-5xl'} text-amber-400 drop-shadow-[0_3px_0_#7d0b1e]`}>המשחקייה</div>
      <div className={`font-display ${small ? 'text-sm' : 'text-xl'} tracking-[.3em] text-cherry-400`}>— על הגג —</div>
    </div>
  );
}

export function Skyline() {
  return (
    <svg className="pointer-events-none fixed bottom-0 left-0 right-0 -z-10 h-40 w-full opacity-60" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 100V62h18V48h14v14h10V30h22v32h8V52h16v-8h12v56h6V40h20v22h14V20h10V8h4v12h10v42h10V50h18v12h12V36h26v26h8V56h14v6h12V44h22v18h12V30h18v70z"
        fill="#141217"
      />
      {[30, 52, 88, 128, 166, 214, 268, 330, 372].map((x, i) => (
        <rect key={x} x={x} y={52 + (i % 3) * 8} width="3" height="4" fill="#ffbe3b" opacity={0.5 + (i % 2) * 0.3} />
      ))}
    </svg>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto flex min-h-fill w-full max-w-xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] ${className}`}>{children}</main>;
}

export function TopBar({ onBack, title, right }: { onBack?: () => void; title?: string; right?: ReactNode }) {
  return (
    <header className="mb-4 flex min-h-[48px] items-center gap-2">
      {onBack && (
        <button className="btn-ghost min-h-[44px] px-3 text-base" onClick={onBack} aria-label="חזרה">
          → חזרה
        </button>
      )}
      <h1 className="flex-1 truncate font-display text-xl text-white">{title}</h1>
      {right}
      <MuteButton />
    </header>
  );
}

export function MuteButton() {
  const [m, setM] = useState(isMuted());
  return (
    <button
      className="btn-ghost min-h-[44px] w-11 px-0 text-xl"
      aria-label={m ? 'הפעלת צלילים' : 'השתקה'}
      aria-pressed={m}
      onClick={() => {
        setMuted(!m);
        setM(!m);
        if (m) sfx.tap();
      }}
    >
      {m ? '🔇' : '🔊'}
    </button>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal aria-label={title} onClick={onClose}>
      <div className="card max-h-modal w-full max-w-lg animate-rise overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl text-amber-400">{title}</h2>
          <button className="btn-ghost min-h-[44px] px-3" onClick={onClose} aria-label="סגירה">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Countdown that calls onEnd once. seconds=0 disables it. */
export function Timer({ seconds, running, onEnd, keyId }: { seconds: number; running: boolean; onEnd?: () => void; keyId: string }) {
  const [left, setLeft] = useState(seconds);
  const ended = useRef(false);
  useEffect(() => {
    setLeft(seconds);
    ended.current = false;
  }, [seconds, keyId]);
  useEffect(() => {
    if (!running || !seconds) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [running, seconds, keyId]);
  useEffect(() => {
    if (!seconds || !running) return;
    if (left <= 5 && left > 0) sfx.tick();
    if (left === 0 && !ended.current) {
      ended.current = true;
      onEnd?.();
    }
  }, [left, seconds, running, onEnd]);
  if (!seconds) return null;
  const pct = (left / seconds) * 100;
  return (
    <div className="flex items-center gap-3" role="timer" aria-live="off">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-700">
        <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${left <= 5 ? 'bg-cherry-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 text-left font-display text-2xl tabular-nums ${left <= 5 ? 'animate-shake text-cherry-400' : 'text-white'}`}>{left}</span>
    </div>
  );
}

/** Full-screen cover shown between private pass-the-phone turns. */
export function PassScreen({ name, note, onReady }: { name: string; note?: string; onReady: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-[76px] z-40 flex flex-col items-center justify-center gap-6 bg-ink-950 p-6 text-center">
      <div className="text-6xl" aria-hidden>
        📱
      </div>
      <p className="text-lg text-ink-400">העבירו את הטלפון ל־</p>
      <p className="font-display text-5xl text-amber-400">{name}</p>
      {note && <p className="max-w-xs text-ink-400">{note}</p>}
      <button className="btn-amber w-full max-w-xs" onClick={onReady}>
        זה אני — הראו לי
      </button>
    </div>
  );
}

export function Confetti() {
  const bits = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {bits.map((i) => (
        <span
          key={i}
          className="absolute top-[-10px] h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: ['#ffbe3b', '#e0243f', '#ff8a9a', '#ffd27a'][i % 4],
            animation: `fall ${1.8 + (i % 5) * 0.35}s ${(i % 7) * 0.12}s ease-in forwards`
          }}
        />
      ))}
      <style>{`@keyframes fall{to{transform:translateY(105vh) rotate(${540}deg);opacity:.9}}`}</style>
    </div>
  );
}

export function Scoreboard({ items, highlight }: { items: { id: string; name: string; score: number }[]; highlight?: Record<string, number> }) {
  const ranked = items.slice().sort((a, b) => b.score - a.score);
  return (
    <ol className="space-y-2">
      {ranked.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-ink-800 px-4 py-3 animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="w-6 font-display text-xl text-ink-400">{i + 1}</span>
          <span className="flex-1 truncate text-lg font-bold text-white">{p.name}</span>
          {highlight?.[p.id] ? <span className="chip border-amber-400 text-amber-300 animate-pop">+{highlight[p.id]}</span> : null}
          <span className="font-display text-2xl tabular-nums text-amber-400">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

/** Two-tap confirmation (browser confirm() dialogs are unavailable in embedded viewers). */
export function ConfirmButton({ className, label, confirmLabel = 'בטוח? הקישו שוב', onConfirm }: { className: string; label: string; confirmLabel?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={`${className} ${armed ? '!text-cherry-300' : ''}`} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
