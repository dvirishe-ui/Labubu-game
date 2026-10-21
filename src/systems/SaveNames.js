/**
 * SaveNames.js
 * Short save codes the player chooses ("dvir123") instead of the long
 * LABUBU1 string. The long code is stored in the artifact's shared `codes`
 * collection under the chosen name and refreshed after every cloud save, so
 * typing the name on any device loads the latest progress.
 *
 * Needs the `db` rule { path: 'codes', read: 'view', write: 'interact' }:
 * anyone who can open the game can load a name, people who can write to the
 * game (the owner and invited players) can choose one.
 */
import { exportSaveCode, importSaveCode } from './SaveCode.js';

export const SAVE_NAME = { MIN: 3, MAX: 16 };

/** "  Dvir 123 " -> "dvir123"; null when it can't be a code name. */
export function normalizeSaveName(raw) {
  const name = String(raw || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '')
    .trim();
  if (name.length < SAVE_NAME.MIN || name.length > SAVE_NAME.MAX) return null;
  return /^[a-z0-9-]+$/.test(name) ? name : null;
}

/** True when the input looks like a long LABUBU1 save code rather than a name. */
export const isLongCode = (raw) => /^\s*LABUBU1\./.test(String(raw || ''));

const ref = (adapter, name) => adapter.db.doc(`codes/${name}`);

/** The signed-in Claude adapter if this view can read the shared codes, else null. */
export function codesAdapter(sync) {
  const a = sync?.adapter;
  return a?.kind === 'claude' && a.db ? a : null;
}

/**
 * Claims `raw` as this player's code name and stores their save under it.
 * Throws Error('invalid' | 'taken' | 'no_account' | 'read_only').
 */
export async function claimSaveName(adapter, saveManager, raw) {
  const name = normalizeSaveName(raw);
  if (!name) throw new Error('invalid');
  if (!adapter) throw new Error('no_account');
  if (adapter.readOnly) throw new Error('read_only');
  const snap = await ref(adapter, name).get();
  if (snap.exists && snap.data()?.owner !== adapter.uid) throw new Error('taken');
  const data = saveManager.data;
  const old = data.profile.saveName;
  data.profile.saveName = name;
  try {
    await ref(adapter, name).set({ owner: adapter.uid, code: await exportSaveCode(data), updatedAt: Date.now() });
  } catch (err) {
    data.profile.saveName = old || '';
    if (err?.code === 'invalid_argument' || err?.code === 'not_granted' || err?.code === 'permission_denied') throw new Error('read_only');
    throw err;
  }
  saveManager.save('save_name');
  // Free the old name so someone else can use it.
  if (old && old !== name) ref(adapter, old).delete?.().catch(() => {});
  return name;
}

/** Writes the latest save under the player's code name (after a cloud save). */
export async function refreshSaveName(adapter, data) {
  const name = data?.profile?.saveName;
  if (!name || !adapter || adapter.readOnly) return;
  const snap = await ref(adapter, name).get();
  if (snap.exists && snap.data()?.owner !== adapter.uid) return;
  await ref(adapter, name).set({ owner: adapter.uid, code: await exportSaveCode(data), updatedAt: Date.now() });
}

/**
 * Loads progress from a code name or a long save code.
 * Throws Error('invalid' | 'not_found' | 'no_account') or a decode error.
 */
export async function loadAnyCode(sync, saveManager, raw) {
  if (isLongCode(raw)) return importSaveCode(saveManager, raw);
  const name = normalizeSaveName(raw);
  if (!name) throw new Error('invalid');
  const adapter = codesAdapter(sync);
  if (!adapter) throw new Error('no_account');
  const snap = await ref(adapter, name).get();
  const code = snap.exists ? snap.data()?.code : null;
  if (!code) throw new Error('not_found');
  return importSaveCode(saveManager, code);
}

/** Toast text for a failed claim / load. */
export function codeErrorText(err) {
  switch (err?.message) {
    case 'invalid':
      return { text: 'Use 3-16 letters or numbers', sub: 'Like: dvir123' };
    case 'taken':
      return { text: 'That name is taken', sub: 'Try adding some numbers' };
    case 'not_found':
      return { text: 'No save with that name', sub: 'Check the spelling and try again' };
    case 'no_account':
      return { text: 'Code names need Claude sign-in', sub: 'Paste the long save code instead' };
    case 'read_only':
      return { text: "This link can't save names", sub: 'Ask the game owner to invite you' };
    default:
      return { text: "That code didn't work", sub: 'Check it and try again' };
  }
}
