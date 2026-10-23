export type Role = 'f' | 'm' | 'k';

/** Assigning a role to one name takes it away from whoever had it, so the result is always a permutation. */
export function assign(current: Record<number, Role>, idx: number, role: Role): Record<number, Role> {
  const next: Record<number, Role> = {};
  for (const [k, v] of Object.entries(current)) if (v !== role && Number(k) !== idx) next[Number(k)] = v;
  next[idx] = role;
  return next;
}
