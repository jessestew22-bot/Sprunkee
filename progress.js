// Sprunkee progression: jam points, goals, unlocks. Saved per device in localStorage.
'use strict';

const STAGE_INFO = {
  day: { name: 'Sunny Day' },
  night: { name: 'Night Time' },
  beach: { name: 'Beach Party' },
  candy: { name: 'Candy Land' },
  space: { name: 'Outer Space' },
  snow: { name: 'Snow Day' },
};

// Each goal: label (short, parents read it to kids), check(st) -> [current, target], reward.
const GOALS = [
  { id: 'wake', label: 'Wake up a friend', check: (s) => [s.wakes, 1], reward: { sound: 'tappy' } },
  { id: 'band4', label: 'Get 4 friends singing at once', check: (s) => [s.maxActive, 4], reward: { sound: 'sparkle' } },
  { id: 'rainbow', label: 'Rainbow band: one of every color', check: (s) => [s.rainbow, 1], reward: { sound: 'whistlo' } },
  { id: 'hush', label: 'Hush a friend, then wake them', check: (s) => [s.rewakes, 1], reward: { sound: 'cowbo' } },
  { id: 'jam1', label: 'Get a SUPER JAM', check: (s) => [s.superJams, 1], reward: { stage: 'beach' } },
  { id: 'dice', label: 'Roll the dice 5 times', check: (s) => [s.shuffles, 5], reward: { sound: 'sirena' } },
  { id: 'pts1k', label: 'Score 1,000 in one jam', check: (s) => [s.best, 1000], reward: { sound: 'clavvy' } },
  { id: 'owl', label: 'Jam at night for 1 minute', check: (s) => [Math.floor(s.stageSecs.night || 0), 60], reward: { sound: 'hummy' } },
  { id: 'time5', label: 'Jam for 5 minutes', check: (s) => [Math.floor(s.playSecs / 60), 5], reward: { sound: 'robo' } },
  { id: 'jam3', label: 'Get 3 SUPER JAMS', check: (s) => [s.superJams, 3], reward: { stage: 'candy' } },
  { id: 'all20', label: 'Try all 20 first friends', check: (s) => [Object.keys(s.used).filter((id) => BASE_IDS.includes(id)).length, 20], reward: { sound: 'trumpo' } },
  { id: 'beachjam', label: 'SUPER JAM at the Beach', check: (s) => [s.stageJams.beach ? 1 : 0, 1], reward: { stage: 'space' } },
  { id: 'pts5k', label: 'Score 5,000 in one jam', check: (s) => [s.best, 5000], reward: { sound: 'thumpo' } },
  { id: 'share', label: 'Share a jam', check: (s) => [s.shared, 1], reward: { sound: 'woo' } },
  { id: 'listen', label: "Listen to a friend's jam", check: (s) => [s.listened, 1], reward: { sound: 'rumbo' } },
  { id: 'jam10', label: 'Get 10 SUPER JAMS', check: (s) => [s.superJams, 10], reward: { stage: 'snow' } },
  { id: 'spacejam', label: 'SUPER JAM in Outer Space', check: (s) => [s.stageJams.space ? 1 : 0, 1], reward: null },
  { id: 'tour', label: 'Jam on every stage', check: (s) => [Object.keys(s.stageSecs).filter((k) => s.stageSecs[k] >= 10).length, STAGE_IDS.length], reward: null },
  { id: 'pts25k', label: 'Score 25,000 points in total', check: (s) => [s.total, 25000], reward: null },
  { id: 'all', label: 'Unlock every friend and stage', check: (s) => [GOALS.filter((g) => g.reward && s.done[g.id]).length, GOALS.filter((g) => g.reward).length], reward: null },
];
const BASE_IDS = SOUNDS.filter((s) => !s.unlock).map((s) => s.id);

const Progress = (() => {
  const KEY = 'sprunkee.save.v2';
  const fresh = () => ({
    wakes: 0, maxActive: 0, rainbow: 0, rewakes: 0, superJams: 0, shuffles: 0, best: 0, total: 0,
    playSecs: 0, stageSecs: {}, stageJams: {}, used: {}, shared: 0, listened: 0, done: {},
    initials: '', pid: Math.random().toString(36).slice(2, 12), postedBest: 0,
  });
  let st = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) st = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* storage blocked */ }
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked */ } }, 300);
  }

  const listeners = [];
  function evaluate() {
    const fresh = [];
    for (const g of GOALS) {
      if (st.done[g.id]) continue;
      const [cur, max] = g.check(st);
      if (cur >= max) { st.done[g.id] = Date.now(); fresh.push(g); }
    }
    if (fresh.length) { save(); fresh.forEach((g) => listeners.forEach((f) => f(g))); evaluate(); }
  }

  // ----- the current jam -----
  let jam = { pts: 0, idleBars: 0 };

  return {
    get state() { return st; },
    get jam() { return jam; },
    onGoal(fn) { listeners.push(fn); },
    isSoundUnlocked(id) {
      const g = GOALS.find((x) => x.reward && x.reward.sound === id);
      return !g || !!st.done[g.id];
    },
    isStageUnlocked(id) {
      const g = GOALS.find((x) => x.reward && x.reward.stage === id);
      return !g || !!st.done[g.id];
    },
    goalFor(kind, id) { return GOALS.find((x) => x.reward && x.reward[kind] === id); },
    progressOf(g) { const [c, m] = g.check(st); return [Math.min(c, m), m]; },
    // nudge the "freshness" bonus whenever the player changes something
    touch() { jam.idleBars = 0; },
    wake(id) { st.wakes++; st.used[id] = 1; jam.idleBars = 0; save(); evaluate(); },
    rewake() { st.rewakes++; jam.idleBars = 0; save(); evaluate(); },
    shuffle() { st.shuffles++; save(); evaluate(); },
    superJam(stage) { st.superJams++; st.stageJams[stage] = (st.stageJams[stage] || 0) + 1; jam.pts += 500; st.total += 500; save(); evaluate(); return 500; },
    shared() { st.shared++; save(); evaluate(); },
    listened() { st.listened++; save(); evaluate(); },
    setInitials(v) { st.initials = v; save(); },
    // called once per bar while anyone is playing; returns points gained
    bar({ active, cats, party, stage, secs }) {
      st.playSecs += secs;
      st.stageSecs[stage] = (st.stageSecs[stage] || 0) + secs;
      st.maxActive = Math.max(st.maxActive, active);
      if (cats >= 4) st.rainbow = 1;
      jam.idleBars++;
      // fresh changes keep full points; a band left alone slowly earns less (min 20%)
      const fresh = Math.max(0.2, 1 - Math.max(0, jam.idleBars - 8) * 0.1);
      const pts = Math.round(active * 10 * (1 + 0.25 * (cats - 1)) * (party ? 2 : 1) * fresh);
      jam.pts += pts; st.total += pts;
      if (jam.pts > st.best) st.best = jam.pts;
      save(); evaluate();
      return pts;
    },
    // the stage went quiet: the jam is over. Returns its score.
    endJam() { const p = jam.pts; jam = { pts: 0, idleBars: 0 }; return p; },
    markPosted(v) { st.postedBest = v; save(); },
    reset() { st = fresh(); save(); },
  };
})();

window.GOALS = GOALS;
window.STAGE_INFO = STAGE_INFO;
window.Progress = Progress;
