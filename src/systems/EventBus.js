/**
 * EventBus.js
 * A tiny, dependency-free event emitter with the same surface as
 * Phaser.Events.EventEmitter (on / once / off / emit). Every scene emits
 * gameplay events (EVENT_COIN_COLLECTED, ...) onto ONE shared bus so systems
 * such as QuestManager keep listening while scenes start and stop.
 *
 * It is intentionally framework-free so the systems stay unit-testable in Node.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Array<{fn: Function, ctx: any, once: boolean}>>} */
    this._listeners = new Map();
  }

  /** Subscribe `fn` to `event`. Returns `this` for chaining. */
  on(event, fn, ctx = null) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push({ fn, ctx, once: false });
    return this;
  }

  /** Subscribe for a single emission only. */
  once(event, fn, ctx = null) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push({ fn, ctx, once: true });
    return this;
  }

  /** Unsubscribe. Omitting `fn` removes every listener for `event`. */
  off(event, fn, ctx) {
    const list = this._listeners.get(event);
    if (!list) return this;
    if (!fn) {
      this._listeners.delete(event);
      return this;
    }
    const next = list.filter((l) => !(l.fn === fn && (ctx === undefined || l.ctx === ctx)));
    if (next.length) this._listeners.set(event, next);
    else this._listeners.delete(event);
    return this;
  }

  /** Emit `event` with any number of arguments. Listener errors are isolated. */
  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list || !list.length) return false;
    for (const l of [...list]) {
      if (l.once) this.off(event, l.fn, l.ctx);
      try {
        l.fn.apply(l.ctx, args);
      } catch (err) {
        console.error(`[EventBus] listener for "${event}" threw`, err);
      }
    }
    return true;
  }

  /** Remove every listener bound to `ctx` (handy in a scene's shutdown handler). */
  offContext(ctx) {
    for (const [event, list] of this._listeners) {
      const next = list.filter((l) => l.ctx !== ctx);
      if (next.length) this._listeners.set(event, next);
      else this._listeners.delete(event);
    }
  }
}
