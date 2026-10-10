// The 20 Sprunkee sounds. Every melodic part is written in scale degrees / chord tones,
// so the whole band re-harmonizes itself when you switch between Day and Night.
'use strict';

const CATS = [
  { id: 'beat', name: 'Beats', color: '#ff5d73' },
  { id: 'fx', name: 'Effects', color: '#2fd38a' },
  { id: 'melody', name: 'Melody', color: '#3aa8ff' },
  { id: 'voice', name: 'Voices', color: '#b46bff' },
];

// 'x..x' style pattern helper: returns char at the step in bar.
const pat = (s, i) => s[i % s.length];

// Main theme (leitmotif), [step, degree, length] per bar. Shared by Dingle and the bonus fanfare.
const THEME_MELODY = [
  [[0, 2, 2], [2, 4, 2], [4, 5, 2], [6, 4, 4], [10, 2, 2], [12, 0, 4]],
  [[0, 1, 2], [2, -1, 2], [4, 1, 2], [6, 4, 4], [10, 3, 2], [12, 1, 4]],
  [[0, 0, 2], [2, 2, 2], [4, 5, 2], [6, 4, 2], [8, 2, 4], [12, 0, 2], [14, 2, 2]],
  [[0, 3, 3], [3, 2, 3], [6, 0, 2], [8, 1, 2], [10, 2, 2], [12, 4, 4]],
];
const LALA_MELODY = [
  [[0, 7, 2], [2, 7, 2], [4, 6, 2], [6, 4, 6]],
  [[0, 6, 2], [2, 6, 2], [4, 5, 2], [6, 4, 6]],
  [[0, 7, 2], [2, 7, 2], [4, 9, 2], [6, 7, 6]],
  [[0, 8, 2], [2, 7, 2], [4, 5, 2], [6, 4, 8]],
];
const melodyAt = (mel, S) => mel[S.bar].filter((n) => n[0] === S.s16);

const SOUNDS = [
  // ---------------- BEATS ----------------
  {
    id: 'boomo', name: 'Boomo', cat: 'beat', color: '#ff4d5e',
    look: { shape: 'round', acc: 'headphones', eyes: 'big', mouth: 'grin' },
    vol: 1, rev: 0.02,
    play(e, S) {
      const p = S.bar === 3 ? 'x...x...x...x.x.' : 'x...x...x...x...';
      if (pat(p, S.s16) === 'x') { e.kick(S.out, S.t, S.s16 === 14 ? 0.7 : 1); S.hit(1); }
    },
  },
  {
    id: 'clappy', name: 'Clappy', cat: 'beat', color: '#ff8a3d',
    look: { shape: 'tall', acc: 'cap', eyes: 'happy', mouth: 'o' },
    vol: 0.9, rev: 0.25,
    play(e, S) {
      const p = S.bar === 3 ? '....x.......x.xx' : '....x.......x...';
      if (pat(p, S.s16) === 'x') {
        const ghost = S.s16 > 12;
        e.snap(S.out, S.t, ghost ? 0.45 : 0.9, { freq: 1400, tone: ghost ? 0 : 190 });
        S.hit(ghost ? 0.5 : 1);
      }
    },
  },
  {
    id: 'tikka', name: 'Tikka', cat: 'beat', color: '#ff6f91',
    look: { shape: 'pear', acc: 'antenna', eyes: 'big', mouth: 'smile' },
    vol: 0.75, rev: 0.08, dly: 0.05,
    play(e, S) {
      const v = [1, 0.35, 0.6, 0.35, 1, 0.35, 0.6, 0.5, 1, 0.35, 0.6, 0.35, 1, 0.35, 0.6, 0.6][S.s16];
      const open = S.s16 === 6 || S.s16 === 14;
      // a little swing on the off-16ths
      const t = S.t + (S.s16 % 2 ? S.sd * 0.12 : 0);
      e.hat(S.out, t, v * (S.night ? 0.8 : 1), open);
      if (S.s16 % 4 === 0 || open) S.hit(open ? 0.8 : 0.5);
    },
  },
  {
    id: 'bizzy', name: 'Bizzy', cat: 'beat', color: '#e8364f',
    look: { shape: 'square', acc: 'mic', eyes: 'shades', mouth: 'grin' },
    vol: 0.9, rev: 0.12,
    play(e, S) {
      // human beatbox: "b" kicks, "pff" snares, "ts" ticks
      const p = 'b..t.pb.b.tbp.t.';
      const c = pat(p, S.s16);
      if (c === 'b') { e.kick(S.out, S.t, 0.75, { f0: 110, f1: 55, len: 0.2 }); S.hit(1); }
      if (c === 'p') { e.snap(S.out, S.t, 0.8, { freq: 2300, q: 0.6, len: 0.12, claps: 1, tone: 260 }); S.hit(1); }
      if (c === 't') { e.snap(S.out, S.t, 0.35, { freq: 6500, q: 1.5, len: 0.05, claps: 1 }); S.hit(0.4); }
    },
  },
  {
    id: 'bongo', name: 'Bongo', cat: 'beat', color: '#ffb02e',
    look: { shape: 'round', acc: 'bandana', eyes: 'happy', mouth: 'grin' },
    vol: 0.85, rev: 0.2,
    play(e, S) {
      const p = 'h.l.hh.lh.l.hlhl';
      const c = pat(p, S.s16);
      if (c === '.') return;
      const f = c === 'h' ? 330 : 220;
      e.tom(S.out, S.t, S.night ? f * 0.89 : f, S.s16 % 4 === 0 ? 0.85 : 0.6, c === 'h' ? 0.16 : 0.24);
      S.hit(c === 'h' ? 0.7 : 0.9);
    },
  },

  // ---------------- EFFECTS ----------------
  {
    id: 'wubby', name: 'Wubby', cat: 'fx', color: '#22c55e',
    look: { shape: 'square', acc: 'horns', eyes: 'big', mouth: 'grin' },
    vol: 0.75, rev: 0.03,
    play(e, S) {
      const p = 'x..x..x.x..x.x..';
      if (pat(p, S.s16) !== 'x') return;
      const up = S.s16 === 6 || S.s16 === 13;
      const m = e.deg(e.chordRoot(S.step), -2) + (up ? 12 : 0);
      e.tone(S.out, S.t, m, S.sd * (S.s16 === 0 ? 2 : 1.3), {
        type: 'sawtooth', v: 0.36, cutoff: 220, fenv: S.night ? 900 : 1500, fdecay: 0.12, q: 6, voices: 2, detune: 8, rel: 0.06,
      });
      e.tone(S.out, S.t, m - 12, S.sd * 1.5, { type: 'sine', v: 0.32, cutoff: 400, rel: 0.05 });
      S.hit(up ? 0.7 : 1);
    },
  },
  {
    id: 'zappo', name: 'Zappo', cat: 'fx', color: '#9be15d',
    look: { shape: 'tall', acc: 'zigzag', eyes: 'one', mouth: 'o' },
    vol: 0.95, rev: 0.15, dly: 0.35,
    play(e, S) {
      const hits = { 6: 3, 10: 2, 14: 4 };
      if (S.bar % 2 === 1 && hits[S.s16] !== undefined) {
        const f = mtof(e.chordNote(S.step, hits[S.s16], 1));
        e.blip(S.out, S.t, f * 2, f * 0.5, 0.18, { type: 'square', v: 0.22, pan: S.s16 === 10 ? -0.5 : 0.5 });
        S.hit(1);
      }
      if (S.bar % 2 === 0 && S.s16 === 14) {
        const f = mtof(e.chordNote(S.step, 4, 1));
        e.blip(S.out, S.t, f * 0.5, f * 2, 0.12, { type: 'square', v: 0.15 });
        S.hit(0.6);
      }
    },
  },
  {
    id: 'bloop', name: 'Bloop', cat: 'fx', color: '#14b8a6',
    look: { shape: 'round', acc: 'bubble', eyes: 'big', mouth: 'o' },
    vol: 0.7, rev: 0.35, dly: 0.25,
    play(e, S) {
      const seq = { 2: 2, 5: 4, 7: 3, 11: 5, 13: 2 };
      const k = seq[S.s16];
      if (k === undefined || (S.bar === 1 && S.s16 === 13)) return;
      const f = mtof(e.chordNote(S.step, k + (S.bar % 2), 1));
      e.blip(S.out, S.t, f * 0.6, f * 1.25, 0.09, { type: 'sine', v: 0.38, pan: Math.sin(S.step) * 0.6 });
      S.hit(0.8);
    },
  },
  {
    id: 'swish', name: 'Swish', cat: 'fx', color: '#5eead4',
    look: { shape: 'pear', acc: 'propeller', eyes: 'happy', mouth: 'smile' },
    vol: 1.1, rev: 0.4,
    play(e, S) {
      if (S.s16 === 0 && S.bar % 2 === 1) { e.swoosh(S.out, S.t, S.sd * 16, { from: 250, to: S.night ? 3500 : 7000, v: 0.22 }); }
      if (S.s16 === 0 && S.bar % 2 === 0) {
        // sparkle chime cascade on the downbeat
        for (let i = 0; i < 5; i++) {
          e.mallet(S.out, S.t + i * 0.06, e.chordNote(S.step, 6 + i, 1), 0.12, { ratio: 2.76, pv: 0.4, len: 0.9 });
        }
        S.hit(1);
      }
      if (S.s16 % 4 === 0) S.hit(0.3);
    },
  },
  {
    id: 'puffy', name: 'Puffy', cat: 'fx', color: '#4ade80',
    look: { shape: 'cloud', acc: 'sprout', eyes: 'sleepy', mouth: 'smile' },
    vol: 0.6, rev: 0.45,
    play(e, S) {
      if (S.s16 === 0) {
        for (let k = 0; k < 4; k++) {
          e.tone(S.out, S.t, e.chordNote(S.step, k, 0), S.sd * 15, {
            type: 'sawtooth', v: 0.09, a: 0.25, rel: 0.5, cutoff: S.night ? 900 : 1600, voices: 3, detune: 14,
          });
        }
      }
      // pump: the pad "breathes" with the beat
      if (S.s16 % 4 === 0 && S.pump) {
        S.pump.gain.cancelScheduledValues(S.t);
        S.pump.gain.setValueAtTime(0.25, S.t);
        S.pump.gain.linearRampToValueAtTime(1, S.t + S.sd * 3);
        S.hit(0.6);
      }
    },
  },

  // ---------------- MELODY ----------------
  {
    id: 'marimo', name: 'Marimo', cat: 'melody', color: '#38bdf8',
    look: { shape: 'round', acc: 'beanie', eyes: 'big', mouth: 'smile' },
    vol: 0.75, rev: 0.2, dly: 0.12,
    play(e, S) {
      const arp = [0, 1, 2, 3, 2, 1, 2, 4, 3, 2, 1, 2, 3, 4, 5, 4];
      if (S.s16 % 2 === 1 && ![3, 11].includes(S.s16)) return;
      e.mallet(S.out, S.t, e.chordNote(S.step, arp[S.s16], 0), S.s16 % 4 === 0 ? 0.42 : 0.3, { ratio: 3.98, pv: 0.25, len: 0.45 });
      S.hit(S.s16 % 4 === 0 ? 1 : 0.5);
    },
  },
  {
    id: 'dingle', name: 'Dingle', cat: 'melody', color: '#22d3ee',
    look: { shape: 'tall', acc: 'tophat', eyes: 'happy', mouth: 'o' },
    vol: 0.7, rev: 0.3, dly: 0.2,
    play(e, S) {
      for (const [, d, len] of melodyAt(THEME_MELODY, S)) {
        e.fm(S.out, S.t, e.deg(d, 1), S.sd * len * 0.6, { v: 0.22, ratio: 3.5, index: 2.4, idecay: 0.4, rel: 0.7 });
        S.hit(1);
      }
    },
  },
  {
    id: 'chippy', name: 'Chippy', cat: 'melody', color: '#3b82f6',
    look: { shape: 'square', acc: 'visor', eyes: 'pixel', mouth: 'grin' },
    vol: 0.5, rev: 0.12, dly: 0.3,
    play(e, S) {
      const notes = { 0: 4, 3: 3, 6: 2, 8: 4, 10: 5, 11: 4, 14: 3 };
      const k = notes[S.s16];
      if (k === undefined) return;
      e.tone(S.out, S.t, e.chordNote(S.step, k, 1), S.sd * 1.2, { type: 'square', v: 0.16, cutoff: 5000, rel: 0.05, vib: 0.01, vibRate: 9 });
      S.hit(0.8);
    },
  },
  {
    id: 'fluffle', name: 'Fluffle', cat: 'melody', color: '#818cf8',
    look: { shape: 'cloud', acc: 'bunny', eyes: 'sleepy', mouth: 'o' },
    vol: 0.6, rev: 0.45, dly: 0.15,
    play(e, S) {
      const line = [[0, 4, 6], [6, 3, 2], [8, 2, 8]];
      for (const [st, k, len] of line) {
        if (st !== S.s16) continue;
        const m = e.chordNote(S.step, k, 1);
        e.tone(S.out, S.t, m, S.sd * len * 0.9, { type: 'triangle', v: 0.26, a: 0.06, rel: 0.25, cutoff: 3000, vib: 0.014, glideFrom: m - 1 });
        e.tone(S.out, S.t, m + 12, S.sd * len * 0.9, { type: 'sine', v: 0.05, a: 0.08, rel: 0.25 });
        S.hit(1);
      }
    },
  },
  {
    id: 'keyko', name: 'Keyko', cat: 'melody', color: '#6366f1',
    look: { shape: 'round', acc: 'glasses', eyes: 'big', mouth: 'smile' },
    vol: 0.65, rev: 0.2,
    play(e, S) {
      if (pat('..x...x...x..x.x', S.s16) !== 'x') return;
      for (let k = 1; k < 4; k++) {
        e.fm(S.out, S.t, e.chordNote(S.step, k, 0), S.sd * 0.8, { v: 0.11, ratio: 1, index: 1.2, idecay: 0.15, rel: 0.2, type: 'sine' });
      }
      S.hit(0.8);
    },
  },

  // ---------------- VOICES ----------------
  {
    id: 'doowee', name: 'Doowee', cat: 'voice', color: '#a855f7',
    look: { shape: 'pear', acc: 'bowtie', eyes: 'sleepy', mouth: 'sing' },
    vol: 0.6, rev: 0.15,
    play(e, S) {
      const p = { 0: [0, 3], 3: [0, 1], 6: [2, 2], 8: [0, 3], 11: [0, 1], 14: [3, 2] };
      const n = p[S.s16];
      if (!n) return;
      e.voice(S.out, S.t, e.chordNote(S.step, n[0], -1), S.sd * n[1] * 0.8, 'u', { cons: 'd', v: 0.5, vib: 0.008, to: 'o' });
      S.hit(1);
    },
  },
  {
    id: 'oohla', name: 'Oohla', cat: 'voice', color: '#c084fc',
    look: { shape: 'cloud', acc: 'halo', eyes: 'sleepy', mouth: 'sing' },
    vol: 0.55, rev: 0.5,
    play(e, S) {
      if (S.s16 !== 0) { if (S.s16 % 8 === 0) S.hit(0.4); return; }
      for (let k = 1; k < 4; k++) {
        e.voice(S.out, S.t + k * 0.015, e.chordNote(S.step, k, 0), S.sd * 14, k === 2 ? 'o' : 'u', { cons: 'w', v: 0.2, a: 0.18, rel: 0.4, vib: 0.01 });
      }
      S.hit(1);
    },
  },
  {
    id: 'bapbap', name: 'Bapbap', cat: 'voice', color: '#e879f9',
    look: { shape: 'square', acc: 'crown', eyes: 'happy', mouth: 'sing' },
    vol: 0.8, rev: 0.2, dly: 0.12,
    play(e, S) {
      const p = { 0: [2, 'b'], 3: [2, 'b'], 4: [1, 'd'], 6: [2, 'b'], 10: [3, 'b'], 12: [2, 'd'] };
      const n = p[S.s16];
      if (!n) return;
      e.voice(S.out, S.t, e.chordNote(S.step, n[0], 0), S.sd * 0.7, 'a', { cons: n[1], v: 0.4, vib: 0, a: 0.01, rel: 0.06 });
      S.hit(1);
    },
  },
  {
    id: 'lala', name: 'Lala', cat: 'voice', color: '#f472b6',
    look: { shape: 'tall', acc: 'bow', eyes: 'lashes', mouth: 'sing' },
    vol: 0.75, rev: 0.4, dly: 0.18,
    play(e, S) {
      for (const [, d, len] of melodyAt(LALA_MELODY, S)) {
        e.voice(S.out, S.t, e.deg(d, 0), S.sd * len * 0.85, 'a', { cons: 'l', v: 0.34, vib: 0.016 });
        S.hit(1);
      }
    },
  },
  {
    id: 'heyhey', name: 'Heyhey', cat: 'voice', color: '#8b5cf6',
    look: { shape: 'round', acc: 'mohawk', eyes: 'big', mouth: 'shout' },
    vol: 0.7, rev: 0.3, dly: 0.3,
    play(e, S) {
      const shout = (vowel) => {
        e.voice(S.out, S.t, e.chordNote(S.step, 2, 0), S.sd * 1.2, vowel, { shout: true, v: 0.45, vib: 0, a: 0.008, rel: 0.1 });
        S.hit(1);
      };
      if (S.bar < 3 && S.s16 === 12) shout('e');
      if (S.bar === 3 && (S.s16 === 8 || S.s16 === 10)) shout('e');
      if (S.bar === 3 && S.s16 === 12) shout('o');
    },
  },

  // ================= UNLOCKABLES (append only: index is used in share codes) =================
  // ---- beats ----
  {
    id: 'tappy', name: 'Tappy', cat: 'beat', color: '#ff9f6b', unlock: true,
    look: { shape: 'round', acc: 'party', eyes: 'happy', mouth: 'smile' },
    vol: 1.0, rev: 0.15,
    play(e, S) {
      // shaker 16ths + tambourine on 2 and 4
      const v = [0.5, 0.25, 0.4, 0.25][S.s16 % 4];
      e.snap(S.out, S.t + (S.s16 % 2 ? S.sd * 0.1 : 0), v * 0.5, { freq: 9000, q: 0.7, len: 0.05, claps: 1 });
      if (S.s16 === 4 || S.s16 === 12) {
        e.snap(S.out, S.t, 0.6, { freq: 7500, q: 2, len: 0.22, claps: 4 });
        S.hit(1);
      } else if (S.s16 % 4 === 0) S.hit(0.4);
    },
  },
  {
    id: 'thumpo', name: 'Thumpo', cat: 'beat', color: '#d62f4a', unlock: true,
    look: { shape: 'square', acc: 'cap', eyes: 'shades', mouth: 'grin' },
    vol: 0.7, rev: 0.05,
    play(e, S) {
      // trap: big 808 boom, rolling hats
      const k = S.bar % 2 ? 'x......x..x.....' : 'x.........x..x..';
      if (pat(k, S.s16) === 'x') {
        e.kick(S.out, S.t, 0.9, { f0: 120, f1: 40, len: 0.9 });
        e.tone(S.out, S.t, e.deg(e.chordRoot(S.step), -3), S.sd * 3, { type: 'sine', v: 0.35, cutoff: 300, rel: 0.2 });
        S.hit(1);
      }
      const roll = S.bar === 3 && S.s16 >= 12;
      if (S.s16 % 2 === 0 || roll) {
        e.hat(S.out, S.t, roll ? 0.5 : 0.35);
        if (roll) e.hat(S.out, S.t + S.sd / 2, 0.4);
      }
    },
  },
  {
    id: 'cowbo', name: 'Cowbo', cat: 'beat', color: '#ffc94d', unlock: true,
    look: { shape: 'pear', acc: 'cowboy', eyes: 'big', mouth: 'o' },
    vol: 1.1, rev: 0.12,
    play(e, S) {
      const p = 'x..x..x...x.x...';
      if (pat(p, S.s16) !== 'x') return;
      // classic cowbell: two detuned squares through a bandpass
      [587, 845].forEach((f) => e.blip(S.out, S.t, f, f * 0.99, 0.18, { type: 'square', v: S.s16 === 0 ? 0.13 : 0.09 }));
      S.hit(S.s16 === 0 ? 1 : 0.7);
    },
  },
  // ---- effects ----
  {
    id: 'sirena', name: 'Sirena', cat: 'fx', color: '#6ee7b7', unlock: true,
    look: { shape: 'tall', acc: 'star', eyes: 'big', mouth: 'shout' },
    vol: 0.8, rev: 0.3, dly: 0.2,
    play(e, S) {
      if (S.bar % 2 === 1 && (S.s16 === 0 || S.s16 === 8)) {
        const lo = mtof(e.chordNote(S.step, 2, 0)), hi = mtof(e.chordNote(S.step, 4, 0));
        const c = S.out.context, o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(lo, S.t);
        for (let i = 1; i <= 4; i++) o.frequency.linearRampToValueAtTime(i % 2 ? hi : lo, S.t + i * S.sd * 2);
        g.gain.setValueAtTime(0.0001, S.t); g.gain.linearRampToValueAtTime(0.22, S.t + 0.05);
        g.gain.setValueAtTime(0.22, S.t + S.sd * 7); g.gain.exponentialRampToValueAtTime(0.0001, S.t + S.sd * 8);
        o.connect(g); g.connect(S.out); o.start(S.t); o.stop(S.t + S.sd * 8 + 0.05);
        S.hit(1);
      } else if (S.s16 % 4 === 0 && S.bar % 2 === 1) S.hit(0.5);
    },
  },
  {
    id: 'sparkle', name: 'Sparkle', cat: 'fx', color: '#a7f3d0', unlock: true,
    look: { shape: 'cloud', acc: 'flower', eyes: 'lashes', mouth: 'smile' },
    vol: 1.0, rev: 0.5, dly: 0.35,
    play(e, S) {
      const seq = { 0: 7, 3: 9, 6: 8, 9: 10, 12: 9, 14: 11 };
      const k = seq[S.s16];
      if (k === undefined) return;
      e.mallet(S.out, S.t, e.chordNote(S.step, k + (S.bar % 2), 1), 0.14, { ratio: 2.76, pv: 0.5, len: 0.7 });
      S.hit(0.8);
    },
  },
  {
    id: 'rumbo', name: 'Rumbo', cat: 'fx', color: '#16a34a', unlock: true,
    look: { shape: 'square', acc: 'antlers', eyes: 'sleepy', mouth: 'grin' },
    vol: 0.65, rev: 0.05,
    play(e, S) {
      // wobble bass: a filter that "talks" in 8ths
      if (S.s16 % 2) return;
      const m = e.deg(e.chordRoot(S.step), -2) + (S.s16 === 6 || S.s16 === 14 ? 12 : 0);
      e.tone(S.out, S.t, m, S.sd * 1.7, { type: 'sawtooth', v: 0.3, cutoff: 180, fenv: S.s16 % 4 ? 600 : 1800, fdecay: S.sd * 1.6, q: 9, voices: 2, detune: 10, rel: 0.04 });
      S.hit(S.s16 % 4 ? 0.6 : 1);
    },
  },
  // ---- melody ----
  {
    id: 'clavvy', name: 'Clavvy', cat: 'melody', color: '#60a5fa', unlock: true,
    look: { shape: 'round', acc: 'afro', eyes: 'shades', mouth: 'grin' },
    vol: 0.6, rev: 0.12,
    play(e, S) {
      // funky clav: short plucky chord chops
      const p = { 0: 1, 3: 2, 4: 1, 7: 2, 10: 1, 11: 3, 14: 2 };
      const k = p[S.s16];
      if (k === undefined) return;
      e.tone(S.out, S.t, e.chordNote(S.step, k, 0), S.sd * 0.5, { type: 'square', v: 0.14, cutoff: 600, fenv: 3500, fdecay: 0.08, q: 4, rel: 0.03 });
      e.tone(S.out, S.t, e.chordNote(S.step, k + 1, 0), S.sd * 0.5, { type: 'square', v: 0.1, cutoff: 600, fenv: 3000, fdecay: 0.08, q: 4, rel: 0.03 });
      S.hit(0.8);
    },
  },
  {
    id: 'trumpo', name: 'Trumpo', cat: 'melody', color: '#2563eb', unlock: true,
    look: { shape: 'pear', acc: 'tophat', eyes: 'happy', mouth: 'o' },
    vol: 1.1, rev: 0.25,
    play(e, S) {
      // brass stabs answering the beat
      const p = S.bar % 2 ? { 10: [2, 2], 12: [3, 3] } : { 0: [2, 2], 3: [3, 1], 6: [4, 4] };
      const n = p[S.s16];
      if (!n) return;
      for (const k of [n[0], n[0] - 2]) {
        e.tone(S.out, S.t, e.chordNote(S.step, k, 0), S.sd * n[1] * 0.8, { type: 'sawtooth', v: 0.1, voices: 2, detune: 8, cutoff: 900, fenv: 2200, fdecay: 0.12, a: 0.02, rel: 0.12, vib: 0.006 });
      }
      S.hit(1);
    },
  },
  {
    id: 'whistlo', name: 'Whistlo', cat: 'melody', color: '#93c5fd', unlock: true,
    look: { shape: 'tall', acc: 'scarf', eyes: 'happy', mouth: 'o' },
    vol: 0.55, rev: 0.4, dly: 0.25,
    play(e, S) {
      // a whistled answer to the main theme, an octave up
      const line = [[[0, 4, 3], [4, 5, 2], [6, 4, 6]], [[8, 3, 2], [10, 2, 2], [12, 1, 4]], [[0, 2, 3], [4, 4, 2], [6, 7, 6]], [[8, 5, 2], [10, 4, 2], [12, 4, 4]]];
      for (const [st, d, len] of line[S.bar]) {
        if (st !== S.s16) continue;
        e.tone(S.out, S.t, e.deg(d, 1), S.sd * len * 0.85, { type: 'sine', v: 0.2, a: 0.03, rel: 0.12, vib: 0.01, vibRate: 6, glideFrom: e.deg(d, 1) - 2 });
        S.hit(1);
      }
    },
  },
  // ---- voices ----
  {
    id: 'robo', name: 'Robo', cat: 'voice', color: '#9333ea', unlock: true,
    look: { shape: 'square', acc: 'astro', eyes: 'pixel', mouth: 'sing' },
    vol: 0.6, rev: 0.2, dly: 0.25,
    play(e, S) {
      // "beep boop" robot voice
      const p = { 0: ['i', 4], 2: ['u', 2], 8: ['i', 5], 10: ['u', 3], 12: ['o', 2] };
      const n = p[S.s16];
      if (!n || (S.bar % 2 && S.s16 >= 8)) return;
      e.voice(S.out, S.t, e.chordNote(S.step, n[1], 0), S.sd * 1.4, n[0], { cons: 'b', v: 0.3, vib: 0, a: 0.005, rel: 0.04 });
      S.hit(1);
    },
  },
  {
    id: 'hummy', name: 'Hummy', cat: 'voice', color: '#d8b4fe', unlock: true,
    look: { shape: 'cloud', acc: 'bow', eyes: 'sleepy', mouth: 'smile' },
    vol: 0.5, rev: 0.45,
    play(e, S) {
      // "mmm-hmm" humming harmony, two notes per bar
      if (S.s16 !== 0 && S.s16 !== 8) return;
      const k = S.s16 === 0 ? 2 : 1;
      e.voice(S.out, S.t, e.chordNote(S.step, k, 0), S.sd * 7, 'u', { cons: 'm', v: 0.28, a: 0.08, rel: 0.25, vib: 0.012 });
      S.hit(0.8);
    },
  },
  {
    id: 'woo', name: 'Woo', cat: 'voice', color: '#c026d3', unlock: true,
    look: { shape: 'round', acc: 'party', eyes: 'big', mouth: 'shout' },
    vol: 0.6, rev: 0.35, dly: 0.3,
    play(e, S) {
      // "woo!" party shouts that slide up
      if (!((S.bar === 1 || S.bar === 3) && (S.s16 === 6 || S.s16 === 14))) return;
      const m = e.chordNote(S.step, 3, 0);
      e.voice(S.out, S.t, m, S.sd * 2.2, 'u', { cons: 'w', glideFrom: m - 7, v: 0.4, vib: 0.01, a: 0.01, rel: 0.12, to: 'o' });
      S.hit(1);
    },
  },
];

// Bonus fanfare layer for SUPER JAM (4 bars, played on the master bus).
function bonusLayer(e, S, i) {
  if (i === 0) e.crash(S.out, S.t, 0.9);
  for (const [, d, len] of melodyAt(THEME_MELODY, S)) {
    e.tone(S.out, S.t, e.deg(d, 1), S.sd * len * 0.8, { type: 'sawtooth', v: 0.1, voices: 3, detune: 12, cutoff: 2600, fenv: 1800, fdecay: 0.15, rel: 0.2 });
    e.tone(S.out, S.t, e.deg(d - 2, 1), S.sd * len * 0.8, { type: 'sawtooth', v: 0.06, voices: 2, detune: 10, cutoff: 2000, rel: 0.2 });
  }
  if (S.s16 % 2 === 0) e.mallet(S.out, S.t, e.chordNote(S.step, (S.s16 / 2) % 5 + 3, 1), 0.08, { ratio: 2.76, pv: 0.3, len: 0.5 });
}

window.CATS = CATS;
window.SOUNDS = SOUNDS;
window.bonusLayer = bonusLayer;
