/**
 * AudioController.js
 * Every sound in the game is synthesised at runtime with the Web Audio API -
 * oscillators, filtered noise and envelopes. No MP3/OGG files ship with the app.
 *
 * Mobile browsers start AudioContexts suspended; `unlock()` is wired to the
 * first pointer/key event in main.js.
 */
const NOTE = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

/** C-major pentatonic melodies (semitones from A4) for the two music loops. */
const MUSIC = {
  menu: {
    bpm: 96,
    lead: [3, null, 7, 10, 12, null, 10, 7, 5, null, 7, 3, 0, null, null, null],
    bass: [-21, null, null, null, -16, null, null, null, -14, null, null, null, -16, null, null, null]
  },
  run: {
    bpm: 156,
    lead: [15, 12, 10, 12, 15, null, 17, 15, 12, 10, 7, 10, 12, null, 10, null],
    bass: [-21, null, -9, null, -16, null, -4, null, -14, null, -2, null, -16, null, -4, null]
  }
};

export class AudioController {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.muted = false;
    this.musicEnabled = true;
    this._noiseBuffer = null;
    this._musicTimer = null;
    this._musicTrack = null;
    this._step = 0;
    this._nextStepTime = 0;
    this._coinCombo = 0;
    this._lastCoinTime = 0;
  }

  /** Lazily builds the audio graph: sfx + music -> master -> destination. */
  _ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.22;
    this.musicBus.connect(this.master);

    // One second of white noise reused by every percussive / whoosh effect.
    const len = this.ctx.sampleRate;
    this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this._noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  /** Resumes the context after a user gesture (required on iOS/Android). */
  unlock() {
    const ctx = this._ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  /** Pauses all audio when the app goes to background. */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (!enabled) this.stopMusic();
  }

  get _ready() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  // ------------------------------------------------------------------ primitives

  /**
   * Plays one enveloped oscillator note.
   * @param {object} o
   * @param {number} o.freq      start frequency (Hz)
   * @param {number} [o.to]      end frequency for a pitch slide
   * @param {number} [o.dur]     seconds
   * @param {OscillatorType} [o.type]
   * @param {number} [o.vol]
   * @param {number} [o.delay]   seconds from now
   * @param {AudioNode} [o.bus]
   */
  tone({ freq, to, dur = 0.15, type = 'square', vol = 0.25, delay = 0, attack = 0.005, bus }) {
    if (!this._ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Band-passed noise burst (whooshes, tearing foil, crashes). */
  noise({ dur = 0.2, freq = 1200, q = 1, vol = 0.3, delay = 0, type = 'bandpass', sweepTo }) {
    if (!this._ready) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Plays a sequence of notes (semitone offsets from A4). */
  arpeggio(semis, { step = 0.07, type = 'triangle', vol = 0.22, dur = 0.18, delay = 0 } = {}) {
    semis.forEach((s, i) => this.tone({ freq: NOTE(s), dur, type, vol, delay: delay + i * step }));
  }

  // ------------------------------------------------------------------ game sfx

  play(name, arg) {
    const fn = this[`sfx_${name}`];
    if (fn) fn.call(this, arg);
  }

  sfx_click() {
    this.tone({ freq: 880, to: 1320, dur: 0.06, type: 'triangle', vol: 0.18 });
  }
  sfx_error() {
    this.tone({ freq: 220, to: 160, dur: 0.18, type: 'square', vol: 0.15 });
  }
  sfx_jump() {
    this.tone({ freq: 330, to: 760, dur: 0.16, type: 'square', vol: 0.14 });
  }
  sfx_doubleJump() {
    this.tone({ freq: 520, to: 1200, dur: 0.14, type: 'square', vol: 0.12 });
    this.noise({ dur: 0.12, freq: 2400, q: 2, vol: 0.08 });
  }
  sfx_land() {
    this.tone({ freq: 140, to: 60, dur: 0.09, type: 'sine', vol: 0.3 });
  }
  sfx_slide() {
    this.noise({ dur: 0.35, freq: 600, sweepTo: 2400, q: 0.8, vol: 0.15 });
  }
  /** Coin "ding" whose pitch climbs while you chain coins quickly. */
  sfx_coin() {
    const now = performance.now();
    this._coinCombo = now - this._lastCoinTime < 350 ? Math.min(this._coinCombo + 1, 12) : 0;
    this._lastCoinTime = now;
    const base = NOTE(15 + this._coinCombo);
    this.tone({ freq: base, dur: 0.08, type: 'square', vol: 0.09 });
    this.tone({ freq: base * 1.5, dur: 0.16, type: 'sine', vol: 0.12, delay: 0.05 });
  }
  sfx_ticket() {
    this.arpeggio([12, 16, 19, 24], { step: 0.06, type: 'triangle', vol: 0.2 });
  }
  sfx_powerup() {
    this.arpeggio([0, 4, 7, 12, 16, 19], { step: 0.045, type: 'square', vol: 0.12, dur: 0.12 });
  }
  sfx_shieldBreak() {
    this.noise({ dur: 0.4, freq: 3000, sweepTo: 400, q: 3, vol: 0.25 });
    this.tone({ freq: 900, to: 300, dur: 0.3, type: 'sawtooth', vol: 0.1 });
  }
  sfx_crash() {
    this.noise({ dur: 0.5, freq: 800, sweepTo: 120, q: 0.7, vol: 0.4, type: 'lowpass' });
    this.tone({ freq: 300, to: 50, dur: 0.6, type: 'sawtooth', vol: 0.2 });
  }
  sfx_dodge() {
    this.tone({ freq: 1200, dur: 0.04, type: 'sine', vol: 0.05 });
  }
  sfx_boxDrop() {
    this.tone({ freq: 180, to: 70, dur: 0.18, type: 'sine', vol: 0.4 });
    this.noise({ dur: 0.1, freq: 400, vol: 0.15 });
  }
  /** Foil tearing - a short crackle per swipe step. */
  sfx_tear() {
    this.noise({ dur: 0.07, freq: 3500 + Math.random() * 2000, q: 4, vol: 0.18 });
  }
  /** Box rattle; `level` 1..3 increases pitch & volume with each shake. */
  sfx_shake(level = 1) {
    for (let i = 0; i < 4; i++) {
      this.noise({ dur: 0.05, freq: 900 + level * 400, q: 5, vol: 0.12 + level * 0.06, delay: i * 0.06 });
      this.tone({ freq: 200 + level * 60, dur: 0.05, type: 'square', vol: 0.05 + level * 0.02, delay: i * 0.06 });
    }
  }
  /** Tiered reveal fanfare: brighter and longer the rarer the pull. */
  sfx_reveal(rarity = 'common') {
    const chords = {
      common: [0, 4, 7],
      rare: [0, 4, 7, 12],
      epic: [0, 4, 7, 11, 14, 19],
      secret: [0, 4, 7, 12, 16, 19, 24, 28]
    };
    this.noise({ dur: 0.5, freq: 5000, sweepTo: 800, q: 0.5, vol: 0.2, type: 'highpass' });
    this.arpeggio(chords[rarity] || chords.common, { step: 0.08, type: 'triangle', vol: 0.22, dur: 0.5 });
    if (rarity === 'epic' || rarity === 'secret') {
      this.arpeggio(chords[rarity].map((s) => s + 12), { step: 0.08, type: 'square', vol: 0.06, dur: 0.4, delay: 0.04 });
    }
    if (rarity === 'secret') {
      for (let i = 0; i < 10; i++) {
        this.tone({ freq: NOTE(24 + Math.floor(Math.random() * 12)), dur: 0.12, type: 'sine', vol: 0.08, delay: 0.7 + i * 0.07 });
      }
    }
  }
  sfx_questComplete() {
    this.arpeggio([7, 12, 16, 19], { step: 0.09, type: 'square', vol: 0.1, dur: 0.2 });
  }
  /** Cash-register "ka-ching" for idle bank claims. */
  sfx_cash() {
    this.noise({ dur: 0.08, freq: 2500, q: 3, vol: 0.2 });
    this.tone({ freq: NOTE(19), dur: 0.35, type: 'sine', vol: 0.18, delay: 0.08 });
    this.tone({ freq: NOTE(24), dur: 0.45, type: 'sine', vol: 0.15, delay: 0.14 });
  }
  // ---- kart-style extras
  sfx_countdown() {
    this.tone({ freq: NOTE(-2), dur: 0.22, type: 'square', vol: 0.16 });
  }
  sfx_go() {
    this.tone({ freq: NOTE(10), dur: 0.5, type: 'square', vol: 0.16 });
    this.tone({ freq: NOTE(14), dur: 0.5, type: 'triangle', vol: 0.14 });
  }
  sfx_rocket() {
    this.noise({ dur: 0.6, freq: 500, sweepTo: 3000, q: 0.7, vol: 0.3 });
    this.arpeggio([0, 7, 12, 19], { step: 0.05, type: 'square', vol: 0.12, dur: 0.15 });
  }
  sfx_boost() {
    this.noise({ dur: 0.45, freq: 400, sweepTo: 2600, q: 0.9, vol: 0.25 });
    this.tone({ freq: 220, to: 660, dur: 0.35, type: 'sawtooth', vol: 0.08 });
  }
  sfx_itemBox() {
    this.arpeggio([12, 16, 19, 24, 28], { step: 0.035, type: 'triangle', vol: 0.15, dur: 0.12 });
  }
  sfx_roulette() {
    this.tone({ freq: NOTE(19 + Math.floor(Math.random() * 5)), dur: 0.04, type: 'square', vol: 0.06 });
  }
  sfx_itemGet() {
    this.arpeggio([7, 11, 14, 19], { step: 0.05, type: 'square', vol: 0.12, dur: 0.14 });
  }
  sfx_star() {
    this.arpeggio([0, 4, 7, 12, 16, 19, 24, 28], { step: 0.04, type: 'square', vol: 0.1, dur: 0.12 });
  }
  sfx_closeCall() {
    this.tone({ freq: 900, to: 1800, dur: 0.12, type: 'triangle', vol: 0.12 });
  }
  sfx_combo() {
    this.arpeggio([12, 19, 24], { step: 0.05, type: 'triangle', vol: 0.14, dur: 0.16 });
  }
  sfx_smash() {
    this.noise({ dur: 0.25, freq: 900, sweepTo: 200, q: 1, vol: 0.3, type: 'lowpass' });
    this.tone({ freq: 400, to: 120, dur: 0.18, type: 'square', vol: 0.12 });
  }

  sfx_lane() {
    this.noise({ dur: 0.12, freq: 1800, sweepTo: 600, q: 1.2, vol: 0.12 });
  }
  sfx_bump() {
    this.tone({ freq: 160, to: 90, dur: 0.16, type: 'square', vol: 0.18 });
    this.noise({ dur: 0.1, freq: 500, vol: 0.15 });
  }
  sfx_letter() {
    this.arpeggio([12, 19, 24, 31], { step: 0.05, type: 'triangle', vol: 0.18, dur: 0.2 });
  }
  sfx_wordComplete() {
    this.arpeggio([0, 4, 7, 12, 16, 19, 24, 28, 31, 36], { step: 0.07, type: 'square', vol: 0.12, dur: 0.25 });
    this.arpeggio([12, 16, 19, 24], { step: 0.14, type: 'triangle', vol: 0.16, dur: 0.5, delay: 0.75 });
  }
  /** Escalating praise jingle: each level climbs a little higher. */
  sfx_praise(level = 0) {
    const base = 7 + level * 2;
    this.arpeggio([base, base + 4, base + 7, base + 12], { step: 0.055, type: 'square', vol: 0.11, dur: 0.16 });
  }
  sfx_spinTick() {
    this.tone({ freq: 1400, dur: 0.025, type: 'square', vol: 0.06 });
  }
  sfx_spinWin() {
    this.arpeggio([0, 7, 12, 16, 19, 24], { step: 0.08, type: 'triangle', vol: 0.2, dur: 0.35 });
  }

  sfx_highScore() {
    this.arpeggio([0, 4, 7, 12, 7, 12, 16, 24], { step: 0.09, type: 'square', vol: 0.12, dur: 0.22 });
  }

  // ------------------------------------------------------------------ music

  /**
   * Starts a looping chiptune track. Uses a look-ahead scheduler (setInterval
   * + AudioContext clock) so timing stays tight even if the frame rate drops.
   */
  playMusic(track = 'menu') {
    if (!this.musicEnabled) return;
    this._ensureContext();
    if (!this.ctx) return;
    if (this._musicTrack === track && this._musicTimer) return;
    this.stopMusic();
    this._musicTrack = track;
    this._step = 0;
    this._nextStepTime = this.ctx.currentTime + 0.1;
    this._musicTimer = setInterval(() => this._scheduleMusic(), 50);
  }

  stopMusic() {
    clearInterval(this._musicTimer);
    this._musicTimer = null;
    this._musicTrack = null;
  }

  _scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const song = MUSIC[this._musicTrack];
    if (!song) return;
    const stepDur = 60 / song.bpm / 2; // eighth notes
    while (this._nextStepTime < this.ctx.currentTime + 0.2) {
      const i = this._step % song.lead.length;
      const delay = Math.max(0, this._nextStepTime - this.ctx.currentTime);
      const lead = song.lead[i];
      const bass = song.bass[i];
      if (lead !== null && !this.muted) {
        this.tone({ freq: NOTE(lead), dur: stepDur * 0.9, type: 'triangle', vol: 0.5, delay, bus: this.musicBus });
      }
      if (bass !== null && !this.muted) {
        this.tone({ freq: NOTE(bass), dur: stepDur * 1.8, type: 'square', vol: 0.25, delay, bus: this.musicBus });
      }
      // Soft hi-hat on off-beats while running.
      if (this._musicTrack === 'run' && i % 2 === 1 && this._ready) {
        this.noise({ dur: 0.03, freq: 8000, q: 1, vol: 0.03, delay, type: 'highpass' });
      }
      this._nextStepTime += stepDur;
      this._step++;
    }
  }
}
