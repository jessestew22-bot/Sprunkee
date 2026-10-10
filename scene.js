// Sprunkee backdrops: one look per stage, blended when the stage changes.
'use strict';

const STAGE_LOOK = {
  day:   { sky: ['#6ec8ff', '#bfe6ff', '#ffd6ec'], hill: ['#8be08f', '#5fcf74'], floor: ['#ffb3d9', '#e08bc0'], orb: 'sun', fx: 'clouds', meta: '#2a1460', dark: 0 },
  night: { sky: ['#0b0a2a', '#2b1561', '#5b2a86'], hill: ['#3b2a7a', '#2a1d5c'], floor: ['#3a1f6e', '#1a0d3d'], orb: 'moon', fx: 'flies', meta: '#0b0a2a', dark: 1 },
  beach: { sky: ['#ff8e6e', '#ffc58a', '#ffe7b8'], hill: ['#2bb3c9', '#f3d08a'], floor: ['#ffe0a3', '#e9b96e'], orb: 'sunset', fx: 'palms', meta: '#ff8e6e', dark: 0 },
  candy: { sky: ['#ffb3e6', '#ffd6f2', '#c9f7ff'], hill: ['#ff8fd0', '#7ee8c8'], floor: ['#fff0a8', '#ffc0e0'], orb: 'sun', fx: 'candy', meta: '#ff8fd0', dark: 0 },
  space: { sky: ['#05030f', '#1a0b3a', '#3a1466'], hill: ['#6a5aa0', '#3a2d66'], floor: ['#2a2350', '#120d2a'], orb: 'planet', fx: 'comets', meta: '#05030f', dark: 1 },
  snow:  { sky: ['#8ccaff', '#d6efff', '#f4fbff'], hill: ['#ffffff', '#dcecff'], floor: ['#eef7ff', '#b8d8f5'], orb: 'sun', fx: 'snow', meta: '#4f95d6', dark: 0 },
};

const Scene = (() => {
  const rnd = (n, f) => Array.from({ length: n }, f);
  const stars = rnd(90, () => ({ x: Math.random(), y: Math.random() * 0.62, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 }));
  const clouds = rnd(6, (_, i) => ({ x: Math.random(), y: 0.08 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.8, v: 0.004 + i * 0.002 }));
  const flies = rnd(24, () => ({ x: Math.random(), y: 0.3 + Math.random() * 0.5, p: Math.random() * 10 }));
  const flakes = rnd(80, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, v: 0.03 + Math.random() * 0.05, p: Math.random() * 6 }));
  const comets = rnd(3, (_, i) => ({ t0: i * 3.3, y: 0.08 + Math.random() * 0.3 }));
  const mix = (a, b, k) => (k <= 0 ? a : k >= 1 ? b : mixColor(a, b, k));

  function orb(c, w, h, type, level, sky) {
    const R = Math.min(w, h) * 0.08 * (1 + level * 0.25);
    let cx = w * 0.82, cy = h * 0.2;
    if (type === 'sunset') { cx = w * 0.72; cy = h * 0.5; }
    const glow = (col, r) => {
      const gr = c.createRadialGradient(cx, cy, R * 0.3, cx, cy, r);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    };
    if (type === 'sun') { glow('rgba(255,240,150,0.9)', R * 2.4); c.fillStyle = '#ffe066'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill(); }
    if (type === 'sunset') { glow('rgba(255,170,90,0.9)', R * 3.2); c.fillStyle = '#ff7b3d'; c.beginPath(); c.arc(cx, cy, R * 1.6, 0, Math.PI * 2); c.fill(); }
    if (type === 'moon') {
      glow('rgba(210,200,255,0.6)', R * 2.2);
      c.fillStyle = '#f4f0ff'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = sky; c.beginPath(); c.arc(cx + R * 0.45, cy - R * 0.25, R * 0.85, 0, Math.PI * 2); c.fill();
    }
    if (type === 'planet') {
      glow('rgba(190,120,255,0.5)', R * 2.6);
      c.fillStyle = '#c084fc'; c.beginPath(); c.arc(cx, cy, R * 1.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(cx - R * 0.3, cy - R * 0.3, R * 0.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd23f'; c.lineWidth = Math.max(2, R * 0.12);
      c.beginPath(); c.ellipse(cx, cy, R * 1.9, R * 0.45, -0.35, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#7ff5ff'; c.beginPath(); c.arc(cx - R * 2.6, cy + R * 0.9, R * 0.28, 0, Math.PI * 2); c.fill();
    }
  }

  function cloudShape(c, x, y, s) {
    c.beginPath();
    c.arc(x, y, s, 0, Math.PI * 2); c.arc(x + s * 0.9, y + s * 0.15, s * 0.75, 0, Math.PI * 2);
    c.arc(x - s * 0.9, y + s * 0.2, s * 0.65, 0, Math.PI * 2); c.arc(x + s * 0.3, y - s * 0.45, s * 0.7, 0, Math.PI * 2);
    c.fill();
  }

  function palm(c, x, y, s, t) {
    c.strokeStyle = '#7a4a1f'; c.lineWidth = s * 0.07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.18, y - s * 0.5, x + s * 0.08, y - s); c.stroke();
    c.fillStyle = '#2f9e44';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 1.5 + i) * 0.05;
      c.save(); c.translate(x + s * 0.08, y - s); c.rotate(a);
      c.beginPath(); c.ellipse(s * 0.25, 0, s * 0.27, s * 0.06, 0.25, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  function lolly(c, x, y, s, cols) {
    c.strokeStyle = '#fff'; c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s); c.stroke();
    for (let i = 3; i >= 1; i--) { c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(x, y - s, s * 0.12 * i, 0, Math.PI * 2); c.fill(); }
  }

  function fx(c, w, h, type, t, alpha, floorY) {
    if (alpha <= 0.01) return;
    c.save(); c.globalAlpha = alpha;
    if (type === 'clouds' || type === 'snow') {
      for (const cl of clouds) {
        const x = ((cl.x + t * cl.v * 0.25) % 1.4 - 0.2) * w, s = cl.s * Math.min(w, h) * 0.08;
        c.fillStyle = type === 'snow' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.85)';
        cloudShape(c, x, cl.y * h, s);
      }
    }
    if (type === 'flies') {
      for (const f of flies) {
        const x = (f.x + Math.sin(t * 0.3 + f.p) * 0.03) * w, y = (f.y + Math.cos(t * 0.4 + f.p) * 0.03) * h;
        c.globalAlpha = alpha * (0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + f.p)));
        const gr = c.createRadialGradient(x, y, 0, x, y, 8);
        gr.addColorStop(0, '#fff9a8'); gr.addColorStop(1, 'rgba(255,249,168,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
      }
    }
    if (type === 'comets') {
      for (const cm of comets) {
        const k = ((t + cm.t0) % 10) / 1.6;
        if (k > 1) continue;
        const x = w * (1.1 - k * 1.3), y = h * (cm.y + k * 0.25);
        const gr = c.createLinearGradient(x, y, x + w * 0.15, y - h * 0.05);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.strokeStyle = gr; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.15, y - h * 0.05); c.stroke();
      }
    }
    if (type === 'snow') {
      c.fillStyle = '#fff';
      for (const f of flakes) {
        const y = ((f.y + t * f.v) % 1) * h, x = (f.x + Math.sin(t + f.p) * 0.02) * w;
        c.beginPath(); c.arc(x, y, f.r, 0, Math.PI * 2); c.fill();
      }
    }
    if (type === 'palms') {
      const s = Math.min(h * 0.5, w * 0.3);
      palm(c, w * 0.05, floorY, s, t); palm(c, w * 0.96, floorY, s * 0.85, t + 1);
      // sea sparkles
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const x = ((i * 0.13 + t * 0.02) % 1) * w, y = h * (0.62 + (i % 3) * 0.025);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.03, y); c.stroke();
      }
    }
    if (type === 'candy') {
      const s = Math.min(h * 0.32, w * 0.2);
      lolly(c, w * 0.08, floorY - 4, s, ['#ff5d73', '#fff', '#3aa8ff']);
      lolly(c, w * 0.92, floorY - 4, s * 0.8, ['#b46bff', '#fff', '#ffd23f']);
      lolly(c, w * 0.6, h * 0.66, s * 0.5, ['#2fd38a', '#fff', '#ff9be1']);
      for (let i = 0; i < 6; i++) { // gumdrops on the hills
        c.fillStyle = ['#ff5d73', '#ffd23f', '#2fd38a', '#3aa8ff', '#b46bff', '#ff9be1'][i];
        const x = w * (0.15 + i * 0.13), y = h * (0.66 + (i % 2) * 0.04);
        c.beginPath(); c.arc(x, y, Math.max(4, w * 0.012), Math.PI, 0); c.fill();
      }
    }
    c.restore();
  }

  /** Draw a full backdrop. A/B = stage looks, k = blend (0 = A, 1 = B). */
  function draw(c, w, h, t, level, A, B, k, floorY, lights) {
    const col = (part, i) => mix(A[part][i], B[part][i], k);
    const dark = A.dark + (B.dark - A.dark) * k;
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, col('sky', 0)); sky.addColorStop(0.55, col('sky', 1)); sky.addColorStop(1, col('sky', 2));
    c.fillStyle = sky; c.fillRect(0, 0, w, h);

    if (dark > 0.01) {
      c.fillStyle = '#fff';
      for (const s of stars) {
        c.globalAlpha = dark * (0.5 + 0.5 * Math.sin(t * 2 + s.p));
        c.beginPath(); c.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }

    // sun / moon / planet: cross-fade when the type changes
    if (A.orb === B.orb) orb(c, w, h, B.orb, level, col('sky', 1));
    else {
      c.globalAlpha = 1 - k; orb(c, w, h, A.orb, level, col('sky', 1));
      c.globalAlpha = k; orb(c, w, h, B.orb, level, col('sky', 1));
      c.globalAlpha = 1;
    }
    const sameFx = A.fx === B.fx;
    const backFx = (type) => type === 'clouds' || type === 'snow' || type === 'comets';
    if (sameFx) { if (backFx(B.fx)) fx(c, w, h, B.fx, t, 1, floorY); } else {
      if (backFx(A.fx)) fx(c, w, h, A.fx, t, 1 - k, floorY);
      if (backFx(B.fx)) fx(c, w, h, B.fx, t, k, floorY);
    }

    // hills, gently bouncing to the music
    [[0.62, 0.05, 1.3, 0.05], [0.7, 0.04, 2.1, 0.09]].forEach(([hy, ha, hf, sp], i) => {
      c.fillStyle = col('hill', i);
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w + 10; x += 10) {
        c.lineTo(x, h * hy - Math.sin(x / w * Math.PI * hf + t * sp + i) * h * ha - level * h * 0.02 * (i + 1) * Math.sin(x / 60 + t * 3));
      }
      c.lineTo(w, h); c.closePath(); c.fill();
    });

    // stage floor + lights
    const fg = c.createLinearGradient(0, floorY - 20, 0, h);
    fg.addColorStop(0, col('floor', 0)); fg.addColorStop(1, col('floor', 1));
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(0, h); c.lineTo(0, floorY - 12); c.quadraticCurveTo(w / 2, floorY - 40, w, floorY - 12); c.lineTo(w, h); c.closePath(); c.fill();
    if (lights) {
      for (let i = 0; i < 14; i++) {
        const on = lights.party ? (Math.floor(t * 8) + i) % 3 === 0 : i % 2 === 0;
        c.fillStyle = on ? lights.colors[i % lights.colors.length] : 'rgba(255,255,255,0.25)';
        c.globalAlpha = on ? 0.9 : 0.5;
        c.beginPath(); c.arc((i + 0.5) * w / 14, floorY + (h - floorY) * 0.55, Math.max(3, w * 0.006), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }

    if (sameFx) { if (!backFx(B.fx)) fx(c, w, h, B.fx, t, 1, floorY); } else {
      if (!backFx(A.fx)) fx(c, w, h, A.fx, t, 1 - k, floorY);
      if (!backFx(B.fx)) fx(c, w, h, B.fx, t, k, floorY);
    }
    return dark;
  }

  /** A still thumbnail of one stage. */
  function thumb(c, w, h, stage) {
    const L = STAGE_LOOK[stage];
    draw(c, w, h, 1.5, 0, L, L, 1, h * 0.86, null);
  }

  return { draw, thumb };
})();

window.STAGE_LOOK = STAGE_LOOK;
window.Scene = Scene;
