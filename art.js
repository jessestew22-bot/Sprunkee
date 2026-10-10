// Sprunkee art: every character, prop and backdrop is drawn in code.
'use strict';

const OUTLINE = '#1d1036';
const IDLE_COLOR = '#a6abc2';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// Body outline paths. (0,0) is the bottom-centre; body spans y in [-h, 0].
function bodyPath(g, shape, w, h) {
  g.beginPath();
  const r = w / 2;
  switch (shape) {
    case 'tall':
      g.moveTo(-r * 0.85, 0);
      g.bezierCurveTo(-r * 1.0, -h * 0.5, -r * 0.95, -h, 0, -h);
      g.bezierCurveTo(r * 0.95, -h, r * 1.0, -h * 0.5, r * 0.85, 0);
      g.quadraticCurveTo(0, h * 0.06, -r * 0.85, 0);
      break;
    case 'square': {
      const k = r * 0.45;
      g.moveTo(-r + k, -h); g.lineTo(r - k, -h); g.quadraticCurveTo(r, -h, r, -h + k);
      g.lineTo(r, -k); g.quadraticCurveTo(r, 0, r - k, 0); g.lineTo(-r + k, 0);
      g.quadraticCurveTo(-r, 0, -r, -k); g.lineTo(-r, -h + k); g.quadraticCurveTo(-r, -h, -r + k, -h);
      break;
    }
    case 'pear':
      g.moveTo(0, -h);
      g.bezierCurveTo(r * 0.75, -h, r * 0.6, -h * 0.62, r * 0.95, -h * 0.35);
      g.bezierCurveTo(r * 1.25, -h * 0.02, r * 0.5, 0, 0, 0);
      g.bezierCurveTo(-r * 0.5, 0, -r * 1.25, -h * 0.02, -r * 0.95, -h * 0.35);
      g.bezierCurveTo(-r * 0.6, -h * 0.62, -r * 0.75, -h, 0, -h);
      break;
    case 'cloud': {
      g.moveTo(-r * 0.9, -h * 0.1);
      g.bezierCurveTo(-r * 1.25, -h * 0.4, -r * 1.05, -h * 0.75, -r * 0.62, -h * 0.78);
      g.bezierCurveTo(-r * 0.55, -h * 1.05, r * 0.0, -h * 1.08, r * 0.1, -h * 0.92);
      g.bezierCurveTo(r * 0.45, -h * 1.08, r * 0.95, -h * 0.9, r * 0.82, -h * 0.65);
      g.bezierCurveTo(r * 1.25, -h * 0.5, r * 1.2, -h * 0.05, r * 0.8, 0);
      g.quadraticCurveTo(0, h * 0.05, -r * 0.9, -h * 0.1);
      break;
    }
    default: // round
      g.moveTo(0, -h);
      g.bezierCurveTo(r * 1.1, -h, r * 1.05, 0, 0, 0);
      g.bezierCurveTo(-r * 1.05, 0, -r * 1.1, -h, 0, -h);
  }
  g.closePath();
}

const SHAPE_H = { round: 1.0, tall: 1.3, square: 0.95, pear: 1.1, cloud: 0.95 };

/**
 * Draw one Sprunkee.
 * s: { look, color, active, muted, pulse, mouth, blink, t, beat, night, lookX, lookY, glow, scale, hover }
 */
function drawSprunkee(g, x, y, size, s) {
  const look = s.look || { shape: 'round', eyes: 'sleepy', mouth: 'smile' };
  const active = s.active && !s.muted;
  const col = s.active ? s.color : IDLE_COLOR;
  const w = size * 0.78;
  const h = size * 0.82 * (SHAPE_H[look.shape] || 1);
  const t = s.t || 0;
  const pulse = s.pulse || 0;
  const beat = s.beat || 0; // 0..1 phase within the beat
  const bob = active ? Math.pow(1 - beat, 3) : 0;
  const sq = 1 + pulse * 0.1 + bob * 0.04;
  const sx = s.active ? 1 / Math.sqrt(sq) * (1 + pulse * 0.05) : 1 + Math.sin(t * 1.5 + x) * 0.015;
  const sy = s.active ? (active ? 1 - pulse * 0.07 + bob * 0.03 : 0.94) : 1 - Math.sin(t * 1.5 + x) * 0.02;
  const scale = s.scale === undefined ? 1 : s.scale;
  const tilt = active ? Math.sin(t * Math.PI * (110 / 60) * 0.5 + x) * 0.05 : (s.muted ? 0.08 : Math.sin(t * 0.8 + x) * 0.03);

  g.save();
  g.translate(x, y);

  // floor shadow
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(0, 2, w * 0.55 * scale * (1 + pulse * 0.08), size * 0.07 * scale, 0, 0, Math.PI * 2);
  g.fill();

  g.scale(scale * sx, scale * sy);
  g.rotate(tilt);

  // hover / drop target ring
  if (s.hover) {
    g.strokeStyle = 'rgba(255,230,120,0.95)';
    g.lineWidth = size * 0.04;
    g.setLineDash([size * 0.08, size * 0.06]);
    g.lineDashOffset = -t * 40;
    g.beginPath(); g.ellipse(0, -h * 0.5, w * 0.72, h * 0.66, 0, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }

  // night glow
  if (s.night && active) {
    g.shadowColor = col;
    g.shadowBlur = size * (0.25 + pulse * 0.35);
  }

  const lw = Math.max(2, size * 0.035);
  g.lineWidth = lw;
  g.strokeStyle = OUTLINE;
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // feet (tap with the beat)
  const tap = active ? Math.max(0, Math.sin(beat * Math.PI)) * size * 0.04 : 0;
  g.fillStyle = shade(col.startsWith('#') ? col : IDLE_COLOR, -0.25);
  [-1, 1].forEach((side, i) => {
    g.beginPath();
    g.ellipse(side * w * 0.22, -size * 0.01 - (i === 0 ? tap : 0), w * 0.17, size * 0.065, 0, 0, Math.PI * 2);
    g.fill(); g.stroke();
  });

  // arms
  const armUp = active ? pulse * 0.9 + Math.sin(t * 6 + x) * 0.08 : (s.muted ? -0.2 : 0);
  g.fillStyle = col;
  [-1, 1].forEach((side) => {
    g.save();
    g.translate(side * w * 0.47, -h * 0.42);
    g.rotate(side * (0.5 + armUp * (side > 0 ? 1 : 0.6)) * -1 + (side > 0 ? 0 : 0));
    g.beginPath();
    g.ellipse(side * w * 0.08, -w * 0.02, w * 0.14, w * 0.09, side * -0.5 - side * armUp, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.restore();
  });

  // body
  const grad = g.createLinearGradient(-w * 0.5, -h, w * 0.4, 0);
  grad.addColorStop(0, shade(col.startsWith('#') ? col : IDLE_COLOR, 0.35));
  grad.addColorStop(0.55, col);
  grad.addColorStop(1, shade(col.startsWith('#') ? col : IDLE_COLOR, -0.2));
  bodyPath(g, look.shape, w, h);
  g.fillStyle = grad;
  g.fill();
  g.shadowBlur = 0;
  g.stroke();

  // belly + shine
  g.save();
  bodyPath(g, look.shape, w, h);
  g.clip();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.ellipse(0, -h * 0.22, w * 0.3, h * 0.2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath(); g.ellipse(-w * 0.24, -h * 0.78, w * 0.08, h * 0.05, -0.6, 0, Math.PI * 2); g.fill();
  g.restore();

  const faceY = -h * (look.shape === 'tall' ? 0.66 : 0.6);
  drawEyes(g, look.eyes, s, w, faceY, size, lw);
  drawMouth(g, look.mouth, s, w, faceY + h * 0.2, size, lw);
  if (s.active) drawAccessory(g, look.acc, s, w, h, size, lw, col);

  // cheeks
  g.fillStyle = 'rgba(255,120,150,0.45)';
  g.beginPath(); g.ellipse(-w * 0.3, faceY + h * 0.13, w * 0.07, w * 0.04, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(w * 0.3, faceY + h * 0.13, w * 0.07, w * 0.04, 0, 0, Math.PI * 2); g.fill();

  g.restore();

  // sleepy Zzz for idle / hushed friends
  if (!active && s.zzz !== false) {
    g.save();
    g.fillStyle = s.muted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)';
    g.font = `800 ${Math.round(size * 0.16)}px "Baloo 2", sans-serif`;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.5 + i / 3) % 1);
      g.globalAlpha = Math.sin(k * Math.PI);
      g.fillText('z', x + w * 0.35 + k * size * 0.25, y - h * scale - k * size * 0.35);
    }
    g.restore();
  }
}

function drawEyes(g, type, s, w, y, size, lw) {
  const ex = w * 0.19, r = w * 0.13;
  const closed = s.blink || s.muted || !s.active;
  const lx = (s.lookX || 0) * r * 0.45, ly = (s.lookY || 0) * r * 0.4;
  g.lineWidth = lw;
  g.strokeStyle = OUTLINE;
  if (closed && type !== 'shades') {
    g.beginPath();
    [-1, 1].forEach((sd) => {
      if (!s.active) { // sleepy closed arcs
        g.moveTo(sd * ex - r * 0.8, y); g.quadraticCurveTo(sd * ex, y + r * 0.7, sd * ex + r * 0.8, y);
      } else {
        g.moveTo(sd * ex - r * 0.8, y); g.lineTo(sd * ex + r * 0.8, y);
      }
    });
    g.stroke();
    return;
  }
  const drawBall = (cx, rr) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(cx, y, rr, rr * 1.15, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = OUTLINE;
    g.beginPath(); g.arc(cx + lx, y + ly + rr * 0.1, rr * 0.55, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx + lx - rr * 0.2, y + ly - rr * 0.15, rr * 0.2, 0, Math.PI * 2); g.fill();
  };
  switch (type) {
    case 'happy':
      g.beginPath();
      [-1, 1].forEach((sd) => { g.moveTo(sd * ex - r * 0.8, y + r * 0.3); g.quadraticCurveTo(sd * ex, y - r * 1.1, sd * ex + r * 0.8, y + r * 0.3); });
      g.stroke();
      break;
    case 'sleepy':
      [-1, 1].forEach((sd) => drawBall(sd * ex, r));
      g.fillStyle = s.color || IDLE_COLOR;
      [-1, 1].forEach((sd) => {
        g.beginPath(); g.ellipse(sd * ex, y - r * 0.2, r * 1.08, r * 0.8, 0, Math.PI, 0); g.fill();
        g.beginPath(); g.moveTo(sd * ex - r, y - r * 0.15); g.lineTo(sd * ex + r, y - r * 0.15); g.stroke();
      });
      break;
    case 'shades':
      g.fillStyle = '#111';
      g.beginPath();
      g.roundRect(-ex - r * 1.3, y - r * 0.8, r * 2.4, r * 1.5, r * 0.5);
      g.roundRect(ex - r * 1.1, y - r * 0.8, r * 2.4, r * 1.5, r * 0.5);
      g.fill();
      g.beginPath(); g.moveTo(-ex + r, y - r * 0.3); g.lineTo(ex - r, y - r * 0.3); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(-ex - r * 0.8, y - r * 0.55, r * 0.6, r * 0.25);
      g.fillRect(ex - r * 0.6, y - r * 0.55, r * 0.6, r * 0.25);
      break;
    case 'one':
      drawBall(0, r * 1.5);
      break;
    case 'pixel':
      [-1, 1].forEach((sd) => {
        g.fillStyle = '#fff'; g.fillRect(sd * ex - r, y - r, r * 2, r * 2); g.strokeRect(sd * ex - r, y - r, r * 2, r * 2);
        g.fillStyle = OUTLINE; g.fillRect(sd * ex - r * 0.5 + lx, y - r * 0.4 + ly, r, r);
      });
      break;
    case 'lashes':
      [-1, 1].forEach((sd) => {
        drawBall(sd * ex, r);
        g.beginPath();
        for (let i = -1; i <= 1; i++) {
          const a = -Math.PI / 2 + i * 0.5 + sd * 0.3;
          g.moveTo(sd * ex + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.25);
          g.lineTo(sd * ex + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.75);
        }
        g.stroke();
      });
      break;
    default:
      [-1, 1].forEach((sd) => drawBall(sd * ex, r * 1.1));
  }
}

function drawMouth(g, type, s, w, y, size, lw) {
  const m = s.active && !s.muted ? (s.mouth || 0) : 0;
  g.lineWidth = lw;
  g.strokeStyle = OUTLINE;
  if (!s.active || s.muted) {
    g.beginPath();
    if (s.muted) { g.moveTo(-w * 0.07, y); g.lineTo(w * 0.07, y); } else { g.arc(0, y - w * 0.02, w * 0.06, 0.2, Math.PI - 0.2); }
    g.stroke();
    return;
  }
  const open = (rx, ry) => {
    g.fillStyle = '#5a1530';
    g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    if (ry > w * 0.06) {
      g.save(); g.clip();
      g.fillStyle = '#ff7a9a';
      g.beginPath(); g.ellipse(0, y + ry * 0.7, rx * 0.7, ry * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  };
  switch (type) {
    case 'grin':
      g.fillStyle = '#5a1530';
      g.beginPath();
      g.moveTo(-w * 0.17, y - w * 0.03);
      g.quadraticCurveTo(0, y - w * 0.06, w * 0.17, y - w * 0.03);
      g.quadraticCurveTo(w * 0.12, y + w * (0.12 + m * 0.08), 0, y + w * (0.13 + m * 0.08));
      g.quadraticCurveTo(-w * 0.12, y + w * (0.12 + m * 0.08), -w * 0.17, y - w * 0.03);
      g.fill(); g.stroke();
      g.fillStyle = '#fff';
      g.fillRect(-w * 0.09, y - w * 0.035, w * 0.18, w * 0.04);
      break;
    case 'o':
      open(w * (0.06 + m * 0.03), w * (0.06 + m * 0.07));
      break;
    case 'sing':
      open(w * (0.07 + m * 0.03), w * (0.03 + m * 0.11));
      break;
    case 'shout':
      open(w * (0.09 + m * 0.06), w * (0.04 + m * 0.13));
      break;
    default: // smile
      if (m > 0.15) open(w * 0.1, w * (0.03 + m * 0.07));
      else { g.beginPath(); g.arc(0, y - w * 0.05, w * 0.11, 0.25, Math.PI - 0.25); g.stroke(); }
  }
}

function drawAccessory(g, acc, s, w, h, size, lw, col) {
  const top = -h;
  const t = s.t || 0;
  const dark = shade(col, -0.35);
  g.lineWidth = lw;
  g.strokeStyle = OUTLINE;
  switch (acc) {
    case 'headphones':
      g.strokeStyle = '#333';
      g.lineWidth = lw * 2.2;
      g.beginPath(); g.arc(0, top + h * 0.42, w * 0.5, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.lineWidth = lw;
      g.strokeStyle = OUTLINE;
      g.fillStyle = '#ffd23f';
      [-1, 1].forEach((sd) => { g.beginPath(); g.roundRect(sd * w * 0.5 - w * 0.09, top + h * 0.3, w * 0.18, h * 0.24, w * 0.06); g.fill(); g.stroke(); });
      break;
    case 'cap':
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.ellipse(0, top + h * 0.1, w * 0.36, h * 0.13, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffb000';
      g.beginPath(); g.ellipse(w * 0.3, top + h * 0.1, w * 0.26, h * 0.04, 0.1, 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'antenna': {
      const wob = Math.sin(t * 8) * w * 0.05 * (1 + (s.pulse || 0) * 2);
      g.beginPath(); g.moveTo(0, top + 2); g.quadraticCurveTo(wob, top - h * 0.2, wob * 2, top - h * 0.32); g.stroke();
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(wob * 2, top - h * 0.34, w * 0.07 * (1 + (s.pulse || 0) * 0.4), 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    }
    case 'mic':
      g.save(); g.translate(w * 0.62, top + h * 0.55); g.rotate(-0.4);
      g.fillStyle = '#444'; g.fillRect(-w * 0.03, 0, w * 0.06, h * 0.25); g.strokeRect(-w * 0.03, 0, w * 0.06, h * 0.25);
      g.fillStyle = '#ccc'; g.beginPath(); g.arc(0, 0, w * 0.08, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
      break;
    case 'bandana':
      g.fillStyle = '#ff3d3d';
      g.beginPath(); g.ellipse(0, top + h * 0.12, w * 0.4, h * 0.08, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#fff';
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * w * 0.13, top + h * 0.12, w * 0.02, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ff3d3d';
      g.beginPath(); g.moveTo(w * 0.36, top + h * 0.12); g.lineTo(w * 0.55, top + h * 0.05 + Math.sin(t * 9) * 3); g.lineTo(w * 0.52, top + h * 0.2); g.closePath(); g.fill(); g.stroke();
      break;
    case 'horns':
      g.fillStyle = '#fff6d6';
      [-1, 1].forEach((sd) => {
        g.beginPath(); g.moveTo(sd * w * 0.18, top + h * 0.05);
        g.quadraticCurveTo(sd * w * 0.35, top - h * 0.1, sd * w * 0.3, top - h * 0.25);
        g.quadraticCurveTo(sd * w * 0.22, top - h * 0.08, sd * w * 0.06, top + h * 0.04);
        g.closePath(); g.fill(); g.stroke();
      });
      break;
    case 'zigzag':
      g.fillStyle = '#ffe94a';
      g.beginPath();
      g.moveTo(-w * 0.05, top + 2); g.lineTo(w * 0.08, top - h * 0.13); g.lineTo(-w * 0.02, top - h * 0.13);
      g.lineTo(w * 0.1, top - h * 0.3); g.lineTo(-w * 0.12, top - h * 0.1); g.lineTo(-w * 0.02, top - h * 0.1);
      g.lineTo(-w * 0.12, top + 2); g.closePath(); g.fill(); g.stroke();
      break;
    case 'bubble': {
      const by = top - h * 0.18 - Math.sin(t * 3) * h * 0.04;
      g.fillStyle = 'rgba(200,250,255,0.55)';
      g.beginPath(); g.arc(0, by, w * 0.15 * (1 + (s.pulse || 0) * 0.3), 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(-w * 0.05, by - w * 0.05, w * 0.035, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(200,250,255,0.55)';
      g.beginPath(); g.arc(w * 0.18, by + h * 0.1, w * 0.06, 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    }
    case 'propeller': {
      g.beginPath(); g.moveTo(0, top + 2); g.lineTo(0, top - h * 0.12); g.stroke();
      const a = t * 14, len = w * 0.32 * Math.abs(Math.cos(a));
      g.fillStyle = '#ff5d73';
      g.beginPath(); g.ellipse(-len / 2, top - h * 0.12, len / 2 + 1, h * 0.035, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#3aa8ff';
      g.beginPath(); g.ellipse(len / 2, top - h * 0.12, len / 2 + 1, h * 0.035, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, top - h * 0.12, w * 0.035, 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    }
    case 'sprout':
      g.strokeStyle = '#1f7a3a';
      g.beginPath(); g.moveTo(0, top + h * 0.05); g.quadraticCurveTo(w * 0.04, top - h * 0.08, 0, top - h * 0.14); g.stroke();
      g.strokeStyle = OUTLINE;
      g.fillStyle = '#7ee08a';
      [-1, 1].forEach((sd) => {
        g.save(); g.translate(0, top - h * 0.12); g.rotate(sd * (0.6 + Math.sin(t * 3) * 0.15));
        g.beginPath(); g.ellipse(sd * w * 0.1, 0, w * 0.1, w * 0.05, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.restore();
      });
      break;
    case 'beanie':
      g.fillStyle = '#ff8a3d';
      g.beginPath(); g.ellipse(0, top + h * 0.16, w * 0.4, h * 0.2, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.roundRect(-w * 0.42, top + h * 0.12, w * 0.84, h * 0.08, h * 0.03); g.fill(); g.stroke();
      g.beginPath(); g.arc(0, top - h * 0.05, w * 0.07, 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'tophat':
      g.fillStyle = '#2b2b3a';
      g.beginPath(); g.ellipse(0, top + h * 0.04, w * 0.34, h * 0.04, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(-w * 0.2, top - h * 0.24, w * 0.4, h * 0.27, 3); g.fill(); g.stroke();
      g.fillStyle = '#ff5d73'; g.fillRect(-w * 0.2, top - h * 0.04, w * 0.4, h * 0.05);
      break;
    case 'visor':
      g.fillStyle = 'rgba(80,220,255,0.75)';
      g.beginPath(); g.roundRect(-w * 0.46, top + h * 0.22, w * 0.92, h * 0.2, h * 0.08); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-w * 0.36, top + h * 0.25, w * 0.2, h * 0.04);
      break;
    case 'bunny':
      g.fillStyle = s.color;
      [-1, 1].forEach((sd) => {
        g.save(); g.translate(sd * w * 0.18, top + h * 0.12); g.rotate(sd * (0.25 + Math.sin(t * 4 + sd) * 0.08));
        g.beginPath(); g.ellipse(0, -h * 0.25, w * 0.09, h * 0.27, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#ffc0dd'; g.beginPath(); g.ellipse(0, -h * 0.25, w * 0.04, h * 0.18, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = s.color;
        g.restore();
      });
      break;
    case 'glasses':
      g.lineWidth = lw * 1.2;
      g.beginPath();
      [-1, 1].forEach((sd) => { g.moveTo(sd * w * 0.19 + w * 0.15, -h * 0.6); g.arc(sd * w * 0.19, -h * 0.6, w * 0.15, 0, Math.PI * 2); });
      g.moveTo(-w * 0.04, -h * 0.62); g.lineTo(w * 0.04, -h * 0.62);
      g.stroke();
      break;
    case 'bowtie':
      g.fillStyle = '#ff3d7f';
      g.beginPath();
      g.moveTo(0, -h * 0.28); g.lineTo(-w * 0.16, -h * 0.36); g.lineTo(-w * 0.16, -h * 0.2); g.closePath();
      g.moveTo(0, -h * 0.28); g.lineTo(w * 0.16, -h * 0.36); g.lineTo(w * 0.16, -h * 0.2); g.closePath();
      g.fill(); g.stroke();
      g.beginPath(); g.arc(0, -h * 0.28, w * 0.035, 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'halo':
      g.strokeStyle = '#ffe066';
      g.lineWidth = lw * 1.8;
      g.shadowColor = '#fff3a0'; g.shadowBlur = size * 0.15;
      g.beginPath(); g.ellipse(0, top - h * 0.12 - Math.sin(t * 2) * h * 0.03, w * 0.28, h * 0.06, 0, 0, Math.PI * 2); g.stroke();
      g.shadowBlur = 0;
      break;
    case 'crown':
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.moveTo(-w * 0.25, top + h * 0.06); g.lineTo(-w * 0.28, top - h * 0.16); g.lineTo(-w * 0.12, top - h * 0.04);
      g.lineTo(0, top - h * 0.2); g.lineTo(w * 0.12, top - h * 0.04); g.lineTo(w * 0.28, top - h * 0.16); g.lineTo(w * 0.25, top + h * 0.06);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff3d7f'; g.beginPath(); g.arc(0, top - h * 0.03, w * 0.035, 0, Math.PI * 2); g.fill();
      break;
    case 'bow':
      g.fillStyle = '#ff3d7f';
      g.save(); g.translate(w * 0.22, top + h * 0.08); g.rotate(0.3);
      g.beginPath();
      g.moveTo(0, 0); g.quadraticCurveTo(-w * 0.2, -h * 0.14, -w * 0.18, h * 0.06); g.closePath();
      g.moveTo(0, 0); g.quadraticCurveTo(w * 0.2, -h * 0.14, w * 0.18, h * 0.06); g.closePath();
      g.fill(); g.stroke();
      g.beginPath(); g.arc(0, 0, w * 0.04, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
      break;
    case 'mohawk':
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(-w * 0.16, top + h * 0.06);
      for (let i = 0; i < 5; i++) {
        const xx = -w * 0.16 + (i + 0.5) * (w * 0.32 / 5);
        g.lineTo(xx, top - h * (0.16 + (i === 2 ? 0.06 : 0)) - (s.pulse || 0) * h * 0.04);
        g.lineTo(xx + w * 0.032, top + h * 0.02);
      }
      g.lineTo(w * 0.16, top + h * 0.06);
      g.closePath(); g.fill(); g.stroke();
      break;
  }
}

// ---------- particles ----------
function drawNote(g, x, y, size, color, rot) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = Math.max(1.5, size * 0.12);
  g.beginPath(); g.ellipse(0, 0, size * 0.42, size * 0.32, -0.4, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(size * 0.36, -size * 0.1); g.lineTo(size * 0.36, -size * 1.2);
  g.quadraticCurveTo(size * 0.8, -size * 0.9, size * 0.75, -size * 0.55); g.stroke();
  g.restore();
}

function drawStar(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

window.drawSprunkee = drawSprunkee;
window.drawNote = drawNote;
window.drawStar = drawStar;
window.shadeColor = shade;
window.mixColor = mix;
