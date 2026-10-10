// Sprunkee: game logic, layout, input and the render loop.
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
  let nightMix = 0;             // 0 = day, 1 = night (animated)
  let nightTarget = 0;
  let party = false, partyStart = 0, partyQueued = false;
  let started = false;
  const particles = [];
  const confetti = [];
  const pointer = { x: -1, y: -1, active: false };
  let drag = null;              // { sound, el, moved, startX, startY, id }

  const slots = Array.from({ length: SLOTS }, (_, i) => ({
    i, sound: null, muted: false, pulse: 0, mouth: 0, enter: 0, blinkAt: 2 + Math.random() * 4, blink: 0,
    x: 0, y: 0, size: 100, hover: false,
  }));

  // ---------- logo ----------
  $('logo').innerHTML = 'SPRUNKEE'.split('').map((c) => `<span>${c}</span>`).join('');

  // ---------- toolbar icons ----------
  const SVG = {
    moon: '<svg viewBox="0 0 24 24"><path fill="#ffe680" d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffd23f"/><g stroke="#ffd23f" stroke-width="2.4" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g></svg>',
    dice: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="#fff"/><g fill="#6a3bd1"><circle cx="8" cy="8" r="1.8"/><circle cx="16" cy="8" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="8" cy="16" r="1.8"/><circle cx="16" cy="16" r="1.8"/></g></svg>',
    clear: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg>',
  };
  $('btnNight').innerHTML = SVG.moon;
  $('btnShuffle').innerHTML = SVG.dice;
  $('btnClear').innerHTML = SVG.clear;

  // ---------- tray ----------
  const iconEls = {};
  function buildTray() {
    tray.innerHTML = '';
    for (const cat of CATS) {
      const grp = document.createElement('div');
      grp.className = 'group';
      grp.innerHTML = `<h3 style="color:${cat.color}">${cat.name}</h3>`;
      const icons = document.createElement('div');
      icons.className = 'icons';
      for (const snd of SOUNDS.filter((s) => s.cat === cat.id)) {
        const b = document.createElement('button');
        b.className = 'icon';
        b.style.background = cat.color;
        b.setAttribute('aria-label', snd.name);
        b.title = snd.name;
        const c = document.createElement('canvas');
        b.appendChild(c);
        icons.appendChild(b);
        iconEls[snd.id] = b;
        b.addEventListener('pointerdown', (ev) => onIconDown(ev, snd));
      }
      grp.appendChild(icons);
      tray.appendChild(grp);
    }
    iconEls[SOUNDS[0].id].classList.add('hint');
  }

  function paintIcon(c, snd, px) {
    c.width = c.height = px * DPR;
    const x = c.getContext('2d');
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cat = CATS.find((k) => k.id === snd.cat);
    const grad = x.createRadialGradient(px * 0.35, px * 0.3, 2, px / 2, px / 2, px * 0.7);
    grad.addColorStop(0, shadeColor(cat.color, 0.35)); grad.addColorStop(1, cat.color);
    x.fillStyle = grad; x.fillRect(0, 0, px, px);
    drawSprunkee(x, px / 2, px * 1.05, px * 0.92, { look: snd.look, color: snd.color, active: true, mouth: 0.3, t: 0, zzz: false });
  }

  function perRow() { return window.innerWidth / window.innerHeight <= 1 || window.innerHeight >= 700 ? 3 : 5; }

  function paintIcons() {
    const isz = iconSize();
    tray.style.setProperty('--isz', isz + 'px');
    tray.style.setProperty('--iw', (perRow() * isz + (perRow() - 1) * 6 + 2) + 'px');
    for (const snd of SOUNDS) paintIcon(iconEls[snd.id].querySelector('canvas'), snd, isz);
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

  // ---------- layout ----------
  function layout() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    paintIcons();
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    // keep big iPad screens smooth: cap the stage at ~3.2 megapixels
    DPR = Math.min(DPR, Math.sqrt(3.2e6 / Math.max(1, W * H)));
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

  // portrait phones: the star meter drops below the buttons
  function topPad() { return W < 640 ? 104 : Math.min(80, H * 0.16); }
  function meterY() { return W < 640 ? 82 : topPad() - 18; }

  // ---------- sound assignment ----------
  function isUsed(snd) { return slots.some((s) => s.sound === snd); }

  function assign(slot, snd) {
    if (!engine) return;
    const prev = slot.sound;
    const old = slots.find((s) => s.sound === snd);
    if (old && old !== slot) clearSlot(old, true);
    slot.sound = snd; slot.muted = false; slot.enter = performance.now();
    engine.setSound(slot.i, snd);
    if (prev) iconEls[prev.id].classList.remove('used');
    iconEls[snd.id].classList.add('used');
    iconEls[SOUNDS[0].id].classList.remove('hint');
    poof(slot, snd.color, 26);
    blipUI(70 + slot.i * 2);
  }

  function clearSlot(slot, quiet) {
    if (!slot.sound) return;
    iconEls[slot.sound.id].classList.remove('used');
    if (!quiet) poof(slot, '#ffffff', 14);
    slot.sound = null; slot.muted = false;
    engine.setSound(slot.i, null);
  }

  function toggleMute(slot) {
    slot.muted = !slot.muted;
    engine.setMuted(slot.i, slot.muted);
    slot.pulse = 0.6;
  }

  function firstEmpty() { return slots.find((s) => !s.sound); }

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
      // tap: send to the first free friend (or bring a used sound home)
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
      const cx = s.x, cy = s.y - s.size * 0.5;
      const d = Math.hypot((x - cx) / (s.size * 0.6), (y - cy) / (s.size * 0.75));
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

  // ---------- toolbar ----------
  $('btnNight').addEventListener('click', () => {
    if (!engine) return;
    const next = (engine.pendingTheme || engine.themeName) === 'day' ? 'night' : 'day';
    engine.setTheme(next);
    $('btnNight').innerHTML = next === 'night' ? SVG.sun : SVG.moon;
    if (!slots.some((s) => s.sound)) { engine.themeName = next; engine.theme = THEMES[next]; engine.pendingTheme = null; applyTheme(next); }
  });
  $('btnShuffle').addEventListener('click', () => {
    if (!engine) return;
    slots.forEach((s) => clearSlot(s, true));
    const pick = [];
    for (const cat of CATS) {
      const list = SOUNDS.filter((s) => s.cat === cat.id);
      pick.push(list[Math.floor(Math.random() * list.length)]);
    }
    const rest = SOUNDS.filter((s) => !pick.includes(s)).sort(() => Math.random() - 0.5);
    const n = 4 + Math.floor(Math.random() * 2);
    pick.push(...rest.slice(0, n - 4));
    pick.forEach((snd, i) => assign(slots[i], snd));
  });
  $('btnClear').addEventListener('click', () => { if (engine) slots.forEach((s) => clearSlot(s)); });
  $('btnHelp').addEventListener('click', () => $('help').classList.remove('hidden'));
  $('btnHelpOk').addEventListener('click', () => $('help').classList.add('hidden'));

  // ---------- feedback ----------
  function toast(text, ms = 1600, scale = 1) {
    toastEl.textContent = text;
    toastEl.style.fontSize = scale !== 1 ? `clamp(24px, ${9 * scale}vw, ${90 * scale}px)` : '';
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function blipUI(midi) {
    if (!engine) return;
    const t = engine.ctx.currentTime + 0.01;
    engine.mallet(engine.bus, t, midi, 0.12, { ratio: 3, pv: 0.2, len: 0.2 });
  }

  function poof(slot, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 220;
      particles.push({ kind: 'dot', x: slot.x, y: slot.y - slot.size * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.6 + Math.random() * 0.4, age: 0, r: 3 + Math.random() * 6, color });
    }
  }

  function applyTheme(name) {
    nightTarget = name === 'night' ? 1 : 0;
    document.querySelector('meta[name=theme-color]').setAttribute('content', name === 'night' ? '#0b0a2a' : '#2a1460');
  }

  // ---------- start ----------
  function startGame() {
    if (started) return;
    started = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    engine = new Engine();
    engine.ctx.resume();
    // iOS: play a silent buffer inside the gesture to unlock output.
    const b = engine.ctx.createBufferSource();
    b.buffer = engine.ctx.createBuffer(1, 1, 22050); b.connect(engine.ctx.destination); b.start(0);
    slots.forEach((s, i) => engine.makeChannel(i, (i - (SLOTS - 1) / 2) / ((SLOTS - 1) / 2) * 0.55));
    engine.on('theme', ({ name, time }) => {
      const d = Math.max(0, (time - engine.ctx.currentTime) * 1000);
      setTimeout(() => { applyTheme(name); toast(name === 'night' ? 'NIGHT TIME!' : 'GOOD MORNING!', 1500, 0.8); }, d);
    });
    engine.on('loop', ({ step, time }) => {
      const full = slots.every((s) => s.sound && !s.muted);
      if (full && !party && !partyQueued) {
        partyQueued = true;
        engine.extras.push({ fn: bonusLayer, startStep: step, len: 64 });
        const d = Math.max(0, (time - engine.ctx.currentTime) * 1000);
        setTimeout(() => {
          partyQueued = false;
          if (!slots.every((s) => s.sound && !s.muted)) return;
          party = true; partyStart = performance.now(); toast('SUPER JAM!', 2600);
          burstConfetti(160);
        }, d);
      }
    });
    engine.start();
    // welcome jingle
    const t = engine.ctx.currentTime + 0.05;
    [72, 76, 79, 84].forEach((m, i) => engine.mallet(engine.bus, t + i * 0.09, m, 0.2, { ratio: 3.98, pv: 0.2, len: 0.5 }));
    $('start').classList.add('hidden');
    try { if (!localStorage.getItem('sprunkee.helped')) { $('help').classList.remove('hidden'); localStorage.setItem('sprunkee.helped', '1'); } } catch (e) { /* storage blocked */ }
  }
  $('btnPlay').addEventListener('click', startGame);

  document.addEventListener('visibilitychange', () => {
    if (!engine) return;
    if (document.hidden) engine.ctx.suspend(); else engine.ctx.resume();
  });
  // iOS can suspend/interrupt audio (calls, Siri, app switch). Any touch brings it back.
  const wake = () => { if (engine && !document.hidden && engine.ctx.state !== 'running') engine.ctx.resume(); };
  ['touchend', 'pointerup', 'click'].forEach((ev) => document.addEventListener(ev, wake, true));
  // no pinch-zoom / double-tap zoom in the middle of a jam
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

  // ---------- background ----------
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 }));
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: 0.08 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.8, v: 0.004 + i * 0.002 }));
  const flies = Array.from({ length: 24 }, () => ({ x: Math.random(), y: 0.3 + Math.random() * 0.5, p: Math.random() * 10 }));

  function lerpCol(a, b, k) { return mixColor(a, b, k); }

  function drawBackground(t, level) {
    const n = nightMix;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, lerpCol('#6ec8ff', '#0b0a2a', n));
    sky.addColorStop(0.55, lerpCol('#bfe6ff', '#2b1561', n));
    sky.addColorStop(1, lerpCol('#ffd6ec', '#5b2a86', n));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    // stars
    if (n > 0.01) {
      for (const s of stars) {
        g.globalAlpha = n * (0.5 + 0.5 * Math.sin(t * 2 + s.p));
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }

    // sun / moon
    const cx = W * 0.82, cy = H * 0.2 + n * H * 0.02, R = Math.min(W, H) * 0.08 * (1 + level * 0.25);
    if (n < 0.99) {
      g.globalAlpha = 1 - n;
      const sg = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 2.4);
      sg.addColorStop(0, 'rgba(255,240,150,0.9)'); sg.addColorStop(1, 'rgba(255,240,150,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, R * 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffe066'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    if (n > 0.01) {
      g.globalAlpha = n;
      const mg = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 2.2);
      mg.addColorStop(0, 'rgba(210,200,255,0.6)'); mg.addColorStop(1, 'rgba(210,200,255,0)');
      g.fillStyle = mg; g.beginPath(); g.arc(cx, cy, R * 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f4f0ff'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      g.fillStyle = lerpCol('#bfe6ff', '#2b1561', n);
      g.beginPath(); g.arc(cx + R * 0.45, cy - R * 0.25, R * 0.85, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }

    // clouds
    for (const c of clouds) {
      c.x += c.v / 60;
      if (c.x > 1.2) c.x = -0.2;
      const x = c.x * W, y = c.y * H, s = c.s * Math.min(W, H) * 0.08;
      g.fillStyle = n > 0.5 ? `rgba(120,100,200,${0.35 * n})` : `rgba(255,255,255,${0.85 * (1 - n)})`;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2); g.arc(x + s * 0.9, y + s * 0.15, s * 0.75, 0, Math.PI * 2);
      g.arc(x - s * 0.9, y + s * 0.2, s * 0.65, 0, Math.PI * 2); g.arc(x + s * 0.3, y - s * 0.45, s * 0.7, 0, Math.PI * 2);
      g.fill();
    }

    // hills (parallax, gently bouncing to the music)
    const hills = [
      { y: 0.62, a: 0.05, f: 1.3, c1: '#8be08f', c2: '#3b2a7a', sp: 0.05 },
      { y: 0.7, a: 0.04, f: 2.1, c1: '#5fcf74', c2: '#2a1d5c', sp: 0.09 },
    ];
    hills.forEach((hl, k) => {
      g.fillStyle = lerpCol(hl.c1, hl.c2, n);
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) {
        const y = H * hl.y - Math.sin(x / W * Math.PI * hl.f + t * hl.sp + k) * H * hl.a - level * H * 0.02 * (k + 1) * Math.sin(x / 60 + t * 3);
        g.lineTo(x, y);
      }
      g.lineTo(W, H); g.closePath(); g.fill();
    });

    // stage floor
    const fy = slots[slots.length - 1].y - 4;
    const fg = g.createLinearGradient(0, fy - 20, 0, H);
    fg.addColorStop(0, lerpCol('#ffb3d9', '#3a1f6e', n));
    fg.addColorStop(1, lerpCol('#e08bc0', '#1a0d3d', n));
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(0, H); g.lineTo(0, fy - 12);
    g.quadraticCurveTo(W / 2, fy - 40, W, fy - 12);
    g.lineTo(W, H); g.closePath(); g.fill();
    // floor lights
    for (let i = 0; i < 14; i++) {
      const x = (i + 0.5) * W / 14;
      const on = party ? (Math.floor(t * 8) + i) % 3 === 0 : (i % 2 === 0);
      g.fillStyle = on ? CONF[i % CONF.length] : 'rgba(255,255,255,0.25)';
      g.globalAlpha = on ? 0.9 : 0.5;
      g.beginPath(); g.arc(x, fy + (H - fy) * 0.55, Math.max(3, W * 0.006), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    // fireflies at night
    if (n > 0.05) {
      for (const f of flies) {
        const x = (f.x + Math.sin(t * 0.3 + f.p) * 0.03) * W, y = (f.y + Math.cos(t * 0.4 + f.p) * 0.03) * H;
        g.globalAlpha = n * (0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + f.p)));
        const fg2 = g.createRadialGradient(x, y, 0, x, y, 8);
        fg2.addColorStop(0, '#fff9a8'); fg2.addColorStop(1, 'rgba(255,249,168,0)');
        g.fillStyle = fg2; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
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
    if (!W) return;

    let beat = 0, level = 0;
    if (engine) {
      const at = engine.ctx.currentTime;
      // visual hits
      const keep = [];
      for (const h of engine.hits) {
        if (h.time <= at) {
          const s = slots[h.slot];
          if (s.sound && !s.muted) {
            s.pulse = Math.max(s.pulse, h.v);
            s.mouth = Math.max(s.mouth, h.v);
            if (h.v >= 0.8 && Math.random() < 0.55) {
              particles.push({ kind: 'note', x: s.x + (Math.random() - 0.5) * s.size * 0.6, y: s.y - s.size * 1.0,
                vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 50, life: 1.4, age: 0, r: s.size * 0.12, color: s.sound.color, rot: (Math.random() - 0.5) * 0.6 });
            }
          }
        } else keep.push(h);
      }
      engine.hits = keep.length > 400 ? keep.slice(-400) : keep;
      // beat phase
      let lb = null;
      while (engine.beatTimes.length && engine.beatTimes[0].time <= at) lb = engine.beatTimes.shift();
      if (lb) frame.lastBeat = lb.time;
      if (frame.lastBeat) beat = Math.min(1, (at - frame.lastBeat) / (engine.stepDur * 4));
      level = Math.min(1, engine.level() * 3);
      if (engine.beatTimes.length > 64) engine.beatTimes.splice(0, engine.beatTimes.length - 64);
    }

    // party ends when someone leaves or hushes
    if (party && !slots.every((s) => s.sound && !s.muted)) party = false;
    if (party && Math.random() < 0.15) burstConfetti(2);

    nightMix += (nightTarget - nightMix) * Math.min(1, dt * 2.5);

    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground(t, level);
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
    drawSpotlights(t);

    // characters (back row first)
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
      drawSprunkee(g, s.x, s.y, s.size, {
        look: s.sound ? s.sound.look : null, color: s.sound ? s.sound.color : null, active: !!s.sound, muted: s.muted,
        pulse: s.pulse, mouth: s.mouth, blink: s.blink > 0, t: t + s.i, beat, night: nightMix > 0.5, lookX, lookY,
        scale: pop * (party && s.sound ? 1 + Math.sin(t * 6 + s.i) * 0.03 : 1), hover: s.hover,
      });
      if (s.sound) {
        // name tag + remove button
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

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age > p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = 1 - p.age / p.life;
      if (p.kind === 'note') {
        p.vx += Math.sin(p.age * 5) * 4;
        drawNote(g, p.x, p.y, p.r, p.color, p.rot);
      } else {
        p.vy += 400 * dt; p.vx *= 0.97;
        drawStar(g, p.x, p.y, p.r, p.color);
      }
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

    // jam meter
    if (engine) {
      const filled = slots.filter((s) => s.sound && !s.muted).length;
      const mw = Math.min(260, W * 0.6), mx = W / 2 - mw / 2, my = meterY();
      g.fillStyle = 'rgba(20,10,45,0.55)';
      g.beginPath(); g.roundRect(mx - 8, my - 14, mw + 16, 28, 14); g.fill();
      for (let i = 0; i < SLOTS; i++) {
        const on = i < filled;
        drawStar(g, mx + (i + 0.5) * mw / SLOTS, my, on ? 10 + (party ? Math.sin(t * 10 + i) * 2 : 0) : 8, on ? '#ffd23f' : 'rgba(255,255,255,0.25)');
      }
    }
  }

  // ---------- title screen animation ----------
  const sc = $('startCanvas'), sg = sc.getContext('2d');
  const titleCast = [SOUNDS[0], SOUNDS[6], SOUNDS[11], SOUNDS[18], SOUNDS[15]];
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
      drawSprunkee(sg, r.width * (i + 0.5) / n, r.height - 6 - Math.abs(Math.sin(beat * Math.PI)) * 10, Math.min(r.width / n * 0.8, r.height * 0.62), {
        look: snd.look, color: snd.color, active: true, pulse: Math.pow(1 - beat, 4) * 0.6, mouth: Math.pow(1 - beat, 3), t: t + i, beat, zzz: false,
      });
    });
  }

  // ---------- boot ----------
  buildTray();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  requestAnimationFrame(frame);
  requestAnimationFrame(titleFrame);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // test hooks
  window.__sprunkee = { slots, assign: (i, id) => assign(slots[i], SOUNDS.find((s) => s.id === id)), get engine() { return engine; }, get party() { return party; } };
})();
