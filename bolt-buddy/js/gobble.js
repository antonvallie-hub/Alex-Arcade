'use strict';
// BOLT GOBBLE: steer a smiling gobble-hole; bolts and toys fall in and it grows from tiny to giant. No fail state.
const GB = {};
const GW = 2800, GH = 1560;
const ITYPES = [
  { k: 'nut', r: 17, t: 1 }, { k: 'bolt', r: 19, t: 1 }, { k: 'star', r: 19, t: 1 },
  { k: 'ball', r: 33, t: 2 }, { k: 'duck', r: 35, t: 2 }, { k: 'block', r: 37, t: 2 },
  { k: 'car', r: 58, t: 3 }, { k: 'bear', r: 64, t: 3 },
  { k: 'bear', r: 128, t: 4 }, { k: 'car', r: 118, t: 4 }, { k: 'block', r: 112, t: 4 }, { k: 'duck', r: 122, t: 4 },
];
const MAT = ['#a8ece0', '#d9c6ff', '#b9f0c8', '#fff0a8', '#ffd0e6', '#bfe4ff'];
function startGobble() {
  Object.assign(GB, { t: 0, hx: GW / 2, hy: GH / 2, vx: 0, vy: 0, r: 40, z: 1, camx: GW / 2, camy: GH / 2, items: [], eaten: 0, bolts: 0, stage: 0, gulp: 0, mouth: 0,
    tx: null, ty: null, idle: 0, cheerT: 4, state: 'intro', endT: 0, combo: 0, comboT: 0, rig: BotRig(), swirl: 0, total: 0, assist: 0 });
  const place = (ty, n) => {
    for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do { x = rnd(80 + ty.r, GW - 80 - ty.r); y = rnd(80 + ty.r, GH - 80 - ty.r); tries++; }
      while (tries < 40 && (hyp(x - GW / 2, y - GH / 2) < 220 + ty.r || GB.items.some(o => hyp(o.x - x, o.y - y) < o.r + ty.r + 14)));
      GB.items.push({ k: ty.k, r: ty.r * rnd(.92, 1.08), t: ty.t, x, y, rot: rnd(-.5, .5), ph: rnd(0, TAU), fall: -1, wob: 0, vx: 0, vy: 0 });
    }
  };
  // nearby starter ring of bolts so the first second is already juicy
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; GB.items.push({ k: i % 2 ? 'nut' : 'bolt', r: 17, t: 1, x: GW / 2 + Math.cos(a) * 150, y: GH / 2 + Math.sin(a) * 110, rot: rnd(-.5, .5), ph: rnd(0, TAU), fall: -1, wob: 0, vx: 0, vy: 0 }); }
  [[0, 22], [1, 22], [2, 16], [3, 9], [4, 9], [5, 8], [6, 6], [7, 6], [8, 1], [9, 1], [10, 1], [11, 1]].forEach(([i, n]) => place(ITYPES[i], n));
  GB.total = GB.items.length;
  music('gobble'); say('n_gobble', { interrupt: true }); say('n_drag');
  rigAct(GB.rig, 'cheer', 1.5, 'star');
}
function gobbleInput(kind, p) {
  if (GB.state !== 'play' && GB.state !== 'intro') return;
  if (kind === 'down' || kind === 'move') { GB.tx = (p.x - VW / 2) / GB.z + GB.camx; GB.ty = (p.y - VH / 2) / GB.z + GB.camy; GB.idle = 0; if (GB.state === 'intro') GB.state = 'play'; }
  if (kind === 'up') { GB.tx = null; GB.ty = null; }
}
function updateGobble(dt) {
  GB.t += dt; GB.swirl += dt * (1.5 + GB.r / 80); GB.gulp = Math.max(0, GB.gulp - dt * 4); GB.mouth = Math.max(0, GB.mouth - dt * 5);
  GB.comboT -= dt; if (GB.comboT < 0) GB.combo = 0;
  if (GB.state === 'intro' && GB.t > 2.2) GB.state = 'play';
  // steering
  let tx = GB.tx, ty = GB.ty;
  if (GB.state === 'play' && tx == null) {
    GB.idle += dt;
    if (GB.idle > 2.5) { // gentle auto-drift toward the nearest thing it can eat
      let best = null, bd = 1e9; for (const o of GB.items) if (o.fall < 0 && o.r < GB.r * .9) { const d = hyp(o.x - GB.hx, o.y - GB.hy); if (d < bd) { bd = d; best = o; } }
      if (best) { tx = best.x; ty = best.y; }
    }
  }
  if (GB.state === 'finale') { tx = GW / 2; ty = GH / 2; }
  const maxV = (GB.tx != null ? 560 : 200) + GB.r * 1.6;
  if (tx != null) {
    const dx = tx - GB.hx, dy = ty - GB.hy, d = hyp(dx, dy);
    const want = Math.min(maxV, d * 4.2);
    const wx = d > 1 ? dx / d * want : 0, wy = d > 1 ? dy / d * want : 0;
    GB.vx = lerp(GB.vx, wx, 1 - Math.exp(-dt * 7)); GB.vy = lerp(GB.vy, wy, 1 - Math.exp(-dt * 7));
  } else { GB.vx *= Math.exp(-dt * 4); GB.vy *= Math.exp(-dt * 4); }
  GB.hx = clamp(GB.hx + GB.vx * dt, GB.r * .5, GW - GB.r * .5); GB.hy = clamp(GB.hy + GB.vy * dt, GB.r * .5, GH - GB.r * .5);
  // eat / bump
  let left = 0;
  for (const o of GB.items) {
    if (o.fall >= 0) {
      o.fall += dt / .38; const k = easeIn(o.fall);
      o.x = lerp(o.x, GB.hx, k * .6); o.y = lerp(o.y, GB.hy, k * .6); o.rot += dt * 9;
      if (o.fall >= 1) { o.dead = true; onEat(o); }
      continue;
    }
    left++;
    const d = hyp(o.x - GB.hx, o.y - GB.hy);
    const canEat = o.r < GB.r * .9 || GB.state === 'finale';
    if (GB.state === 'finale' && !o.sucked) { o.sucked = true; o.vx = 0; }
    if (GB.state === 'finale') { const a = Math.atan2(GB.hy - o.y, GB.hx - o.x); const sp = 900 + GB.endT * 900; o.x += Math.cos(a) * sp * dt; o.y += Math.sin(a) * sp * dt; o.rot += dt * 6; }
    if (canEat && d < GB.r - o.r * .25 + (GB.state === 'finale' ? 60 : 0)) { o.fall = 0; GB.mouth = 1; }
    else if (canEat && d < GB.r + o.r * .6) { const a = Math.atan2(GB.hy - o.y, GB.hx - o.x); o.x += Math.cos(a) * 140 * dt; o.y += Math.sin(a) * 140 * dt; o.rot += dt * 2; }
    else if (!canEat && d < GB.r + o.r * .55) { // too big for now: it wobbles and gets nudged, no penalty
      const a = Math.atan2(o.y - GB.hy, o.x - GB.hx), push = (GB.r + o.r * .55 - d);
      o.x = clamp(o.x + Math.cos(a) * push * .5, o.r, GW - o.r); o.y = clamp(o.y + Math.sin(a) * push * .5, o.r, GH - o.r);
      if (o.wob < .2) { o.wob = 1; sfx('boing'); }
    }
    o.wob = Math.max(0, o.wob - dt * 2);
  }
  GB.items = GB.items.filter(o => !o.dead);
  // assist: after a long time, the hole gets hungrier so it always finishes
  if (GB.state === 'play' && GB.t > 110) GB.r += dt * 6;
  if (GB.state === 'play' && (left === 0 || GB.eaten >= GB.total * .9 || GB.t > 170)) { GB.state = 'finale'; GB.endT = 0; say('n_megagobble', { interrupt: true }); sfx('grow'); shake(10); punch(.3); }
  if (GB.state === 'finale') { GB.endT += dt; if (GB.endT > 2.6 && GB.items.length === 0 || GB.endT > 4.5) { GB.state = 'done'; GB.items.length = 0; setTimeout(() => goWin('gobble', 15), 900); sfx('fanfare'); say('b_wedid'); rigAct(GB.rig, 'cheer', 3, 'star'); } }
  // camera: zoom out as it grows
  const zt = clamp(VH / (GB.r * 6.5 + 240), .42, 1.0);
  GB.z = lerp(GB.z, zt, 1 - Math.exp(-dt * 2));
  const hw = VW / 2 / GB.z, hh = VH / 2 / GB.z;
  GB.camx = lerp(GB.camx, hw * 2 >= GW ? GW / 2 : clamp(GB.hx, hw, GW - hw), 1 - Math.exp(-dt * 6));
  GB.camy = lerp(GB.camy, hh * 2 >= GH ? GH / 2 : clamp(GB.hy, hh, GH - hh), 1 - Math.exp(-dt * 6));
  // Bolt cheers
  GB.cheerT -= dt;
  if (GB.cheerT < 0 && GB.state === 'play' && !voiceBusy()) { GB.cheerT = 7 + rnd(0, 4); say(pick(['b_yum', 'b_gobble', 'b_sogood', 'b_bigger2'])); rigAct(GB.rig, pick(['cheer', 'hop', 'dance']), 1.4, pick(['star', 'joy', 'love'])); }
}
function onEat(o) {
  GB.eaten++; GB.combo++; GB.comboT = 1.2;
  if (o.t === 1) GB.bolts++;
  const add = o.r * o.r * .55; GB.r = Math.sqrt(GB.r * GB.r + add);
  GB.gulp = 1; sfx('chomp', Math.min(14, GB.combo)); if (o.t >= 3) { sfx('gulp'); shake(4 + o.t * 2); }
  // juice: sparkles at the rim + a bolt that flies to the HUD counter
  const sx = (GB.hx - GB.camx) * GB.z + VW / 2, sy = (GB.hy - GB.camy) * GB.z + VH / 2;
  burst(sx, sy - GB.r * GB.z * .3, o.t >= 3 ? 16 : 5, { k: 'star', g: 300, sp0: 80, sp1: 260 + o.t * 60, size: .8 + o.t * .2 });
  if (o.t === 1 && GB.bolts % 2 === 0) fx({ k: 'item', it: 'nut', x: sx, y: sy, vx: (110 - sx) * 1.6, vy: (52 - sy) * 1.6 - 200, g: 400, life: .6, s: 34, vr: 8, layer: 'hud' });
  if (GB.combo > 0 && GB.combo % 8 === 0) { say(PRAISE()); }
  const st = GB.r > 150 ? 2 : GB.r > 78 ? 1 : 0;
  if (st > GB.stage) {
    GB.stage = st; sfx('grow'); shake(12); punch(.35); flash(.35, '#fff');
    say(st === 1 ? 'n_supersize' : 'n_megagobble', { interrupt: true });
    burst(sx, sy, 40, { k: 'star', size: 1.4 }); fx({ k: 'ring', x: sx, y: sy, life: .7, r0: GB.r * GB.z, r1: 260, w: 14, c: '#fff' });
    rigAct(GB.rig, 'jump', 1.1, 'star');
  }
}
const MATS = {};
function matTile(c) { // pre-rendered play-mat square (2x res) so the floor costs one drawImage per tile
  if (MATS[c]) return MATS[c];
  const k = document.createElement('canvas'); k.width = k.height = 312; const g = k.getContext('2d'); g.scale(2, 2); const T = 156;
  const rr2 = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = '#8fd6c8'; g.fillRect(0, 0, T, T);
  g.fillStyle = shade(c, -.14); rr2(3, 5, T - 6, T - 6, 18); g.fill();
  const gr = g.createLinearGradient(0, 0, T, T); gr.addColorStop(0, shade(c, .25)); gr.addColorStop(1, c); g.fillStyle = gr; rr2(3, 2, T - 6, T - 8, 18); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([6, 7]); g.lineWidth = 2; rr2(12, 10, T - 24, T - 24, 12); g.stroke(); g.setLineDash([]);
  g.globalAlpha = .12; g.fillStyle = '#fff'; g.beginPath(); g.arc(T / 2, T / 2, 26, 0, TAU); g.fill(); g.globalAlpha = 1;
  return MATS[c] = k;
}
function drawHole(x, y, r) {
  const sq = 1 + Math.sin(GB.gulp * PI) * .12;
  cx.save(); cx.translate(x, y); cx.scale(sq, 2 - sq);
  // soft outer glow + rim
  glow(0, 0, r * 1.9, 'rgba(150,90,255,1)', .5);
  const rim = cx.createRadialGradient(0, -r * .2, r * .7, 0, 0, r * 1.15); rim.addColorStop(0, '#5b3bd6'); rim.addColorStop(.6, '#8a5cff'); rim.addColorStop(1, 'rgba(160,120,255,0)');
  circ(0, 0, r * 1.15, rim);
  const g = cx.createRadialGradient(0, r * .15, r * .05, 0, 0, r); g.addColorStop(0, '#030010'); g.addColorStop(.75, '#140a3a'); g.addColorStop(1, '#3a1f8a');
  circ(0, 0, r, g);
  // swirl
  cx.save(); cx.beginPath(); cx.arc(0, 0, r * .98, 0, TAU); cx.clip(); cx.rotate(GB.swirl);
  for (let i = 0; i < 3; i++) { cx.rotate(TAU / 3); cx.strokeStyle = 'rgba(140,110,255,.35)'; cx.lineWidth = r * .09; cx.beginPath(); cx.arc(r * .25, 0, r * .55, -1.2, .9); cx.stroke(); }
  cx.restore();
  // the smiling face (glowing, like Bolt's visor)
  const fa = 'rgba(120,255,250,.95)'; cx.strokeStyle = fa; cx.lineCap = 'round'; cx.lineWidth = Math.max(4, r * .085);
  for (const sd of [-1, 1]) { cx.beginPath(); cx.arc(sd * r * .32, -r * .12, r * .13, PI * 1.1, PI * 1.9); cx.stroke(); }
  if (GB.mouth > .1) { cx.fillStyle = fa; cx.beginPath(); cx.ellipse(0, r * .3, r * .16 * GB.mouth + r * .05, r * .14 * GB.mouth + r * .04, 0, 0, TAU); cx.fill(); }
  else { cx.beginPath(); cx.arc(0, r * .12, r * .24, PI * .15, PI * .85); cx.stroke(); }
  glow(-r * .32, -r * .12, r * .3, 'rgba(120,255,250,1)', .35); glow(r * .32, -r * .12, r * .3, 'rgba(120,255,250,1)', .35);
  // rim shine
  cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = Math.max(3, r * .05); cx.beginPath(); cx.arc(0, 0, r * 1.02, PI * 1.1, PI * 1.6); cx.stroke();
  cx.restore();
}
function drawGobble(dt) {
  const z = GB.z * (1 + CAM.punch * .25), [sx0, sy0] = camShakeXY();
  cx.save(); cx.translate(VW / 2 + sx0, VH / 2 + sy0); cx.scale(z, z); cx.translate(-GB.camx, -GB.camy);
  // play-mat floor (code-drawn so it stays crisp at every zoom), only visible tiles
  cx.fillStyle = '#8fd6c8'; cx.fillRect(-400, -400, GW + 800, GH + 800);
  const T = 156, vl = GB.camx - VW / 2 / z - T, vr = GB.camx + VW / 2 / z + T, vt = GB.camy - VH / 2 / z - T, vb = GB.camy + VH / 2 / z + T;
  for (let i = Math.max(-2, Math.floor(vl / T)); i <= Math.min(GW / T + 2, Math.ceil(vr / T)); i++) for (let j = Math.max(-2, Math.floor(vt / T)); j <= Math.min(GH / T + 2, Math.ceil(vb / T)); j++) {
    cx.drawImage(matTile(MAT[((i * 7 + j * 3) % 6 + 6) % 6]), i * T, j * T, T, T);
  }
  // play area fence
  cx.strokeStyle = 'rgba(90,60,200,.35)'; cx.lineWidth = 18; rr(-9, -9, GW + 18, GH + 18, 40); cx.stroke();
  // items (bigger first, so small bolts sit on top), falling ones under the hole rim
  const tm = now() / 1000;
  for (const o of GB.items) if (o.fall < 0) {
    const bob = Math.sin(tm * 2 + o.ph) * 2, w = o.wob ? Math.sin(o.wob * 30) * .15 * o.wob : 0;
    cx.fillStyle = 'rgba(40,20,90,.18)'; cx.beginPath(); cx.ellipse(o.x + 4, o.y + o.r * .75, o.r * .8, o.r * .25, 0, 0, TAU); cx.fill();
    cx.save(); cx.translate(o.x, o.y + bob); cx.scale(1 + w, 1 - w); drawItem(o.k, 0, 0, o.r * 2.3, o.rot); cx.restore();
    if (o.r < GB.r * .9 && o.t >= 3) glow(o.x, o.y, o.r * 1.6, 'rgba(255,240,120,1)', .25 + .15 * Math.sin(tm * 6));
  }
  drawHole(GB.hx, GB.hy, GB.r);
  for (const o of GB.items) if (o.fall >= 0) { const k = 1 - easeIn(o.fall); cx.save(); cx.beginPath(); cx.arc(GB.hx, GB.hy, GB.r, 0, TAU); cx.clip(); drawItem(o.k, o.x, o.y, o.r * 2.3 * Math.max(.05, k), o.rot); cx.restore(); }
  cx.restore();
  drawFx();
  // HUD
  const bp = Math.min(1, GB.eaten / (GB.total * .9));
  glossBall(64, 52, 36, '#ffc61a'); drawItem('nut', 64, 52, 50); txt(String(GB.bolts), 118, 54, 38, '#fff', { al: 'left' });
  backBtnAt(VW - 56, 52, () => go('hub'));
  const bw = Math.min(460, VW * .4), bx = VW / 2 - bw / 2;
  cx.fillStyle = 'rgba(30,10,80,.55)'; rr(bx - 6, 30, bw + 12, 36, 18); cx.fill();
  const g = cx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#7ff'); g.addColorStop(.5, '#a46bff'); g.addColorStop(1, '#ff7ac6');
  cx.fillStyle = g; rr(bx, 36, Math.max(24, bw * bp), 24, 12); cx.fill();
  for (let i = 1; i <= 2; i++) { const mx = bx + bw * (i === 1 ? .28 : .62); star5(mx, 48, 13, GB.stage >= i ? '#ffd23f' : 'rgba(255,255,255,.4)'); }
  star5(bx + bw, 48, 18, bp >= 1 ? '#ffd23f' : 'rgba(255,255,255,.5)');
  drawFx('hud');
  // Bolt cheering in the corner
  const p = rigPose(GB.rig, dt);
  drawBolt({ x: 120, y: VH - 14, s: .36, color: SV.color, hat: SV.hat, face: p.face, pose: p });
  if (GB.state === 'intro' || (GB.state === 'play' && GB.t < 6 && GB.tx == null)) drawHandHint(VW / 2 + 120, VH / 2 + 60, 'drag');
  drawBubble(190, VH - 230);
  if (CAM.flash > 0) { cx.fillStyle = CAM.flashCol; cx.globalAlpha = CAM.flash; cx.fillRect(0, 0, VW, VH); cx.globalAlpha = 1; }
}
function drawHandHint(x, y, kind) {
  const t = now() / 1000; let ox2 = 0, oy2 = 0, s = 1;
  if (kind === 'drag') { ox2 = Math.sin(t * 2) * 90; oy2 = Math.cos(t * 2) * 30; }
  if (kind === 'tap') { s = 1 - .15 * Math.max(0, Math.sin(t * 7)); }
  if (kind === 'hold') { s = .85 + .15 * ((t % 1.2) < .7 ? 0 : 1); }
  cx.save(); cx.translate(x + ox2, y + oy2); cx.scale(s, s); cx.globalAlpha = .9;
  cx.fillStyle = '#fff'; cx.strokeStyle = '#2a2060'; cx.lineWidth = 4;
  cx.beginPath(); rr(-12, -46, 24, 56, 12); cx.fill(); cx.stroke();
  cx.beginPath(); cx.ellipse(6, 20, 30, 28, 0, 0, TAU); cx.fill(); cx.stroke();
  cx.fillStyle = '#fff'; rr(-10, -44, 20, 60, 10); cx.fill();
  if (kind !== 'drag') { cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 4; cx.beginPath(); cx.arc(0, -50, 22 + (t * 40) % 20, 0, TAU); cx.stroke(); }
  cx.restore();
}
function backBtnAt(x, y, cb) {
  const prs = pressed('back');
  glossBall(x, y, 36 * (prs ? .9 : 1), '#7a5cff'); drawIcon('home', x, y - 1, .95);
  BTN.push({ id: 'back', x, y, r: 40, cb: () => { sfx('click'); cb(); } });
}
