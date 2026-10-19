/**
 * Account.js
 * Signs the player in at startup and pulls their cloud save:
 *  - a backend configured at build time (Supabase / REST for the store app), or
 *  - their Claude account when the game runs as a claude.ai Artifact.
 * Otherwise the player is a guest and progress stays on this device (plus
 * portable save codes, see SaveCode.js).
 */
import { Services } from './Services.js';
import { ClaudeAdapter } from './sync/ClaudeAdapter.js';
import { isPristine } from './SyncManager.js';

/**
 * @returns {Promise<{ cloud: boolean, kind: string, readOnly?: boolean, accountName?: string, newPlayer: boolean }>}
 */
export async function connectAccount() {
  const sync = Services.sync;
  try {
    if (!sync.adapter.enabled) {
      const adapter = await ClaudeAdapter.connect();
      if (!adapter) return { cloud: false, kind: 'guest', newPlayer: isPristine(Services.save.data) };
      sync.setAdapter(adapter);
    }
    await sync.syncNow({ force: true });
    const adapter = sync.adapter;
    return {
      cloud: adapter.enabled && !adapter.readOnly,
      kind: adapter.kind,
      readOnly: Boolean(adapter.readOnly),
      accountName: adapter.accountName || '',
      newPlayer: isPristine(Services.save.data)
    };
  } catch (err) {
    console.warn('[Account] sign-in failed, playing locally', err);
    return { cloud: false, kind: 'guest', newPlayer: isPristine(Services.save.data) };
  }
}

/** Starts signing in once; every caller shares the same promise. */
export function accountReady() {
  if (!Services.account) Services.account = connectAccount();
  return Services.account;
}
