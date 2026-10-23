import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** QR code drawn as SVG rects (no HTML injection). */
export function Qr({ text, size = 180 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const out: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) out.push([c, r]);
    return { n, out };
  }, [text]);
  const pad = 2;
  const total = cells.n + pad * 2;
  return (
    <svg viewBox={`0 0 ${total} ${total}`} width={size} height={size} role="img" aria-label="קוד QR להצטרפות" className="rounded-xl bg-white" shapeRendering="crispEdges">
      {cells.out.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + pad} y={y + pad} width="1" height="1" fill="#0c0b0d" />
      ))}
    </svg>
  );
}
