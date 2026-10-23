import type { BoardRow } from '../lib/challenges';
import { Avatar } from './Avatar';
import { fmt } from './Coins';

export function Board({ rows, me, empty }: { rows: BoardRow[] | null; me: string | null; empty: string }) {
  if (rows === null) return <p className="card p-4 text-center text-sm text-ink-400">הטבלה מתעדכנת רק כשהמשחק פתוח בגרסה המשותפת (דרך Claude או השרת של המשחקייה).</p>;
  if (!rows.length) return <p className="card p-4 text-center text-sm text-ink-400">{empty}</p>;
  return (
    <ol className="space-y-2">
      {rows.slice(0, 50).map((r, i) => (
        <li key={r.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.id === me ? 'border border-amber-400/60 bg-amber-400/10' : 'bg-ink-800'}`}>
          <span className={`w-7 text-center font-display text-xl ${i < 3 ? 'text-amber-400' : 'text-ink-400'}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-ink-900">
            <Avatar charId={r.char} skinId={r.skin} size={40} animated={false} />
          </span>
          <span className="min-w-0 flex-1 truncate font-bold text-white">
            {r.name}
            {r.id === me && <span className="ms-1 text-xs text-amber-300">(את/ה)</span>}
          </span>
          <span className="text-left">
            <span className="block font-display text-lg tabular-nums text-amber-400">{fmt(r.score)}</span>
            <span className="block text-xs tabular-nums text-ink-400">{r.correct} נכונות</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
