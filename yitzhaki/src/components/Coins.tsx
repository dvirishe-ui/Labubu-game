import { useEffect, useId, useRef, useState } from 'react';

export function CoinIcon({ size = 20 }: { size?: number }) {
  const id = 'coin' + useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset=".5" stopColor="#ffbe3b" />
          <stop offset="1" stopColor="#a66a00" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#${id})`} stroke="#7c4a03" strokeWidth="1" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#7c4a03" strokeOpacity=".5" />
      <path d="M7 13 L12 8.5 L17 13" stroke="#7c4a03" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="10" y="12.5" width="4" height="4" rx="1" fill="#7c4a03" />
    </svg>
  );
}

/** Counts up/down smoothly when the balance changes. */
export function useTween(value: number, ms = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

export const fmt = (n: number) => n.toLocaleString('he-IL');

export function CoinPill({ coins, onClick }: { coins: number; onClick?: () => void }) {
  const shown = useTween(coins);
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-b from-ink-800 to-ink-900 px-3 font-display text-lg tabular-nums text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
      aria-label={`${fmt(coins)} מטבעות הגג`}
    >
      <CoinIcon />
      {fmt(shown)}
    </Tag>
  );
}

export function Price({ value, dim }: { value: number; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-display tabular-nums ${dim ? 'text-ink-400' : 'text-amber-300'}`}>
      <CoinIcon size={16} />
      {fmt(value)}
    </span>
  );
}
