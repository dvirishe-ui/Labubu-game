import { useId, type ReactNode } from 'react';
import { charById, skinById, type CharacterDef, type Tier } from '../lib/characters';
import { GameHead, headTop, HEADS, type Expr } from './heads';

const EXPR: Record<Tier, Expr> = { classic: 'smile', special: 'grin', legendary: 'laugh', gold: 'wink', crown: 'smirk', secret: 'smile' };

/** Illustrated collectible portrait. Each tier changes outfit, pose, expression, scene and lighting. */
export function Avatar({ charId, skinId, size = 160, animated = true, locked = false, fluid = false }: { charId: string | null; skinId?: string | null; size?: number; animated?: boolean; locked?: boolean; fluid?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const c = charById(charId);
  if (!c) return <EmptyAvatar size={size} />;
  const tier: Tier = skinById(skinId)?.tier ?? (c.id === 'noam-future' ? 'secret' : 'classic');
  const drawn = !!HEADS[c.id];
  const L = drawn ? { ...c.look, skin: HEADS[c.id].skin } : c.look;
  const g = (n: string) => `${uid}-${n}`;
  const url = (n: string) => `url(#${g(n)})`;
  const outfit = OUTFIT[tier](L);

  return (
    <svg
      viewBox="0 0 200 240"
      width={fluid ? '100%' : size}
      height={fluid ? undefined : (size * 240) / 200}
      role="img"
      aria-label={c.name}
      className={`block ${animated ? 'av-anim' : ''}`}
      style={locked ? { filter: 'grayscale(.55) brightness(.68) contrast(1.05)' } : undefined}
    >
      <defs>
        <radialGradient id={g('skin')} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={lighten(L.skin, 0.22)} />
          <stop offset=".6" stopColor={L.skin} />
          <stop offset="1" stopColor={darken(L.skin, 0.28)} />
        </radialGradient>
        <linearGradient id={g('hair')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(L.hairColor, 0.25)} />
          <stop offset="1" stopColor={L.hairColor} />
        </linearGradient>
        <linearGradient id={g('cloth')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(outfit.main, 0.18)} />
          <stop offset="1" stopColor={darken(outfit.main, 0.3)} />
        </linearGradient>
        <linearGradient id={g('cloth2')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(outfit.second, 0.15)} />
          <stop offset="1" stopColor={darken(outfit.second, 0.35)} />
        </linearGradient>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset=".45" stopColor="#ffbe3b" />
          <stop offset="1" stopColor="#a66a00" />
        </linearGradient>
        <radialGradient id={g('rim')} cx="50%" cy="42%" r="78%">
          <stop offset=".62" stopColor={RIM[tier]} stopOpacity="0" />
          <stop offset="1" stopColor={RIM[tier]} stopOpacity=".42" />
        </radialGradient>
      </defs>
      <style>{`
        .av-anim .${g('tw')}{animation:${g('tw')} 2.2s ease-in-out infinite}
        .av-anim .${g('sway')}{transform-origin:100px -20px;animation:${g('sway')} 6s ease-in-out infinite}
        .av-anim .${g('spin')}{transform-origin:100px 110px;animation:${g('spin')} 24s linear infinite}
        .av-anim .${g('pop')}{transform-origin:center;transform-box:fill-box;animation:${g('pop')} 2.8s ease-out infinite}
        @keyframes ${g('tw')}{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes ${g('sway')}{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
        @keyframes ${g('spin')}{to{transform:rotate(360deg)}}
        @keyframes ${g('pop')}{0%{transform:scale(.2);opacity:0}30%{opacity:1}100%{transform:scale(1.25);opacity:0}}
        @media (prefers-reduced-motion: reduce){.av-anim *{animation:none!important}}
      `}</style>

      <Scene tier={tier} L={L} g={g} url={url} />

      {/* shoulders & outfit */}
      <ellipse cx="100" cy="236" rx="70" ry="10" fill="#000" opacity=".35" />
      <path d="M38 240 L43 180 Q47 151 79 145 L121 145 Q153 151 157 180 L162 240 Z" fill={url('cloth')} stroke="#1a1118" strokeWidth="3" strokeLinejoin="round" />
      <Outfit tier={tier} L={L} url={url} />
      <Arms tier={tier} c={c} url={url} />

      {/* neck & head */}
      {drawn ? (
        <>
          {/* Big game-style head, scaled up from the neck so it always sits on the shoulders. */}
          <g transform={`translate(100 ${HEAD_PIVOT}) scale(${HEAD_SCALE}) translate(-100 -${HEAD_PIVOT})`}>
            <GameHead id={c.id} expr={EXPR[tier]} g={g} />
            {L.prop === 'shades' && (tier === 'legendary' || tier === 'gold') && <Shades />}
          </g>
          {tier === 'crown' && <Crown url={url} lift={HEAD_PIVOT - (HEAD_PIVOT - headTop(c.id)) * HEAD_SCALE + 14 - 52} />}
        </>
      ) : (
        <>
          <path d="M86 122 L86 148 Q100 158 114 148 L114 122 Z" fill={darken(L.skin, 0.18)} />
          <ellipse cx="61" cy="96" rx="7" ry="10" fill={darken(L.skin, 0.1)} />
          <ellipse cx="139" cy="96" rx="7" ry="10" fill={darken(L.skin, 0.1)} />
          <ellipse cx="100" cy="92" rx="38" ry="44" fill={url('skin')} />
          <Beard kind={L.beard} url={url} color={L.hairColor} />
          <Face expr={EXPR[tier]} skin={L.skin} />
          {L.glasses && <Glasses gold={tier === 'gold' || tier === 'crown'} url={url} />}
          {L.prop === 'shades' && tier !== 'classic' && <Shades />}
          <Hair kind={L.hair} url={url} L={L} tier={tier} />
          {L.prop === 'headphones' && <Headphones color={tier === 'gold' || tier === 'crown' ? url('gold') : L.accent} />}
          {tier === 'crown' && <Crown url={url} />}
        </>
      )}
      <rect width="200" height="240" fill={url('rim')} pointerEvents="none" />
      {tier !== 'classic' && <Sparkles tier={tier} g={g} />}
    </svg>
  );
}

const HEAD_SCALE = 1.1;
const HEAD_PIVOT = 146;

function EmptyAvatar({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 200 240" width={size} height={(size * 240) / 200} aria-hidden className="block">
      <rect width="200" height="240" rx="24" fill="#1d1a21" />
      <circle cx="100" cy="92" r="40" fill="#29252f" />
      <path d="M38 240 Q44 150 100 146 Q156 150 162 240 Z" fill="#29252f" />
      <text x="100" y="106" textAnchor="middle" fontSize="44" fill="#8b8494" fontFamily="Secular One, sans-serif">?</text>
    </svg>
  );
}

const RIM: Record<Tier, string> = { classic: '#ffbe3b', special: '#ff4dc4', legendary: '#a855f7', gold: '#ffd76a', crown: '#fff1a8', secret: '#67e8f9' };

const OUTFIT: Record<Tier, (L: CharacterDef['look']) => { main: string; second: string }> = {
  classic: (L) => ({ main: L.accent, second: L.accent2 }),
  special: (L) => ({ main: '#1f2937', second: L.accent }),
  legendary: () => ({ main: '#4c1d95', second: '#c026d3' }),
  gold: () => ({ main: '#b7791f', second: '#fde68a' }),
  crown: () => ({ main: '#7f1d1d', second: '#fef3c7' }),
  secret: () => ({ main: '#94a3b8', second: '#22d3ee' })
};

function Scene({ tier, L, g, url }: { tier: Tier; L: CharacterDef['look']; g: (n: string) => string; url: (n: string) => string }) {
  if (tier === 'classic')
    return (
      <g>
        <defs>
          <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141a33" />
            <stop offset="1" stopColor="#0c0b0d" />
          </linearGradient>
        </defs>
        <rect width="200" height="240" fill={url('sky')} />
        <circle cx="160" cy="38" r="14" fill="#fef3c7" opacity=".85" />
        <circle cx="166" cy="34" r="12" fill="#141a33" />
        <path d="M0 200 V150 h18 v-16 h14 v16 h10 v-34 h22 v34 h8 v-12 h16 v-8 h12 v60 h40 v-44 h20 v24 h14 v-50 h10 v-14 h4 v14 h12 v84 z" fill="#1d1a21" />
        <path d="M0 26 Q100 58 200 22" stroke="#3a3542" strokeWidth="1" fill="none" />
        {[14, 38, 62, 86, 110, 134, 158, 182].map((x, i) => (
          <circle key={x} cx={x} cy={26 + Math.sin((x / 200) * Math.PI) * 18} r="3" fill="#ffbe3b" className={g('tw')} style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </g>
    );
  if (tier === 'special')
    return (
      <g>
        <defs>
          <linearGradient id={g('club')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2a0f3d" />
            <stop offset="1" stopColor="#0c0b0d" />
          </linearGradient>
          <pattern id={g('brick')} width="24" height="12" patternUnits="userSpaceOnUse">
            <rect width="24" height="12" fill="none" />
            <path d="M0 11.5 H24 M12 0 V6 M0 6 H24 M0 0 V0" stroke="#ffffff" strokeOpacity=".05" />
          </pattern>
        </defs>
        <rect width="200" height="240" fill={url('club')} />
        <rect width="200" height="240" fill={url('brick')} />
        <path d="M30 60 A70 70 0 0 1 170 60" stroke="#ff4dc4" strokeWidth="5" fill="none" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #ff4dc4)' }} className={g('tw')} />
        <path d="M44 70 A56 56 0 0 1 156 70" stroke={L.accent} strokeWidth="3" fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${L.accent})` }} />
        <text x="38" y="22" textAnchor="middle" fontSize="11" fill="#22d3ee" transform="rotate(-8 38 22)" fontFamily="Secular One, sans-serif" style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }}>
          OPEN MIC
        </text>
      </g>
    );
  if (tier === 'legendary')
    return (
      <g>
        <defs>
          <radialGradient id={g('stage')} cx="50%" cy="15%" r="90%">
            <stop offset="0" stopColor="#6d28d9" />
            <stop offset=".55" stopColor="#1e0b3a" />
            <stop offset="1" stopColor="#09060f" />
          </radialGradient>
          <linearGradient id={g('beam')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f5d0fe" stopOpacity=".7" />
            <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="200" height="240" fill={url('stage')} />
        <g className={g('sway')}>
          <path d="M100 -20 L40 240 H160 Z" fill={url('beam')} opacity=".55" />
        </g>
        <path d="M-10 -10 L60 240 H90 Z" fill={url('beam')} opacity=".25" />
        <path d="M210 -10 L140 240 H110 Z" fill={url('beam')} opacity=".25" />
        <ellipse cx="60" cy="226" rx="60" ry="14" fill="#c4b5fd" opacity=".12" />
        <ellipse cx="150" cy="230" rx="70" ry="12" fill="#c4b5fd" opacity=".1" />
      </g>
    );
  if (tier === 'gold')
    return (
      <g>
        <defs>
          <radialGradient id={g('aura')} cx="50%" cy="40%" r="75%">
            <stop offset="0" stopColor="#fff3b0" />
            <stop offset=".35" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#3b2300" />
          </radialGradient>
        </defs>
        <rect width="200" height="240" fill={url('aura')} />
        <g className={g('spin')} opacity=".35">
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d="M100 110 L94 -120 H106 Z" fill="#fff7d6" transform={`rotate(${i * 22.5} 100 110)`} />
          ))}
        </g>
        <path d="M0 240 V196 h20 v-20 h16 v20 h12 v-36 h24 v36 h56 v-28 h18 v-18 h10 v46 h20 v-30 h24 v70 z" fill="#7c4a03" opacity=".7" />
      </g>
    );
  if (tier === 'secret')
    return (
      <g>
        <defs>
          <radialGradient id={g('portal')} cx="50%" cy="42%" r="70%">
            <stop offset="0" stopColor="#ecfeff" />
            <stop offset=".25" stopColor="#22d3ee" />
            <stop offset=".6" stopColor="#3b0764" />
            <stop offset="1" stopColor="#05030a" />
          </radialGradient>
        </defs>
        <rect width="200" height="240" fill={url('portal')} />
        <g className={g('spin')}>
          {[34, 52, 70, 88].map((r, i) => (
            <circle key={r} cx="100" cy="110" r={r} fill="none" stroke={i % 2 ? '#a855f7' : '#67e8f9'} strokeWidth="2" strokeDasharray={`${6 + i * 3} ${8 + i * 2}`} opacity={0.75 - i * 0.12} />
          ))}
        </g>
        <path d="M0 240 L100 175 L200 240 Z" fill="#22d3ee" opacity=".08" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${100 - (i + 1) * 30} 240 L100 175 L${100 + (i + 1) * 30} 240`} stroke="#67e8f9" strokeOpacity=".25" fill="none" />
        ))}
        <text x="28" y="24" textAnchor="middle" fontSize="13" fill="#67e8f9" fontFamily="Secular One, sans-serif" style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }}>
          2028
        </text>
      </g>
    );
  return (
    <g>
      <defs>
        <radialGradient id={g('royal')} cx="50%" cy="30%" r="85%">
          <stop offset="0" stopColor="#7f1d1d" />
          <stop offset=".6" stopColor="#3b0a12" />
          <stop offset="1" stopColor="#12040a" />
        </radialGradient>
      </defs>
      <rect width="200" height="240" fill={url('royal')} />
      {[
        [40, 46, '#ffbe3b'],
        [160, 40, '#ff4d64'],
        [126, 70, '#fff1a8'],
        [66, 82, '#a855f7']
      ].map(([x, y, c], i) => (
        <g key={i} className={g('pop')} style={{ animationDelay: `${i * 0.6}s` }}>
          {Array.from({ length: 10 }, (_, k) => (
            <line key={k} x1={x as number} y1={y as number} x2={(x as number) + Math.cos((k / 10) * Math.PI * 2) * 18} y2={(y as number) + Math.sin((k / 10) * Math.PI * 2) * 18} stroke={c as string} strokeWidth="2.5" strokeLinecap="round" />
          ))}
        </g>
      ))}
      <path d="M44 240 V120 Q44 60 100 52 Q156 60 156 120 V240 Z" fill="#b91c1c" stroke={url('gold')} strokeWidth="6" />
      <circle cx="100" cy="64" r="8" fill={url('gold')} />
    </g>
  );
}

function Outfit({ tier, L, url }: { tier: Tier; L: CharacterDef['look']; url: (n: string) => string }) {
  if (tier === 'classic')
    return (
      <g>
        <path d="M84 146 Q100 162 116 146" stroke={darken(L.accent, 0.35)} strokeWidth="4" fill="none" />
        <circle cx="100" cy="196" r="16" fill={L.accent2} opacity=".9" />
        <path d="M92 196 l6 6 l10 -12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {L.prop === 'chain' && <path d="M84 150 Q100 176 116 150" stroke={url('gold')} strokeWidth="3" fill="none" strokeDasharray="3 2" />}
      </g>
    );
  if (tier === 'special')
    return (
      <g>
        <path d="M86 146 L100 200 L114 146 Z" fill={L.accent2} />
        <path d="M79 145 L100 200 L72 240 H38 L43 180 Q47 151 79 145 Z" fill={url('cloth2')} />
        <path d="M121 145 L100 200 L128 240 H162 L157 180 Q153 151 121 145 Z" fill={url('cloth2')} />
        <path d="M79 145 L92 172 L84 176 Z M121 145 L108 172 L116 176 Z" fill={darken(L.accent, 0.4)} />
        {L.prop === 'chain' && <path d="M86 150 Q100 182 114 150" stroke={url('gold')} strokeWidth="4" fill="none" strokeDasharray="4 2" />}
      </g>
    );
  if (tier === 'legendary')
    return (
      <g>
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={46 + ((i * 37) % 110)} cy={160 + ((i * 23) % 76)} r="1.6" fill="#f0abfc" opacity=".7" />
        ))}
        <path d="M78 146 Q60 190 70 240 L58 240 Q48 196 70 148 Z" fill={L.accent} />
        <path d="M122 146 Q140 190 130 240 L142 240 Q152 196 130 148 Z" fill={L.accent} />
        <path d="M86 146 L100 176 L114 146 Z" fill="#0f0a1a" />
      </g>
    );
  if (tier === 'secret')
    return (
      <g>
        <path d="M78 146 Q100 166 122 146 L126 152 Q100 176 74 152 Z" fill="#e2e8f0" />
        <path d="M100 166 V240" stroke="#22d3ee" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
        <path d="M56 200 H86 M114 200 H144" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="196" r="7" fill="#0f172a" stroke="#67e8f9" strokeWidth="2" />
      </g>
    );
  if (tier === 'gold')
    return (
      <g>
        <path d="M86 146 L100 196 L114 146 Z" fill="#fffbeb" />
        <path d="M79 145 L100 200 L70 240 H38 L43 180 Q47 151 79 145 Z" fill={url('gold')} />
        <path d="M121 145 L100 200 L130 240 H162 L157 180 Q153 151 121 145 Z" fill={url('gold')} />
        <path d="M90 152 L100 158 L110 152 L110 164 L100 158 L90 164 Z" fill="#111" />
        <circle cx="100" cy="206" r="3" fill="#7c4a03" />
        <circle cx="100" cy="220" r="3" fill="#7c4a03" />
      </g>
    );
  return (
    <g>
      <path d="M38 240 L43 180 Q47 151 79 145 L100 170 L121 145 Q153 151 157 180 L162 240 Z" fill="#991b1b" />
      <path d="M79 145 L100 170 L121 145 L128 150 L100 186 L72 150 Z" fill="#fef3c7" />
      {[60, 76, 124, 140, 92, 108].map((x, i) => (
        <path key={x} d={`M${x} ${200 + (i % 3) * 12} l2 4 l-2 4 l-2 -4 z`} fill="#111" />
      ))}
      <path d="M80 160 Q100 200 120 160" stroke={url('gold')} strokeWidth="5" fill="none" />
      <circle cx="100" cy="186" r="9" fill={url('gold')} stroke="#7c4a03" />
    </g>
  );
}

function Prop({ kind, x, y, gold }: { kind: CharacterDef['look']['prop']; x: number; y: number; gold?: boolean }) {
  const metal = gold ? '#ffbe3b' : '#9ca3af';
  const items: Record<string, ReactNode> = {
    mic: (
      <g>
        <rect x={x - 4} y={y - 4} width="8" height="26" rx="3" fill={gold ? '#a66a00' : '#1f2937'} transform={`rotate(-20 ${x} ${y})`} />
        <circle cx={x - 4} cy={y - 10} r="10" fill={metal} />
        <path d={`M${x - 12} ${y - 12} h16 M${x - 12} ${y - 7} h16`} stroke="#0003" strokeWidth="1.5" />
      </g>
    ),
    coffee: (
      <g>
        <path d={`M${x - 9} ${y - 14} h18 l-2 22 h-14 z`} fill="#f5f5f4" />
        <rect x={x - 9} y={y - 8} width="18" height="7" fill="#b45309" />
        <path d={`M${x - 4} ${y - 20} q3 -4 0 -8 M${x + 3} ${y - 20} q3 -4 0 -8`} stroke="#fff8" strokeWidth="1.5" fill="none" />
      </g>
    ),
    notebook: (
      <g transform={`rotate(-12 ${x} ${y})`}>
        <rect x={x - 12} y={y - 18} width="24" height="30" rx="2" fill="#fde68a" />
        {[0, 6, 12, 18].map((d) => (
          <path key={d} d={`M${x - 8} ${y - 12 + d} h16`} stroke="#92400e" strokeWidth="1" />
        ))}
      </g>
    ),
    phone: (
      <g transform={`rotate(-10 ${x} ${y})`}>
        <rect x={x - 8} y={y - 18} width="16" height="30" rx="3" fill="#111827" />
        <rect x={x - 6} y={y - 15} width="12" height="22" rx="1.5" fill="#38bdf8" />
      </g>
    ),
    sneaker: (
      <g>
        <path d={`M${x - 16} ${y} q2 -12 12 -12 l6 6 q10 0 14 6 v4 h-32 z`} fill="#f9fafb" />
        <path d={`M${x - 16} ${y + 4} h32`} stroke="#ef4444" strokeWidth="3" />
      </g>
    )
  };
  return <>{items[kind] ?? items.mic}</>;
}

function Arms({ tier, c, url }: { tier: Tier; c: CharacterDef; url: (n: string) => string }) {
  const L = c.look;
  const sleeve = tier === 'special' ? url('cloth2') : tier === 'gold' ? url('gold') : tier === 'crown' ? '#991b1b' : url('cloth');
  const hand = L.skin;
  const holds = ['mic', 'coffee', 'notebook', 'phone', 'sneaker'].includes(L.prop) ? L.prop : 'mic';
  if (tier === 'classic') return null;
  if (tier === 'special' || tier === 'secret')
    return (
      <g>
        <path d="M150 178 Q158 210 134 214 L124 204 Q140 198 138 182 Z" fill={sleeve} />
        <circle cx="126" cy="206" r="8" fill={hand} />
        <Prop kind={holds as never} x={124} y={196} />
      </g>
    );
  if (tier === 'legendary')
    return (
      <g>
        <path d="M150 172 Q172 140 166 92 L152 92 Q154 132 138 164 Z" fill={url('cloth')} />
        <circle cx="160" cy="88" r="9" fill={hand} />
        <Prop kind={holds as never} x={160} y={78} />
      </g>
    );
  if (tier === 'gold')
    return (
      <g>
        <path d="M150 178 Q160 210 134 212 L124 202 Q140 198 138 182 Z" fill={sleeve} />
        <circle cx="126" cy="204" r="8" fill={hand} />
        <Prop kind="mic" x={124} y={192} gold />
        <path d="M52 180 Q46 204 72 196 L78 186 Q62 190 64 180 Z" fill={sleeve} />
        <circle cx="78" cy="186" r="7" fill={hand} />
      </g>
    );
  return (
    <g>
      <path d="M150 178 Q160 206 134 210 L126 198 Q142 194 138 180 Z" fill={sleeve} />
      <rect x="128" y="120" width="7" height="96" rx="3" fill={url('gold')} />
      <circle cx="131.5" cy="114" r="12" fill={url('gold')} />
      <circle cx="131.5" cy="114" r="5" fill="#ef4444" />
      <circle cx="130" cy="200" r="8" fill={hand} />
    </g>
  );
}

function Face({ expr, skin }: { expr: Expr; skin: string }) {
  const ink = '#1a1110';
  const eye = (x: number) => (
    <g>
      <ellipse cx={x} cy="90" rx="6.5" ry="7.5" fill="#fff" />
      <circle cx={x + 1} cy="91" r="4" fill={ink} />
      <circle cx={x + 2.4} cy="89.2" r="1.4" fill="#fff" />
    </g>
  );
  const closed = (x: number) => <path d={`M${x - 7} 92 Q${x} 84 ${x + 7} 92`} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />;
  return (
    <g>
      <ellipse cx="78" cy="108" rx="7" ry="4" fill="#ff7a8a" opacity=".35" />
      <ellipse cx="122" cy="108" rx="7" ry="4" fill="#ff7a8a" opacity=".35" />
      <path d={`M${expr === 'smirk' ? '74 78 Q84 74 92 79' : '73 79 Q83 72 92 78'}`} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={`M${expr === 'wink' ? '108 77 Q118 74 127 80' : '108 78 Q117 72 127 79'}`} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      {expr === 'laugh' ? closed(83) : eye(83)}
      {expr === 'laugh' || expr === 'wink' ? closed(117) : eye(117)}
      {expr === 'smirk' && <path d="M76 87 h14 M110 87 h14" stroke={darken(skin, 0.35)} strokeWidth="3" />}
      <path d="M100 96 Q96 106 100 109 Q104 110 106 107" stroke={darken(skin, 0.35)} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {expr === 'smile' && <path d="M86 117 Q100 127 114 117" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {expr === 'grin' && (
        <g>
          <path d="M84 115 Q100 132 116 115 Z" fill="#5b1220" />
          <path d="M86 116 Q100 121 114 116 L113 119 Q100 123 87 119 Z" fill="#fff" />
        </g>
      )}
      {expr === 'laugh' && (
        <g>
          <path d="M82 113 Q100 140 118 113 Z" fill="#5b1220" />
          <path d="M84 114 h32 l-2 4 h-28 z" fill="#fff" />
          <ellipse cx="100" cy="128" rx="8" ry="5" fill="#f43f5e" />
        </g>
      )}
      {expr === 'wink' && <path d="M86 118 Q102 126 116 114" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {expr === 'smirk' && <path d="M88 119 Q104 123 115 114" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />}
    </g>
  );
}

function Hair({ kind, url, L, tier }: { kind: CharacterDef['look']['hair']; url: (n: string) => string; L: CharacterDef['look']; tier: Tier }) {
  const fill = url('hair');
  switch (kind) {
    case 'swoop':
      return <path d="M62 92 Q56 46 102 44 Q146 44 140 86 Q134 64 112 62 Q96 74 74 70 Q66 78 62 92 Z" fill={fill} />;
    case 'curly':
      return (
        <g fill={fill}>
          {[
            [68, 70, 12],
            [78, 56, 13],
            [94, 50, 13],
            [110, 50, 13],
            [125, 56, 13],
            [134, 70, 12],
            [62, 86, 9],
            [140, 86, 9]
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    case 'buzz':
      return <path d="M63 86 Q62 50 100 48 Q138 50 137 86 Q126 64 100 63 Q74 64 63 86 Z" fill={fill} opacity=".8" />;
    case 'beanie':
      return (
        <g>
          <path d="M60 80 Q60 34 100 34 Q140 34 140 80 Z" fill={tier === 'gold' ? url('gold') : L.accent2} />
          <rect x="57" y="72" width="86" height="14" rx="7" fill={darken(tier === 'gold' ? '#ffbe3b' : L.accent2, 0.25)} />
          <circle cx="100" cy="30" r="9" fill="#f9fafb" />
        </g>
      );
    case 'bun':
      return (
        <g fill={fill}>
          <circle cx="100" cy="40" r="13" />
          <path d="M62 90 Q60 50 100 48 Q140 50 138 90 Q130 66 100 64 Q72 66 62 90 Z" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M62 78 Q62 42 100 42 Q138 42 138 78 Z" fill={tier === 'gold' ? url('gold') : L.accent} />
          <path d="M62 78 Q40 78 34 86 Q60 90 100 82 Z" fill={darken(tier === 'gold' ? '#ffbe3b' : L.accent, 0.3)} />
          <circle cx="100" cy="44" r="3" fill="#0006" />
        </g>
      );
    case 'wavy':
      return <path d="M60 100 Q52 60 74 50 Q92 38 114 46 Q144 52 140 100 Q134 78 126 70 Q118 76 106 68 Q94 78 82 70 Q70 78 60 100 Z" fill={fill} />;
    default:
      return <path d="M63 84 L68 56 L78 66 L84 46 L94 60 L100 40 L108 58 L118 46 L122 64 L134 54 L137 84 Q124 66 100 66 Q76 66 63 84 Z" fill={fill} />;
  }
}

function Beard({ kind, url, color }: { kind: CharacterDef['look']['beard']; url: (n: string) => string; color: string }) {
  if (kind === 'none') return null;
  if (kind === 'stubble') return <path d="M64 104 Q68 136 100 138 Q132 136 136 104 Q128 126 100 128 Q72 126 64 104 Z" fill={color} opacity=".28" />;
  if (kind === 'full') return <path d="M62 98 Q62 142 100 144 Q138 142 138 98 Q130 124 116 122 Q100 132 84 122 Q70 124 62 98 Z" fill={url('hair')} />;
  if (kind === 'goatee')
    return (
      <g fill={url('hair')}>
        <path d="M90 126 Q100 142 110 126 Q100 132 90 126 Z" />
        <path d="M88 111 Q100 105 112 111 Q100 109 88 111 Z" />
      </g>
    );
  return <path d="M84 112 Q92 104 100 109 Q108 104 116 112 Q108 110 100 113 Q92 110 84 112 Z" fill={url('hair')} />;
}

function Glasses({ gold, url }: { gold: boolean; url: (n: string) => string }) {
  const s = gold ? url('gold') : '#111827';
  return (
    <g fill="none" stroke={s} strokeWidth="3">
      <rect x="71" y="81" width="24" height="19" rx="7" />
      <rect x="105" y="81" width="24" height="19" rx="7" />
      <path d="M95 89 h10" />
    </g>
  );
}

function Shades() {
  return (
    <g>
      <path d="M70 84 H97 Q97 102 83 102 Q70 102 70 84 Z M103 84 H130 Q130 102 117 102 Q103 102 103 84 Z" fill="#0b0b10" stroke="#1a1118" strokeWidth="2" />
      <path d="M96 87 h8 M70 86 L58 84 M130 86 L142 84" stroke="#0b0b10" strokeWidth="3" />
      <path d="M76 88 l6 6 M109 88 l6 6" stroke="#ffffff55" strokeWidth="2" />
    </g>
  );
}

function Headphones({ color }: { color: string }) {
  return (
    <g>
      <path d="M58 92 Q56 40 100 38 Q144 40 142 92" stroke={color} strokeWidth="7" fill="none" />
      <rect x="50" y="84" width="14" height="24" rx="6" fill={color} />
      <rect x="136" y="84" width="14" height="24" rx="6" fill={color} />
    </g>
  );
}

function Crown({ url, lift = 0 }: { url: (n: string) => string; lift?: number }) {
  return (
    <g transform={`translate(0 ${lift})`}>
      <path d="M66 52 L72 22 L86 40 L100 16 L114 40 L128 22 L134 52 Z" fill={url('gold')} stroke="#7c4a03" strokeWidth="2" />
      <circle cx="100" cy="30" r="4" fill="#ef4444" />
      <circle cx="80" cy="44" r="3" fill="#3b82f6" />
      <circle cx="120" cy="44" r="3" fill="#10b981" />
    </g>
  );
}

function Sparkles({ tier, g }: { tier: Tier; g: (n: string) => string }) {
  const color = tier === 'special' ? '#a5f3fc' : tier === 'legendary' ? '#f0abfc' : '#fff7d6';
  const pts = [
    [22, 130],
    [176, 120],
    [34, 60],
    [168, 168],
    [150, 26],
    [44, 196]
  ].slice(0, tier === 'special' ? 3 : 6);
  return (
    <g>
      {pts.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} fill={color} className={g('tw')} style={{ animationDelay: `${i * 0.37}s` }} />
      ))}
    </g>
  );
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(Math.min(255, Math.max(0, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = f(n >> 16);
  const gg = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0');
}
const lighten = (h: string, a: number) => shade(h, a);
const darken = (h: string, a: number) => shade(h, -a);
