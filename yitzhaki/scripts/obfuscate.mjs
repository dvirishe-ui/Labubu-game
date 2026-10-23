// Light obfuscation so answers aren't readable by glancing at the bundle or network tab.
// Not security — just spoiler protection. Mirrored in src/lib/obfuscate.ts.
export function keyFor(id) {
  let h = 2166136261 >>> 0;
  const s = 'gag:' + id;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function stream(seed, n) {
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
export function seal(id, obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const ks = stream(keyFor(id), bytes.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
  return Buffer.from(bytes).toString('base64');
}
