// Sprunkee: game logic, layout, input, menus and the render loop.
'use strict';

(() => {
  const SLOTS = 7;
  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');
  const g = canvas.getContext('2d');
  const tray = $('tray');
  const ghost = $('ghost');
  const toastEl = $('toast');

  // Safari < 16 (older iPads) has no roundRect.
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, w / 2, h / 2);
      this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
    };
  }

  let engine = null;
  let DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  let stageFrom = 'day', stageTo = 'day', stageK = 1; // backdrop blend
  let darkness = 0;
  let party = false, partyQueued = false;
  let started = false;
  let shownPts = 0;
  let newGoals = 0;
  const particles = [];
  const confetti = [];
  const pointer = { x: -1, y: -1, active: false };
  let drag = null;

  const slots = Array.from({ length: SLOTS }, (_, i) => ({
    i, sound: null, muted: false, pulse: 0, mouth: 0, enter: 0, blinkAt: 2 + Math.random() * 4, blink: 0,
    x: 0, y: 0, size: 100, hover: false,
  }));
  const soundById = (id) => SOUNDS.find((s) => s.id === id);

  // ---------- logo + toolbar ----------
  $('logo').innerHTML = 'SPRUNKEE'.split('').map((c) => `<span>${c}</span>`).join('');
  const SVG = {
    stage: '<svg viewBox="0 0 24 24"><path fill="#ffe680" d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z"/><circle cx="18" cy="5" r="1.4" fill="#fff"/><circle cx="21" cy="9" r="0.9" fill="#fff"/></svg>',
    dice: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="#fff"/><g fill="#6a3bd1"><circle cx="8" cy="8" r="1.8"/><circle cx="16" cy="8" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="8" cy="16" r="1.8"/><circle cx="16" cy="16" r="1.8"/></g></svg>',
    clear: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path fill="#ffd23f" d="M7 3h10v3h3a3 3 0 0 1-3 4.6A5 5 0 0 1 13 14v3h3v3H8v-3h3v-3a5 5 0 0 1-4-3.4A3 3 0 0 1 4 6h3zm-1 5a1.5 1.5 0 0 0 1 1.4V8zm12 0v1.4A1.5 1.5 0 0 0 19 8z"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path fill="#ff9be1" d="M5 8h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>',
    share: '<svg viewBox="0 0 24 24"><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></g></svg>',
  };
  $('btnStage').innerHTML = SVG.stage;
  $('btnShuffle').innerHTML = SVG.dice;
  $('btnClear').innerHTML = SVG.clear;
  $('btnTrophy').insertAdjacentHTML('afterbegin', SVG.trophy);
  $('btnShare').innerHTML = SVG.share;
  $('btnShop').innerHTML = SVG.shop;

  // ---------- tray ----------
  let iconEls = {};
  let freshIds = new Set();

  function trayItems(cat) {
    const list = SOUNDS.filter((s) => s.cat === cat.id);
    const open = list.filter((s) => Progress.isSoundUnlocked(s.id));
    const goalIdx = (s) => GOALS.indexOf(Progress.goalFor('sound', s.id));
    const locked = list.filter((s) => !Progress.isSoundUnlocked(s.id)).sort((a, b) => goalIdx(a) - goalIdx(b));
    return { open, teaser: locked[0] || null };
  }

  function buildTray() {
    tray.innerHTML = '';
    iconEls = {};
    let most = 0;
    for (const cat of CATS) {
      const { open, teaser } = trayItems(cat);
      most = Math.max(most, open.length + (teaser ? 1 : 0));
      const grp = document.createElement('div');
      grp.className = 'group';
      grp.innerHTML = `<h3 style="color:${cat.color}">${cat.name}</h3>`;
      const icons = document.createElement('div');
      icons.className = 'icons';
      for (const snd of open) {
        const b = document.createElement('button');
        b.className = 'icon' + (freshIds.has(snd.id) ? ' fresh' : '') + (snd.special ? ' star' : '');
        b.style.background = cat.color;
        b.setAttribute('aria-label', snd.name);
        b.title = snd.name;
        b.appendChild(document.createElement('canvas'));
        icons.appendChild(b);
        iconEls[snd.id] = b;
        b.addEventListener('pointerdown', (ev) => onIconDown(ev, snd));
      }
      if (teaser) {
        const b = document.createElement('button');
        b.className = 'icon locked';
        b.setAttribute('aria-label', 'Locked friend');
        b.appendChild(document.createElement('canvas'));
        b.dataset.teaser = teaser.id;
        b.addEventListener('click', () => showLockedSound(teaser));
        icons.appendChild(b);
      }
      grp.appendChild(icons);
      tray.appendChild(grp);
    }
    tray.dataset.most = most;
    slots.forEach((s) => { if (s.sound && iconEls[s.sound.id]) iconEls[s.sound.id].classList.add('used'); });
    if (!Progress.state.wakes && iconEls[SOUNDS[0].id]) iconEls[SOUNDS[0].id].classList.add('hint');
    paintIcons();
  }

  function paintIcon(c, snd, px, locked) {
    c.width = c.height = Math.round(px * DPR);
    const x = c.getContext('2d');
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cat = CATS.find((k) => k.id === snd.cat);
    if (locked) {
      x.fillStyle = '#3a2a63'; x.fillRect(0, 0, px, px);
      // silhouette: draw the friend, then paint over it
      const off = document.createElement('canvas');
      off.width = off.height = c.width;
      const o = off.getContext('2d'); o.setTransform(DPR, 0, 0, DPR, 0, 0);
      drawSprunkee(o, px / 2, px * 1.05, px * 0.92, { look: snd.look, color: snd.color, active: true, t: 0, zzz: false });
      o.globalCompositeOperation = 'source-atop'; o.fillStyle = '#5a4790'; o.fillRect(0, 0, px, px);
      x.drawImage(off, 0, 0, px, px);
      x.fillStyle = '#ffd23f'; x.font = `800 ${Math.round(px * 0.42)}px "Baloo 2", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('?', px / 2, px * 0.55);
      return;
    }
    const grad = x.createRadialGradient(px * 0.35, px * 0.3, 2, px / 2, px / 2, px * 0.7);
    grad.addColorStop(0, shadeColor(cat.color, 0.35)); grad.addColorStop(1, cat.color);
    x.fillStyle = grad; x.fillRect(0, 0, px, px);
    drawSprunkee(x, px / 2, px * 1.05, px * 0.92, { look: snd.look, color: snd.color, active: true, mouth: 0.3, t: 0, zzz: false });
  }

  function perRow() {
    const n = +tray.dataset.most || 5;
    const land = window.innerWidth / window.innerHeight > 1;
    if (land && window.innerHeight < 700 && n <= 5) return n;
    return Math.max(3, Math.ceil(n / 2));
  }

  function iconSize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const cols = vw / vh <= 1 ? 2 : 4;
    const gw = (vw - 16 - 10 * (cols - 1)) / cols;
    const n = perRow();
    let s = Math.floor((gw - 6 * (n - 1)) / n);
    s = Math.min(s, 64, Math.floor(vh * (cols === 2 ? 0.068 : 0.1)));
    return Math.max(34, s);
  }

  function paintIcons() {
    const isz = iconSize(), n = perRow();
    tray.style.setProperty('--isz', isz + 'px');
    tray.style.setProperty('--iw', (n * isz + (n - 1) * 6 + 2) + 'px');
    for (const id in iconEls) paintIcon(iconEls[id].querySelector('canvas'), soundById(id), isz);
    tray.querySelectorAll('[data-teaser]').forEach((b) => paintIcon(b.querySelector('canvas'), soundById(b.dataset.teaser), isz, true));
  }

  const markUsed = (snd, on) => { if (snd && iconEls[snd.id]) iconEls[snd.id].classList.toggle('used', on); };

  // ---------- layout ----------
  function layout() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    paintIcons();
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    DPR = Math.min(DPR, Math.sqrt(3.2e6 / Math.max(1, W * H))); // keep big iPads smooth
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    const top = topPad();
    const usable = H - top;
    if (W / usable >= 1.6) {
      const size = Math.min(W / 7.8, usable * 0.5);
      const gap = W / (SLOTS + 0.4);
      slots.forEach((s, i) => { s.size = size; s.x = gap * (i + 0.7); s.y = top + usable * 0.86; });
    } else {
      const size = Math.min(W / 4.7, usable * 0.3);
      slots.forEach((s, i) => {
        s.size = size;
        if (i < 4) { s.x = W * (0.14 + i * 0.24); s.y = top + usable * 0.5; } else { s.x = W * (0.26 + (i - 4) * 0.24); s.y = top + usable * 0.93; }
      });
    }
  }
  function topPad() { return W < 640 ? 104 : Math.min(80, H * 0.16); }
  function meterY() { return W < 640 ? 82 : topPad() - 18; }

  // ---------- band changes ----------
  const hasBand = () => slots.some((s) => s.sound);

  function assign(slot, snd, opts = {}) {
    if (!engine) return;
    const prev = slot.sound;
    const old = slots.find((s) => s.sound === snd);
    if (old && old !== slot) clearSlot(old, true);
    slot.sound = snd; slot.muted = false; slot.enter = performance.now();
    stopIntro();
    engine.setSound(slot.i, snd);
    markUsed(prev, false); markUsed(snd, true);
    if (iconEls[SOUNDS[0].id]) iconEls[SOUNDS[0].id].classList.remove('hint');
    poof(slot, snd.color, 26);
    if (!opts.quiet) { blipUI(70 + slot.i * 2); Progress.wake(snd.id); }
    if (snd.special) { toast('LINK IS HERE!', 1800, 0.75); fanfare(); burstConfetti(60); poof(slot, '#ffd23f', 40); }
  }

  function clearSlot(slot, quiet) {
    if (!slot.sound) return;
    markUsed(slot.sound, false);
    if (!quiet) poof(slot, '#ffffff', 14);
    slot.sound = null; slot.muted = false;
    engine.setSound(slot.i, null);
    Progress.touch();
    if (!hasBand()) finishJam();
  }

  function toggleMute(slot) {
    slot.muted = !slot.muted;
    engine.setMuted(slot.i, slot.muted);
    slot.pulse = 0.6;
    if (!slot.muted) Progress.rewake(); else Progress.touch();
  }

  function finishJam() {
    const pts = Progress.endJam();
    if (pts > 0 && pts >= Progress.state.best) toast('NEW BEST!', 1600, 0.7);
    postBest();
  }

  const firstEmpty = () => slots.find((s) => !s.sound);

  // ---------- input: tray ----------
  function onIconDown(ev, snd) {
    if (!started) return;
    ev.preventDefault();
    drag = { sound: snd, moved: false, startX: ev.clientX, startY: ev.clientY, id: ev.pointerId };
    ghost.innerHTML = '';
    const c = document.createElement('canvas');
    paintIcon(c, snd, 72);
    ghost.appendChild(c);
  }

  window.addEventListener('pointermove', (ev) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ev.clientX - r.left; pointer.y = ev.clientY - r.top; pointer.active = true;
    if (!drag || ev.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 8) {
      drag.moved = true;
      ghost.style.display = 'block';
    }
    if (drag.moved) {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
      const hit = slotAt(pointer.x, pointer.y, 1.25);
      slots.forEach((s) => { s.hover = s === hit; });
    }
  });

  window.addEventListener('pointerup', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const snd = drag.sound;
    ghost.style.display = 'none';
    slots.forEach((s) => { s.hover = false; });
    if (drag.moved) {
      const r = canvas.getBoundingClientRect();
      const hit = slotAt(ev.clientX - r.left, ev.clientY - r.top, 1.25);
      if (hit) assign(hit, snd);
    } else {
      const own = slots.find((s) => s.sound === snd);
      if (own) clearSlot(own);
      else {
        const e = firstEmpty();
        if (e) assign(e, snd);
        else toast('Tap ✕ to make room!', 1400, 0.55);
      }
    }
    drag = null;
  });
  window.addEventListener('pointercancel', () => { drag = null; ghost.style.display = 'none'; slots.forEach((s) => { s.hover = false; }); });

  function slotAt(x, y, reach = 1) {
    let best = null, bd = Infinity;
    for (const s of slots) {
      const d = Math.hypot((x - s.x) / (s.size * 0.6), (y - (s.y - s.size * 0.5)) / (s.size * 0.75));
      if (d < reach && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function xButton(s) { return { x: s.x + s.size * 0.42, y: s.y - s.size * 1.0, r: Math.max(16, s.size * 0.13) }; }

  canvas.addEventListener('pointerdown', (ev) => {
    if (!started) return;
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    for (const s of slots) {
      if (!s.sound) continue;
      const b = xButton(s);
      if (Math.hypot(x - b.x, y - b.y) < b.r * 1.3) { clearSlot(s); return; }
    }
    const s = slotAt(x, y, 1);
    if (s && s.sound) toggleMute(s);
    else if (s) { s.pulse = 1; blipUI(84); }
  });

  // ---------- stages ----------
  function applyStage(name) {
    if (name === stageTo) return;
    stageFrom = stageTo; stageTo = name; stageK = 0;
    document.querySelector('meta[name=theme-color]').setAttribute('content', STAGE_LOOK[name].meta);
  }

  function setStage(id) {
    if (!engine) return;
    Progress.touch();
    const live = slots.some((s) => s.sound && !s.muted);
    if (!live) { engine.forceTheme(id); applyStage(id); toast(STAGE_INFO[id].name.toUpperCase() + '!', 1400, 0.7); } else engine.setTheme(id);
  }

  function openStages() {
    const grid = $('stageGrid');
    grid.innerHTML = '';
    const cur = engine ? (engine.pendingTheme || engine.themeName) : 'day';
    for (const id of STAGE_IDS) {
      const open = Progress.isStageUnlocked(id);
      const b = document.createElement('button');
      b.className = 'stagecard' + (open ? '' : ' locked') + (id === cur ? ' on' : '');
      const c = document.createElement('canvas');
      b.appendChild(c);
      if (open) b.insertAdjacentHTML('beforeend', `<span class="sn">${STAGE_INFO[id].name}</span>`);
      else {
        const goal = Progress.goalFor('stage', id);
        const item = SHOP.find((x) => x.id === id);
        if (goal) {
          const [p, m] = Progress.progressOf(goal);
          b.insertAdjacentHTML('beforeend', `<span class="lk"><b>🔒</b>${goal.label}<br>${fmt(p)} / ${fmt(m)}</span>`);
        } else if (item) b.insertAdjacentHTML('beforeend', `<span class="lk"><b>🛍️</b>${STAGE_INFO[id].name}<br>🪙 ${fmt(item.price)} in the Shop</span>`);
      }
      b.addEventListener('click', () => {
        if (!open && SHOP.some((x) => x.id === id)) { $('stages').classList.add('hidden'); renderShop(); $('shop').classList.remove('hidden'); return; }
        if (!open) return;
        setStage(id);
        $('stages').classList.add('hidden');
      });
      grid.appendChild(b);
    }
    $('stages').classList.remove('hidden');
    grid.querySelectorAll('canvas').forEach((c, i) => {
      const w = c.clientWidth || 200, h = c.clientHeight || 125;
      c.width = w * DPR; c.height = h * DPR;
      const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0);
      Scene.thumb(x, w, h, STAGE_IDS[i]);
    });
  }

  // ---------- toolbar ----------
  $('btnStage').addEventListener('click', () => { if (engine) openStages(); });
  $('stagesClose').addEventListener('click', () => $('stages').classList.add('hidden'));
  $('btnShuffle').addEventListener('click', () => {
    if (!engine) return;
    slots.forEach((s) => clearSlot(s, true));
    const pool = SOUNDS.filter((s) => Progress.isSoundUnlocked(s.id));
    const pick = [];
    for (const cat of CATS) {
      const list = pool.filter((s) => s.cat === cat.id);
      pick.push(list[Math.floor(Math.random() * list.length)]);
    }
    const rest = pool.filter((s) => !pick.includes(s)).sort(() => Math.random() - 0.5);
    pick.push(...rest.slice(0, Math.floor(Math.random() * 2)));
    pick.forEach((snd, i) => assign(slots[i], snd, { quiet: true }));
    pick.forEach((snd) => Progress.wake(snd.id));
    blipUI(76);
    Progress.shuffle();
  });
  $('btnClear').addEventListener('click', () => { if (!engine) return; slots.forEach((s) => clearSlot(s)); playIntro(); });
  $('btnHelp').addEventListener('click', () => $('help').classList.remove('hidden'));
  $('btnHelpOk').addEventListener('click', () => $('help').classList.add('hidden'));

  // ---------- feedback ----------
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  function toast(text, ms = 1600, scale = 1) {
    toastEl.textContent = text;
    toastEl.style.fontSize = scale !== 1 ? `clamp(24px, ${9 * scale}vw, ${90 * scale}px)` : '';
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function popPoints(text, big) {
    const r = canvas.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'pop' + (big ? ' big' : '');
    el.textContent = text;
    el.style.left = (r.left + W / 2 + Math.min(150, W * 0.35) - 20) + 'px';
    el.style.top = (r.top + meterY() + 14) + 'px';
    $('pops').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function blipUI(midi) {
    if (!engine) return;
    engine.mallet(engine.bus, engine.ctx.currentTime + 0.01, midi, 0.12, { ratio: 3, pv: 0.2, len: 0.2 });
  }

  function fanfare() {
    if (!engine) return;
    const t = engine.ctx.currentTime + 0.05;
    [72, 76, 79, 84, 79, 84].forEach((m, i) => engine.mallet(engine.bus, t + i * 0.1, m, 0.22, { ratio: 3.98, pv: 0.2, len: 0.6 }));
  }

  function poof(slot, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 220;
      particles.push({ kind: 'dot', x: slot.x, y: slot.y - slot.size * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.6 + Math.random() * 0.4, age: 0, r: 3 + Math.random() * 6, color });
    }
  }

  // ---------- cards: unlocks, locked info ----------
  const cardQueue = [];
  let cardArt = null;
  function showCard(card) { cardQueue.push(card); if (cardQueue.length === 1) openCard(); }
  function openCard() {
    const c = cardQueue[0];
    if (!c) return;
    $('rewardEyebrow').textContent = c.eyebrow;
    $('rewardTitle').textContent = c.title;
    $('rewardText').textContent = c.text;
    $('rewardOk').textContent = c.btn || 'YAY!';
    cardArt = c.draw;
    $('reward').classList.remove('hidden');
    if (c.celebrate) { fanfare(); burstConfetti(80); }
  }
  $('rewardOk').addEventListener('click', () => {
    cardQueue.shift();
    $('reward').classList.add('hidden');
    cardArt = null;
    if (cardQueue.length) setTimeout(openCard, 250);
  });
  function drawCardArt(t) {
    if (!cardArt) return;
    const c = $('rewardArt');
    const w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    if (c.width !== Math.round(w * DPR)) { c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); }
    const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, w, h);
    cardArt(x, w, h, t);
  }
  const artSound = (snd, silhouette) => (x, w, h, t) => {
    const beat = (t * 1.8) % 1;
    drawSprunkee(x, w / 2, h - 8, Math.min(w * 0.6, h * 0.7), {
      look: snd.look, color: silhouette ? '#5a4790' : snd.color, active: !silhouette, pulse: silhouette ? 0 : Math.pow(1 - beat, 3) * 0.7,
      mouth: silhouette ? 0 : Math.pow(1 - beat, 3), t, beat, zzz: false,
    });
  };
  const artStage = (id) => (x, w, h) => { x.save(); x.beginPath(); x.roundRect(0, 0, w, h, 18); x.clip(); Scene.thumb(x, w, h, id); x.restore(); };
  const artTrophy = (x, w, h, t) => { drawStar(x, w / 2, h / 2, Math.min(w, h) * (0.38 + Math.sin(t * 4) * 0.03), '#ffd23f'); };

  function showLockedSound(snd) {
    const goal = Progress.goalFor('sound', snd.id);
    const [p, m] = Progress.progressOf(goal);
    showCard({ eyebrow: 'Secret friend', title: '???', text: `To unlock: ${goal.label} (${fmt(p)} / ${fmt(m)})`, btn: 'OK', draw: artSound(snd, true) });
  }

  Progress.onGoal((goal) => {
    newGoals++;
    $('trophyBadge').textContent = newGoals; $('trophyBadge').hidden = false;
    const r = goal.reward;
    if (r && r.sound) {
      const snd = soundById(r.sound);
      freshIds.add(snd.id);
      buildTray();
      showCard({ eyebrow: 'New friend!', title: snd.name.toUpperCase(), text: `You did it: ${goal.label}. Find ${snd.name} down in the tray!`, draw: artSound(snd), celebrate: true });
    } else if (r && r.stage) {
      showCard({ eyebrow: 'New stage!', title: STAGE_INFO[r.stage].name.toUpperCase(), text: `You did it: ${goal.label}. Tap the moon button to go there!`, draw: artStage(r.stage), celebrate: true });
    } else {
      showCard({ eyebrow: 'Trophy!', title: 'AMAZING!', text: `You did it: ${goal.label}.`, draw: artTrophy, celebrate: true });
    }
  });

  // ---------- trophy room ----------
  let roomTab = 'goals';
  // No online backend = no Top 10 / Jams tabs (share links still work).
  Cloud.ready.then(() => {
    if (Cloud.online) return;
    document.querySelectorAll('#room .tab[data-tab=top], #room .tab[data-tab=jams]').forEach((b) => b.remove());
    if (roomTab !== 'goals') roomTab = 'goals';
  });

  function openRoom(tab) {
    newGoals = 0; $('trophyBadge').hidden = true;
    $('room').classList.remove('hidden');
    if (!Cloud.online) tab = 'goals';
    showTab(tab || roomTab);
    postBest();
  }
  function showTab(tab) {
    roomTab = tab;
    document.querySelectorAll('#room .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('paneGoals').classList.toggle('hidden', tab !== 'goals');
    $('paneTop').classList.toggle('hidden', tab !== 'top');
    $('paneJams').classList.toggle('hidden', tab !== 'jams');
    if (tab === 'goals') renderGoals();
    if (tab === 'top') renderTop();
    if (tab === 'jams') renderJams();
  }
  document.querySelectorAll('#room .tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('btnTrophy').addEventListener('click', () => { if (engine) openRoom(); });
  $('roomClose').addEventListener('click', () => $('room').classList.add('hidden'));

  function renderGoals() {
    const pane = $('paneGoals');
    const done = GOALS.filter((x) => Progress.state.done[x.id]).length;
    pane.innerHTML = `<p class="note">${done} of ${GOALS.length} trophies. Best jam: <b>${fmt(Progress.state.best)}</b>. Total points: <b>${fmt(Progress.state.total)}</b></p>`;
    for (const goal of GOALS) {
      const [p, m] = Progress.progressOf(goal);
      const isDone = !!Progress.state.done[goal.id];
      const r = goal.reward;
      const rewardText = r ? (r.sound ? `Unlocks a new friend${isDone ? ': ' + soundById(r.sound).name : ''}` : `Unlocks a stage${isDone ? ': ' + STAGE_INFO[r.stage].name : ''}`) : 'Trophy';
      const row = document.createElement('div');
      row.className = 'goal' + (isDone ? ' done' : '');
      row.innerHTML = `<canvas></canvas><div><div class="lbl">${goal.label}</div><div class="rew">${rewardText}</div>
        <div class="bar"><i style="width:${Math.round((p / m) * 100)}%"></i></div></div><div class="st">${isDone ? '✅' : `<small>${fmt(p)}/${fmt(m)}</small>`}</div>`;
      pane.appendChild(row);
      const c = row.querySelector('canvas');
      c.width = c.height = 56 * DPR;
      const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0);
      x.fillStyle = isDone ? '#efe8ff' : '#3a2a63'; x.beginPath(); x.arc(28, 28, 28, 0, Math.PI * 2); x.fill();
      x.save(); x.beginPath(); x.arc(28, 28, 28, 0, Math.PI * 2); x.clip();
      if (r && r.sound) paintIcon(c, soundById(r.sound), 56, !isDone);
      else if (r && r.stage) { Scene.thumb(x, 56, 56, r.stage); if (!isDone) { x.fillStyle = 'rgba(30,20,60,0.7)'; x.fillRect(0, 0, 56, 56); } }
      else drawStar(x, 28, 30, 20, isDone ? '#ffd23f' : '#6b5a90');
      x.restore();
    }
  }

  async function renderTop() {
    const pane = $('paneTop');
    const st = Progress.state;
    pane.innerHTML = `<div class="mybest"><span>Your best jam: ${fmt(st.best)}</span>
      <button class="ini" id="topIni">${st.initials || 'ADD ME'}</button></div><div id="topList"><p class="note">Loading…</p></div>`;
    $('topIni').addEventListener('click', async () => { await pickInitials(); postBest(true); renderTop(); });
    const list = $('topList');
    if (!Cloud.online) { list.innerHTML = '<p class="note">The online leaderboard isn\'t switched on yet. Your best score is saved on this device.</p>'; return; }
    try {
      const rows = await Cloud.topScores();
      if (!rows.length) { list.innerHTML = '<p class="note">No scores yet. Be the first!</p>'; return; }
      list.innerHTML = '<table class="board">' + rows.map((x, i) =>
        `<tr class="${x.ini === st.initials && x.score === st.best ? 'me' : ''}"><td>${i + 1}</td><td>${x.ini}</td><td>${fmt(x.score)}</td></tr>`).join('') + '</table>';
    } catch (e) { list.innerHTML = '<p class="note">Couldn\'t reach the leaderboard. Try again in a bit.</p>'; }
  }

  async function renderJams() {
    const pane = $('paneJams');
    pane.innerHTML = '<p class="note">Loading…</p>';
    if (!Cloud.online) { pane.innerHTML = '<p class="note">Shared jams aren\'t switched on yet. You can still share a jam link from the share button.</p>'; return; }
    try {
      const rows = await Cloud.listJams();
      if (!rows.length) { pane.innerHTML = '<p class="note">No shared jams yet. Make one and press share!</p>'; return; }
      pane.innerHTML = '';
      for (const j of rows) {
        const dec = Jam.decode(j.code);
        const look = STAGE_LOOK[dec.stage];
        const row = document.createElement('div');
        row.className = 'jamrow';
        row.innerHTML = `<div class="sw" style="background:linear-gradient(${look.sky[0]},${look.sky[2]})"></div>
          <div><div class="nm"></div><div class="who">by ${j.ini} · ${dec.slots.filter((x) => x.sound).length} friends · ${STAGE_INFO[dec.stage].name}</div></div>
          <button class="playbtn">▶ Play</button>`;
        row.querySelector('.nm').textContent = j.name;
        row.querySelector('.playbtn').addEventListener('click', () => { $('room').classList.add('hidden'); loadJam(dec, j.ini, j.name); });
        pane.appendChild(row);
      }
    } catch (e) { pane.innerHTML = '<p class="note">Couldn\'t reach the jam list. Try again in a bit.</p>'; }
  }

  let posting = false;
  async function postBest(force) {
    const st = Progress.state;
    if (posting || !st.initials || !Cloud.online || !st.best || (!force && st.best <= st.postedBest)) return;
    posting = true;
    try { if (await Cloud.postScore(st.initials, st.best, st.pid)) Progress.markPosted(st.best); } catch (e) { /* try again later */ }
    posting = false;
  }

  // ---------- initials ----------
  function pickInitials() {
    return new Promise((resolve) => {
      const cur = (Progress.state.initials || 'AAA').padEnd(3, 'A').split('');
      const row = $('iniRow');
      row.innerHTML = '';
      cur.forEach((ch, i) => {
        const col = document.createElement('div');
        col.className = 'inicol';
        col.innerHTML = `<button aria-label="Next letter">▲</button><span>${ch}</span><button aria-label="Previous letter">▼</button>`;
        const span = col.querySelector('span');
        const step = (d) => { cur[i] = String.fromCharCode(((cur[i].charCodeAt(0) - 65 + d + 26) % 26) + 65); span.textContent = cur[i]; blipUI(72 + i * 4); };
        col.querySelectorAll('button')[0].addEventListener('click', () => step(1));
        col.querySelectorAll('button')[1].addEventListener('click', () => step(-1));
        row.appendChild(col);
      });
      $('initials').classList.remove('hidden');
      $('iniOk').onclick = () => {
        $('initials').classList.add('hidden');
        Progress.setInitials(cur.join(''));
        resolve(cur.join(''));
      };
    });
  }

  // ---------- sharing ----------
  let jamName = '';
  function openShare() {
    if (!hasBand()) { toast('Add some friends first!', 1500, 0.6); return; }
    jamName = randomJamName();
    $('jamName').textContent = jamName;
    $('btnIni').textContent = Progress.state.initials || '???';
    $('shareDone').hidden = true;
    $('btnShareGo').hidden = false;
    $('share').classList.remove('hidden');
    const c = $('shareBand');
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * DPR; c.height = h * DPR;
    const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0);
    const band = slots.filter((s) => s.sound);
    band.forEach((s, i) => {
      const sz = Math.min(h * 0.9, w / band.length * 0.95);
      drawSprunkee(x, w * (i + 0.5) / band.length, h - 4, sz, { look: s.sound.look, color: s.sound.color, active: true, muted: s.muted, mouth: 0.4, t: i, zzz: false });
    });
  }
  $('btnShare').addEventListener('click', () => { if (engine) openShare(); });
  $('btnReroll').addEventListener('click', () => { jamName = randomJamName(); $('jamName').textContent = jamName; blipUI(80); });
  $('btnIni').addEventListener('click', async () => { $('btnIni').textContent = await pickInitials(); });
  $('shareClose').addEventListener('click', () => $('share').classList.add('hidden'));
  $('btnShareGo').addEventListener('click', async () => {
    const ini = Progress.state.initials || await pickInitials();
    $('btnIni').textContent = ini;
    const code = Jam.encode(engine.pendingTheme || engine.themeName, slots);
    $('shareLink').value = Jam.link(code, ini);
    let ok = false;
    if (Cloud.online) { try { ok = await Cloud.shareJam(ini, jamName, code, Progress.state.pid); } catch (e) { ok = false; } }
    $('shareDone').hidden = false;
    $('btnShareGo').hidden = true;
    document.querySelector('#shareDone .ok').textContent = ok ? 'Shared! Friends can find it in 🎵 Jams.' : 'Here\'s your jam link!';
    fanfare();
    Progress.shared();
  });
  $('btnCopy').addEventListener('click', () => {
    const v = $('shareLink').value;
    const done = () => { $('btnCopy').textContent = 'Copied!'; setTimeout(() => { $('btnCopy').textContent = 'Copy link'; }, 1500); };
    const fallback = () => { $('shareLink').select(); try { document.execCommand('copy'); done(); } catch (e) { /* user can copy by hand */ } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, fallback); else fallback();
  });

  function loadJam(dec, ini) {
    if (!engine || !dec) return;
    stopIntro();
    slots.forEach((s) => clearSlot(s, true));
    engine.forceTheme(dec.stage);
    applyStage(dec.stage);
    dec.slots.forEach((x, i) => {
      if (!x.sound) return;
      assign(slots[i], x.sound, { quiet: true });
      if (x.muted) { slots[i].muted = true; engine.setMuted(i, true); }
    });
    toast(ini ? `${ini}'S JAM!` : 'JAM TIME!', 1800, 0.8);
    fanfare();
    if (!ini || ini !== Progress.state.initials) Progress.listened();
  }

  // ---------- the shop (pretend purchases; coins come from jamming, never money) ----------
  const coinIcon = (x, cx, cy, r) => {
    const gr = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
    gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.55, '#ffc531'); gr.addColorStop(1, '#c98a00');
    x.fillStyle = gr; x.strokeStyle = '#8a5a00'; x.lineWidth = Math.max(1.5, r * 0.15);
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#8a5a00'; x.font = `800 ${Math.round(r * 1.1)}px "Baloo 2", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('S', cx, cy + r * 0.08); x.textAlign = 'start'; x.textBaseline = 'alphabetic';
  };

  function drawItemArt(x, w, h, item, t) {
    const bg = (c1, c2) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); x.fillStyle = gr; x.fillRect(0, 0, w, h); };
    const friend = (look, color) => drawSprunkee(x, w / 2, h - 6, Math.min(w * 0.55, h * 0.72), { look, color, active: true, mouth: 0.4, t, beat: (t * 1.8) % 1, pulse: 0.2, zzz: false });
    if (item.kind === 'stage') { Scene.thumb(x, w, h, item.id); return; }
    switch (item.id) {
      case 'gift': {
        bg('#ffe0f3', '#ffb3d9');
        const s = Math.min(w, h) * 0.5, cx = w / 2, cy = h * 0.58 + Math.sin(t * 4) * 3;
        x.fillStyle = '#3aa8ff'; x.fillRect(cx - s / 2, cy - s / 2, s, s);
        x.fillStyle = '#ffd23f'; x.fillRect(cx - s * 0.08, cy - s / 2, s * 0.16, s); x.fillRect(cx - s / 2, cy - s * 0.08, s, s * 0.16);
        x.fillStyle = '#5ab8ff'; x.fillRect(cx - s * 0.55, cy - s * 0.62, s * 1.1, s * 0.2);
        x.fillStyle = '#ffd23f';
        x.beginPath(); x.ellipse(cx - s * 0.18, cy - s * 0.7, s * 0.18, s * 0.1, 0.5, 0, Math.PI * 2); x.ellipse(cx + s * 0.18, cy - s * 0.7, s * 0.18, s * 0.1, -0.5, 0, Math.PI * 2); x.fill();
        break;
      }
      case 'shades': bg('#c9f7ff', '#7fd6ff'); friend({ shape: 'round', acc: 'none', eyes: 'shades', mouth: 'grin' }, '#3aa8ff'); break;
      case 'hats': bg('#fff3c4', '#ffd6a0'); friend({ shape: 'pear', acc: 'party', eyes: 'happy', mouth: 'grin' }, '#ff8a3d'); break;
      case 'rainbownotes':
        bg('#2a1460', '#4a2490');
        for (let i = 0; i < 6; i++) drawNote(x, w * (0.15 + i * 0.14), h * (0.5 + Math.sin(t * 3 + i) * 0.15), Math.min(w, h) * 0.09, `hsl(${i * 60},90%,60%)`, -0.2);
        break;
      case 'bubbles':
        bg('#9fe3ff', '#d6f6ff');
        x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 2;
        for (let i = 0; i < 9; i++) { const y = h - ((t * 30 + i * 37) % (h + 20)); x.beginPath(); x.arc(w * (0.1 + (i * 0.37) % 0.8), y, 5 + (i % 3) * 5, 0, Math.PI * 2); x.stroke(); }
        break;
      case 'disco': bg('#2a1460', '#120a2e'); discoBall(x, w / 2, h * 0.5, Math.min(w, h) * 0.28, t, w, h); break;
      case 'fireworks':
        bg('#0b0a2a', '#2b1561');
        [[0.3, 0.4, '#ff5d73'], [0.7, 0.35, '#ffd23f'], [0.5, 0.6, '#7ff5ff']].forEach(([fx, fy, col], k) => {
          const r = ((t * 0.8 + k * 0.33) % 1) * Math.min(w, h) * 0.3;
          x.fillStyle = col;
          for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.arc(w * fx + Math.cos(a) * r, h * fy + Math.sin(a) * r, 2.5, 0, Math.PI * 2); x.fill(); }
        });
        break;
    }
  }

  function discoBall(x, cx, cy, r, t, w, h) {
    x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, cy - r); x.stroke();
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
    const n = 8;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const v = (Math.sin(i * 1.7 + j * 2.3 + t * 4) + 1) / 2;
      x.fillStyle = `hsl(${(i * 30 + j * 20 + t * 60) % 360},60%,${55 + v * 35}%)`;
      x.fillRect(cx + i * r / n * 1.0 + ((t * 20) % (r / n)), cy + j * r / n, r / n - 1, r / n - 1);
    }
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    // spinning light spots
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const a = t * 0.8 + i * 0.63;
      x.fillStyle = `hsla(${i * 36},90%,65%,0.22)`;
      x.beginPath(); x.ellipse(cx + Math.cos(a) * w * 0.42, cy + Math.abs(Math.sin(a * 1.3)) * h * 0.6, 10 + (i % 3) * 6, 6 + (i % 3) * 4, 0, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }

  function fireworks(n) {
    const cols = ['#ff5d73', '#ffd23f', '#2fd38a', '#3aa8ff', '#b46bff', '#ff9be1'];
    for (let k = 0; k < n; k++) {
      setTimeout(() => {
        const cx = W * (0.15 + Math.random() * 0.7), cy = H * (0.12 + Math.random() * 0.25), col = cols[Math.floor(Math.random() * cols.length)];
        for (let i = 0; i < 36; i++) {
          const a = i * Math.PI / 18, sp = 140 + Math.random() * 60;
          particles.push({ kind: 'spark', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1, age: 0, r: 2.5, color: col });
        }
        if (engine) engine.snap(engine.bus, engine.ctx.currentTime + 0.01, 0.35, { freq: 400, q: 0.5, len: 0.5, claps: 2 });
      }, k * 260);
    }
  }

  function renderShop() {
    $('wallet').innerHTML = `🪙 ${fmt(Progress.state.coins)}`;
    const grid = $('shopGrid');
    grid.innerHTML = '';
    for (const item of SHOP) {
      const owned = Progress.owns(item.id);
      const b = document.createElement('button');
      const on = item.kind === 'extra' && Progress.isOn(item.id);
      b.className = 'item' + (item.kind === 'gift' ? ' gift' : '') + (item.price === 0 && !owned ? ' free' : '') + (owned ? (item.kind === 'extra' && !on ? ' off' : ' owned') : '');
      let label = item.price === 0 ? 'FREE!' : `🪙 ${fmt(item.price)}`;
      if (owned) label = item.kind === 'extra' ? (on ? 'ON ✓' : 'OFF') : item.kind === 'gift' ? 'Opened ✓' : 'Owned ✓';
      b.innerHTML = `<canvas></canvas><span class="nm"></span><span class="price">${label}</span>`;
      b.querySelector('.nm').textContent = item.name;
      b.addEventListener('click', () => {
        if (!owned) return openBuy(item);
        if (item.kind === 'extra') { Progress.toggle(item.id); blipUI(on ? 64 : 76); renderShop(); }
        if (item.kind === 'stage') { $('shop').classList.add('hidden'); setStage(item.id); }
      });
      grid.appendChild(b);
    }
    paintShopArt(0);
  }
  function paintShopArt(t) {
    $('shopGrid').querySelectorAll('canvas').forEach((c, i) => {
      const w = c.clientWidth || 150, h = c.clientHeight || 112;
      if (c.width !== Math.round(w * DPR)) { c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); }
      const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, w, h);
      drawItemArt(x, w, h, SHOP[i], t);
    });
  }
  $('btnShop').addEventListener('click', () => { if (!engine) return; renderShop(); $('shop').classList.remove('hidden'); });
  $('shopClose').addEventListener('click', () => $('shop').classList.add('hidden'));

  let buying = null;
  function openBuy(item) {
    buying = item;
    $('buyName').textContent = item.name;
    $('buyText').textContent = item.text;
    $('buyGo').textContent = item.price === 0 ? 'OPEN IT!' : `BUY FOR 🪙 ${fmt(item.price)}`;
    $('buyAsk').hidden = false; $('buyWait').hidden = true; $('buyDone').hidden = true;
    $('buy').classList.remove('hidden');
  }
  $('buyNo').addEventListener('click', () => { $('buy').classList.add('hidden'); buying = null; });
  $('buyGo').addEventListener('click', () => {
    const item = buying;
    if (!item) return;
    if (Progress.state.coins < item.price) {
      const sheet = $('buySheet');
      sheet.classList.remove('shake'); void sheet.offsetWidth; sheet.classList.add('shake');
      $('buyText').textContent = `You need ${fmt(item.price - Progress.state.coins)} more coins. Keep jamming to earn them!`;
      blipUI(52);
      return;
    }
    $('buyAsk').hidden = true; $('buyWait').hidden = false;
    setTimeout(() => {
      Progress.buy(item);
      $('buyWait').hidden = true; $('buyDone').hidden = false;
      document.querySelector('#buyDone .ok').textContent = item.kind === 'gift' ? `+${fmt(item.coins)} coins!` : item.kind === 'stage' ? 'New stage! Tap the moon to go there.' : "It's yours! It's on now.";
      kaching();
      coinBurst($('buyArt'));
      burstConfetti(70);
    }, 900);
  });
  $('buyOk').addEventListener('click', () => { $('buy').classList.add('hidden'); buying = null; renderShop(); });

  function kaching() {
    if (!engine) return;
    const t = engine.ctx.currentTime + 0.02;
    engine.mallet(engine.bus, t, 88, 0.25, { ratio: 2.76, pv: 0.5, len: 0.25 });
    engine.mallet(engine.bus, t + 0.09, 93, 0.3, { ratio: 2.76, pv: 0.5, len: 0.9 });
    engine.hat(engine.bus, t + 0.09, 0.6, true);
    [84, 88, 91, 96].forEach((m, i) => engine.mallet(engine.bus, t + 0.25 + i * 0.07, m, 0.12, { ratio: 3.98, pv: 0.3, len: 0.4 }));
  }

  function coinBurst(el) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 18; i++) {
      const c = document.createElement('div');
      c.className = 'coinfly';
      c.style.left = (r.left + r.width / 2 - 13) + 'px'; c.style.top = (r.top + r.height / 2 - 13) + 'px';
      document.body.appendChild(c);
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 120;
      c.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d - 60}px) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 80}px) scale(.8)`, opacity: 0 }], { duration: 1100, easing: 'cubic-bezier(.2,.7,.4,1)' });
      setTimeout(() => c.remove(), 1150);
    }
  }

  // ---------- opening theme (Ian's request) ----------
  // Decoded before the first tap so it starts instantly (iOS lesson). Missing file = no intro, no error.
  const AC = window.AudioContext || window.webkitAudioContext;
  const actx = new AC();
  let intro = null;
  const introBuf = fetch('music/intro.mp3')
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('no intro'))))
    .then((b) => new Promise((res, rej) => actx.decodeAudioData(b, res, rej)))
    .catch(() => null);

  function playIntro() {
    introBuf.then((buf) => {
      if (!buf || !engine || intro || hasBand()) return;
      const c = engine.ctx, src = c.createBufferSource(), gn = c.createGain();
      src.buffer = buf; src.loop = true;
      gn.gain.setValueAtTime(0.0001, c.currentTime);
      gn.gain.exponentialRampToValueAtTime(1.5, c.currentTime + 0.4);
      src.connect(gn); gn.connect(engine.bus); // through the limiter so it can't clip
      src.start();
      intro = { src, gn };
    });
  }

  function stopIntro() {
    if (!intro) return;
    const t = engine.ctx.currentTime;
    intro.gn.gain.cancelScheduledValues(t);
    intro.gn.gain.setTargetAtTime(0, t, 0.3);
    intro.src.stop(t + 1.6);
    intro = null;
  }

  // ---------- start ----------
  const hashJam = Jam.fromHash();
  if (hashJam && Jam.decode(hashJam.code)) {
    $('startLine').textContent = hashJam.ini ? `${hashJam.ini} sent you a jam!` : 'Someone sent you a jam!';
    $('btnPlay').textContent = 'PLAY THE JAM';
  }

  function startGame() {
    if (started) return;
    started = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    engine = new Engine(actx);
    engine.ctx.resume();
    // iOS: play a silent buffer inside the gesture to unlock output.
    const b = engine.ctx.createBufferSource();
    b.buffer = engine.ctx.createBuffer(1, 1, 22050); b.connect(engine.ctx.destination); b.start(0);
    slots.forEach((s, i) => engine.makeChannel(i, (i - (SLOTS - 1) / 2) / ((SLOTS - 1) / 2) * 0.55));

    engine.on('theme', ({ name, time }) => {
      setTimeout(() => { applyStage(name); toast(STAGE_INFO[name].name.toUpperCase() + '!', 1500, 0.7); }, Math.max(0, (time - engine.ctx.currentTime) * 1000));
    });
    engine.on('bar', ({ time, secs }) => {
      setTimeout(() => {
        const act = slots.filter((s) => s.sound && !s.muted);
        if (!act.length) return;
        const cats = new Set(act.map((s) => s.sound.cat)).size;
        const boost = act.some((s) => s.sound.special) ? 2 : 1;
        const pts = Progress.bar({ active: act.length, cats, party, stage: engine.themeName, secs, boost });
        if (pts) popPoints('+' + pts + (boost > 1 ? ' ×2' : ''));
        if (Progress.isOn('fireworks') && party && (Math.floor(time / secs) % 2 === 0)) fireworks(2);
      }, Math.max(0, (time - engine.ctx.currentTime) * 1000));
    });
    engine.on('loop', ({ step, time }) => {
      const full = slots.every((s) => s.sound && !s.muted);
      if (full && !party && !partyQueued) {
        partyQueued = true;
        engine.extras.push({ fn: bonusLayer, startStep: step, len: 64 });
        setTimeout(() => {
          partyQueued = false;
          if (!slots.every((s) => s.sound && !s.muted)) return;
          party = true; toast('SUPER JAM!', 2600);
          burstConfetti(160);
          popPoints('+' + Progress.superJam(engine.themeName), true);
          if (Progress.isOn('fireworks')) fireworks(5);
        }, Math.max(0, (time - engine.ctx.currentTime) * 1000));
      }
    });
    engine.start();
    const t = engine.ctx.currentTime + 0.05;
    [72, 76, 79, 84].forEach((m, i) => engine.mallet(engine.bus, t + i * 0.09, m, 0.2, { ratio: 3.98, pv: 0.2, len: 0.5 }));
    $('start').classList.add('hidden');
    if (hashJam && Jam.decode(hashJam.code)) {
      loadJam(Jam.decode(hashJam.code), hashJam.ini);
      history.replaceState(null, '', location.pathname + location.search);
    } else {
      playIntro();
      try { if (!localStorage.getItem('sprunkee.helped')) { $('help').classList.remove('hidden'); localStorage.setItem('sprunkee.helped', '1'); } } catch (e) { /* storage blocked */ }
    }
  }
  $('btnPlay').addEventListener('click', startGame);

  document.addEventListener('visibilitychange', () => {
    if (!engine) return;
    if (document.hidden) { engine.ctx.suspend(); postBest(); } else engine.ctx.resume();
  });
  // iOS can suspend/interrupt audio (calls, Siri, app switch). Any touch brings it back.
  const wake = () => { if (engine && !document.hidden && engine.ctx.state !== 'running') engine.ctx.resume(); };
  ['touchend', 'pointerup', 'click'].forEach((ev) => document.addEventListener(ev, wake, true));
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ---------- confetti ----------
  const CONF = ['#ff5d73', '#ffd23f', '#2fd38a', '#3aa8ff', '#b46bff', '#ff9be1', '#7ff5ff'];
  function burstConfetti(n) {
    for (let i = 0; i < n; i++) {
      confetti.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, w: 6 + Math.random() * 6, h: 10 + Math.random() * 8,
        color: CONF[i % CONF.length], age: 0 });
    }
  }

  function drawSpotlights(t) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const s of slots) {
      if (!s.sound || s.muted) continue;
      const a = 0.08 + s.pulse * 0.12 + (party ? 0.06 : 0);
      const sway = party ? Math.sin(t * 2 + s.i) * s.size * 0.6 : 0;
      const grd = g.createLinearGradient(0, 0, 0, s.y);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(1, hexA(s.sound.color, a));
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(s.x + sway - s.size * 0.12, 0); g.lineTo(s.x + sway + s.size * 0.12, 0);
      g.lineTo(s.x + s.size * 0.6, s.y); g.lineTo(s.x - s.size * 0.6, s.y); g.closePath(); g.fill();
      g.fillStyle = hexA(s.sound.color, a * 1.5);
      g.beginPath(); g.ellipse(s.x, s.y, s.size * 0.6, s.size * 0.1, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    requestAnimationFrame(frame);
    drawCardArt(t);
    if (buying) {
      const c = $('buyArt'), w = c.clientWidth, h = c.clientHeight;
      if (w) {
        if (c.width !== Math.round(w * DPR)) { c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); }
        const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, w, h);
        x.save(); x.beginPath(); x.roundRect(0, 0, w, h, 18); x.clip(); drawItemArt(x, w, h, buying, t); x.restore();
      }
    }
    if (!$('shop').classList.contains('hidden') && Math.floor(t * 30) % 2 === 0) paintShopArt(t);
    if (!W) return;

    let beat = 0, level = 0;
    if (engine) {
      const at = engine.ctx.currentTime;
      const keep = [];
      for (const h of engine.hits) {
        if (h.time <= at) {
          const s = slots[h.slot];
          if (s.sound && !s.muted) {
            s.pulse = Math.max(s.pulse, h.v);
            s.mouth = Math.max(s.mouth, h.v);
            if (h.v >= 0.8 && Math.random() < 0.55) {
              particles.push({ kind: 'note', x: s.x + (Math.random() - 0.5) * s.size * 0.6, y: s.y - s.size * 1.0,
                vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 50, life: 1.4, age: 0, r: s.size * 0.12, color: Progress.isOn('rainbownotes') ? `hsl(${Math.floor(Math.random() * 360)},90%,62%)` : s.sound.color, rot: (Math.random() - 0.5) * 0.6 });
            }
          }
        } else keep.push(h);
      }
      engine.hits = keep.length > 400 ? keep.slice(-400) : keep;
      let lb = null;
      while (engine.beatTimes.length && engine.beatTimes[0].time <= at) lb = engine.beatTimes.shift();
      if (lb) frame.lastBeat = lb.time;
      if (frame.lastBeat) beat = Math.min(1, (at - frame.lastBeat) / (engine.stepDur * 4));
      level = Math.min(1, engine.level() * 3);
      if (engine.beatTimes.length > 64) engine.beatTimes.splice(0, engine.beatTimes.length - 64);
    }

    if (party && !slots.every((s) => s.sound && !s.muted)) party = false;
    if (party && Math.random() < 0.15) burstConfetti(2);
    stageK = Math.min(1, stageK + dt * 0.8);

    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    darkness = Scene.draw(g, W, H, t, level, STAGE_LOOK[stageFrom], STAGE_LOOK[stageTo], stageK, slots[SLOTS - 1].y - 4, { party, colors: CONF });
    if (party) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = t * 1.2 + i * 1.256;
        g.fillStyle = hexA(CONF[i], 0.08);
        g.beginPath(); g.moveTo(W / 2, -20);
        g.lineTo(W / 2 + Math.cos(a) * W, H); g.lineTo(W / 2 + Math.cos(a + 0.25) * W, H); g.closePath(); g.fill();
      }
      g.restore();
    }
    if (Progress.isOn('disco')) discoBall(g, W < 640 ? W / 2 : W * 0.3, W < 640 ? meterY() + 95 : topPad() * 0.9 + 40, Math.min(W, H) * 0.06, t, W, H);
    if (Progress.isOn('bubbles') && slots.some((s) => s.sound && !s.muted) && Math.random() < 0.12) {
      particles.push({ kind: 'bubble', x: Math.random() * W, y: H + 10, vx: 0, vy: -40 - Math.random() * 40, life: 6, age: 0, r: 4 + Math.random() * 10, color: '#fff' });
    }
    drawSpotlights(t);

    const order = [...slots].sort((a, b) => a.y - b.y);
    for (const s of order) {
      s.pulse = Math.max(0, s.pulse - dt * 4);
      s.mouth = Math.max(0, s.mouth - dt * 5);
      if (t > s.blinkAt) { s.blink = 0.12; s.blinkAt = t + 2 + Math.random() * 4; }
      s.blink = Math.max(0, s.blink - dt);
      const age = (now - s.enter) / 1000;
      const pop = s.sound && age < 0.5 ? 1 + Math.sin(age / 0.5 * Math.PI) * 0.25 * (1 - age / 0.5) : 1;
      let lookX = 0, lookY = 0;
      if (pointer.active) {
        const dx = pointer.x - s.x, dy = pointer.y - (s.y - s.size * 0.6), d = Math.hypot(dx, dy) || 1;
        lookX = dx / d; lookY = dy / d;
      }
      if (s.sound && s.sound.special && !s.muted) linkAura(s, t);
      let look = s.sound ? s.sound.look : null;
      if (look && Progress.isOn('shades')) look = { ...look, eyes: 'shades' };
      if (look && Progress.isOn('hats') && !s.sound.special) look = { ...look, acc: 'party' };
      drawSprunkee(g, s.x, s.y, s.size, {
        look, color: s.sound ? s.sound.color : null, active: !!s.sound, muted: s.muted,
        pulse: s.pulse, mouth: s.mouth, blink: s.blink > 0, t: t + s.i, beat, night: darkness > 0.5, lookX, lookY,
        scale: pop * (party && s.sound ? 1 + Math.sin(t * 6 + s.i) * 0.03 : 1), hover: s.hover,
      });
      if (s.sound) {
        const b = xButton(s);
        g.fillStyle = 'rgba(255,255,255,0.92)'; g.strokeStyle = '#1d1036'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(b.x, b.y, b.r * 0.8, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = '#e8364f'; g.lineWidth = 3; g.lineCap = 'round';
        const k = b.r * 0.32;
        g.beginPath(); g.moveTo(b.x - k, b.y - k); g.lineTo(b.x + k, b.y + k); g.moveTo(b.x + k, b.y - k); g.lineTo(b.x - k, b.y + k); g.stroke();
        g.font = `800 ${Math.max(12, Math.round(s.size * 0.15))}px "Baloo 2", sans-serif`;
        g.textAlign = 'center';
        g.fillStyle = s.muted ? 'rgba(255,255,255,0.55)' : '#fff';
        g.strokeStyle = 'rgba(29,16,54,0.8)'; g.lineWidth = 4; g.lineJoin = 'round';
        g.strokeText(s.sound.name, s.x, s.y + s.size * 0.2);
        g.fillText(s.sound.name, s.x, s.y + s.size * 0.2);
        g.textAlign = 'start';
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age > p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = 1 - p.age / p.life;
      if (p.kind === 'note') { p.vx += Math.sin(p.age * 5) * 4; drawNote(g, p.x, p.y, p.r, p.color, p.rot); } else if (p.kind === 'bubble') {
        g.globalAlpha = Math.min(1, (1 - p.age / p.life) * 2) * 0.85; p.x += Math.sin(p.age * 3) * 0.6;
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.2, 0, Math.PI * 2); g.fill();
      } else if (p.kind === 'spark') { p.vy += 120 * dt; p.vx *= 0.98; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); } else { p.vy += 400 * dt; p.vx *= 0.97; drawStar(g, p.x, p.y, p.r, p.color); }
    }
    g.globalAlpha = 1;

    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.age += dt; c.x += c.vx * dt + Math.sin(c.age * 3) * 0.6; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.y > H + 20) { confetti.splice(i, 1); continue; }
      g.save(); g.translate(c.x, c.y); g.rotate(c.rot);
      g.fillStyle = c.color; g.fillRect(-c.w / 2, -c.h / 2 * Math.abs(Math.cos(c.age * 4)), c.w, c.h * Math.abs(Math.cos(c.age * 4)));
      g.restore();
    }

    // star meter + this jam's points
    if (engine) {
      const filled = slots.filter((s) => s.sound && !s.muted).length;
      const mw = Math.min(300, W * 0.7), mx = W / 2 - mw / 2, my = meterY();
      const sw = mw * 0.64;
      g.fillStyle = 'rgba(20,10,45,0.6)';
      g.beginPath(); g.roundRect(mx - 8, my - 15, mw + 16, 30, 15); g.fill();
      for (let i = 0; i < SLOTS; i++) {
        const on = i < filled;
        drawStar(g, mx + (i + 0.5) * sw / SLOTS, my, on ? 9 + (party ? Math.sin(t * 10 + i) * 2 : 0) : 7, on ? '#ffd23f' : 'rgba(255,255,255,0.25)');
      }
      shownPts += (Progress.jam.pts - shownPts) * Math.min(1, dt * 6);
      if (Math.abs(Progress.jam.pts - shownPts) < 1) shownPts = Progress.jam.pts;
      g.font = '800 18px "Baloo 2", sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillStyle = party ? '#ffd23f' : '#fff';
      g.fillText(fmt(shownPts), mx + mw, my + 1);
      g.textAlign = 'start'; g.textBaseline = 'alphabetic';
      // coins
      const cy = my + 30, label = fmt(Progress.state.coins);
      g.font = '800 15px "Baloo 2", sans-serif';
      const cw = g.measureText(label).width + 40;
      g.fillStyle = 'rgba(20,10,45,0.6)';
      g.beginPath(); g.roundRect(W / 2 - cw / 2, cy - 12, cw, 24, 12); g.fill();
      coinIcon(g, W / 2 - cw / 2 + 14, cy, 8);
      g.fillStyle = '#ffd23f'; g.textBaseline = 'middle'; g.fillText(label, W / 2 - cw / 2 + 28, cy + 1); g.textBaseline = 'alphabetic';
      if (slots.some((s) => s.sound && s.sound.special && !s.muted)) {
        g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center';
        g.strokeStyle = 'rgba(29,16,54,0.85)'; g.lineWidth = 4; g.lineJoin = 'round';
        g.strokeText('LINK BOOST ×2', W / 2, cy + 28);
        g.fillStyle = `hsl(${(t * 120) % 360},95%,65%)`;
        g.fillText('LINK BOOST ×2', W / 2, cy + 28);
        g.textAlign = 'start';
      }
    }
  }

  // Link's rainbow glow and orbiting stars
  function linkAura(s, t) {
    const cx = s.x, cy = s.y - s.size * 0.45, R = s.size * (0.75 + s.pulse * 0.08);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = `hsla(${(i * 60 + t * 90) % 360},95%,60%,0.35)`;
      g.lineWidth = s.size * 0.05;
      g.beginPath(); g.arc(cx, cy, R + i * s.size * 0.035, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
    for (let i = 0; i < 5; i++) {
      const a = t * 1.6 + i * Math.PI * 2 / 5;
      drawStar(g, cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 0.5, s.size * 0.06, i % 2 ? '#fff6b0' : '#ffd23f');
    }
  }

  // ---------- title screen animation ----------
  const sc = $('startCanvas'), sg = sc.getContext('2d');
  const titleCast = [SOUNDS[0], SOUNDS[6], soundById('link'), SOUNDS[18], SOUNDS[15]];
  function titleFrame(now) {
    if (started) return;
    requestAnimationFrame(titleFrame);
    const r = sc.getBoundingClientRect();
    if (sc.width !== Math.round(r.width * DPR)) { sc.width = Math.round(r.width * DPR); sc.height = Math.round(r.height * DPR); }
    sg.setTransform(DPR, 0, 0, DPR, 0, 0);
    sg.clearRect(0, 0, r.width, r.height);
    const t = now / 1000, n = titleCast.length;
    titleCast.forEach((snd, i) => {
      const beat = (t * 110 / 60 + i * 0.25) % 1;
      const big = snd.special ? 1.25 : 1;
      drawSprunkee(sg, r.width * (i + 0.5) / n, r.height - 6 - Math.abs(Math.sin(beat * Math.PI)) * 10, Math.min(r.width / n * 0.8, r.height * 0.62) * big, {
        look: snd.look, color: snd.color, active: true, pulse: Math.pow(1 - beat, 4) * 0.6, mouth: Math.pow(1 - beat, 3), t: t + i, beat, zzz: false,
      });
    });
  }

  // ---------- boot ----------
  buildTray();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); paintIcons(); });
  requestAnimationFrame(frame);
  requestAnimationFrame(titleFrame);

  if ('serviceWorker' in navigator && location.protocol === 'https:' && /github\.io$/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // test hooks
  window.__sprunkee = {
    slots, assign: (i, id) => assign(slots[i], soundById(id)), loadJam: (code, ini) => loadJam(Jam.decode(code), ini), setStage,
    get engine() { return engine; }, get party() { return party; }, get intro() { return !!intro; }, get stage() { return stageTo; },
  };
})();
