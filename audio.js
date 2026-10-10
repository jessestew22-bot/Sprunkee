// Sprunkee audio engine: a tiny Web Audio synth + step sequencer.
// Everything is synthesized live; there are no audio files.
'use strict';

// Stages ("tracks"). Every part is written in scale degrees, so each stage re-harmonizes the whole band.
// Order matters: the index is stored in share codes. Append only.
const THEMES = {
  day:    { tonic: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], bpm: 110, rev: 0.22, dark: false }, // C major  I-V-vi-IV
  night:  { tonic: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 4, 5, 3], bpm: 110, rev: 0.38, dark: true },  // A minor  i-v-VI-iv
  beach:  { tonic: 65, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 3], bpm: 96, rev: 0.3, dark: false },  // F major  I-IV-V-IV
  candy:  { tonic: 67, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], bpm: 124, rev: 0.2, dark: false }, // G major  I-vi-IV-V
  space:  { tonic: 62, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 4], bpm: 118, rev: 0.45, dark: true }, // D dorian i-IV-VII-v
  snow:   { tonic: 63, scale: [0, 2, 4, 5, 7, 9, 11], prog: [5, 3, 0, 4], bpm: 104, rev: 0.4, dark: false }, // Eb major vi-IV-I-V
};
const STAGE_IDS = Object.keys(THEMES);

const VOWELS = {
  a: [[730, 1], [1090, 0.5], [2440, 0.22]],
  e: [[530, 1], [1840, 0.45], [2480, 0.25]],
  i: [[300, 1], [2290, 0.35], [3010, 0.2]],
  o: [[570, 1], [840, 0.55], [2410, 0.15]],
  u: [[320, 1], [870, 0.35], [2240, 0.1]],
};
// Where the formants start for each consonant before gliding to the vowel.
const CONSONANTS = {
  b: { f: [250, 700, 2000], glide: 0.035 },
  d: { f: [250, 1700, 2600], glide: 0.03 },
  l: { f: [350, 1100, 2600], glide: 0.07 },
  m: { f: [250, 900, 2200], glide: 0.06, hum: 0.05 },
  w: { f: [300, 650, 2200], glide: 0.09 },
  y: { f: [280, 2200, 3000], glide: 0.08 },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Engine {
  constructor(ctx) {
    this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    this.bpm = 110;
    this.theme = THEMES.day;
    this.themeName = 'day';
    this.pendingTheme = null;
    this.step = 0;           // global 16th-note counter
    this.nextTime = 0;
    this.running = false;
    this.channels = [];
    this.hits = [];          // visual events {slot, time, v}
    this.beatTimes = [];     // {time, step}
    this.extras = [];        // one-shot layers e.g. bonus fanfare: {fn, startStep, len}
    this.listeners = {};
    this._buildBus();
  }

  get stepDur() { return 60 / this.bpm / 4; }

  on(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); }
  emit(evt, data) { (this.listeners[evt] || []).forEach((f) => f(data)); }

  _buildBus() {
    const c = this.ctx;
    this.bus = c.createGain();
    this.bus.gain.value = 0.8;

    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3.5;
    comp.attack.value = 0.006; comp.release.value = 0.18;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.08;
    this.master = c.createGain();
    this.master.gain.value = 0.95;

    this.bus.connect(comp); comp.connect(lim); lim.connect(this.master);
    this.master.connect(c.destination);

    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 256;
    this.master.connect(this.analyser);

    // Reverb: generated impulse response.
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.2);
    this.revIn = c.createGain();
    this.revIn.gain.value = this.theme.rev;
    const revHp = c.createBiquadFilter(); revHp.type = 'highpass'; revHp.frequency.value = 250;
    this.revIn.connect(revHp); revHp.connect(this.reverb); this.reverb.connect(this.bus);

    // Tempo-synced ping-pong-ish delay (dotted 8th).
    this.dlyIn = c.createGain(); this.dlyIn.gain.value = 0.5;
    const d = c.createDelay(2); d.delayTime.value = this.stepDur * 3;
    const fb = c.createGain(); fb.gain.value = 0.35;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
    const dpan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if (dpan.pan) dpan.pan.value = 0.35;
    this.dlyIn.connect(d); d.connect(dlp); dlp.connect(fb); fb.connect(d);
    dlp.connect(dpan); dpan.connect(this.bus);
    this.delayNode = d;

    this.noise = this._noiseBuf();
  }

  _impulse(seconds, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _noiseBuf() {
    const c = this.ctx, len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------- channels ----------
  makeChannel(slot, pan) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = 1;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    const rev = c.createGain(); rev.gain.value = 0;
    const dly = c.createGain(); dly.gain.value = 0;
    const pump = c.createGain(); pump.gain.value = 1;
    g.connect(pump);
    if (p) { p.pan.value = pan; pump.connect(p); p.connect(this.bus); } else pump.connect(this.bus);
    pump.connect(rev); rev.connect(this.revIn);
    pump.connect(dly); dly.connect(this.dlyIn);
    const ch = { slot, input: g, pump, rev, dly, sound: null, startStep: 0, muted: false };
    this.channels[slot] = ch;
    return ch;
  }

  setSound(slot, sound) {
    const ch = this.channels[slot];
    const t = this.ctx.currentTime;
    ch.sound = sound;
    ch.muted = false;
    if (sound) {
      // Nothing playing yet? Start the song from the top right away.
      if (!this.channels.some((o) => o !== ch && o.sound && !o.muted)) {
        this.step = 0;
        this.nextTime = t + 0.06;
        this.channels.forEach((o) => { if (o) o.startStep = 0; });
      }
      ch.startStep = Math.ceil(this.step / 4) * 4; // next beat
      ch.rev.gain.setValueAtTime(sound.rev || 0.15, t);
      ch.dly.gain.setValueAtTime(sound.dly || 0, t);
      ch.input.gain.cancelScheduledValues(t);
      ch.input.gain.setValueAtTime(sound.vol || 1, t);
      ch.pump.gain.cancelScheduledValues(t);
      ch.pump.gain.setValueAtTime(1, t);
    }
  }

  setMuted(slot, m) {
    const ch = this.channels[slot];
    ch.muted = m;
    const t = this.ctx.currentTime, gp = ch.input.gain;
    gp.cancelScheduledValues(t);
    gp.setTargetAtTime(m ? 0 : (ch.sound && ch.sound.vol) || 1, t, 0.03);
  }

  setTheme(name) { this.pendingTheme = name; }
  // Switch right away (used when the stage is silent, and for loading shared jams).
  forceTheme(name) {
    this.pendingTheme = null;
    this.themeName = name; this.theme = THEMES[name];
    this.bpm = this.theme.bpm;
    this.delayNode.delayTime.value = this.stepDur * 3;
    this.revIn.gain.value = this.theme.rev;
  }

  // ---------- music theory ----------
  barOf(step) { return Math.floor(step / 16) % 4; }
  deg(d, oct = 0) {
    const s = this.theme.scale, n = s.length;
    const o = Math.floor(d / n), r = ((d % n) + n) % n;
    return this.theme.tonic + 12 * (o + oct) + s[r];
  }
  chordRoot(step) { return this.theme.prog[this.barOf(step)]; }
  // k-th chord tone (0=root, 1=third, 2=fifth, 3=root+8va ...) as a scale degree
  chordDeg(step, k) {
    const r = this.chordRoot(step), m = ((k % 3) + 3) % 3;
    return r + 2 * m + 7 * Math.floor(k / 3);
  }
  chordNote(step, k, oct = 0) { return this.deg(this.chordDeg(step, k), oct); }

  // ---------- transport ----------
  start() {
    if (this.running) return;
    this.running = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    const tick = () => {
      if (!this.running) return;
      this._schedule();
      this._timer = setTimeout(tick, 25);
    };
    tick();
  }
  stop() { this.running = false; clearTimeout(this._timer); }

  _schedule() {
    const ahead = this.ctx.currentTime + 0.14;
    while (this.nextTime < ahead) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step++;
    }
  }

  // Schedules everything for one 16th step. Public so tests can render offline.
  playStep(step, t) {
    if (step % 16 === 0 && this.pendingTheme) {
      this.themeName = this.pendingTheme;
      this.theme = THEMES[this.pendingTheme];
      this.pendingTheme = null;
      this.revIn.gain.setTargetAtTime(this.theme.rev, t, 0.3);
      if (this.theme.bpm !== this.bpm) {
        this.bpm = this.theme.bpm;
        this.delayNode.delayTime.setTargetAtTime(this.stepDur * 3, t, 0.05);
      }
      this.emit('theme', { name: this.themeName, time: t });
    }
    if (step % 64 === 0) this.emit('loop', { step, time: t });
    if (step % 16 === 0) this.emit('bar', { step, time: t, secs: this.stepDur * 16 });
    if (step % 4 === 0) this.beatTimes.push({ time: t, step });
    const s16 = step % 16, bar = this.barOf(step);
    for (const ch of this.channels) {
      if (!ch || !ch.sound || step < ch.startStep) continue;
      const S = this._S(step, t, s16, bar, ch.input, ch.pump, (v) => { if (!ch.muted) this.hits.push({ slot: ch.slot, time: t, v }); });
      ch.sound.play(this, S);
    }
    this.extras = this.extras.filter((x) => step < x.startStep + x.len);
    for (const x of this.extras) {
      if (step >= x.startStep) x.fn(this, this._S(step, t, s16, bar, this.bus, null, () => {}), step - x.startStep);
    }
  }

  _S(step, t, s16, bar, out, pump, hit) {
    return { step, t, s16, bar, out, pump, hit, night: !!this.theme.dark, stage: this.themeName, sd: this.stepDur };
  }

  // ---------- instrument primitives ----------
  _env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + rel);
    return t + Math.max(a, dur) + rel + 0.05;
  }

  noiseSrc(t, end) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    n.start(t, Math.random() * 1.5);
    n.stop(end);
    return n;
  }

  kick(out, t, v = 1, { f0 = 150, f1 = 45, len = 0.42 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    g.gain.setValueAtTime(v * 1.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + len + 0.05);
    // click
    const n = this.noiseSrc(t, t + 0.02), ng = c.createGain(), hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    ng.gain.setValueAtTime(v * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    n.connect(hp); hp.connect(ng); ng.connect(out);
  }

  snap(out, t, v = 1, { freq = 1500, q = 0.9, len = 0.18, tone = 0, claps = 3 } = {}) {
    const c = this.ctx, bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const n = this.noiseSrc(t, t + len + 0.1);
    n.connect(bp); bp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    // multiple quick bursts = hand clap
    for (let i = 0; i < claps; i++) {
      const ti = t + i * 0.011;
      g.gain.setValueAtTime(v * 0.9, ti);
      g.gain.exponentialRampToValueAtTime(v * 0.2, ti + 0.009);
    }
    g.gain.setValueAtTime(v * 0.8, t + claps * 0.011);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    if (tone) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(tone, t);
      o.frequency.exponentialRampToValueAtTime(tone * 0.6, t + 0.08);
      og.gain.setValueAtTime(v * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
    }
  }

  hat(out, t, v = 1, open = false) {
    const c = this.ctx, hp = c.createBiquadFilter(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    const len = open ? 0.25 : 0.045;
    const n = this.noiseSrc(t, t + len + 0.05);
    n.connect(hp); hp.connect(g); g.connect(out);
    g.gain.setValueAtTime(v * 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
  }

  tom(out, t, freq, v = 1, len = 0.25) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05);
    const n = this.noiseSrc(t, t + 0.04), ng = c.createGain(), bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq * 4; bp.Q.value = 2;
    ng.gain.setValueAtTime(v * 0.35, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    n.connect(bp); bp.connect(ng); ng.connect(out);
  }

  crash(out, t, v = 1) {
    const c = this.ctx, hp = c.createBiquadFilter(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 4500;
    const n = this.noiseSrc(t, t + 2.2);
    n.connect(hp); hp.connect(g); g.connect(out);
    g.gain.setValueAtTime(v * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2);
  }

  // General subtractive synth voice.
  tone(out, t, midi, dur, o = {}) {
    const c = this.ctx;
    const {
      type = 'sawtooth', a = 0.005, rel = 0.15, v = 0.3, cutoff = 4000, q = 1,
      fenv = 0, fdecay = 0.2, detune = 0, voices = 1, vib = 0, vibRate = 5.5, glideFrom = null, pan = null, decayTo = null,
    } = o;
    const f = mtof(midi);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = q;
    lp.frequency.setValueAtTime(cutoff + fenv, t);
    if (fenv) lp.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff), t + fdecay);
    const g = c.createGain();
    let dest = out;
    if (pan !== null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; p.connect(out); dest = p; }
    lp.connect(g); g.connect(dest);
    let end;
    if (decayTo !== null) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v * decayTo), t + a + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur + rel);
      end = t + a + dur + rel + 0.05;
    } else end = this._env(g, t, a, v, dur, rel);
    let lfo = null;
    if (vib) {
      lfo = c.createOscillator(); const lg = c.createGain();
      lfo.frequency.value = vibRate;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * vib, t + Math.min(0.3, dur));
      lfo.connect(lg); lfo._g = lg; lfo.start(t); lfo.stop(end);
    }
    for (let i = 0; i < voices; i++) {
      const osc = c.createOscillator();
      osc.type = type;
      if (glideFrom !== null) {
        osc.frequency.setValueAtTime(mtof(glideFrom), t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      } else osc.frequency.setValueAtTime(f, t);
      osc.detune.value = voices > 1 ? (i - (voices - 1) / 2) * detune : detune;
      if (lfo) lfo._g.connect(osc.frequency);
      const vg = c.createGain(); vg.gain.value = 1 / Math.sqrt(voices);
      osc.connect(vg); vg.connect(lp);
      osc.start(t); osc.stop(end);
    }
  }

  // Mallet: sine + inharmonic partial with fast decay (marimba / bell).
  mallet(out, t, midi, v = 0.4, { ratio = 4, pv = 0.3, len = 0.6, plen = 0.08, type = 'sine' } = {}) {
    const c = this.ctx, f = mtof(midi);
    [[1, v, len], [ratio, v * pv, plen]].forEach(([r, amp, l]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + l);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + l + 0.05);
    });
  }

  // FM bell / electric piano.
  fm(out, t, midi, dur, { v = 0.3, ratio = 3.5, index = 2, idecay = 0.5, rel = 0.6, type = 'sine' } = {}) {
    const c = this.ctx, f = mtof(midi);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.type = type; car.frequency.value = f;
    mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t);
    mg.gain.exponentialRampToValueAtTime(f * index * 0.05 + 0.01, t + idecay);
    mod.connect(mg); mg.connect(car.frequency);
    car.connect(g); g.connect(out);
    const end = this._env(g, t, 0.004, v, dur, rel);
    car.start(t); mod.start(t); car.stop(end); mod.stop(end);
  }

  // Formant "singing" voice: a buzzy source through three vowel filters.
  voice(out, t, midi, dur, vowel = 'a', o = {}) {
    const c = this.ctx;
    const { v = 0.5, cons = null, vib = 0.012, a = 0.025, rel = 0.12, glideFrom = null, shout = false, breath = 0.04, to = null } = o;
    const f = mtof(midi);
    const src = c.createOscillator();
    src.type = 'sawtooth';
    if (glideFrom !== null) {
      src.frequency.setValueAtTime(mtof(glideFrom), t);
      src.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    } else src.frequency.setValueAtTime(f, t);
    if (shout) src.frequency.exponentialRampToValueAtTime(f * 0.82, t + dur + rel);
    const src2 = c.createOscillator();
    src2.type = 'square'; src2.frequency.value = f; src2.detune.value = 6;
    const s2g = c.createGain(); s2g.gain.value = 0.25;
    src2.connect(s2g);

    const g = c.createGain();
    const end = this._env(g, t, a, v, dur, rel);
    // vibrato
    if (vib) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 5.2 + Math.random() * 0.6;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * vib, t + Math.min(0.35, dur));
      lfo.connect(lg); lg.connect(src.frequency); lg.connect(src2.frequency);
      lfo.start(t); lfo.stop(end);
    }
    const hi = midi > 66 ? 1.12 : 1; // brighter formants for high voices
    const V = VOWELS[vowel], V2 = to ? VOWELS[to] : null, C = cons ? CONSONANTS[cons] : null;
    const sum = c.createGain(); sum.gain.value = 3.2;
    V.forEach(([ff, amp], i) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      const target = ff * hi;
      bp.Q.value = (target / (i === 0 ? 90 : 120));
      if (C) {
        bp.frequency.setValueAtTime(C.f[i], t);
        bp.frequency.linearRampToValueAtTime(target, t + C.glide);
      } else bp.frequency.setValueAtTime(target, t);
      if (V2) bp.frequency.linearRampToValueAtTime(V2[i][0] * hi, t + dur);
      const ag = c.createGain(); ag.gain.value = amp;
      src.connect(bp); s2g.connect(bp); bp.connect(ag); ag.connect(sum);
    });
    // a bit of the raw source so it stays audible on small speakers
    const raw = c.createBiquadFilter(); raw.type = 'lowpass'; raw.frequency.value = 900;
    const rg = c.createGain(); rg.gain.value = 0.12;
    src.connect(raw); raw.connect(rg); rg.connect(sum);
    sum.connect(g); g.connect(out);
    src.start(t); src2.start(t); src.stop(end); src2.stop(end);
    // breath / consonant noise
    if (breath || shout) {
      const n = this.noiseSrc(t, t + 0.12), ng = c.createGain(), bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = shout ? 1800 : 3500; bp.Q.value = 1;
      const bv = shout ? v * 0.9 : v * breath * 4;
      ng.gain.setValueAtTime(bv, t); ng.gain.exponentialRampToValueAtTime(0.001, t + (shout ? 0.09 : 0.04));
      n.connect(bp); bp.connect(ng); ng.connect(out);
    }
  }

  // Filtered-noise swoosh.
  swoosh(out, t, len, { from = 300, to = 6000, v = 0.3, q = 4 } = {}) {
    const c = this.ctx, bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + len);
    const n = this.noiseSrc(t, t + len + 0.1);
    n.connect(bp); bp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + len * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  }

  // Pitch sweep blip (zaps, bubbles).
  blip(out, t, f0, f1, len, { type = 'sine', v = 0.3, pan = null } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    let dest = out;
    if (pan !== null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; p.connect(out); dest = p; }
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + 0.03);
  }

  level() {
    const a = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(a);
    let s = 0;
    for (let i = 0; i < a.length; i++) { const x = (a[i] - 128) / 128; s += x * x; }
    return Math.sqrt(s / a.length);
  }
}

window.Engine = Engine;
window.THEMES = THEMES;
window.STAGE_IDS = STAGE_IDS;
window.mtof = mtof;
