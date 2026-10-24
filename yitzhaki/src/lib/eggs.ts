// Easter eggs: one item per panelist, each unlocking one power in "המסלול של יצחקי".
// Powers are no longer handed out for free — a run starts with one charge of every power
// whose egg you own. Eggs are bought on their own, whatever character you have;
// "זוג מנצח" is the exception: it comes free once both Tzach and Noam are in your collection.
import type { PowerUp } from './profile';

export interface EggDef {
  id: string;
  /** The panelist the egg belongs to (the duo lists both). */
  chars: string[];
  name: string;
  icon: string;
  power: PowerUp | 'shield';
  /** Short name of the power, as shown on the in-game button. */
  label: string;
  desc: string;
  price: number;
}

export const EGGS: EggDef[] = [
  {
    id: 'egg:chips',
    chars: ['dor'],
    name: 'צ׳יפים',
    icon: '🎰',
    power: 'fifty',
    label: 'הימור',
    desc: 'בשאלת שלוש אפשרויות: 50/50 — מוחק תשובה שגויה. בשאלה רגילה: כפול או כלום.',
    price: 1500
  },
  {
    id: 'egg:jacket',
    chars: ['yonatan'],
    name: 'מקטורת ופייסל',
    icon: '🧥',
    power: 'skip',
    label: 'דילוג',
    desc: 'יוצאים מהשאלה בסטייל — מדלגים בלי לאבד לב.',
    price: 2000
  },
  {
    id: 'egg:weights',
    chars: ['assaf'],
    name: 'משקולות',
    icon: '🏋️',
    power: 'life',
    label: '+לב',
    desc: 'אימון קצר באמצע הריצה — מקבלים לב נוסף.',
    price: 3000
  },
  {
    id: 'egg:phone',
    chars: ['matan'],
    name: 'טלפון',
    icon: '📱',
    power: 'answer',
    label: 'התשובה',
    desc: 'מתקשרים למתן — והוא אומר את התשובה הנכונה.',
    price: 3500
  },
  {
    id: 'egg:bag',
    chars: ['tal'],
    name: 'שקית קוק',
    icon: '🛍️',
    power: 'time',
    label: '+10 שנ׳',
    desc: 'זריקת אנרגיה — עוד 10 שניות לשאלה.',
    price: 1200
  },
  {
    id: 'egg:duo',
    chars: ['tzach', 'noam'],
    name: 'זוג מנצח',
    icon: '🤝',
    power: 'shield',
    label: 'מגן',
    desc: 'צח ונועם משחקים ביחד: פעם בכל שלב, טעות אחת לא עולה לב — השני מציל.',
    price: 0
  }
];

export const DUO = EGGS.find((e) => e.id === 'egg:duo')!;

export const eggById = (id: string | null | undefined) => EGGS.find((e) => e.id === id);
export const eggForPower = (power: PowerUp) => EGGS.find((e) => e.power === power)!;
export const eggsOfChar = (charId: string) => EGGS.filter((e) => e.chars.includes(charId));

/** Whether the player has an egg. The duo is earned by owning both of its characters. */
export function hasEgg(p: { eggs?: string[]; owned: string[] }, id: string): boolean {
  if (id === DUO.id) return DUO.chars.every((c) => p.owned.includes(c));
  return (p.eggs ?? []).includes(id);
}

/** Powers a run starts with: one charge of each power whose egg the player owns. */
export function startingPowers(p: { eggs?: string[]; owned: string[] }): Record<PowerUp, number> {
  const out: Record<PowerUp, number> = { fifty: 0, answer: 0, life: 0, skip: 0, time: 0 };
  for (const e of EGGS) if (e.power !== 'shield' && hasEgg(p, e.id)) out[e.power] = 1;
  return out;
}
