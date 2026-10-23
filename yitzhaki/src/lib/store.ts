import { useSyncExternalStore } from 'react';
import { connectCloud, aggregate, type Cloud, type CrowdStats, type PublicPlayer } from './cloud';
import type { RewardEvent, Result } from './economy';
import { levelOf, normalizeProfile, type Profile } from './profile';
import { load, save } from './storage';

type Listener = () => void;

interface State {
  profile: Profile;
  cloud: Cloud | null;
  cloudReady: boolean;
  toasts: (RewardEvent & { key: number })[];
}

let state: State = { profile: normalizeProfile(load('profile.v1', null)), cloud: null, cloudReady: false, toasts: [] };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
let toastSeq = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
}

export function publicOf(p: Profile, id: string): PublicPlayer {
  const days: PublicPlayer['days'] = {};
  for (const [d, v] of Object.entries(p.daily).slice(-30)) days[d] = { score: v.score, correct: v.correct };
  const duels: PublicPlayer['duels'] = {};
  for (const [c, v] of Object.entries(p.duels).slice(-50)) duels[c] = v;
  return { id, name: p.name || 'שחקן/ית', char: p.equipped.char, skin: p.equipped.skin, level: levelOf(p.xp).level, days, duels, updatedAt: Date.now() };
}

function persist() {
  save('profile.v1', state.profile);
  if (!state.cloud) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { cloud, profile } = state;
    if (!cloud) return;
    void cloud.saveProfile(profile).catch(() => undefined);
    void cloud.savePlayer(publicOf(profile, cloud.userId)).catch(() => undefined);
    void cloud.saveAnswers(profile.answered).catch(() => undefined);
  }, 1200);
}

export const profileStore = {
  get: () => state,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Apply a reward/stat transition and queue its toasts. */
  apply(r: Result | ((p: Profile) => Result)) {
    const res = typeof r === 'function' ? r(state.profile) : r;
    const toasts = [...state.toasts, ...res.events.map((e) => ({ ...e, key: ++toastSeq }))];
    set({ profile: res.profile, toasts });
    persist();
    return res;
  },
  update(fn: (p: Profile) => Profile) {
    set({ profile: { ...fn(state.profile), rev: state.profile.rev + 1 } });
    persist();
  },
  dismissToast(key: number) {
    set({ toasts: state.toasts.filter((t) => t.key !== key) });
  },
  async init() {
    const cloud = await connectCloud();
    if (!cloud) return set({ cloudReady: true });
    const remote = await cloud.loadProfile().catch(() => null);
    if (remote && (remote.rev ?? 0) > state.profile.rev) set({ profile: normalizeProfile(remote) });
    set({ cloud, cloudReady: true });
    save('profile.v1', state.profile);
    persist();
  }
};

export function useProfileState(): State {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get, profileStore.get);
}

export const useProfile = () => useProfileState().profile;

// ---- shared reads (cached briefly so screens can call freely) ----

let crowdCache: { at: number; value: CrowdStats } | null = null;
let playersCache: { at: number; value: PublicPlayer[] } | null = null;

export async function getCrowd(force = false): Promise<CrowdStats | null> {
  const { cloud } = state;
  if (!cloud) return null;
  if (!force && crowdCache && Date.now() - crowdCache.at < 60_000) return crowdCache.value;
  const rows = await cloud.loadAnswers().catch(() => null);
  if (!rows) return crowdCache?.value ?? null;
  crowdCache = { at: Date.now(), value: aggregate(rows, cloud.userId) };
  return crowdCache.value;
}

export async function getPlayers(force = false): Promise<PublicPlayer[] | null> {
  const { cloud } = state;
  if (!cloud) return null;
  if (!force && playersCache && Date.now() - playersCache.at < 30_000) return playersCache.value;
  const rows = await cloud.loadPlayers().catch(() => null);
  if (!rows) return playersCache?.value ?? null;
  // Make sure you appear with your latest numbers even before the write lands.
  const me = publicOf(state.profile, cloud.userId);
  playersCache = { at: Date.now(), value: [...rows.filter((r) => r.id !== me.id), me] };
  return playersCache.value;
}
