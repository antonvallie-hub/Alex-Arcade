'use strict';
// ROCKET RIDE: Bolt flies a rocket through a space tunnel. Hold = up, let go = float down. Grab stars, land on a friendly planet.
const RK = {};
const RK_LEN = 17500, RK_SPEED = 330;
function startRocket() {
  Object.assign(RK, { t0tilt: null, landed: false, out: false, done: false, lx: 0, t: 0, d: 0, y: VH * .55, vy: 0, hold: false, stars: [], rings: [], got: 0, power: 0, state: 'intro', endT: 0, tilt: 0, flame: 0, trail: [], cheerT: 6, rig: BotRig(), landX: 0, planetX: VW + 600, bolts: 0, bob: 0 });
  // star patterns at reachable heights
  let x = 900;
  const H0 = 120, H1 = VH - 120;
  while (x < RK_LEN - 1800) {
    const kind = pick(['wave', 'arc', 'line', 'zig', 'wave']), n = kind === 'line' ? 6 : 9, yc = rnd(H0 + 90, H1 - 90);
    for (let i = 0; i < n; i++) {
      let y = yc;
      if (kind === 'wave') y = yc + Math.sin(i / n * TAU) * 110;
      if (kind === 'arc') y = yc + 120 - Math.sin(i / (n - 1) * PI) * 220;
      if (kind === 'zig') y = yc + (i % 2 ? -70 : 70);
      RK.stars.push({ x: x + i * 70, y: clamp(y, H0, H1), got: false, big: false, ph: rnd(0, TAU) });
    }
    x += n * 70 + rnd(260, 520);
  }
  for (const px of [RK_LEN * .25, RK_LEN * .5, RK_LEN * .75]) RK.stars.push({ x: px, y: rnd(H0 + 60, H1 - 60), got: false, big: true, ph: 0 });
  for (let rx = 700; rx < RK_LEN - 1500; rx += 760) RK.rings.push({ x: rx, y: VH / 2 + rnd(-60, 60), col: pick(['#7ff', '#ff7ac6', '#ffd23f', '#a46bff']), pass: false });
  // distant parallax things
  RK.bg = []; for (let i = 0; i < 14; i++) RK.bg.push({ x: rnd(0, 2400), y: rnd(40, VH - 40), r: rnd(16, 46), c: pick(['#ff9ad5', '#9fd8ff', '#ffd27a', '#b9a0ff', '#8affc1']), ring: Math.random() < .4, par: rnd(.15, .35) });
  RK.dust = []; for (let i = 0; i < 70; i++) RK.dust.push({ x: rnd(0, VW), y: rnd(0, VH), s: rnd(1, 3), par: rnd(.6, 1.6) });
  music('space'); say('n_rocket', { interrupt: true }); say('n_hold');
}
function rocketInput(kind) {
  if (kind === 'down') { RK.hold = true; if (RK.state === 'intro' && RK.t > .8) { RK.state = 'fly'; say('n_blast', { interrupt: true }); sfx('whoosh'); } }
  if (kind === 'up') RK.hold = false;
}
function updateRocket(dt) {
  RK.t += dt; RK.bob += dt;
  if (RK.state === 'intro') { if (RK.t > 4.5) { RK.state = 'fly'; say('n_blast', { interrupt: true }); sfx('whoosh'); } RK.y = lerp(RK.y, VH * .55 + Math.sin(RK.t * 2) * 10, .1); return; }
  const speed = RK_SPEED * (RK.power > 0 ? 1.45 : 1) * (RK.state === 'land' ? Math.max(0, 1 - RK.endT * .6) : 1);
  if (RK.state === 'fly') {
    RK.d += speed * dt;
    if (RK.hold) { RK.vy = Math.max(-430, RK.vy - 1500 * dt); RK.flame = Math.min(1, RK.flame + dt * 6); if (Math.random() < dt * 8) sfx('thrust'); }
    else { RK.vy = Math.min(250, RK.vy + 620 * dt); RK.flame = Math.max(.25, RK.flame - dt * 3); }
    RK.y += RK.vy * dt;
    if (RK.y < 90) { RK.y = 90; RK.vy = Math.abs(RK.vy) * .35; fx({ k: 'ring', x: VW * .3, y: 70, life: .4, r0: 10, r1: 60, w: 6, c: '#7ff' }); }
    if (RK.y > VH - 90) { RK.y = VH - 90; RK.vy = -Math.abs(RK.vy) * .35 - 60; fx({ k: 'ring', x: VW * .3, y: VH - 70, life: .4, r0: 10, r1: 60, w: 6, c: '#ff7ac6' }); }
    RK.tilt = lerp(RK.tilt, clamp(RK.vy / 900, -.35, .3), .15);
    if (RK.d > RK_LEN) { RK.state = 'land'; RK.endT = 0; RK.y0 = RK.y; say('n_land', { interrupt: true }); RK.hold = false; }
  }
  if (RK.state === 'land') { // autopilot: ease onto the planet
    RK.endT += dt; RK.d += speed * dt;
    const k = easeOut(Math.min(1, RK.endT / 2.4));
    const px = VW * .62, padY = VH - 208;
    if (RK.t0tilt == null) RK.t0tilt = RK.tilt; RK.lx = lerp(VW * .3, px, k); RK.y = lerp(RK.y0, VH - 300, k); RK.tilt = lerp(RK.t0tilt, -PI / 2, easeOut(Math.min(1, RK.endT / 1.6))); RK.flame = 1 - k * .5;
    if (RK.endT > 2.4 && !RK.landed) { RK.landed = true; sfx('land'); shake(10); punch(.4); burst(px, padY - 10, 30, { k: 'dot', cols: ['#fff', '#ffe0f4', '#d0f0ff'], g: 200, up: 120, size: 1.6 }); say('n_perfect', { interrupt: true }); }
    if (RK.endT > 3.1 && !RK.out) { RK.out = true; sfx('boing'); rigAct(RK.rig, 'cheer', 3, 'star'); say('b_wedid'); sfx('fanfare'); burst(px, padY - 120, 40, { k: 'conf' }); }
    if (RK.endT > 6.2 && !RK.done) { RK.done = true; goWin('rocket', 15); }
  }
  RK.power = Math.max(0, RK.power - dt);
  // stars
  const rx = RK.state === 'land' ? RK.lx : VW * .3, mag = RK.power > 0 ? 190 : 72;
  for (const s of RK.stars) {
    if (s.got) continue; const sx = s.x - RK.d + rx;
    if (sx < -60 || sx > VW + 60) continue;
    const d = hyp(sx - rx, s.y - RK.y);
    if (d < mag) { s.y = lerp(s.y, RK.y, .25); s.x = lerp(s.x, RK.d + 0, .2); }
    if (d < (s.big ? 70 : 52)) {
      s.got = true; RK.got++; if (RK.got % 3 === 0) RK.bolts++;
      if (s.big) { RK.power = 4.5; sfx('powerup'); say('n_starpower', { interrupt: true }); flash(.3, '#fff6c0'); burst(rx, RK.y, 30, { k: 'star', size: 1.3 }); punch(.25); }
      else { sfx('star'); burst(rx + 10, RK.y, 6, { k: 'star', g: 0, sp0: 60, sp1: 200, size: .8, life: .6 }); fx({ k: 'item', it: 'star', x: rx, y: RK.y, vx: (60 - rx) * 1.8, vy: (52 - RK.y) * 1.8, life: .55, s: 30, layer: 'hud' }); }
      if (RK.got % 12 === 0) { say(pick(['b_flying', 'b_stars', 'n_woohoo', 'b_sogood'])); }
    }
  }
  for (const r of RK.rings) { const sx = r.x - RK.d + rx; if (!r.pass && sx < rx) { r.pass = true; sfx('sparkle'); burst(rx, r.y, 8, { k: 'star', g: 0, cols: [r.col, '#fff'], sp1: 220, life: .6 }); } }
  // trail
  RK.trail.push({ x: rx - 70, y: RK.y + RK.tilt * 60, t: 0 }); if (RK.trail.length > 26) RK.trail.shift();
  for (const p of RK.trail) { p.t += dt; p.x -= speed * dt; }
  RK.cheerT -= dt;
}
function drawRocketShip(x, y, rot, flame, power) {
  cx.save(); cx.translate(x, y); cx.rotate(rot);
  // exhaust
  const L = 60 + flame * 70 + Math.random() * 20;
  const g = cx.createLinearGradient(-60, 0, -60 - L, 0); g.addColorStop(0, 'rgba(255,255,230,.95)'); g.addColorStop(.35, power ? 'rgba(255,120,240,.9)' : 'rgba(255,170,40,.9)'); g.addColorStop(1, 'rgba(255,60,20,0)');
  cx.fillStyle = g; cx.beginPath(); cx.moveTo(-58, -20); cx.quadraticCurveTo(-60 - L, 0, -58, 20); cx.fill();
  glow(-70, 0, 50 + flame * 30, power ? 'rgba(255,120,240,1)' : 'rgba(255,170,60,1)', .6);
  // fins
  cx.fillStyle = '#e8202a';
  cx.beginPath(); cx.moveTo(-30, -26); cx.lineTo(-62, -58); cx.lineTo(-56, -20); cx.fill();
  cx.beginPath(); cx.moveTo(-30, 26); cx.lineTo(-62, 58); cx.lineTo(-56, 20); cx.fill();
  // body
  const b = cx.createLinearGradient(0, -34, 0, 34); b.addColorStop(0, '#ffffff'); b.addColorStop(.5, '#e4e9f7'); b.addColorStop(1, '#9aa6c9');
  cx.fillStyle = b; cx.beginPath(); cx.moveTo(-60, -28); cx.quadraticCurveTo(40, -46, 92, 0); cx.quadraticCurveTo(40, 46, -60, 28); cx.closePath(); cx.fill();
  cx.fillStyle = '#e8202a'; cx.beginPath(); cx.moveTo(62, -24); cx.quadraticCurveTo(80, -14, 92, 0); cx.quadraticCurveTo(80, 14, 62, 24); cx.quadraticCurveTo(70, 0, 62, -24); cx.fill();
  cx.fillStyle = '#c4161f'; rr(-62, -28, 10, 56, 4); cx.fill();
  cx.fillStyle = '#e8202a'; cx.beginPath(); cx.moveTo(-6, 6); cx.lineTo(-36, 30); cx.lineTo(10, 18); cx.fill();
  cx.restore();
}
function drawRocket(dt) {
  const [shx, shy] = camShakeXY(), z = 1 + CAM.punch * .2;
  cx.save(); cx.translate(VW / 2 + shx, VH / 2 + shy); cx.scale(z, z); cx.translate(-VW / 2, -VH / 2);
  // scrolling nebula (mirror-tiled so it never seams)
  const im = IMG.bg_space;
  if (okI(im)) {
    const h = VH + 40, w = im.naturalWidth * h / im.naturalHeight, off = (RK.d * .12) % (w * 2);
    for (let k = -1; k < 3; k++) { const x = k * w - off; if (x > VW || x + w < 0) continue; cx.save(); if (((k % 2) + 2) % 2) { cx.translate(x + w, -20); cx.scale(-1, 1); cx.drawImage(im, 0, 0, w, h); } else cx.drawImage(im, x, -20, w, h); cx.restore(); }
  } else { cx.fillStyle = '#1a0f4a'; cx.fillRect(0, 0, VW, VH); }
  // parallax planets
  for (const p of RK.bg) { const x = ((p.x - RK.d * p.par) % 2400 + 2400) % 2400 - 200; if (x < -80 || x > VW + 80) continue; const g = cx.createRadialGradient(x - p.r * .3, p.y - p.r * .3, 1, x, p.y, p.r); g.addColorStop(0, '#fff'); g.addColorStop(.3, p.c); g.addColorStop(1, shade(p.c, -.5)); circ(x, p.y, p.r, g); if (p.ring) { cx.strokeStyle = 'rgba(255,255,255,.5)'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(x, p.y, p.r * 1.7, p.r * .45, -.3, 0, TAU); cx.stroke(); } }
  // speed dust
  cx.fillStyle = 'rgba(255,255,255,.7)';
  for (const p of RK.dust) { const x = ((p.x - RK.d * p.par) % VW + VW) % VW; const L = (RK.power > 0 ? 40 : 14) * p.par; cx.fillRect(x, p.y, L, p.s); }
  // tunnel walls: glowing nebula bands top + bottom
  for (const [y0, dir] of [[0, 1], [VH, -1]]) {
    const g = cx.createLinearGradient(0, y0, 0, y0 + dir * 90); g.addColorStop(0, 'rgba(255,120,220,.55)'); g.addColorStop(1, 'rgba(120,80,255,0)'); cx.fillStyle = g; cx.fillRect(0, Math.min(y0, y0 + dir * 90), VW, 90);
    cx.strokeStyle = 'rgba(160,255,255,.6)'; cx.lineWidth = 4; cx.beginPath();
    for (let x = 0; x <= VW; x += 20) { const yy = y0 + dir * (56 + Math.sin((x + RK.d) / 90) * 10); x ? cx.lineTo(x, yy) : cx.moveTo(x, yy); } cx.stroke();
  }
  const rx = RK.state === 'land' ? RK.lx : VW * .3;
  // tunnel rings (back half)
  for (const r of RK.rings) { const x = r.x - RK.d + rx; if (x < -120 || x > VW + 120) continue; cx.strokeStyle = r.col; cx.lineWidth = 10; cx.globalAlpha = .55; cx.beginPath(); cx.ellipse(x, r.y, 46, VH * .42, 0, PI / 2, PI * 1.5); cx.stroke(); cx.globalAlpha = 1; }
  // planet (landing)
  const remain = RK_LEN - RK.d;
  if (remain < VW * 1.4 || RK.state === 'land') {
    const px = VW * .62 + Math.max(0, remain) * .9, py = VH + 330, pr = 540;
    glow(px, py, pr * 1.35, 'rgba(255,150,230,1)', .5);
    const g = cx.createRadialGradient(px - 160, py - 300, 40, px, py, pr); g.addColorStop(0, '#fff0c8'); g.addColorStop(.35, '#ffb36b'); g.addColorStop(.8, '#ff6fa8'); g.addColorStop(1, '#a03a8a');
    circ(px, py, pr, g);
    cx.fillStyle = 'rgba(255,255,255,.25)'; for (const [a, r2] of [[-1.9, 50], [-1.3, 34], [-1.6, 22], [-1.1, 40]]) circ(px + Math.cos(a) * pr * .78, py + Math.sin(a) * pr * .8, r2, 'rgba(160,60,140,.25)');
    // friendly face on the planet
    const fy = py - pr + 150, happy = RK.landed ? 1 : 0;
    for (const sd of [-1, 1]) { cx.fillStyle = '#4a1c4a'; cx.beginPath(); cx.ellipse(px + sd * 150, fy, 18, happy ? 10 : 24, 0, 0, TAU); cx.fill(); circ(px + sd * 150 - 5, fy - 8, 6, '#fff'); circ(px + sd * 220, fy + 40, 26, 'rgba(255,90,140,.45)'); }
    cx.strokeStyle = '#4a1c4a'; cx.lineWidth = 10; cx.lineCap = 'round'; cx.beginPath(); cx.arc(px, fy + 20, 60 + happy * 20, .3, PI - .3); cx.stroke();
    // landing pad
    cx.fillStyle = '#ffffff'; cx.globalAlpha = .9; cx.beginPath(); cx.ellipse(VW * .62 + Math.max(0, remain) * .9, VH - 208, 90, 16, 0, 0, TAU); cx.fill(); cx.globalAlpha = 1;
  }
  // trail
  for (let i = 0; i < RK.trail.length; i++) { const p = RK.trail[i], a = i / RK.trail.length; circ(p.x, p.y, 4 + a * (RK.power > 0 ? 14 : 8), RK.power > 0 ? 'hsla(' + ((i * 25 + RK.t * 300) % 360) + ',100%,70%,' + a * .8 + ')' : 'rgba(255,220,160,' + a * .5 + ')'); }
  // stars
  const tm = now() / 1000;
  for (const s of RK.stars) {
    if (s.got) continue; const x = s.x - RK.d + rx; if (x < -60 || x > VW + 60) continue;
    if (s.big) { glow(x, s.y, 80, 'rgba(255,180,255,1)', .7); rays(x, s.y, 10, 70, 8, 'rgba(255,255,255,.25)', tm); drawItem('star', x, s.y, 86 + Math.sin(tm * 6) * 6, Math.sin(tm * 3) * .2); }
    else { glow(x, s.y, 34, 'rgba(255,230,120,1)', .45); drawItem('star', x, s.y + Math.sin(tm * 4 + s.ph) * 4, 44, Math.sin(tm * 3 + s.ph) * .25); }
  }
  // ship + Bolt
  if (!RK.out) {
    const y = RK.y + Math.sin(RK.bob * 3) * 3;
    if (RK.power > 0) glow(rx, y, 120, 'hsla(' + ((RK.t * 300) % 360) + ',100%,70%,1)', .55);
    // glass dome with Bolt's head
    cx.save(); cx.translate(rx, y); cx.scale(1.25, 1.25); cx.rotate(RK.tilt);
    drawBoltHeadFace(18, -30, .3, RK.hold ? 'determined' : RK.power > 0 ? 'star' : 'joy');
    const dg = cx.createRadialGradient(4, -52, 4, 18, -34, 52); dg.addColorStop(0, 'rgba(255,255,255,.55)'); dg.addColorStop(.6, 'rgba(180,230,255,.15)'); dg.addColorStop(1, 'rgba(200,240,255,.45)');
    cx.fillStyle = dg; cx.beginPath(); cx.arc(18, -30, 44, PI, TAU); cx.fill(); cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 3; cx.stroke();
    cx.restore();
    cx.save(); cx.translate(rx, y); cx.scale(1.25, 1.25); drawRocketShip(0, 0, RK.tilt, RK.flame, RK.power > 0); cx.restore();
  } else {
    // landed: rocket parked, Bolt hopped out cheering
    cx.save(); cx.translate(VW * .62, VH - 300); cx.scale(1.25, 1.25); drawRocketShip(0, 0, -PI / 2, .1, 0); cx.restore();
    const p = rigPose(RK.rig, dt);
    drawBolt({ x: VW * .62 + 130, y: VH - 205, s: .42, color: SV.color, hat: SV.hat, face: p.face, pose: p, noShadow: true });
  }
  cx.restore();
  drawFx();
  // HUD
  glossBall(64, 52, 36, '#7a5cff'); drawItem('star', 64, 52, 50); txt(String(RK.got), 118, 54, 38, '#fff', { al: 'left' });
  const bw = Math.min(460, VW * .4), bx = VW / 2 - bw / 2, k = clamp(RK.d / RK_LEN, 0, 1);
  cx.fillStyle = 'rgba(30,10,80,.55)'; rr(bx - 6, 30, bw + 12, 36, 18); cx.fill();
  const g = cx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#7ff'); g.addColorStop(1, '#ff7ac6'); cx.fillStyle = g; rr(bx, 36, Math.max(24, bw * k), 24, 12); cx.fill();
  cx.save(); cx.translate(bx + bw * k, 48); cx.scale(.32, .32); drawRocketShip(0, 0, 0, .5, 0); cx.restore();
  circ(bx + bw + 4, 48, 16, '#ff9ad5'); circ(bx + bw, 44, 5, 'rgba(255,255,255,.6)');
  drawFx('hud');
  backBtnAt(VW - 56, 52, () => go('hub'));
  if (RK.state === 'intro' || (RK.state === 'fly' && RK.d < 1400 && !RK.hold)) drawHandHint(VW * .62, VH * .62, 'hold');
  drawBubble(VW * .3 + 60, 110);
  if (CAM.flash > 0) { cx.fillStyle = CAM.flashCol; cx.globalAlpha = CAM.flash; cx.fillRect(0, 0, VW, VH); cx.globalAlpha = 1; }
}
function drawBoltHeadFace(x, y, s, face, hat) {
  cx.save(); cx.translate(x, y); cx.scale(s, s); cx.translate(0, 290);
  const T = now() / 1000; drawHead(COLORS[SV.color || 0], { hat: hat != null ? hat : SV.hat === 4 ? 0 : SV.hat, face }, { ant: Math.sin(T * 9) * .2 }, T);
  cx.restore();
}
