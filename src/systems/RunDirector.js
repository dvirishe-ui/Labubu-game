/**
 * RunDirector.js
 * Pure helpers that decide how hard the track is at a given distance:
 * the run speed curve, the difficulty stage and the special-zone schedule.
 */
import { SPEED, STAGES, ZONES, ZONE_ORDER, ZONE_RULES } from '../config/ProgressionConfig.js';

/** Speed (m/s) at `m` metres: gentle start, then a steady climb to MAX. */
export function speedAt(m) {
  return SPEED.START + (SPEED.MAX - SPEED.START) * (1 - Math.exp(-Math.max(0, m) / SPEED.RAMP_M));
}

export function stageIndexAt(m) {
  let i = 0;
  while (i + 1 < STAGES.length && m >= STAGES[i + 1].from) i++;
  return i;
}

export const stageAt = (m) => STAGES[stageIndexAt(m)];

/**
 * Lazily generated zone schedule for one run: the first zone at FIRST_AT,
 * then one every GAP_MIN..GAP_MAX metres, never the same type twice in a row.
 */
export class ZoneDirector {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.zones = [];
  }

  _extend(untilM) {
    let last = this.zones[this.zones.length - 1];
    while (!last || last.start <= untilM) {
      const start = last ? last.end + ZONE_RULES.GAP_MIN + this.rng() * (ZONE_RULES.GAP_MAX - ZONE_RULES.GAP_MIN) : ZONE_RULES.FIRST_AT;
      const options = ZONE_ORDER.filter((k) => k !== last?.type);
      const type = options[Math.floor(this.rng() * options.length) % options.length];
      last = { type, def: ZONES[type], start: Math.round(start), end: Math.round(start + ZONE_RULES.LENGTH) };
      this.zones.push(last);
    }
  }

  /** The zone covering track position `m`, or null. */
  zoneAt(m) {
    this._extend(m);
    return this.zones.find((z) => m >= z.start && m < z.end) || null;
  }

  /** The first zone starting at or after `m`. */
  nextZone(m) {
    this._extend(m + ZONE_RULES.GAP_MAX + ZONE_RULES.LENGTH);
    return this.zones.find((z) => z.start >= m) || null;
  }
}
