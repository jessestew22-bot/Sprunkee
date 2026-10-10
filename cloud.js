// Sprunkee online: leaderboard + shared jams.
// Backends, first that works wins:
//   1. Google Sheet (Apps Script web app) — set SPRUNKEE_CLOUD_URL in config.js. Used on GitHub Pages.
//   2. claude.ai artifact database — when the page runs as a Claude artifact.
//   3. Offline — no shared lists, but share links still work.
'use strict';

// ---------- jam codes ----------
// 10 chars: stage, 7 slots (sound index, 'z' = empty), mute bitmask (2 chars). All [0-9a-z].
const Jam = {
  encode(stageId, slots) {
    let s = Math.max(0, STAGE_IDS.indexOf(stageId)).toString(36);
    let mask = 0;
    slots.forEach((sl, i) => {
      const k = sl.sound ? SOUNDS.indexOf(sl.sound) : -1;
      s += k >= 0 ? k.toString(36) : 'z';
      if (sl.sound && sl.muted) mask |= 1 << i;
    });
    return s + mask.toString(36).padStart(2, '0');
  },
  decode(code) {
    if (!/^[0-9a-z]{10}$/.test(code || '')) return null;
    const stage = STAGE_IDS[parseInt(code[0], 36)];
    if (!stage) return null;
    const mask = parseInt(code.slice(8), 36);
    const slots = [];
    for (let i = 0; i < 7; i++) {
      const c = code[1 + i];
      const snd = c === 'z' ? null : SOUNDS[parseInt(c, 36)] || null;
      slots.push({ sound: snd, muted: !!(mask & (1 << i)) });
    }
    if (!slots.some((x) => x.sound)) return null;
    return { stage, slots };
  },
  link(code, ini) {
    const base = location.href.split('#')[0];
    return `${base}#jam-${code}${ini ? '-' + ini : ''}`;
  },
  fromHash() {
    const m = /^#jam-([0-9a-z]{10})(?:-([A-Z]{1,3}))?$/.exec(location.hash || '');
    return m ? { code: m[1], ini: m[2] || '' } : null;
  },
};

// Kid-safe jam names: picked from lists, never typed.
const JAM_WORDS = {
  a: ['Funky', 'Bouncy', 'Sleepy', 'Silly', 'Sparkly', 'Wiggly', 'Zippy', 'Giggly', 'Cosmic', 'Groovy', 'Jumpy', 'Snazzy', 'Wobbly', 'Super', 'Tiny', 'Mega'],
  n: ['Banana', 'Rocket', 'Pickle', 'Dino', 'Taco', 'Robot', 'Puppy', 'Waffle', 'Comet', 'Noodle', 'Bubble', 'Monster', 'Pancake', 'Turtle', 'Volcano', 'Unicorn'],
};
function randomJamName() {
  const r = (l) => l[Math.floor(Math.random() * l.length)];
  return `${r(JAM_WORDS.a)} ${r(JAM_WORDS.n)} Jam`;
}
const validName = (n) => /^[A-Za-z ]{3,40}$/.test(n || '');
const validIni = (v) => /^[A-Z]{1,3}$/.test(v || '');

const Cloud = (() => {
  let mode = 'offline';
  let db = null;
  const url = (window.SPRUNKEE_CLOUD_URL || '').trim();

  const ready = (async () => {
    if (url) { mode = 'sheet'; return mode; }
    if (window.claude && typeof window.claude.use === 'function') {
      try { db = await window.claude.use('db'); } catch (e) { db = null; }
      if (db) { mode = 'claude'; return mode; }
    }
    return mode;
  })();

  async function sheetGet(action) {
    const r = await fetch(`${url}?action=${action}&t=${Date.now()}`);
    if (!r.ok) throw new Error('net');
    return r.json();
  }
  async function sheetPost(body) {
    // text/plain keeps it a "simple" request, so Apps Script needs no CORS preflight
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('net');
    return r.json();
  }
  const clean = (rows) => rows.filter((x) => x && validIni(x.ini));

  return {
    ready,
    get mode() { return mode; },
    get online() { return mode !== 'offline'; },

    async topScores() {
      await ready;
      if (mode === 'sheet') return clean((await sheetGet('top')).scores || []).slice(0, 10);
      if (mode === 'claude') {
        const q = await db.collection('scores').orderBy('score', 'desc').limit(10).get();
        return clean(q.docs.map((d) => d.data()));
      }
      return [];
    },

    async postScore(ini, score, pid) {
      await ready;
      if (!validIni(ini) || !(score > 0)) return false;
      score = Math.min(9999999, Math.round(score));
      if (mode === 'sheet') return (await sheetPost({ action: 'score', ini, score, pid })).ok;
      if (mode === 'claude') {
        // one row per player; only ever raise it
        const ref = db.collection('scores').doc('p' + pid);
        const cur = await ref.get();
        if (cur.exists && (cur.data().score || 0) >= score && cur.data().ini === ini) return true;
        await ref.set({ ini, score: Math.max(score, (cur.exists && cur.data().score) || 0), at: Date.now() });
        return true;
      }
      return false;
    },

    async listJams() {
      await ready;
      let rows = [];
      if (mode === 'sheet') rows = (await sheetGet('jams')).jams || [];
      if (mode === 'claude') {
        const q = await db.collection('jams').orderBy('at', 'desc').limit(30).get();
        rows = q.docs.map((d) => d.data());
      }
      return clean(rows).filter((j) => validName(j.name) && Jam.decode(j.code));
    },

    async shareJam(ini, name, code, pid) {
      await ready;
      if (!validIni(ini) || !validName(name) || !Jam.decode(code)) return false;
      if (mode === 'sheet') return (await sheetPost({ action: 'jam', ini, name, code, pid })).ok;
      if (mode === 'claude') { await db.collection('jams').add({ ini, name, code, at: Date.now() }); return true; }
      return false;
    },
  };
})();

window.Jam = Jam;
window.Cloud = Cloud;
window.randomJamName = randomJamName;
