import type { Secret } from './types';

// Mirror of scripts/obfuscate.mjs. Keeps answers out of plain sight; not a security boundary.
export function keyFor(id: string): number {
  let h = 2166136261 >>> 0;
  const s = 'gag:' + id;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function stream(seed: number, n: number): Uint8Array {
  const out = new Uint8Array(n);
  let a = seed >>> 0;
  for (let i = 0; i < n; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out[i] = ((t ^ (t >>> 14)) >>> 0) & 255;
  }
  return out;
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function seal(id: string, obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const ks = stream(keyFor(id), bytes.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
  return toBase64(bytes);
}

export function unseal<T = Secret>(id: string, b64: string): T {
  const bytes = fromBase64(b64);
  const ks = stream(keyFor(id), bytes.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
