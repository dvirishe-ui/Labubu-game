// Calendar helpers in Israel time, so "today" flips at midnight for everyone playing.
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });

export function dayKey(now: number = Date.now()): string {
  return fmt.format(new Date(now));
}

/** ISO week id like 2026-W43, computed on the Israel calendar day. */
export function weekKey(now: number = Date.now()): string {
  const [y, m, d] = dayKey(now).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The seven day keys (Mon..Sun) of the ISO week containing `now`. */
export function weekDays(now: number = Date.now()): string[] {
  const [y, m, d] = dayKey(now).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(date);
    x.setUTCDate(date.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });
}
