'use strict';
// Bolt Buddy v1 for Alex's Arcade - core: screen, math, input, buttons, drawing helpers, particles, camera, save.
const VH = 600; let VW = 1200;
const cv = document.getElementById('c'), cx = cv.getContext('2d');
let dpr = 1, sc = 1, ox = 0, oy = 0, SW = 0, SH = 0, DPR_CAP = 2;
const QS = new URLSearchParams(location.search);
const TS = Math.max(1, Math.min(8, +QS.get('ts') || 1)); // test-only time scale (bot)
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP); SW = window.innerWidth || 1200; SH = window.innerHeight || 600;
  cv.width = Math.round(SW * dpr); cv.height = Math.round(SH * dpr); cv.style.width = SW + 'px'; cv.style.height = SH + 'px';
  VW = Math.max(900, Math.min(1400, SW / SH * VH)); sc = Math.min(SH / VH, SW / VW); ox = (SW - VW * sc) / 2; oy = (SH - VH * sc) / 2;
}
window.addEventListener('resize', resize);
// rotation hardening (from Turbo Toy Racers): re-measure on every orientation signal, then poll ~1.2 s
(function () {
  let until = 0, raf = 0;
  function chk() { const w = window.innerWidth, h = window.innerHeight; if (w && h && (w !== SW || h !== SH)) resize(); if (performance.now() < until) raf = requestAnimationFrame(chk); else raf = 0; }
  function kick() { resize(); until = performance.now() + 1200; if (!raf) raf = requestAnimationFrame(chk); }
  window.addEventListener('resize', kick); window.addEventListener('orientationchange', kick);
  try { if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', kick); } catch (e) {}
  if (window.visualViewport) window.visualViewport.addEventListener('resize', kick);
})();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, hyp = Math.hypot, rnd = (a, b) => a + Math.random() * (b - a), PI = Math.PI, TAU = PI * 2;
const pick = a => a[(Math.random() * a.length) | 0];
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3), easeIn = t => Math.pow(clamp(t, 0, 1), 3);
const easeBack = t => { const c = 1.7; t = clamp(t, 0, 1); return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeElastic = t => { t = clamp(t, 0, 1); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; };
const now = () => performance.now();
// rotating picker that never repeats the last choice
function rotor(list) { let last = -1; return () => { if (list.length < 2) return list[0]; let i; do i = (Math.random() * list.length) | 0; while (i === last); last = i; return list[i]; }; }

// ===== images =====
const IMG = {};
function loadImg(n, src) { const i = new Image(); i.decoding = 'async'; i.src = src; IMG[n] = i; }
const okI = i => i && i.complete && i.naturalWidth > 0;
['bg_hub', 'bg_talk', 'bg_gobble', 'bg_space', 'bg_boss', 'items'].forEach(n => loadImg(n, 'img/' + n + '.webp'));
const ITEMS = ['nut', 'bolt', 'block', 'ball', 'duck', 'bear', 'car', 'star'];
function drawItem(k, x, y, size, rot, alpha) {
  const im = IMG.items; const i = ITEMS.indexOf(k);
  if (!okI(im) || i < 0) { circ(x, y, size / 2, '#fc3'); return; }
  cx.save(); cx.translate(x, y); if (rot) cx.rotate(rot); if (alpha != null) cx.globalAlpha *= alpha;
  cx.drawImage(im, i * 160, 0, 160, 160, -size / 2, -size / 2, size, size); cx.restore();
}
function cover(img, x, y, w, h, fx, fy) { // draw image covering the rect (focus fx,fy 0..1)
  if (!okI(img)) return false;
  const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
  cx.drawImage(img, x + (w - dw) * (fx == null ? .5 : fx), y + (h - dh) * (fy == null ? .5 : fy), dw, dh); return true;
}

// ===== save =====
const SAVE_KEY = 'bolt-buddy-v1';
const DEF = { kid: 'Alex', bot: 'Bolt', color: 0, hat: 0, bolts: 0, fills: 0, total: 0, unlock: { c: 3, h: 4 }, all: false, plays: { gobble: 0, rocket: 0, hero: 0 }, stars: 0, talkMode: 'conv', talkWait: 'normal', debug: false };
let SV = JSON.parse(JSON.stringify(DEF));
function loadSave() { try { const p = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (p) SV = Object.assign(JSON.parse(JSON.stringify(DEF)), p); } catch (e) {} }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) {} }
const CORE_CAP = 30;
const level = () => SV.fills >= 3 ? 2 : SV.fills >= 1 ? 1 : 0; // 0 Mini, 1 Big, 2 Mega
const LEVEL_NAMES = ['Mini Bot', 'Big Bot', 'Mega Bot'];
const isAlex = () => SV.kid.trim().toLowerCase() === 'alex';
const isBolt = () => SV.bot.trim().toLowerCase() === 'bolt';

// ===== drawing helpers =====
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function circ(x, y, r, c) { cx.beginPath(); cx.arc(x, y, Math.max(0, r), 0, TAU); cx.fillStyle = c; cx.fill(); }
const FONT = '"Arial Rounded MT Bold","Baloo 2","Nunito","Trebuchet MS",system-ui,sans-serif';
function txt(s, x, y, size, col, o) {
  o = o || {}; cx.save(); cx.font = (o.w || 900) + ' ' + size + 'px ' + FONT; cx.textAlign = o.al || 'center'; cx.textBaseline = 'middle';
  if (o.rot) { cx.translate(x, y); cx.rotate(o.rot); x = 0; y = 0; }
  if (o.stroke !== false) { cx.lineJoin = 'round'; cx.lineWidth = o.lw || Math.max(3, size * .2); cx.strokeStyle = o.stroke || 'rgba(20,14,60,.9)'; cx.strokeText(s, x, y); }
  if (o.grad) { const g = cx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, o.grad[0]); g.addColorStop(1, o.grad[1]); cx.fillStyle = g; } else cx.fillStyle = col;
  cx.fillText(s, x, y); cx.restore();
}
function star5(x, y, r, col, rot) {
  cx.save(); cx.translate(x, y); if (rot) cx.rotate(rot); cx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr2 = i % 2 ? r * .48 : r; cx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  cx.closePath(); cx.fillStyle = col; cx.fill(); cx.restore();
}
function shade(hex, a) { // a>0 lighten, a<0 darken
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (a > 0) { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; } else { r *= 1 + a; g *= 1 + a; b *= 1 + a; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
// glossy round button (3D toy look); returns nothing, registers nothing
function glossBall(x, y, r, col, o) {
  o = o || {};
  cx.save();
  cx.fillStyle = 'rgba(0,0,0,.28)'; cx.beginPath(); cx.ellipse(x, y + r * .92, r * .82, r * .2, 0, 0, TAU); cx.fill();
  const g = cx.createRadialGradient(x - r * .35, y - r * .45, r * .1, x, y, r * 1.05);
  g.addColorStop(0, shade(col, .55)); g.addColorStop(.45, col); g.addColorStop(1, shade(col, -.45));
  cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fillStyle = g; cx.fill();
  cx.lineWidth = Math.max(2, r * .07); cx.strokeStyle = o.rim || 'rgba(255,255,255,.75)'; cx.stroke();
  const h = cx.createLinearGradient(0, y - r, 0, y); h.addColorStop(0, 'rgba(255,255,255,.75)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  cx.beginPath(); cx.ellipse(x, y - r * .45, r * .66, r * .38, 0, 0, TAU); cx.fillStyle = h; cx.fill();
  cx.restore();
}
// cached soft glow sprite
const GLOWS = {};
function glowSpr(col) {
  if (GLOWS[col]) return GLOWS[col];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, col); gr.addColorStop(.35, col.replace(/[\d.]+\)$/, '0.45)')); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return GLOWS[col] = c;
}
function glow(x, y, r, col, a) { const s = glowSpr(col || 'rgba(120,255,250,1)'); cx.save(); if (a != null) cx.globalAlpha *= a; cx.globalCompositeOperation = 'lighter'; cx.drawImage(s, x - r, y - r, r * 2, r * 2); cx.restore(); }
function rays(x, y, n, len, w, col, rot) {
  cx.save(); cx.translate(x, y); cx.rotate(rot || 0); cx.fillStyle = col;
  for (let k = 0; k < n; k++) { cx.rotate(TAU / n); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(len, -w); cx.lineTo(len, w); cx.fill(); }
  cx.restore();
}

// ===== particles (pooled, capped) =====
const FX = []; const FX_MAX = 260; let LITE = /[?&]lite=1/.test(location.search); // LITE: still slow at DPR 1 -> fewer particles
function fx(o) { if (FX.length >= (LITE ? 110 : FX_MAX)) FX.shift(); o.t = 0; o.life = o.life || 1; o.vx = o.vx || 0; o.vy = o.vy || 0; o.g = o.g || 0; o.rot = o.rot || 0; o.vr = o.vr || 0; FX.push(o); return o; }
function burst(x, y, n, o) {
  o = o || {}; const cols = o.cols || ['#ffd23f', '#7ff', '#ff7ac6', '#9f7bff', '#fff', '#7dff7a'];
  if (LITE) n = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), sp = rnd(o.sp0 || 120, o.sp1 || 420);
    fx({ k: o.k || pick(['star', 'conf', 'dot']), x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 80), g: o.g == null ? 520 : o.g, life: rnd(.6, 1.2) * (o.life || 1), s: rnd(6, 14) * (o.size || 1), c: pick(cols), rot: rnd(0, TAU), vr: rnd(-8, 8) });
  }
}
function stepFx(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t += dt; if (f.t >= f.life) { FX.splice(i, 1); continue; }
    f.vy += f.g * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; if (f.drag) { f.vx *= Math.pow(f.drag, dt); f.vy *= Math.pow(f.drag, dt); }
  }
}
function drawFx(filter) {
  for (const f of FX) {
    if (filter && f.layer !== filter) continue; if (!filter && f.layer) continue;
    const a = 1 - f.t / f.life;
    cx.globalAlpha = Math.min(1, a * 2);
    if (f.k === 'star') star5(f.x, f.y, f.s, f.c, f.rot);
    else if (f.k === 'conf') { cx.save(); cx.translate(f.x, f.y); cx.rotate(f.rot); cx.fillStyle = f.c; cx.fillRect(-f.s / 2, -f.s / 4, f.s, f.s / 2); cx.restore(); }
    else if (f.k === 'dot') circ(f.x, f.y, f.s * .45 * a + 1, f.c);
    else if (f.k === 'ring') { cx.strokeStyle = f.c; cx.lineWidth = (f.w || 8) * a; cx.beginPath(); cx.arc(f.x, f.y, (f.r0 || 10) + (f.r1 || 120) * easeOut(f.t / f.life), 0, TAU); cx.stroke(); }
    else if (f.k === 'glow') { cx.globalAlpha = a; glow(f.x, f.y, f.s * (1 + f.t), f.c); }
    else if (f.k === 'note') { cx.save(); cx.translate(f.x, f.y); cx.rotate(Math.sin(f.t * 6) * .3); txt(f.ch || '♪', 0, 0, f.s * 2.6, f.c, { lw: 4 }); cx.restore(); }
    else if (f.k === 'z') txt('z', f.x, f.y, f.s * 2.4 * (0.6 + f.t / f.life), '#bff', { lw: 4 });
    else if (f.k === 'item') drawItem(f.it, f.x, f.y, f.s * (f.shrink ? a : 1), f.rot);
    else if (f.k === 'heart') { cx.save(); cx.translate(f.x, f.y); cx.scale(f.s / 10, f.s / 10); cx.fillStyle = f.c; cx.beginPath(); cx.moveTo(0, 4); cx.bezierCurveTo(-10, -4, -6, -12, 0, -6); cx.bezierCurveTo(6, -12, 10, -4, 0, 4); cx.fill(); cx.restore(); }
    else if (f.k === 'text') txt(f.s0, f.x, f.y, f.s, f.c, { lw: 6 });
  }
  cx.globalAlpha = 1;
}

// ===== camera (shake, punch-in, slow-mo) =====
const CAM = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1, shake: 0, punch: 0, slow: 1, slowT: 0, flash: 0, flashCol: '#fff' };
function shake(a) { CAM.shake = Math.max(CAM.shake, a); }
function punch(a) { CAM.punch = Math.max(CAM.punch, a); }
function flash(a, col) { CAM.flash = Math.max(CAM.flash, a); CAM.flashCol = col || '#fff'; }
function slowmo(f, secs) { CAM.slow = f; CAM.slowT = secs; }
function stepCam(dtReal) {
  CAM.shake = Math.max(0, CAM.shake - dtReal * 40); CAM.punch = Math.max(0, CAM.punch - dtReal * 1.6); CAM.flash = Math.max(0, CAM.flash - dtReal * 2.2);
  if (CAM.slowT > 0) { CAM.slowT -= dtReal; if (CAM.slowT <= 0) CAM.slow = 1; }
}
function camShakeXY() { const s = CAM.shake; return s > 0 ? [rnd(-s, s), rnd(-s, s)] : [0, 0]; }

// ===== input / buttons =====
let BTN = [];          // rebuilt every frame by the screen draw: {id,x,y,r,cb,hold,hit(w,h for rect)}
const ptr = new Map(); // pointerId -> {b, t0, done} or a string role for game input
function vpt(e) { return { x: (e.clientX - ox) / sc, y: (e.clientY - oy) / sc }; }
function holdFrac(id) { for (const v of ptr.values()) if (v && v.b && v.b.id === id && v.b.hold && !v.done) return clamp((now() - v.t0) / v.b.hold, 0, 1); return 0; }
function btnHit(b, p) { return b.w ? (Math.abs(p.x - b.x) < b.w / 2 + 8 && Math.abs(p.y - b.y) < b.h / 2 + 8) : hyp(p.x - b.x, p.y - b.y) < b.r + 12; }
function pressed(id) { for (const v of ptr.values()) if (v && v.b && v.b.id === id) return true; return false; }
let lastInput = now();
