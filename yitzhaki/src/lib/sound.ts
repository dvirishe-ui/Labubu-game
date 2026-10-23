import { load, save } from './storage';

let ctx: AudioContext | null = null;
let muted = load<boolean>('muted', false);

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  save('muted', m);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0): void {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  tap: () => tone(520, 0.06, 'triangle', 0.05),
  lock: () => tone(330, 0.12, 'square', 0.04),
  tick: () => tone(880, 0.04, 'square', 0.03),
  reveal: () => [0, 0.08, 0.16, 0.24].forEach((d, i) => tone(300 + i * 90, 0.09, 'triangle', 0.06, d)),
  good: () => [0, 0.1].forEach((d, i) => tone(660 + i * 220, 0.14, 'sine', 0.08, d)),
  bad: () => tone(160, 0.3, 'sawtooth', 0.05),
  win: () => [0, 0.12, 0.24, 0.4].forEach((d, i) => tone([523, 659, 784, 1047][i], 0.22, 'triangle', 0.08, d))
};
