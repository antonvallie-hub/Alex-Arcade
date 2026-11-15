'use strict';
// MEGA BOT HERO: Bolt powers up into a giant robot and bonks the goofy Jelly King, who turns into a friend. Tap anywhere to bonk.
const HB = {};
const JK_HP = 10, GROUND = 540;
function startHero() {
  Object.assign(HB, { grown: false, growT: 0, pt: 0, jt: 0, popT: 0, final: false, letterA: 0, hitstop: 0, t: 0, state: 'intro', rig: BotRig(), bs: .5, bx: 300, glowA: 0, cape: false, j: { x: VW + 320, y: GROUND, sq: 0, v: 0, hop: 0, hp: JK_HP, face: 'grin', on: false, friend: false, hit: 0, tx: VW - 330, bob: 0 },
    bonkQ: 0, bonkT: -1, lastTap: 0, cam: { x: VW / 2, y: VH / 2, z: 1, tx: VW / 2, ty: VH / 2, tz: 1 }, letter: 0, hitstop: 0, events: {}, endT: 0, remind: 0 });
  music('boss'); say('n_hero', { interrupt: true });
  rigAct(HB.rig, 'wave', 1.6, 'joy');
}
function heroInput(kind) {
  if (kind !== 'down') return;
  HB.lastTap = HB.t;
  if (HB.state === 'fight') { if (HB.bonkT < 0) startBonk(); else HB.bonkQ = 1; }
}
function once(k, t, f) { if (!HB.events[k] && HB.t >= t) { HB.events[k] = 1; f(); } }
function startBonk() {
  HB.bonkT = 0; const final = HB.j.hp <= 1;
  rigAct(HB.rig, 'bonk', final ? 1.0 : .42, final ? 'determined' : pick(['determined', 'star', 'joy']));
  HB.final = final;
  if (final) { HB.state = 'final'; say('n_finalbonk', { interrupt: true }); slowmo(.22, 1.4); sfx('slowmo'); HB.cam.tz = 1.7; HB.cam.tx = lerp(HB.bx, HB.j.x, .65); HB.cam.ty = GROUND - 200; HB.letter = 1; }
  else sfx('whoosh');
}
function bonkImpact() {
  const J = HB.j; J.hp--; J.v -= 9; J.hit = 1; J.face = 'dizzy';
  const ix = J.x - 60, iy = J.y - 200;
  HB.hitstop = HB.final ? .0 : .07; sfx('bonk'); setTimeout(() => sfx('wobble'), 80); shake(HB.final ? 26 : 14);
  burst(ix, iy, HB.final ? 70 : 22, { k: 'star', size: HB.final ? 1.8 : 1.1, sp1: HB.final ? 700 : 420 });
  fx({ k: 'ring', x: ix, y: iy, life: .5, r0: 20, r1: HB.final ? 400 : 160, w: 16, c: '#fff' });
  fx({ k: 'text', s0: HB.final ? 'MEGA BONK!' : pick(['BONK!', 'BOING!', 'POW!', 'BONK!']), x: ix, y: HB.final ? iy + 60 : iy - 60, vy: -120, life: .9, s: HB.final ? 70 : 52, c: pick(['#ffd23f', '#ff7ac6', '#7ff']) });
  for (let i = 0; i < (HB.final ? 30 : 8); i++) fx({ k: 'dot', x: ix + rnd(-40, 40), y: iy + rnd(-30, 30), vx: rnd(-500, 500), vy: rnd(-600, -100), g: 1200, life: rnd(.6, 1.1), s: rnd(10, 22), c: pick(['#9dff6a', '#c6ff7a', '#6be04a']) });
  if (!HB.final) {
    punch(.18); flash(.12);
    if (J.hp === 7 || J.hp === 4) say('j_ouch', { interrupt: true, who: 'j' });
    else if (J.hp % 3 === 2) say(pick(['b_gothim', 'n_awesome', 'n_amazing', 'n_woohoo']), { interrupt: true });
    if (J.hp % 2 === 0) J.tx = clamp(J.tx + pick([-90, 90]), VW * .58, VW - 240), J.hop = 1;
  } else {
    flash(.9, '#fff'); punch(.6);
    setTimeout(() => { HB.state = 'pop'; HB.popT = 0; sfx('levelup'); burst(J.x, J.y - 150, 60, { k: 'conf' }); }, 650);
  }
}
function updateHero(dtReal) {
  if (HB.hitstop > 0) { HB.hitstop -= dtReal; return; }
  const dt = dtReal * CAM.slow; HB.t += dt;
  const J = HB.j;
  // intro + power up cinematic
  if (HB.state === 'intro') {
    once('ready', 1.4, () => say('b_letsgo', { interrupt: true }));
    once('power', 3.0, () => { HB.state = 'power'; HB.pt = 0; say('n_powerup', { interrupt: true }); sfx('powerup'); rigAct(HB.rig, 'spin', 1.8, 'star'); HB.cam.tz = 1.8; HB.cam.tx = HB.bx; HB.cam.ty = GROUND - 120; slowmo(.5, 1.6); });
  }
  if (HB.state === 'power') {
    HB.pt += dt; HB.glowA = Math.min(1, HB.pt * 1.2);
    if (Math.random() < dt * 40) { const a = rnd(0, TAU), r = rnd(180, 320); fx({ k: 'dot', x: HB.bx + Math.cos(a) * r, y: GROUND - 100 + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.5, vy: -Math.sin(a) * r * 2.5, life: .4, s: rnd(8, 14), c: pick(['#ffd23f', '#fff', '#7ff']) }); }
    if (HB.pt > 1.4 && !HB.grown) { HB.grown = true; HB.growT = 0; flash(1, '#fff'); shake(20); sfx('hit'); HB.cape = true; say('n_megabot'); HB.cam.tz = 1; HB.cam.tx = VW / 2; HB.cam.ty = VH / 2; burst(HB.bx, GROUND - 150, 50, { k: 'star', size: 1.5 }); }
    if (HB.grown) { HB.growT += dt; HB.bs = lerp(.5, 1.08, easeElastic(Math.min(1, HB.growT / 1.2))); HB.bx = lerp(300, VW * .3, easeOut(Math.min(1, HB.growT / 1.2))); }
    if (HB.grown && HB.growT > 1.6) { HB.state = 'jelly'; HB.jt = 0; rigAct(HB.rig, 'flex', 1.6, 'determined'); }
  }
  if (HB.state === 'jelly') {
    HB.jt += dt;
    if (!J.on) { J.on = true; J.x = VW + 300; J.hop = 1; J.tx = VW - 330; say('j_wobble', { who: 'j', interrupt: true }); }
    if (HB.jt > 2.6 && !HB.events.tap) { HB.events.tap = 1; HB.state = 'fight'; say('n_tapbonk', { interrupt: true }); HB.lastTap = HB.t; }
  }
  // jelly physics: spring squash + hopping between spots
  if (J.on) {
    const k = 120, d = 9; J.v += (-k * J.sq - d * J.v) * dt; J.sq += J.v * dt;
    J.hit = Math.max(0, J.hit - dt * 2); if (J.hit <= 0 && !J.friend) J.face = 'grin';
    if (J.hop > 0) { J.hop = Math.max(0, J.hop - dt * 1.4); J.x = lerp(J.x, J.tx, 1 - Math.exp(-dt * 5)); }
    else J.x = lerp(J.x, J.tx, 1 - Math.exp(-dt * 3));
    J.y = GROUND - Math.sin(J.hop * PI) * 120 * (J.hop > 0 ? 1 : 0);
    J.bob += dt;
    if (J.hop > 0 && J.hop < .05 && !J.landed) { J.landed = true; J.v -= 6; shake(8); sfx('wobble'); }
    if (J.hop > .1) J.landed = false;
  }
  // bonk timeline
  if (HB.bonkT >= 0) {
    const dur = HB.final ? 1.0 : .42;
    const before = HB.bonkT; HB.bonkT += HB.final ? dt / CAM.slow * .5 : dt;
    if (before < dur * .4 && HB.bonkT >= dur * .4) bonkImpact();
    if (HB.bonkT >= dur) { HB.bonkT = -1; if (HB.bonkQ && HB.state === 'fight') { HB.bonkQ = 0; startBonk(); } }
  }
  // Mega Bolt steps toward the jelly for each bonk
  if (HB.state === 'fight' || HB.state === 'final') {
    HB.bx = lerp(HB.bx, J.x - 330 * (HB.bs / 1.08), 1 - Math.exp(-dt * 4));
    if (HB.t - HB.lastTap > 5 && HB.state === 'fight') { HB.lastTap = HB.t; say('n_tapbonk', { interrupt: true }); }
  }
  if (HB.state === 'pop') {
    HB.popT += dtReal; J.friend = true; J.face = 'love';
    if (HB.popT < .1) { HB.cam.tz = 1; HB.cam.tx = VW / 2; HB.cam.ty = VH / 2; HB.letter = 0; }
    once('friend1', HB.t, () => { say('j_friends', { who: 'j', interrupt: true }); J.v -= 8; J.tx = VW * .62; J.hop = 1; });
    if (HB.popT > 2.2 && !HB.events.shrink) { HB.events.shrink = 1; sfx('sparkle'); say('n_friends', { interrupt: true }); rigAct(HB.rig, 'cheer', 3, 'love'); }
    if (HB.popT > 2.2) { HB.bs = lerp(HB.bs, .62, .06); HB.bx = lerp(HB.bx, VW * .38, .05); }
    if (HB.popT > 2.4 && Math.random() < dtReal * 6) fx({ k: 'heart', x: rnd(VW * .3, VW * .7), y: GROUND - rnd(150, 350), vy: -80, life: 1.6, s: rnd(14, 24), c: pick(['#ff5a8a', '#ff7ac6']) });
    if (HB.popT > 4.2 && !HB.events.hero) { HB.events.hero = 1; say('b_hero'); sfx('fanfare'); burst(VW / 2, 200, 50, { k: 'conf' }); }
    if (HB.popT > 7 && !HB.events.win) { HB.events.win = 1; goWin('hero', 15); }
  }
  // camera ease
  const C = HB.cam; C.z = lerp(C.z, C.tz, 1 - Math.exp(-dtReal * 4)); C.x = lerp(C.x, C.tx, 1 - Math.exp(-dtReal * 4)); C.y = lerp(C.y, C.ty, 1 - Math.exp(-dtReal * 4));
}
function drawJelly(J, s) {
  const T = now() / 1000, sq = clamp(J.sq, -.45, .6), w = 1 + sq * .9, h = 1 - sq * .7;
  cx.save(); cx.translate(J.x, J.y); cx.scale(s, s);
  cx.fillStyle = 'rgba(40,0,40,.25)'; cx.beginPath(); cx.ellipse(0, 6, 170 * w, 26, 0, 0, TAU); cx.fill();
  cx.scale(w, h);
  const friend = J.friend, R = friend ? 110 : 160;
  const c0 = friend ? '#ffd0ec' : '#d8ff9a', c1 = friend ? '#ff7ac6' : '#7ed63a', c2 = friend ? '#c4307f' : '#2f8a1a';
  // wobbly dome outline
  cx.beginPath();
  for (let i = 0; i <= 40; i++) { const a = PI + i / 40 * PI, wob = Math.sin(a * 5 + T * 6) * 5 + Math.sin(a * 3 - T * 4) * 4; const rr2 = R + wob; const x = Math.cos(a) * rr2 * 1.12, y = Math.sin(a) * rr2 * 1.25; i ? cx.lineTo(x, y) : cx.moveTo(x, y); }
  cx.quadraticCurveTo(R * 1.18, 10, 0, 10); cx.quadraticCurveTo(-R * 1.18, 10, -R * 1.12, 0); cx.closePath();
  const g = cx.createRadialGradient(-R * .4, -R * .9, 10, 0, -R * .5, R * 1.5); g.addColorStop(0, c0); g.addColorStop(.5, c1); g.addColorStop(1, c2);
  cx.globalAlpha = .93; cx.fillStyle = g; cx.fill(); cx.globalAlpha = 1;
  cx.strokeStyle = 'rgba(255,255,255,.5)'; cx.lineWidth = 4; cx.stroke();
  // bubbles inside
  for (let i = 0; i < 6; i++) { const bx = Math.sin(i * 2.1) * R * .7, by = -R * .3 - ((T * 20 + i * 37) % (R * 1.0)); circ(bx, by, 6 + i % 3 * 3, 'rgba(255,255,255,.35)'); }
  // shine
  cx.fillStyle = 'rgba(255,255,255,.6)'; cx.beginPath(); cx.ellipse(-R * .55, -R * 1.0, R * .25, R * .12, -.6, 0, TAU); cx.fill();
  // face
  const fy = -R * .62;
  if (J.face === 'dizzy') { cx.strokeStyle = '#2a1030'; cx.lineWidth = 7; for (const sd of [-1, 1]) { cx.beginPath(); for (let a = 0; a < TAU * 1.6; a += .3) { const r = 4 + a * 3; cx.lineTo(sd * 48 + Math.cos(a + T * 10) * r, fy + Math.sin(a + T * 10) * r); } cx.stroke(); } }
  else if (J.face === 'love') { for (const sd of [-1, 1]) { cx.save(); cx.translate(sd * 40, fy); cx.scale(2.2, 2.2); cx.fillStyle = '#ff3b6b'; cx.beginPath(); cx.moveTo(0, 4); cx.bezierCurveTo(-10, -4, -6, -12, 0, -6); cx.bezierCurveTo(6, -12, 10, -4, 0, 4); cx.fill(); cx.restore(); } }
  else { // goofy googly eyes
    for (const [sd, r] of [[-1, 30], [1, 24]]) { circ(sd * 48, fy, r, '#fff'); cx.strokeStyle = '#2a1030'; cx.lineWidth = 4; cx.beginPath(); cx.arc(sd * 48, fy, r, 0, TAU); cx.stroke(); circ(sd * 48 + Math.sin(T * 3 + sd) * r * .35, fy + Math.cos(T * 2.3) * r * .3, r * .45, '#1a0820'); circ(sd * 48 - 4, fy - 6, 4, '#fff'); }
  }
  // mouth
  cx.fillStyle = '#5a0f3a';
  if (friend) { cx.beginPath(); cx.arc(0, fy + 34, 22, .1, PI - .1); cx.fill(); circ(-62, fy + 26, 14, 'rgba(255,90,140,.5)'); circ(62, fy + 26, 14, 'rgba(255,90,140,.5)'); }
  else { cx.beginPath(); cx.ellipse(0, fy + 52, 50, J.hit > 0 ? 30 : 22, 0, 0, PI); cx.fill(); cx.fillStyle = '#ff6b9a'; cx.beginPath(); cx.ellipse(14, fy + 66 + Math.sin(T * 8) * 3, 16, 14, .3, 0, TAU); cx.fill(); cx.fillStyle = '#fff'; cx.fillRect(-30, fy + 52, 14, 10); cx.fillRect(10, fy + 52, 14, 10); }
  // crown (wobbles, flies off on the final bonk)
  if (!friend) {
    cx.save(); cx.translate(0, -R * 1.22); cx.rotate(Math.sin(T * 5) * .12 - sq * .3);
    const cg = cx.createLinearGradient(0, -50, 0, 10); cg.addColorStop(0, '#fff3a0'); cg.addColorStop(.6, '#ffc61a'); cg.addColorStop(1, '#c98a00');
    cx.fillStyle = cg; cx.beginPath(); cx.moveTo(-55, 10); cx.lineTo(-62, -38); cx.lineTo(-28, -10); cx.lineTo(0, -50); cx.lineTo(28, -10); cx.lineTo(62, -38); cx.lineTo(55, 10); cx.closePath(); cx.fill();
    circ(0, -2, 9, '#ff3b6b'); circ(-62, -40, 7, '#fff3a0'); circ(62, -40, 7, '#fff3a0'); circ(0, -52, 7, '#fff3a0');
    cx.restore();
  } else { star5(0, -R * 1.3, 18, '#ffd23f', T); }
  cx.restore();
}
function drawHero(dt) {
  const C = HB.cam, [shx, shy] = camShakeXY(), z = C.z * (1 + CAM.punch * .15);
  cx.save(); cx.translate(VW / 2 + shx, VH / 2 + shy); cx.scale(z, z); cx.translate(-C.x, -C.y);
  if (!cover(IMG.bg_boss, -60, -40, VW + 120, VH + 80, .5, .55)) { cx.fillStyle = '#f7b06b'; cx.fillRect(-60, -40, VW + 120, VH + 80); }
  if (HB.state === 'final' || HB.state === 'power' && !HB.grown) { cx.fillStyle = 'rgba(40,0,80,.35)'; cx.fillRect(-60, -40, VW + 120, VH + 80); rays(HB.state === 'final' ? HB.j.x : HB.bx, GROUND - 160, 16, 1400, 70, 'rgba(255,240,180,.12)', now() / 900); }
  if (HB.j.on) drawJelly(HB.j, HB.j.friend ? .8 : 1);
  const p = rigPose(HB.rig, HB.hitstop > 0 ? 0 : HB.state === 'final' ? dt * .5 : dt * CAM.slow);
  if (HB.glowA > 0) glow(HB.bx, GROUND - 200 * HB.bs, 300 * HB.bs + Math.sin(now() / 80) * 10, 'rgba(255,220,90,1)', HB.glowA * .6);
  drawBolt({ x: HB.bx, y: GROUND + 6, s: HB.bs, color: SV.color, hat: SV.hat, face: p.face, pose: p, cape: HB.cape, capeCol: 'rgba(255,90,90,.9)', aura: HB.state === 'pop' ? 0 : HB.glowA, core: 1, coreCol: 'rgba(255,220,90,1)' });
  drawFx();
  cx.restore();
  // letterbox for the slow-mo final bonk
  HB.letterA = lerp(HB.letterA || 0, HB.letter, .12);
  if (HB.letterA > .01) { cx.fillStyle = '#000'; cx.fillRect(0, 0, VW, 70 * HB.letterA); cx.fillRect(0, VH - 70 * HB.letterA, VW, 70 * HB.letterA); }
  // HUD: jelly meter
  if (HB.j.on && !HB.j.friend) {
    const bw = Math.min(420, VW * .36), bx = VW / 2 - bw / 2, k = HB.j.hp / JK_HP;
    cx.fillStyle = 'rgba(30,10,80,.55)'; rr(bx - 6, 30, bw + 12, 36, 18); cx.fill();
    const g = cx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#9dff6a'); g.addColorStop(1, '#3fbf2a'); cx.fillStyle = g; rr(bx, 36, Math.max(24, bw * k), 24, 12); cx.fill();
    cx.save(); cx.translate(bx - 18, 52); cx.scale(.16, .16); drawJelly({ x: 0, y: 60, sq: 0, face: 'grin', hit: 0, friend: false }, 1); cx.restore();
  }
  backBtnAt(VW - 56, 52, () => { slowmo(1, 0); go('hub'); });
  if (HB.state === 'fight' && HB.j.hp === JK_HP) drawHandHint(VW * .55, VH * .55, 'tap');
  drawBubble(VW / 2 - 100, 100);
  if (CAM.flash > 0) { cx.fillStyle = CAM.flashCol; cx.globalAlpha = CAM.flash; cx.fillRect(0, 0, VW, VH); cx.globalAlpha = 1; }
}
