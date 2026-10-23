import { useState } from 'react';
import { levelOf } from '../lib/profile';
import { profileStore, useProfile } from '../lib/store';
import { Avatar } from './Avatar';
import { Modal } from './ui';

export function ProfileChip({ onClick }: { onClick?: () => void }) {
  const p = useProfile();
  const lv = levelOf(p.xp);
  return (
    <button onClick={onClick} className="flex min-h-[44px] items-center gap-2 rounded-full border border-ink-700 bg-ink-900/80 py-1 pe-3 ps-1" aria-label="הפרופיל שלי">
      <span className="h-9 w-9 overflow-hidden rounded-full bg-ink-800">
        <Avatar charId={p.equipped.char} skinId={p.equipped.skin} size={36} animated={false} />
      </span>
      <span className="text-start leading-tight">
        <span className="block max-w-[7.5rem] truncate text-sm font-bold text-white">{p.name || 'אורח/ת'}</span>
        <span className="block text-xs text-ink-400">רמה {lv.level}</span>
      </span>
    </button>
  );
}

export function XpBar() {
  const p = useProfile();
  const lv = levelOf(p.xp);
  return (
    <div className="flex items-center gap-2" aria-label={`רמה ${lv.level}`}>
      <span className="font-display text-sm text-ink-400">רמה {lv.level}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full bg-gradient-to-l from-cherry-500 to-amber-400 transition-[width] duration-700" style={{ width: `${(lv.into / lv.need) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-400">
        {lv.into}/{lv.need}
      </span>
    </div>
  );
}

/** First-visit nickname prompt (also reachable from the collection page). */
export function NameSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  return (
    <Modal open={open} onClose={onClose} title={p.name ? 'שינוי כינוי' : 'ברוכים הבאים לגג!'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim().slice(0, 18);
          if (!n) return;
          profileStore.update((x) => ({ ...x, name: n }));
          onClose();
        }}
      >
        {!p.name && <p className="text-ink-200">קיבלת 500 מטבעות הגג במתנה. איך לקרוא לך בטבלאות?</p>}
        <label className="label" htmlFor="nickname">
          כינוי
        </label>
        <input id="nickname" className="input" maxLength={18} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="למשל: מלך המרפסת" />
        <button className="btn-amber w-full" disabled={!name.trim()}>
          שמירה
        </button>
      </form>
    </Modal>
  );
}
