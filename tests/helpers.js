import { EventBus } from '../src/systems/EventBus.js';
import { SaveManager } from '../src/systems/SaveManager.js';

/** In-memory localStorage replacement. */
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

/** Fresh SaveManager on a controllable clock. */
export function makeSave(start = new Date(2026, 9, 18, 12, 0, 0).getTime()) {
  const clock = { t: start };
  const bus = new EventBus();
  const save = new SaveManager({ storage: memoryStorage(), bus, now: () => clock.t });
  save.load();
  return { save, bus, clock };
}

/** Deterministic RNG returning the given values in order (then repeating). */
export function seq(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}
