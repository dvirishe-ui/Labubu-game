// Drawn, game-style heads for the cast. Each one is built from the person's real look
// (hair shape and colour, beard, skin tone, face shape) taken from the reference photos
// in assets/cast — no photo pixels end up in the game.
import type { ReactNode } from 'react';

export type Expr = 'smile' | 'grin' | 'laugh' | 'wink' | 'smirk';

const INK = '#1a1118';
const CY = 90; // head centre
const EYE_Y = CY + 3;
const MOUTH_Y = CY + 29;

type Beard = 'none' | 'stubble' | 'short' | 'groomed' | 'full';

interface HeadSpec {
  skin: string;
  hair: string;
  beard: Beard;
  beardColor?: string;
  brows: string;
  browW?: number;
  iris: string;
  rx: number;
  ry: number;
  /** Jaw width at the bottom corners, as a share of rx. */
  jaw: number;
  older?: boolean;
  /** Hair drawn behind the head (volume around the sides). */
  back?: (c: string) => ReactNode;
  /** Hair drawn over the forehead. */
  front: (c: string) => ReactNode;
  /** Highest point of the hair, for hats and crowns. */
  top: number;
}

/** Overlapping circles merged into one outlined blob — curls, quiffs, volume. */
function Blob({ pts, fill, w = 5 }: { pts: number[][]; fill: string; w?: number }) {
  return (
    <g>
      {pts.map(([x, y, r], i) => (
        <circle key={'o' + i} cx={x} cy={y} r={r} fill={INK} stroke={INK} strokeWidth={w} />
      ))}
      {pts.map(([x, y, r], i) => (
        <circle key={'f' + i} cx={x} cy={y} r={r} fill={fill} />
      ))}
    </g>
  );
}

const shine = (d: string) => <path d={d} stroke="#fff" strokeOpacity=".35" strokeWidth="3" fill="none" strokeLinecap="round" />;
const strands = (d: string, c: string) => <path d={d} stroke={darken(c, 0.45)} strokeWidth="1.6" fill="none" strokeLinecap="round" />;

export const HEADS: Record<string, HeadSpec> = {
  // Slim face, dark side-swept fringe, light stubble.
  assaf: {
    skin: '#e6b48f',
    hair: '#2c201a',
    beard: 'stubble',
    brows: '#1c1310',
    iris: '#5a3a24',
    rx: 39,
    ry: 48,
    jaw: 0.6,
    top: 32,
    back: (c) => <path d="M55 108 Q46 50 98 34 Q152 30 150 104 L141 108 L140 70 L62 70 L63 108 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />,
    front: (c) => (
      <g>
        <path d="M57 96 Q50 48 100 36 Q148 34 145 90 Q141 70 134 62 Q128 74 116 78 Q120 68 118 62 Q104 74 86 78 Q92 70 92 64 Q76 74 66 74 Q60 82 57 96 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {strands('M72 50 Q86 58 90 66 M96 44 Q110 54 116 64 M120 46 Q132 56 134 66', c)}
        {shine('M72 50 Q92 38 116 40')}
      </g>
    )
  },
  // Big light-brown curls with high temples, short reddish beard.
  yonatan: {
    skin: '#f0c4a3',
    hair: '#7b5534',
    beard: 'short',
    beardColor: '#8f6440',
    brows: '#6a4728',
    iris: '#4f6b52',
    rx: 41,
    ry: 47,
    jaw: 0.7,
    top: 21,
    back: (c) => (
      <Blob
        fill={c}
        pts={[
          [56, 73, 15],
          [52, 93, 11],
          [64, 51, 17],
          [84, 37, 18],
          [104, 31, 19],
          [124, 37, 18],
          [140, 51, 17],
          [148, 73, 15],
          [150, 93, 11]
        ]}
      />
    ),
    front: (c) => (
      <g>
        <Blob
          fill={c}
          w={4}
          pts={[
            [70, 59, 11],
            [86, 53, 11],
            [101, 57, 10],
            [116, 53, 11],
            [132, 59, 11]
          ]}
        />
        {strands('M60 57 q6 -6 12 0 M80 41 q6 -6 12 0 M102 35 q6 -6 12 0 M124 43 q6 -6 12 0 M140 63 q6 -6 10 2 M84 53 q5 -5 10 0 M112 53 q5 -5 10 0', c)}
        {shine('M88 29 Q104 23 120 29')}
      </g>
    )
  },
  // Short brown hair, slightly receding; neat short beard.
  noam: {
    skin: '#e7ad86',
    hair: '#3d2b20',
    beard: 'groomed',
    beardColor: '#32241b',
    brows: '#2e2018',
    iris: '#4a3020',
    rx: 42,
    ry: 47,
    jaw: 0.72,
    top: 36,
    front: (c) => (
      <g>
        <path d="M59 88 Q52 40 100 36 Q148 40 141 88 Q138 70 132 62 Q124 62 118 54 Q100 60 84 54 Q78 62 68 62 Q62 70 59 88 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {strands('M82 48 L88 56 M100 46 L102 58 M118 48 L114 56', c)}
        {shine('M80 46 Q100 40 120 46')}
      </g>
    )
  },
  // Thick dark beard, short sides with a tall quiff.
  tzach: {
    skin: '#cd9472',
    hair: '#2a1f1a',
    beard: 'full',
    brows: '#120c0a',
    browW: 4.4,
    iris: '#3b2416',
    rx: 43,
    ry: 47,
    jaw: 0.76,
    top: 18,
    front: (c) => (
      <g>
        <path d="M58 94 Q54 70 60 58 L68 62 L66 82 Q61 86 58 94 Z M142 94 Q146 70 140 58 L132 62 L134 82 Q139 86 142 94 Z" fill={c} opacity=".7" />
        <path d="M60 66 Q56 46 70 40 Q72 22 98 18 Q126 16 136 32 Q148 40 142 64 Q136 54 124 52 Q122 44 110 42 Q112 54 96 56 Q78 56 70 58 Q62 60 60 66 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {strands('M76 40 Q96 24 124 28 M80 50 Q100 36 130 42 M104 22 Q118 30 120 44', c)}
        {shine('M84 28 Q102 20 120 24')}
      </g>
    )
  },
  // Skin fade with a textured top, sharp full beard, big grin.
  chen: {
    skin: '#c98f69',
    hair: '#27201d',
    beard: 'groomed',
    brows: '#100b0a',
    browW: 4,
    iris: '#3a2416',
    rx: 42,
    ry: 48,
    jaw: 0.74,
    top: 28,
    front: (c) => (
      <g>
        <path d="M59 92 Q56 62 66 52 L68 76 Q62 82 59 92 Z M141 92 Q144 62 134 52 L132 76 Q138 82 141 92 Z" fill={c} opacity=".55" />
        <path d="M64 62 L66 42 L76 48 L80 32 L90 42 L98 28 L106 40 L116 30 L120 44 L132 38 L134 54 Q138 58 138 64 Q124 54 100 56 Q78 54 64 62 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {shine('M84 40 L92 34 M104 36 L112 32')}
      </g>
    )
  },
  // Thick wavy black hair, full groomed beard, round smiling face.
  matan: {
    skin: '#d7a17c',
    hair: '#2b211c',
    beard: 'groomed',
    brows: '#140e0c',
    browW: 4.2,
    iris: '#3d2617',
    rx: 43,
    ry: 46,
    jaw: 0.76,
    top: 30,
    front: (c) => (
      <g>
        <path d="M58 90 Q50 44 96 32 Q148 28 144 88 Q140 70 132 62 Q124 70 112 62 Q102 72 90 64 Q78 72 68 66 Q62 74 58 90 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {strands('M70 50 Q80 44 88 54 M92 42 Q104 36 110 50 M114 42 Q126 40 130 54', c)}
        {shine('M76 42 Q96 32 118 36')}
      </g>
    )
  },
  // High hairline, short dark hair, big full beard, broad face.
  dor: {
    skin: '#dfb08d',
    hair: '#33271f',
    beard: 'full',
    brows: '#1d1512',
    browW: 4,
    iris: '#3e2a1c',
    rx: 45,
    ry: 46,
    jaw: 0.82,
    top: 40,
    front: (c) => (
      <g>
        <path d="M56 90 Q52 50 100 42 Q148 50 144 90 Q142 72 136 62 Q128 54 118 58 Q100 50 82 58 Q72 54 64 62 Q58 72 56 90 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M86 52 Q100 47 114 52" stroke={lighten(c, 0.2)} strokeWidth="2" fill="none" opacity=".7" />
      </g>
    )
  },
  // Tight black curls on top, faded sides, full beard, long smiling face.
  tal: {
    skin: '#bd8662',
    hair: '#261c18',
    beard: 'groomed',
    brows: '#100a08',
    browW: 4,
    iris: '#33200f',
    rx: 40,
    ry: 49,
    jaw: 0.7,
    top: 22,
    front: (c) => (
      <g>
        <path d="M61 92 Q58 66 66 56 L68 78 Q64 84 61 92 Z M139 92 Q142 66 134 56 L132 78 Q136 84 139 92 Z" fill={c} opacity=".55" />
        <Blob
          fill={c}
          w={4}
          pts={[
            [70, 54, 9],
            [82, 44, 10],
            [96, 38, 10],
            [110, 38, 10],
            [124, 44, 10],
            [134, 56, 8],
            [88, 54, 8],
            [104, 52, 8],
            [120, 54, 8],
            [76, 60, 6],
            [130, 62, 6]
          ]}
        />
        {strands('M78 44 q4 -4 8 0 M94 36 q4 -4 8 0 M108 36 q4 -4 8 0 M122 44 q4 -4 8 0 M86 54 q4 -4 8 0 M102 52 q4 -4 8 0 M118 54 q4 -4 8 0', c)}
      </g>
    )
  },
  // The older Noam: grey hair combed back, clean-shaven, laugh lines.
  'noam-future': {
    skin: '#c49072',
    hair: '#aeb0b4',
    beard: 'none',
    brows: '#8b8d92',
    browW: 4.4,
    iris: '#3e2818',
    rx: 45,
    ry: 47,
    jaw: 0.8,
    older: true,
    top: 32,
    back: (c) => <path d="M54 96 Q46 52 98 38 Q154 36 148 96 L140 96 L60 96 Z" fill={c} stroke={INK} strokeWidth="3" />,
    front: (c) => (
      <g>
        <path d="M56 88 Q48 46 92 34 Q132 28 146 58 Q148 72 144 88 Q138 64 124 58 Q108 50 86 56 Q68 60 62 72 Q58 78 56 88 Z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {strands('M70 56 Q96 40 132 50 M76 64 Q100 50 136 60', c)}
        {shine('M80 42 Q102 34 124 40')}
      </g>
    )
  }
};

export function headTop(id: string): number {
  return HEADS[id]?.top ?? 40;
}

function headPath(rx: number, ry: number, jaw: number): string {
  const t = CY - ry;
  const b = CY + ry;
  const jx = rx * jaw;
  const jy = CY + ry * 0.58;
  return [
    `M100 ${t}`,
    `C${100 + rx * 0.62} ${t} ${100 + rx} ${CY - ry * 0.55} ${100 + rx} ${CY - 2}`,
    `C${100 + rx} ${CY + ry * 0.28} ${100 + jx * 1.08} ${jy - ry * 0.1} ${100 + jx} ${jy}`,
    `C${100 + jx * 0.85} ${b - ry * 0.12} ${100 + 14} ${b} 100 ${b}`,
    `C${100 - 14} ${b} ${100 - jx * 0.85} ${b - ry * 0.12} ${100 - jx} ${jy}`,
    `C${100 - jx * 1.08} ${jy - ry * 0.1} ${100 - rx} ${CY + ry * 0.28} ${100 - rx} ${CY - 2}`,
    `C${100 - rx} ${CY - ry * 0.55} ${100 - rx * 0.62} ${t} 100 ${t} Z`
  ].join(' ');
}

function beardPath(h: HeadSpec, kind: Beard): string {
  const { rx, ry, jaw } = h;
  const b = CY + ry;
  const jx = rx * jaw;
  const drop = kind === 'full' ? 9 : kind === 'groomed' ? 5 : 3;
  const cheek = kind === 'full' ? CY + 12 : CY + 16;
  return [
    `M${100 - rx + 1} ${CY - 2}`,
    `L${100 - rx + 6} ${CY - 2}`,
    `Q${100 - rx + 9} ${cheek + 8} ${100 - 22} ${cheek + 12}`,
    `Q100 ${cheek + 6} ${100 + 22} ${cheek + 12}`,
    `Q${100 + rx - 9} ${cheek + 8} ${100 + rx - 6} ${CY - 2}`,
    `L${100 + rx - 1} ${CY - 2}`,
    `C${100 + rx + 1} ${CY + ry * 0.4} ${100 + jx * 1.1} ${b - 10} ${100 + 16} ${b + drop - 2}`,
    `Q100 ${b + drop + 3} ${100 - 16} ${b + drop - 2}`,
    `C${100 - jx * 1.1} ${b - 10} ${100 - rx - 1} ${CY + ry * 0.4} ${100 - rx + 1} ${CY - 2} Z`
  ].join(' ');
}

/** The full head, drawn around (100, 90). `g` makes ids unique per SVG. */
export function GameHead({ id, expr, g }: { id: string; expr: Expr; g: (n: string) => string }) {
  const h = HEADS[id];
  if (!h) return null;
  const url = (n: string) => `url(#${g(n)})`;
  const face = headPath(h.rx, h.ry, h.jaw);
  const shadow = darken(h.skin, 0.2);
  const bc = h.beardColor ?? h.hair;
  const earX = h.rx - 2;
  return (
    <g>
      <defs>
        <clipPath id={g('hc')}>
          <path d={face} />
        </clipPath>
        <radialGradient id={g('hs')} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor={lighten(h.skin, 0.12)} />
          <stop offset=".7" stopColor={h.skin} />
          <stop offset="1" stopColor={darken(h.skin, 0.08)} />
        </radialGradient>
      </defs>
      {h.back?.(h.hair)}
      {/* neck */}
      <path d={`M86 ${CY + h.ry - 14} L86 152 Q100 160 114 152 L114 ${CY + h.ry - 14} Z`} fill={shadow} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d={`M86 ${CY + h.ry - 2} Q100 ${CY + h.ry + 10} 114 ${CY + h.ry - 2} L114 ${CY + h.ry + 6} Q100 ${CY + h.ry + 16} 86 ${CY + h.ry + 6} Z`} fill={darken(h.skin, 0.32)} opacity=".6" />
      {/* ears */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <ellipse cx={100 + s * earX} cy={CY + 6} rx="8" ry="11" fill={h.skin} stroke={INK} strokeWidth="3" />
          <path d={`M${100 + s * (earX + 2)} ${CY} q${s * 3} 6 0 12`} stroke={darken(h.skin, 0.3)} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* face with cel shading */}
      <path d={face} fill={url('hs')} />
      <g clipPath={url('hc')}>
        <path d={`M${100 + h.rx * 0.45} ${CY - h.ry} Q${100 + h.rx * 1.05} ${CY + 6} ${100 + h.rx * 0.3} ${CY + h.ry} L${100 + h.rx + 10} ${CY + h.ry} L${100 + h.rx + 10} ${CY - h.ry} Z`} fill={shadow} opacity=".5" />
        <ellipse cx="100" cy={CY - h.ry + 22} rx={h.rx} ry="12" fill={shadow} opacity=".35" />
        {h.beard === 'stubble' && <path d={beardPath(h, 'groomed')} fill={h.hair} opacity=".2" />}
        {h.beard === 'short' && <path d={beardPath(h, 'short')} fill={bc} opacity=".9" />}
      </g>
      {(h.beard === 'groomed' || h.beard === 'full') && (
        <g>
          <path d={beardPath(h, h.beard)} fill={bc} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d={`M${100 - h.rx + 14} ${CY + 30} q4 8 10 12 M${100 + h.rx - 14} ${CY + 30} q-4 8 -10 12 M94 ${CY + h.ry + 2} q6 3 12 0`} stroke={lighten(bc, 0.3)} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".8" />
          <path d={`M${100 - h.rx + 8} ${CY + 14} q3 10 8 16 M${100 + h.rx - 8} ${CY + 14} q-3 10 -8 16 M84 ${CY + h.ry - 4} q4 4 8 5 M116 ${CY + h.ry - 4} q-4 4 -8 5`} stroke={lighten(bc, 0.22)} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".7" />
        </g>
      )}
      <path d={face} fill="none" stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
      {/* blush & highlight */}
      <ellipse cx={100 - 24} cy={EYE_Y + 15} rx="7" ry="4" fill="#ff6f7d" opacity=".28" />
      <ellipse cx={100 + 24} cy={EYE_Y + 15} rx="7" ry="4" fill="#ff6f7d" opacity=".28" />
      <ellipse cx={100 - h.rx * 0.45} cy={CY - 14} rx="8" ry="5" fill="#fff" opacity=".18" transform={`rotate(-20 ${100 - h.rx * 0.45} ${CY - 14})`} />
      {h.older && (
        <g stroke={darken(h.skin, 0.32)} strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d={`M84 ${CY - 26} q16 -4 32 0 M88 ${CY - 20} q12 -3 24 0`} />
          <path d={`M${100 - 31} ${EYE_Y + 1} l-5 -2 M${100 - 31} ${EYE_Y + 5} l-5 2 M${100 + 31} ${EYE_Y + 1} l5 -2 M${100 + 31} ${EYE_Y + 5} l5 2`} />
          <path d={`M86 ${CY + 18} q-6 8 -2 16 M114 ${CY + 18} q6 8 2 16`} />
        </g>
      )}
      <Eyes h={h} expr={expr} g={g} />
      {/* nose */}
      <path d={`M101 ${CY + 8} Q96 ${CY + 17} 99 ${CY + 20} Q103 ${CY + 21} 106 ${CY + 18}`} stroke={darken(h.skin, 0.38)} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="98" cy={CY + 14} r="1.6" fill="#fff" opacity=".45" />
      {(h.beard === 'groomed' || h.beard === 'full') && <ellipse cx="100" cy={MOUTH_Y + 4} rx="11" ry="7" fill={darken(h.skin, 0.06)} />}
      <Mouth expr={expr} lip={h.beard === 'groomed' || h.beard === 'full' ? lighten(bc, 0.1) : darken(h.skin, 0.25)} />
      {(h.beard === 'groomed' || h.beard === 'full') && (
        <path d={`M85 ${MOUTH_Y - 2} Q92 ${MOUTH_Y - 9} 100 ${MOUTH_Y - 6} Q108 ${MOUTH_Y - 9} 115 ${MOUTH_Y - 2} Q108 ${MOUTH_Y - 4} 100 ${MOUTH_Y - 2} Q92 ${MOUTH_Y - 4} 85 ${MOUTH_Y - 2} Z`} fill={bc} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      )}
      {h.front(h.hair)}
    </g>
  );
}

function Eyes({ h, expr, g }: { h: HeadSpec; expr: Expr; g: (n: string) => string }) {
  const bw = h.browW ?? 3.4;
  const eye = (x: number, k: string) => {
    const almond = `M${x - 10} ${EYE_Y + 2} Q${x} ${EYE_Y - 11} ${x + 10} ${EYE_Y + 2} Q${x} ${EYE_Y + 12} ${x - 10} ${EYE_Y + 2} Z`;
    return (
      <g key={k}>
        <defs>
          <clipPath id={g('e' + k)}>
            <path d={almond} />
          </clipPath>
        </defs>
        <path d={almond} fill="#fff" />
        <g clipPath={`url(#${g('e' + k)})`}>
          <circle cx={x + 0.5} cy={EYE_Y + 2} r="6" fill={h.iris} />
          <circle cx={x + 0.5} cy={EYE_Y + 2} r="2.6" fill={INK} />
          <circle cx={x + 2.4} cy={EYE_Y} r="1.7" fill="#fff" />
          <circle cx={x - 1.6} cy={EYE_Y + 4.4} r=".9" fill="#fff" opacity=".8" />
          <path d={`M${x - 10} ${EYE_Y - 4} H${x + 10} V${EYE_Y - 1} Q${x} ${EYE_Y - 4} ${x - 10} ${EYE_Y - 1} Z`} fill={darken(h.skin, 0.25)} opacity=".35" />
        </g>
        <path d={`M${x - 11} ${EYE_Y + 3} Q${x} ${EYE_Y - 12} ${x + 11} ${EYE_Y + 2}`} stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      </g>
    );
  };
  const closed = (x: number, k: string) => <path key={k} d={`M${x - 9} ${EYE_Y + 3} Q${x} ${EYE_Y - 6} ${x + 9} ${EYE_Y + 3}`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  const L = 100 - 16;
  const R = 100 + 16;
  const browY = EYE_Y - 12;
  const lift = expr === 'smirk' ? 3 : 0;
  return (
    <g>
      <path d={`M${L - 10} ${browY + 3} Q${L} ${browY - 4} ${L + 10} ${browY + 1}`} stroke={h.brows} strokeWidth={bw} fill="none" strokeLinecap="round" />
      <path d={`M${R - 10} ${browY + 1 - lift} Q${R} ${browY - 4 - lift} ${R + 10} ${browY + 3 - lift}`} stroke={h.brows} strokeWidth={bw} fill="none" strokeLinecap="round" />
      {expr === 'laugh' ? closed(L, 'l') : eye(L, 'l')}
      {expr === 'laugh' || expr === 'wink' ? closed(R, 'r') : eye(R, 'r')}
    </g>
  );
}

function Mouth({ expr, lip }: { expr: Expr; lip: string }) {
  const y = MOUTH_Y;
  if (expr === 'smile')
    return (
      <g>
        <path d={`M87 ${y} Q100 ${y + 10} 113 ${y} Q100 ${y + 3} 87 ${y} Z`} fill="#fff" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        <path d={`M85 ${y - 2} q2 2 3 3 M115 ${y - 2} q-2 2 -3 3`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    );
  if (expr === 'smirk') return <path d={`M88 ${y + 2} Q104 ${y + 7} 115 ${y - 3}`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  if (expr === 'wink')
    return (
      <g>
        <path d={`M86 ${y - 1} Q100 ${y + 14} 115 ${y - 2} Q100 ${y + 4} 86 ${y - 1} Z`} fill="#5b1220" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        <path d={`M89 ${y + 1} Q100 ${y + 4} 112 ${y}`} stroke="#fff" strokeWidth="2.4" fill="none" />
      </g>
    );
  const deep = expr === 'laugh' ? 20 : 15;
  return (
    <g>
      <path d={`M84 ${y - 2} Q100 ${y + deep + 4} 116 ${y - 2} Q100 ${y + 1} 84 ${y - 2} Z`} fill="#5b1220" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d={`M87 ${y - 0.5} Q100 ${y + 2.5} 113 ${y - 0.5} L112 ${y + 3} Q100 ${y + 6} 88 ${y + 3} Z`} fill="#fff" />
      {expr === 'laugh' && <ellipse cx="100" cy={y + 12} rx="7" ry="4" fill="#ef5b73" />}
      <path d={`M90 ${y + deep - 3} Q100 ${y + deep + 1} 110 ${y + deep - 3}`} stroke={lip} strokeWidth="1.5" fill="none" opacity=".5" />
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
export const lighten = (h: string, a: number) => shade(h, a);
export const darken = (h: string, a: number) => shade(h, -a);
