import { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/sound';

/** Countdown that can be extended (power-ups) and fires onEnd once per resetKey. */
export function useCountdown(total: number, running: boolean, resetKey: string, onEnd: () => void) {
  const [left, setLeft] = useState(total);
  const [max, setMax] = useState(total);
  const ended = useRef(false);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    setLeft(total);
    setMax(total);
    ended.current = false;
  }, [total, resetKey]);
  useEffect(() => {
    if (!running || !total) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100);
    return () => clearInterval(t);
  }, [running, total, resetKey]);
  useEffect(() => {
    if (!running || !total) return;
    const whole = Math.ceil(left);
    if (left > 0 && whole <= 5 && Math.abs(left - whole) < 0.05) sfx.tick();
    if (left <= 0 && !ended.current) {
      ended.current = true;
      endRef.current();
    }
  }, [left, running, total]);
  return {
    left,
    max,
    add: (n: number) => {
      setLeft((l) => l + n);
      setMax((m) => m + n);
    }
  };
}

export function CountdownBar({ left, max }: { left: number; max: number }) {
  const low = left <= 5;
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${Math.ceil(left)} שניות`}>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-700">
        <div className={`h-full rounded-full ${low ? 'bg-cherry-500' : 'bg-amber-400'}`} style={{ width: `${(left / max) * 100}%`, transition: 'width 100ms linear' }} />
      </div>
      <span className={`w-9 text-left font-display text-2xl tabular-nums ${low ? 'text-cherry-400' : 'text-white'}`}>{Math.ceil(left)}</span>
    </div>
  );
}

export function CrowdLine({ stat, loading }: { stat: { total: number; pct: number } | null; loading?: boolean }) {
  if (loading) return <p className="text-center text-sm text-ink-400">טוענים נתונים של שחקנים אחרים…</p>;
  if (!stat) return <p className="text-center text-sm text-ink-400">עוד אין מספיק שחקנים שענו על השאלה הזאת — את/ה מהראשונים.</p>;
  return (
    <div className="rounded-2xl bg-ink-800/80 p-3">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-ink-200">נגד כולם</span>
        <span className="tabular-nums text-ink-400">{stat.total} שחקנים ענו</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${stat.pct}%` }} />
      </div>
      <p className="mt-1 text-center text-sm font-bold text-amber-300">{stat.pct}% צדקו</p>
    </div>
  );
}
