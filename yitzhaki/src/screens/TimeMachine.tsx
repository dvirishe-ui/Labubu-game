import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Confetti, Screen, TopBar } from '../components/ui';
import { GameHead } from '../components/heads';
import { SECRET_CHARACTER, SECRET_SKIN } from '../lib/characters';
import { equip, unlockSecret } from '../lib/economy';
import { newSeed } from '../lib/rng';
import { sfx } from '../lib/sound';
import { profileStore, useProfile } from '../lib/store';
import { ERAS, flap, gapAt, newGame, PLAYER_X, proceed, R, step, WALL_W, monthLabel, monthOf, type TMState } from '../lib/timeMachine';

const THEMES = [
  { sky: ['#141a33', '#0c0b0d'], wall: '#29252f', edge: '#ffbe3b', accent: '#ffbe3b' },
  { sky: ['#2a0f3d', '#050314'], wall: '#1e1b4b', edge: '#22d3ee', accent: '#ff4dc4' },
  { sky: ['#4a2a00', '#0c0700'], wall: '#7c4a03', edge: '#fff1a8', accent: '#ffd76a' }
];

/** Hidden mini-game: fly from today to 2028 to meet the secret character. */
export default function TimeMachine({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const already = p.owned.includes(SECRET_CHARACTER.id);
  const [phase, setPhase] = useState<'intro' | 'play' | 'won'>('intro');

  if (phase === 'won')
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-hidden bg-black p-6 text-center" role="dialog" aria-label="דמות סודית">
        <Confetti />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 animate-burst" style={{ background: 'repeating-conic-gradient(rgba(103,232,249,.55) 0 8deg, transparent 8deg 22deg)' }} />
        <p className="relative font-display text-xl tracking-widest text-cyan-300">דמות סודית!</p>
        <div className="frame frame-secret relative w-[260px] animate-reveal-card">
          <div>
            <Avatar charId={SECRET_CHARACTER.id} skinId={SECRET_SKIN.id} size={254} />
          </div>
        </div>
        <p className="relative font-display text-3xl text-white">{SECRET_CHARACTER.name}</p>
        <p className="relative max-w-xs text-ink-200">הגעת ל־2028. הדמות הזאת לא נמכרת בחנות — רק מי שסיים את מכונת הזמן מקבל אותה.</p>
        <div className="relative grid w-full max-w-xs grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={onBack}>
            חזרה
          </button>
          <button
            className="btn-amber"
            onClick={() => {
              profileStore.update((x) => equip(x, SECRET_SKIN.id));
              onBack();
            }}
          >
            לצייד עכשיו
          </button>
        </div>
      </div>
    );

  if (phase === 'play')
    return (
      <Flight
        onWin={() => {
          profileStore.apply((x) => unlockSecret(x));
          sfx.win();
          setPhase('won');
        }}
        onExit={onBack}
      />
    );

  return (
    <Screen>
      <TopBar onBack={onBack} title="מכונת הזמן" />
      <section className="card relative overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 50% 30%, #22d3ee55, transparent 60%)' }} />
        <p className="relative text-sm font-bold uppercase tracking-[.3em] text-cyan-300">הודעה מ־2028</p>
        <h2 className="relative mt-2 font-display text-3xl text-white">מישהו מחכה לך בעתיד</h2>
        <p className="relative mt-3 text-ink-200">טסים מהיום ל־2028 דרך קירות של לוחות שנה. הקשה (או רווח) = דחיפה למעלה. עוברים שלוש תקופות, ולכל תקופה שלושה לבבות. נגמרו? מתחילים שוב רק את התקופה.</p>
        <ul className="relative mt-4 space-y-1 text-sm text-ink-400">
          {ERAS.map((e) => (
            <li key={e.name}>
              {monthLabel(e.from)} – {monthLabel(e.to)} · {e.name}
            </li>
          ))}
        </ul>
        {already && <p className="relative mt-4 text-sm text-cyan-300">כבר פגשת אותו. אפשר לטוס שוב בשביל הכיף.</p>}
        <button className="btn-amber relative mt-6 w-full text-2xl" onClick={() => setPhase('play')}>
          🚀 להמריא
        </button>
      </section>
    </Screen>
  );
}

function Flight({ onWin, onExit }: { onWin: () => void; onExit: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<TMState | null>(null);
  const headSvg = useRef<SVGSVGElement>(null);
  const [hud, setHud] = useState({ month: ERAS[0].from, lives: 3, era: 0, clocks: 0, status: 'ready' as TMState['status'] });
  const won = useRef(false);
  const winRef = useRef(onWin);
  winRef.current = onWin;

  useEffect(() => {
    const el = canvas.current!;
    const box = wrap.current!;
    const ctx = el.getContext('2d')!;
    const face = new Image();
    // The pilot is the drawn Noam head, rasterised from the hidden SVG below.
    if (headSvg.current) face.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(headSvg.current));
    let raf = 0;
    let last = performance.now();
    let size = { w: 0, h: 0 };
    let flame = 0;
    const stars = Array.from({ length: 60 }, (_, i) => ({ x: (i * 0.137) % 1, y: (i * 0.291) % 1, z: 0.3 + ((i * 7) % 10) / 14 }));

    const resize = () => {
      const r = box.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height };
      el.width = Math.round(r.width * dpr);
      el.height = Math.round(r.height * dpr);
      el.style.width = r.width + 'px';
      el.style.height = r.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const aspect = r.width / r.height;
      if (!game.current) game.current = newGame(newSeed(), aspect);
      else game.current = { ...game.current, w: aspect };
    };
    resize();
    // Dev builds expose the live state so the browser test can fly the ship.
    if (import.meta.env.DEV) (window as unknown as { __tm: typeof game }).__tm = game;
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const draw = (s: TMState) => {
      const { w: W, h: H } = size;
      const k = H; // world unit → px
      const th = THEMES[s.era];
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, th.sky[0]);
      sky.addColorStop(1, th.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (const st of stars) {
        const x = ((st.x - s.t * 0.02 * st.z) % 1 + 1) % 1;
        ctx.fillStyle = `rgba(255,255,255,${0.25 + st.z * 0.4})`;
        ctx.fillRect(x * W, st.y * H * 0.8, 1.5 * st.z, 1.5 * st.z);
      }
      // skyline parallax
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      const off = (s.t * 18) % 80;
      for (let x = -off; x < W + 80; x += 40) {
        const hgt = 30 + ((Math.floor((x + off + s.t * 18) / 40) * 37) % 60);
        ctx.fillRect(x, H - hgt, 34, hgt);
      }
      const era = ERAS[s.era];
      for (const wl of s.walls) {
        const x = (wl.x - WALL_W / 2) * k;
        const gy = gapAt(wl, s.t, era);
        const top = (gy - wl.gapH / 2) * k;
        const bot = (gy + wl.gapH / 2) * k;
        const ww = WALL_W * k;
        for (const [y0, y1] of [
          [0, top],
          [bot, H]
        ]) {
          ctx.fillStyle = th.wall;
          ctx.fillRect(x, y0, ww, y1 - y0);
          ctx.strokeStyle = 'rgba(255,255,255,.08)';
          for (let gy2 = y0 + 10; gy2 < y1; gy2 += 12) {
            ctx.beginPath();
            ctx.moveTo(x + 4, gy2);
            ctx.lineTo(x + ww - 4, gy2);
            ctx.stroke();
          }
          ctx.fillStyle = th.edge;
          ctx.fillRect(x - 3, y0 === 0 ? y1 - 8 : y0, ww + 6, 8);
        }
      }
      for (const c of s.clocks) {
        const cx = c.x * k;
        const cy = c.y * k;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fillStyle = th.accent;
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 6);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 4, cy + 2);
        ctx.stroke();
      }
      // ship
      const px = PLAYER_X * k;
      const py = s.y * k;
      const pr = R * k;
      const blink = s.invuln > 0 && Math.floor(s.t * 12) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.max(-0.5, Math.min(0.6, s.vy * 0.6)));
        if (flame > 0) {
          ctx.fillStyle = th.accent;
          ctx.beginPath();
          ctx.moveTo(-pr * 1.6, -pr * 0.4);
          ctx.lineTo(-pr * (2.2 + Math.random() * 0.8), 0);
          ctx.lineTo(-pr * 1.6, pr * 0.4);
          ctx.fill();
        }
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 1.7, pr * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = th.edge;
        ctx.fillRect(-pr * 1.4, pr * 0.55, pr * 2.8, pr * 0.22);
        ctx.save();
        ctx.beginPath();
        ctx.arc(pr * 0.35, -pr * 0.15, pr * 0.95, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        if (face.complete && face.naturalWidth) ctx.drawImage(face, pr * 0.35 - pr * 1.05, -pr * 0.15 - pr * 1.15, pr * 2.1, pr * 2.5);
        ctx.restore();
        ctx.strokeStyle = th.edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pr * 0.35, -pr * 0.15, pr * 0.95, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      flame = Math.max(0, flame - 1);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let s = game.current!;
      const before = s.status;
      const crashes = s.crashes;
      s = step(s, dt);
      game.current = s;
      if (s.crashes > crashes) sfx.bad();
      if (s.status !== before) {
        if (s.status === 'eraClear') sfx.win();
        if (s.status === 'done' && !won.current) {
          won.current = true;
          setTimeout(() => winRef.current(), 900);
        }
      }
      draw(s);
      setHud((h) => {
        const month = monthOf(s);
        return h.month === month && h.lives === s.lives && h.era === s.era && h.clocks === s.clocksTaken && h.status === s.status ? h : { month, lives: s.lives, era: s.era, clocks: s.clocksTaken, status: s.status };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const thrust = () => {
      const s = game.current!;
      if (s.status === 'eraClear' || s.status === 'over') return;
      game.current = flap(s);
      flame = 8;
      sfx.tap();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        thrust();
      }
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      thrust();
    };
    const onVis = () => {
      last = performance.now();
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const era = ERAS[hud.era];
  const cont = () => {
    if (!game.current) return;
    game.current = flap(proceed(game.current));
    sfx.lock();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink-950 pt-[env(safe-area-inset-top,0px)]">
      <svg ref={headSvg} xmlns="http://www.w3.org/2000/svg" viewBox="40 14 120 144" width="240" height="288" className="hidden" aria-hidden>
        <GameHead id="noam" expr="grin" g={(n) => 'tm-' + n} />
      </svg>
      <div className="flex items-center gap-3 px-4 py-2">
        <button className="btn-ghost min-h-[44px] px-3 text-base" onClick={onExit}>
          → יציאה
        </button>
        <div className="flex-1 text-center">
          <div className="font-display text-3xl tabular-nums text-white" aria-live="polite">
            {monthLabel(hud.month)}
          </div>
          <div className="text-xs text-ink-400">{era.name}</div>
        </div>
        <div className="text-left text-sm">
          <div aria-label={`${hud.lives} לבבות`}>{'❤️'.repeat(Math.max(0, hud.lives))}</div>
          <div className="text-ink-400">⏰ {hud.clocks}</div>
        </div>
      </div>
      <div ref={wrap} className="relative flex-1 touch-none select-none overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas ref={canvas} className="block" aria-label="מכונת הזמן — הקישו כדי לדחוף למעלה" />
        {hud.status === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-2xl bg-black/60 px-5 py-3 font-display text-2xl text-white animate-pulse">הקישו כדי להמריא</p>
          </div>
        )}
        {(hud.status === 'eraClear' || hud.status === 'over') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6">
            <div className="card w-full max-w-xs space-y-3 p-5 text-center animate-pop">
              <p className="font-display text-3xl text-white">{hud.status === 'eraClear' ? `הגעת ל־${era.to}!` : 'נגמרו הלבבות'}</p>
              <p className="text-ink-200">{hud.status === 'eraClear' ? `הבא בתור: ${ERAS[hud.era + 1].name}` : `מתחילים שוב מ־${monthLabel(era.from)}. התקופות שעברת נשמרות.`}</p>
              <button className="btn-amber w-full text-xl" onClick={cont} autoFocus>
                {hud.status === 'eraClear' ? 'ממשיכים קדימה' : 'עוד ניסיון'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
