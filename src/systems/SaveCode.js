/**
 * SaveCode.js
 * Portable "save codes": the whole save compressed into one copy-paste
 * string. A player can move progress to any phone or browser - even with no
 * account and no internet backend - by copying the code on one device and
 * pasting it on another.
 */
import { migrateSave } from './SaveManager.js';
import { resolveConflict } from './SyncManager.js';

const PREFIX = 'LABUBU1.';

const toB64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Save -> "LABUBU1.z<deflated base64>" (or ".j<plain base64>" without CompressionStream). */
export async function exportSaveCode(data) {
  const json = new TextEncoder().encode(JSON.stringify({ ...data, meta: { ...data.meta, isDirty: true } }));
  if (typeof CompressionStream !== 'undefined') {
    return `${PREFIX}z${toB64(await pipe(json, new CompressionStream('deflate-raw')))}`;
  }
  return `${PREFIX}j${toB64(json)}`;
}

/** Code -> save object, or throws on a bad code. */
export async function decodeSaveCode(code) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) throw new Error('not a save code');
  const kind = clean[PREFIX.length];
  let bytes = fromB64(clean.slice(PREFIX.length + 1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('unknown save code');
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Loads a save code into `saveManager`. The code's progress wins, and
 * collections / personal bests from both are kept (same merge as cloud sync).
 */
export async function importSaveCode(saveManager, code, now = Date.now()) {
  const incoming = migrateSave(await decodeSaveCode(code), now);
  incoming.meta.updatedAt = now + 1;
  const { merged } = resolveConflict(saveManager.data, incoming);
  merged.meta.isDirty = true;
  saveManager.replaceWith(merged);
  saveManager.save('save_code');
  return merged;
}
