'use strict';
// Screens: title, hub (Bolt's home), customize, win/Power Core, parent area; input routing; main loop; test hooks.
let scr = 'title', scrT = 0, firstDone = false, rotDismissed = false;
const HUB = { rig: BotRig(), greeted: false, sparkle: [] };
const GAMES = [
  { id: 'gobble', name: 'Bolt Gobble', clip: 'n_gobble', bg: 'bg_gobble', ring: '#ffc61a', start: () => startGobble() },
  { id: 'rocket', name: 'Rocket Ride', clip: 'n_rocket', bg: 'bg_space', ring: '#7ff', start: () => startRocket() },
  { id: 'hero', name: 'Mega Bot Hero', clip: 'n_hero', bg: 'bg_boss', ring: '#ff7ac6', start: () => startHero() },
];
const SOON = [{ name: 'Dance Party', icon: 'music', col: '#ff7ac6' }, { name: 'Tower Builder', icon: 'block', col: '#ffa53a' }, { name: 'Peek-a-Bot', icon: 'eyes', col: '#7ad1ff' }];
let WIN = null;
function go(s, arg) {
  if (scr === 'talk' && s !== 'talk') leaveTalk(); else if (MIC.on) micClose();
  scr = s; scrT = 0; BTN = []; FX.length = 0; CAM.slow = 1; CAM.slowT = 0; CAM.flash = 0; clearVoiceQ(); lastInput = now();
  if (s === 'hub') enterHub();
  else if (s === 'talk') enterTalk();
  else if (s === 'custom') { music('space'); HUB.crig = BotRig(); rigAct(HUB.crig, 'wave', 1.5, 'joy'); say('n_pickcolor', { interrupt: true }); say('n_pickhat'); }
  else if (s === 'gobble') startGobble();
  else if (s === 'rocket') startRocket();
  else if (s === 'hero') startHero();
  else if (s === 'win') enterWin(arg);
}
function goWin(game, bolts) { if (scr === 'win') return; go('win', { game, bolts }); }
function enterHub() {
  music('space'); HUB.rig = HUB.rig || BotRig(); HUB.rig.asleep = false; HUB.rig.move = null;
  if (!HUB.greeted) { HUB.greeted = true; rigAct(HUB.rig, 'wave', 2, 'joy'); setTimeout(() => { if (scr === 'hub') say(isAlex() ? 'b_hi_alex' : 'b_hi_3', { interrupt: true }); }, 400); }
  else { rigAct(HUB.rig, pick(['hop', 'wave', 'cheer']), 1.4, pick(['joy', 'star', 'love'])); }
  setTimeout(() => { if (scr === 'hub' || scr === 'talk') voskLoad(); }, 6000); // warm his ears in the background
}
// ---------------- title ----------------
function drawLogo(x, y, s) {
  cx.save(); cx.translate(x, y); cx.scale(s, s); cx.rotate(-.04);
  const t = now() / 1000; cx.font = '900 110px ' + FONT;
  const w1 = cx.measureText('BOLT').width, w2 = cx.measureText('BUDDY').width, gap = 34, tot = w1 + gap + w2;
  txt('BOLT', -tot / 2 + w1 / 2, Math.sin(t * 3) * 4, 110, '#fff', { grad: ['#e9fbff', '#4da6ff'], lw: 20, stroke: '#1a1260' });
  txt('BUDDY', tot / 2 - w2 / 2, Math.sin(t * 3 + 1) * 4 + 6, 110, '#fff', { grad: ['#fff3a0', '#ffb21f'], lw: 20, stroke: '#1a1260' });
  cx.restore();
}
function drawTitle(dt) {
  cover(IMG.bg_hub, 0, 0, VW, VH, .5, .6); cx.fillStyle = 'rgba(20,10,60,.45)'; cx.fillRect(0, 0, VW, VH);
  rays(VW / 2, VH * .62, 14, 1200, 90, 'rgba(255,255,255,.05)', scrT * .15);
  const k = easeBack(Math.min(1, scrT / .8));
  drawLogo(VW / 2, 92, k * 1.0);
  const p = rigPose(HUB.rig, dt);
  if (!HUB.rig.move && Math.random() < dt * .08) rigAct(HUB.rig, pick(['wave', 'spinHappy', 'dance', 'backflip', 'hover']), 1.8, pick(['joy', 'star'])); else rigIdleTick(HUB.rig, dt);
  drawBolt({ x: VW / 2, y: 560, s: .8, color: SV.color, hat: SV.hat, face: p.face, pose: p, cape: level() >= 2 });
  const pr = 1 + Math.sin(scrT * 5) * .06;
  glossBall(VW / 2 + 300, 430, 64 * pr, '#5fd45a'); cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(VW / 2 + 286, 400); cx.lineTo(VW / 2 + 326, 430); cx.lineTo(VW / 2 + 286, 460); cx.fill();
  BTN.push({ id: 'play', x: VW / 2 + 300, y: 430, r: 70, cb: () => { sfx('pop'); go('hub'); } });
  parentHome();
}
// ---------------- hub ----------------
function tileArt(g, x, y, r) {
  cx.save(); cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.clip();
  cover(IMG[g.bg], x - r, y - r, r * 2, r * 2, g.id === 'hero' ? .45 : .5, .55);
  if (g.id === 'gobble') { GB.swirl = now() / 600; GB.gulp = 0; GB.mouth = 0; drawHole(x - 8, y + 8, r * .42); drawItem('nut', x + r * .45, y - r * .38, r * .45, now() / 700); drawItem('duck', x - r * .5, y - r * .42, r * .5); }
  else if (g.id === 'rocket') { cx.save(); cx.translate(x, y); cx.scale(r / 95, r / 95); drawRocketShip(-6, 6, -.35, .7, 0); cx.restore(); drawItem('star', x + r * .55, y - r * .45, r * .4); }
  else { drawJelly({ x: x + r * .35, y: y + r * .75, sq: Math.sin(now() / 200) * .06, face: 'grin', hit: 0, friend: false, bob: 0 }, r / 330); drawBoltHeadFace(x - r * .42, y - r * .1, r / 520, 'determined'); }
  cx.restore();
}
function drawHub(dt) {
  if (!cover(IMG.bg_hub, 0, 0, VW, VH, .5, .7)) { cx.fillStyle = '#3a2a8a'; cx.fillRect(0, 0, VW, VH); }
  const T = now() / 1000, R = HUB.rig;
  // floating sparkles
  if (Math.random() < dt * 3) fx({ k: 'dot', x: rnd(0, VW), y: VH + 10, vy: rnd(-60, -30), vx: rnd(-10, 10), life: 6, s: rnd(4, 8), c: pick(['rgba(255,240,180,.8)', 'rgba(160,255,255,.8)']) });
  drawFx();
  // Bolt on his stage
  const lv = level(), bs = [.8, .87, .94][lv], bx = VW * .43, by = 562;
  const p = rigPose(R, dt); rigIdleTick(R, dt);
  glow(bx, by - 10, 170, 'rgba(160,220,255,1)', .35);
  drawBolt({ x: bx, y: by, s: bs, color: SV.color, hat: SV.hat, face: p.face, pose: p, cape: lv >= 2, core: SV.bolts / CORE_CAP, ear: R.ear });
  if (R.asleep && Math.random() < dt * 1.2) fx({ k: 'z', x: bx + 80, y: by - 360 * bs, vx: 30, vy: -50, life: 2, s: 12, c: '#bff' });
  BTN.push({ id: 'bolt', x: bx, y: by - 230 * bs, w: 210 * bs, h: 440 * bs, cb: () => pokeBolt() });
  // Power Core meter
  drawCore(VW * .42, 42, scrT);
  // talk + customize (left)
  const tx = 150, ty = 222, trr = 80;
  for (let i = 0; i < 2; i++) { const k = ((T * .6) + i / 2) % 1; cx.strokeStyle = 'rgba(255,170,150,' + (.5 * (1 - k)) + ')'; cx.lineWidth = 5; cx.beginPath(); cx.arc(tx, ty, trr + 8 + k * 46, 0, TAU); cx.stroke(); }
  glossBall(tx, ty, trr * (pressed('h_talk') ? .92 : 1 + Math.sin(T * 3) * .02), '#ff4436'); drawIcon('mic', tx, ty + 3, 1.05);
  BTN.push({ id: 'h_talk', x: tx, y: ty, r: trr + 6, cb: () => { sfx('pop'); say(isBolt() ? 'n_talk' : 'l_tapme', { interrupt: true }); go('talk'); } });
  txt('Talk', tx, ty + trr + 26, 26, '#fff', { lw: 6 });
  const ux = 150, uy = 440;
  glossBall(ux, uy, 56 * (pressed('h_custom') ? .92 : 1), '#a46bff'); drawIcon('brush', ux, uy + 2, 1.15);
  BTN.push({ id: 'h_custom', x: ux, y: uy, r: 62, cb: () => { sfx('pop'); go('custom'); } });
  // games (right)
  const gp = [[VW - 235, 175], [VW - 112, 318], [VW - 235, 462]];
  GAMES.forEach((g, i) => {
    const [x, y] = gp[i], r = 74 * (pressed('g_' + g.id) ? .92 : 1) * (1 + Math.sin(T * 2 + i) * .02);
    cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(x, y + r * .95, r * .8, r * .18, 0, 0, TAU); cx.fill();
    circ(x, y, r + 9, g.ring); circ(x, y, r + 3, '#fff');
    tileArt(g, x, y, r);
    const sh = cx.createLinearGradient(0, y - r, 0, y); sh.addColorStop(0, 'rgba(255,255,255,.45)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = sh; cx.beginPath(); cx.ellipse(x, y - r * .5, r * .7, r * .38, 0, 0, TAU); cx.fill();
    cx.font = '900 17px ' + FONT; const lw2 = cx.measureText(g.name).width + 22; cx.fillStyle = 'rgba(30,15,90,.82)'; rr(x - lw2 / 2, y + r * .52, lw2, 28, 14); cx.fill(); txt(g.name, x, y + r * .52 + 15, 17, '#fff', { stroke: false });
    BTN.push({ id: 'g_' + g.id, x, y, r: r + 8, cb: () => { sfx('pop'); burst(x, y, 16); go(g.id); } });
  });
  // coming soon
  SOON.forEach((s2, i) => {
    const x = VW - 318 + i * 76, y = 46, r = 29;
    circ(x, y, r + 5, 'rgba(255,255,255,.45)'); glossBall(x, y, r, '#6b6f8f');
    cx.globalAlpha = .55; if (s2.icon === 'music') drawIcon('music', x, y, .58); else if (s2.icon === 'block') { drawItem('block', x, y, 38); } else { circ(x - 9, y, 9, '#fff'); circ(x + 9, y, 9, '#fff'); circ(x - 7, y + 1, 4, '#222'); circ(x + 11, y + 1, 4, '#222'); }
    cx.globalAlpha = 1; drawIcon('lock', x + r * .6, y + r * .55, .55);
    BTN.push({ id: 'soon' + i, x, y, r: r + 4, cb: () => { sfx('locked'); say('n_soon', { interrupt: true }); } });
  });
  parentHome();
  // hidden parent lock: hold 3 s on the faint dot in the top-right corner
  const f = holdFrac('plock'); BTN.push({ id: 'plock', x: VW - 24, y: 24, r: 18, cb: () => openParent(), hold: 3000 });
  circ(VW - 24, 24, 12, 'rgba(255,255,255,' + (.12 + f * .5) + ')'); if (f > 0) { cx.strokeStyle = '#ffd23f'; cx.lineWidth = 4; cx.beginPath(); cx.arc(VW - 24, 24, 17, -PI / 2, -PI / 2 + f * TAU); cx.stroke(); }
  drawBubble(bx, by - 500 * bs, true);
  idleSleepCheck(R);
}
function pokeBolt() {
  lastInput = now(); const R = HUB.rig;
  if (R.asleep) { wake(); return; }
  if (R.move) return;
  const r = pick([['b_tickle', 'laugh', 'joy'], ['b_boop', 'hop', 'star'], ['b_wee', 'spin', 'joy'], [hiClip(), 'wave', 'love']]);
  say(r[0], { interrupt: true }); rigAct(R, r[1], 1.4, r[2]); sfx('boing'); burst(VW * .43, 300, 10, { k: 'star', g: 200 });
}
function drawCore(x, y, t) {
  const w = Math.min(300, VW * .24), k = clamp(SV.bolts / CORE_CAP, 0, 1), lv = level();
  cx.save();
  cx.fillStyle = 'rgba(20,10,60,.6)'; rr(x - w / 2 - 50, y - 24, w + 100, 48, 24); cx.fill();
  cx.strokeStyle = 'rgba(160,240,255,.6)'; cx.lineWidth = 3; cx.stroke();
  cx.fillStyle = 'rgba(255,255,255,.12)'; rr(x - w / 2, y - 12, w, 24, 12); cx.fill();
  const g = cx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#7ff'); g.addColorStop(1, '#ffd23f');
  cx.fillStyle = g; if (k > 0) { rr(x - w / 2, y - 12, Math.max(24, w * k), 24, 12); cx.fill(); }
  glow(x - w / 2 - 24, y, 34, 'rgba(120,255,250,1)', .5 + .2 * Math.sin(t * 4));
  circ(x - w / 2 - 24, y, 18, '#1b2450'); circ(x - w / 2 - 24, y, 12, '#7ffff7');
  txt(LEVEL_NAMES[lv], x + w / 2 + 6, y, 18, '#fff', { al: 'left', lw: 4 });
  cx.restore();
}
function parentHome() {
  const f = holdFrac('phome');
  BTN.push({ id: 'phome', x: 44, y: VH - 40, r: 26, cb: () => { location.href = '../'; }, hold: 2000 });
  circ(44, VH - 40, 26, 'rgba(0,0,0,.35)'); cx.globalAlpha = .8; drawIcon('home', 44, VH - 42, .8); cx.globalAlpha = 1;
  if (f > 0) { cx.strokeStyle = '#ffd23f'; cx.lineWidth = 6; cx.beginPath(); cx.arc(44, VH - 40, 31, -PI / 2, -PI / 2 + f * TAU); cx.stroke(); }
}
// ---------------- customize ----------------
function drawCustom(dt) {
  cover(IMG.bg_hub, 0, 0, VW, VH, .5, .7); cx.fillStyle = 'rgba(30,10,80,.35)'; cx.fillRect(0, 0, VW, VH);
  const R = HUB.crig, p = rigPose(R, dt), bx = VW / 2, by = 570;
  rays(bx, by - 220, 12, 700, 60, 'rgba(255,255,255,.05)', scrT * .2);
  drawBolt({ x: bx, y: by, s: .95, color: SV.color, hat: SV.hat, face: p.face, pose: p, cape: level() >= 2 });
  drawFx();
  backBtn(() => go('hub'));
  const cu = SV.all ? 6 : SV.unlock.c, hu = SV.all ? 6 : SV.unlock.h;
  COLORS.forEach((c, i) => {
    const x = 110 + (i % 2) * 120, y = 175 + ((i / 2) | 0) * 135, sel = SV.color === i, open = i < cu;
    if (sel) { circ(x, y, 62, '#fff'); glow(x, y, 90, 'rgba(255,255,255,1)', .4); }
    glossBall(x, y, 52 * (pressed('c' + i) ? .9 : 1), open ? c.base : '#6b6f8f');
    if (!open) { drawIcon('lock', x, y, .9); }
    BTN.push({ id: 'c' + i, x, y, r: 56, cb: () => { if (!open) { sfx('locked'); return; } SV.color = i; save(); sfx('sparkle'); burst(bx, by - 250, 24, { cols: [c.base, c.light, '#fff'] }); rigAct(R, pick(['spin', 'cheer', 'hop']), 1.3, pick(['star', 'love', 'joy'])); say(pick(['b_looking', 'b_love', 'b_stylish']), { interrupt: true }); } });
  });
  HATS.forEach((h, i) => {
    const x = VW - 230 + (i % 2) * 120 - (i === 0 ? 0 : 0), y = 130 + ((i / 2) | 0) * 118 + (i === 6 ? 0 : 0), sel = SV.hat === i, open = i === 0 || i <= hu;
    if (sel) { circ(x, y, 56, '#fff'); glow(x, y, 80, 'rgba(255,255,255,1)', .4); }
    glossBall(x, y, 48 * (pressed('h' + i) ? .9 : 1), open ? '#3b4a8a' : '#6b6f8f');
    cx.save(); cx.beginPath(); cx.arc(x, y, 46, 0, TAU); cx.clip();
    if (i === 0) { drawBoltHeadFace(x, y + 6, .3, 'happy', 0); }
    else { cx.save(); cx.translate(x, y + 34); cx.scale(.44, .44); cx.translate(0, 372); if (!open) cx.globalAlpha = .45; drawHat(i, COLORS[SV.color], 0); cx.restore(); }
    cx.restore();
    if (!open) drawIcon('lock', x + 26, y + 26, .6);
    BTN.push({ id: 'h' + i, x, y, r: 52, cb: () => { if (!open) { sfx('locked'); return; } SV.hat = i; save(); sfx('boing'); burst(bx, by - 420, 18, { k: 'star' }); rigAct(R, 'hop', .9, pick(['star', 'love', 'cool'])); say(i === 0 ? 'b_boop' : pick(['b_love', 'b_looking', 'b_stylish']), { interrupt: true }); } });
  });
  drawBubble(bx + 120, 60);
}
// ---------------- win + Power Core ----------------
function enterWin(a) {
  const g = GAMES.find(x => x.id === a.game);
  SV.plays[a.game] = (SV.plays[a.game] || 0) + 1; SV.stars += 3; SV.total += a.bolts;
  WIN = { game: a.game, name: g ? g.name : '', bolts: a.bolts, given: 0, t: 0, flying: [], levelUp: null, rig: BotRig(), phase: 'stars', reward: null };
  save(); music('space'); rigAct(WIN.rig, 'cheer', 2.4, 'star'); say(PRAISE(), { interrupt: true }); sfx('fanfare');
}
function giveBolt() {
  SV.bolts++; WIN.given++; sfx('coin');
  if (SV.bolts >= CORE_CAP) {
    const before = level(); SV.bolts = 0; SV.fills++;
    // reward: alternate a new hat and a new color while any are locked
    let reward = null;
    if (!SV.all) { if (SV.fills % 2 === 1 && SV.unlock.h < 6) { SV.unlock.h++; reward = { kind: 'hat', i: SV.unlock.h }; } else if (SV.unlock.c < 6) { SV.unlock.c++; reward = { kind: 'color', i: SV.unlock.c - 1 }; } else if (SV.unlock.h < 6) { SV.unlock.h++; reward = { kind: 'hat', i: SV.unlock.h }; } }
    WIN.levelUp = { t: 0, from: before, to: level(), reward }; WIN.phase = 'level';
    sfx('levelup'); flash(.6, '#fff'); shake(10);
    say('n_levelup', { interrupt: true });
    if (level() > before) say(level() === 2 ? 'n_megabot' : 'n_bigbot'); else if (reward && reward.kind === 'hat') say('n_newhat');
    say(level() > before ? 'b_strong' : 'b_bigger');
  }
  save();
}
function drawWin(dt) {
  const W = WIN; W.t += dt;
  cover(IMG.bg_hub, 0, 0, VW, VH, .5, .7); cx.fillStyle = 'rgba(25,10,70,.6)'; cx.fillRect(0, 0, VW, VH);
  rays(VW / 2, 330, 14, 1100, 80, 'rgba(255,220,120,.08)', W.t * .3);
  txt(W.name, VW / 2, 92, 34, '#fff', { lw: 7 });
  // three stars, always
  for (let i = 0; i < 3; i++) {
    const k = clamp((W.t - .3 - i * .35) / .4, 0, 1); if (k <= 0) continue;
    if (!W['s' + i]) { W['s' + i] = 1; sfx('star'); burst(VW / 2 + (i - 1) * 110, 170, 14, { k: 'star' }); }
    const s = easeBack(k) * (i === 1 ? 1.25 : 1);
    cx.save(); cx.translate(VW / 2 + (i - 1) * 110, 170 - (i === 1 ? 12 : 0)); cx.scale(s, s); glow(0, 0, 70, 'rgba(255,220,90,1)', .5); drawItem('star', 0, 0, 96, Math.sin(W.t * 2 + i) * .1); cx.restore();
  }
  // Bolt cheering
  const p = rigPose(W.rig, dt);
  if (!W.rig.move && Math.random() < dt * .6) rigAct(W.rig, pick(['cheer', 'dance', 'hop', 'spin']), 1.6, pick(['star', 'joy', 'love']));
  drawBolt({ x: VW / 2, y: 580, s: .62, color: SV.color, hat: SV.hat, face: p.face, pose: p, cape: level() >= 2 });
  // bolts fly into the Power Core
  drawCore(VW / 2, 42, W.t);
  if (W.phase === 'stars' && W.t > 1.6) W.phase = 'bolts';
  if (W.phase === 'bolts' && W.given + W.flying.length < W.bolts && Math.random() < dt * 14) W.flying.push({ x: VW / 2 + rnd(-60, 60), y: 380, t: 0, d: rnd(.55, .75) });
  for (let i = W.flying.length - 1; i >= 0; i--) {
    const f = W.flying[i]; f.t += dt; const k = easeIn(f.t / f.d);
    const cw = Math.min(300, VW * .24), tx = VW / 2 - cw / 2 + cw * clamp(SV.bolts / CORE_CAP, 0, 1), x = lerp(f.x, tx, k), y = lerp(f.y, 42, k) - Math.sin(k * PI) * 120;
    drawItem('nut', x, y, 40, f.t * 10);
    if (f.t >= f.d) { W.flying.splice(i, 1); if (W.phase === 'bolts' || W.phase === 'level') giveBolt(); }
  }
  if (W.phase === 'bolts' && W.given >= W.bolts && !W.flying.length) W.phase = 'done';
  drawFx();
  // level-up reveal
  if (W.levelUp) {
    const L = W.levelUp; L.t += dt; const k = easeBack(Math.min(1, L.t / .6));
    cx.fillStyle = 'rgba(10,0,40,' + (.6 * Math.min(1, L.t * 3)) + ')'; cx.fillRect(0, 0, VW, VH);
    rays(VW / 2, VH / 2, 12, 900, 90, 'rgba(255,210,63,.18)', L.t * .7);
    cx.save(); cx.translate(VW / 2, VH / 2); cx.scale(k, k);
    txt(L.to > L.from ? LEVEL_NAMES[L.to] + '!' : 'Power Core full!', 0, -190, 56, '#fff', { grad: ['#fff3a0', '#ffb21f'], lw: 12 });
    if (L.reward) {
      glossBall(0, 10, 110, L.reward.kind === 'color' ? COLORS[L.reward.i].base : '#3b4a8a');
      if (L.reward.kind === 'color') drawBoltHeadFace(0, 26, .55, 'star'); else { cx.save(); cx.translate(0, 70); cx.scale(.7, .7); cx.translate(0, 372); drawHat(L.reward.i, COLORS[SV.color], 0); cx.restore(); }
      txt(L.reward.kind === 'color' ? 'New color!' : 'New hat!', 0, 160, 40, '#fff', { lw: 9 });
    } else { drawBoltHeadFace(0, 20, .7, 'star'); }
    cx.restore();
    if (Math.random() < dt * 10) burst(rnd(0, VW), rnd(0, VH * .5), 4, { k: 'conf' });
    BTN.push({ id: 'lvl', x: VW / 2, y: VH / 2, w: VW, h: VH, cb: () => { if (L.t > 1.2) { W.levelUp = null; if (W.phase === 'level') W.phase = W.given >= W.bolts ? 'done' : 'bolts'; } } });
    if (L.t > 4.5) { W.levelUp = null; if (W.phase === 'level') W.phase = W.given >= W.bolts ? 'done' : 'bolts'; }
    return;
  }
  // buttons: play again + home
  if (W.t > 2.2) {
    const k = easeBack(Math.min(1, (W.t - 2.2) / .5));
    const g = GAMES.find(x => x.id === W.game);
    cx.save(); cx.globalAlpha = Math.min(1, (W.t - 2.2) * 3);
    const ax = VW / 2 + 290, hx = VW / 2 - 290, y = 430;
    glossBall(ax, y, 72 * k * (pressed('again') ? .92 : 1), '#5fd45a');
    cx.save(); cx.translate(ax, y); cx.scale(k, k); cx.strokeStyle = '#fff'; cx.lineWidth = 11; cx.lineCap = 'round'; cx.beginPath(); cx.arc(0, 0, 28, -.4, PI * 1.5); cx.stroke(); cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(18, -40); cx.lineTo(40, -12); cx.lineTo(8, -10); cx.fill(); cx.restore();
    glossBall(hx, y, 72 * k * (pressed('home') ? .92 : 1), '#7a5cff'); drawIcon('home', hx, y - 2, 1.5 * k);
    cx.restore();
    BTN.push({ id: 'again', x: ax, y, r: 76, cb: () => { sfx('pop'); go(W.game); } });
    BTN.push({ id: 'home', x: hx, y, r: 76, cb: () => { sfx('pop'); go('hub'); } });
  }
}
// ---------------- parent area (DOM, behind the hidden 3-second hold) ----------------
function openParent() {
  const el = document.getElementById('parent'); el.style.display = 'flex';
  document.getElementById('pKid').value = SV.kid; document.getElementById('pBot').value = SV.bot; document.getElementById('pAll').checked = !!SV.all;
  document.getElementById('pStats').textContent = 'Games played: ' + (SV.plays.gobble + SV.plays.rocket + SV.plays.hero) + ' · Power Core fills: ' + SV.fills + ' · Level: ' + LEVEL_NAMES[level()];
  document.getElementById('pMode').value = SV.talkMode || 'conv'; document.getElementById('pWait').value = SV.talkWait || 'normal'; document.getElementById('pDbg').checked = !!SV.debug;
  document.getElementById('pMic').textContent = 'Speech engine: ' + ({ idle: 'not loaded yet', loading: 'downloading (' + Math.round(VOSK.prog * 100) + '%)', ready: 'ready, works offline', failed: 'unavailable (' + VOSK.err + '); picture buttons still work' })[VOSK.state];
}
function closeParent() {
  const k = document.getElementById('pKid').value.trim().slice(0, 16), b = document.getElementById('pBot').value.trim().slice(0, 16);
  SV.kid = k || 'Alex'; SV.bot = b || 'Bolt'; SV.all = document.getElementById('pAll').checked;
  const mode = document.getElementById('pMode').value; if (mode !== SV.talkMode && MIC.on) { micClose(); TK.conv = false; }
  SV.talkMode = mode; SV.talkWait = document.getElementById('pWait').value; SV.debug = document.getElementById('pDbg').checked; save(); engCfg(); dbgShow(SV.debug); recEnsure();
  document.getElementById('parent').style.display = 'none';
}
function resetProgress() { if (!confirm('Reset Power Core, colors and hats?')) return; const k = SV.kid, b = SV.bot; SV = JSON.parse(JSON.stringify(DEF)); SV.kid = k; SV.bot = b; save(); closeParent(); }
// ---------------- input ----------------
function firstTap() {
  initAudio(); voicePreload(); if (firstDone) return; firstDone = true;
  try {
    const de = document.documentElement, rq = de.requestFullscreen || de.webkitRequestFullscreen;
    if (rq && document.fullscreenEnabled !== false && !document.fullscreenElement) {
      const p = rq.call(de, { navigationUI: 'hide' });
      const lk = () => { try { const q = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (q && q.catch) q.catch(() => {}); } catch (e) {} };
      if (p && p.then) p.then(lk).catch(() => {}); else lk();
    }
  } catch (e) {}
}
const portrait = () => SH > SW * 1.05 && !rotDismissed;
const GAME_INPUT = { gobble: gobbleInput, rocket: rocketInput, hero: heroInput };
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); firstTap(); lastInput = now(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const p = vpt(e);
  if (portrait()) { rotDismissed = true; return; }
  if (document.getElementById('parent').style.display === 'flex') return;
  // a sleeping Bolt wakes on any tap (the mic button handles its own wake)
  if (scr === 'hub' && HUB.rig.asleep) { wake(); return; }
  if (scr === 'talk') rigLook(TK.rig, p.x - TK.bolt.x, p.y - (TK.bolt.y - 290 * TK.bolt.s), 1400);   // his eyes follow Alex's finger
  for (let k = BTN.length - 1; k >= 0; k--) { const b = BTN[k]; if (btnHit(b, p)) { ptr.set(e.pointerId, { b, t0: now(), done: false }); if (b.down) b.down(); return; } }
  if (GAME_INPUT[scr]) { ptr.set(e.pointerId, 'game'); GAME_INPUT[scr]('down', p); return; }
  if (scr === 'title') { sfx('pop'); go('hub'); }
});
cv.addEventListener('pointermove', e => { const v = ptr.get(e.pointerId); if (v === 'game' && GAME_INPUT[scr]) GAME_INPUT[scr]('move', vpt(e)); });
function pup(e) {
  const v = ptr.get(e.pointerId); ptr.delete(e.pointerId); if (!v) return; const p = vpt(e);
  if (v === 'game') { if (GAME_INPUT[scr] && ![...ptr.values()].includes('game')) GAME_INPUT[scr]('up', p); return; }
  if (v.b.up) { v.b.up(); return; }
  if (!v.b.hold && btnHit(v.b, p)) v.b.cb();
}
cv.addEventListener('pointerup', pup); cv.addEventListener('pointercancel', pup);
for (const ev of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'wheel']) document.addEventListener(ev, e => { if (e.target === cv && e.cancelable) e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.repeat) return; firstTap();
  if (e.code === 'Space' && GAME_INPUT[scr]) { GAME_INPUT[scr]('down', { x: VW / 2, y: VH / 2 }); e.preventDefault(); }
  if (e.code === 'Escape' && scr !== 'hub' && scr !== 'title') go('hub');
});
window.addEventListener('keyup', e => { if (e.code === 'Space' && GAME_INPUT[scr]) GAME_INPUT[scr]('up', { x: VW / 2, y: VH / 2 }); });
window.addEventListener('blur', () => { if (MIC.hold) micUp(); ptr.clear(); if (scr === 'rocket') RK.hold = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (MIC.hold) micUp(); if (MIC.on) { micClose(); TK.conv = false; if (scr === 'talk') { TK.rig.asleep = true; rigAct(TK.rig, 'sleep', 999, 'asleep'); TK.rig.asleep = true; } } if (AC) AC.suspend(); } else if (AC) AC.resume(); });
// ---------------- main loop ----------------
function drawRotate() {
  cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.fillStyle = '#140c3a'; cx.fillRect(0, 0, SW, SH);
  const s = Math.min(SW, SH) / 400, t = now() / 1000;
  cx.save(); cx.translate(SW / 2, SH / 2); cx.scale(s, s); const a = -Math.min(1, (t % 2.4) / 1.2) * PI / 2; cx.rotate(a);
  rr(-60, -110, 120, 220, 16); cx.fillStyle = '#fff'; cx.fill(); rr(-50, -95, 100, 180, 8); cx.fillStyle = '#2a1d78'; cx.fill();
  cx.rotate(-a); drawBoltHeadFace(0, 0, .28, 'joy'); cx.restore();
  cx.save(); cx.translate(SW / 2 + 110 * s, SH / 2 - 130 * s); cx.scale(s, s); cx.strokeStyle = '#ffd23f'; cx.lineWidth = 8; cx.lineCap = 'round'; cx.beginPath(); cx.arc(0, 0, 40, -2.5, 0); cx.stroke(); cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.moveTo(52, -6); cx.lineTo(28, -6); cx.lineTo(40, 14); cx.fill(); cx.restore();
}
let last = now(), fpsAcc = 0, fpsN = 0, slowSecs = 0; window.__fps = 0;
let ftAcc = 0, ftN = 0; window.__ft = 0;
function frame(nw) {
  const fs0 = performance.now();
  let dtR = Math.min(.05, (nw - last) / 1000); last = nw; fpsAcc += dtR; fpsN++;
  if (fpsAcc > 1) { window.__fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; if (window.__fps < 45 && !document.hidden && scrT > 3) { if (++slowSecs >= 2 && DPR_CAP > 1) { DPR_CAP = Math.max(1, DPR_CAP - .5); slowSecs = 0; resize(); } else if (slowSecs >= 3 && !LITE) { LITE = true; slowSecs = 0; } } else slowSecs = 0; }
  dtR *= TS; scrT += dtR;
  try {
    ptr.forEach(v => { if (v && v.b && v.b.hold && !v.done && now() - v.t0 > v.b.hold) { v.done = true; v.b.cb(); } });
    stepCam(dtR); voiceTick();
    const dt = dtR * (scr === 'hero' ? 1 : CAM.slow);
    if (scr === 'gobble') updateGobble(dt); else if (scr === 'rocket') updateRocket(dt); else if (scr === 'hero') updateHero(dtR); else if (scr === 'talk') updateTalk(dt);
    stepFx(scr === 'hero' ? dtR * CAM.slow : dt);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.fillStyle = '#05030f'; cx.fillRect(0, 0, SW, SH);
    if (portrait()) { BTN = []; drawRotate(); }
    else {
      cx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy); cx.save(); cx.beginPath(); cx.rect(0, 0, VW, VH); cx.clip(); BTN = [];
      if (scr === 'title') drawTitle(dt); else if (scr === 'hub') drawHub(dt); else if (scr === 'talk') drawTalk(dt); else if (scr === 'custom') drawCustom(dt);
      else if (scr === 'gobble') drawGobble(dt); else if (scr === 'rocket') drawRocket(dt); else if (scr === 'hero') drawHero(dtR); else if (scr === 'win') drawWin(dt);
      cx.restore();
    }
  } catch (err) { console.error(err); }
  ftAcc += performance.now() - fs0; if (++ftN >= 60) { window.__ft = +(ftAcc / ftN).toFixed(2); ftAcc = 0; ftN = 0; }
  requestAnimationFrame(frame);
}
// ---------------- test hooks for the headless bot (no effect on play) ----------------
// test hooks: play a WAV into the exact mic pipeline (turn engine + vosk + intent + reply) instead of the real microphone.
// leak=true also routes Bolt's own voice into that "mic" (like a tablet speaker next to its mic) to prove he ignores himself.
async function simMic(url, o) {
  o = o || {}; initAudio(); await voskLoad(); if (VOSK.state !== 'ready') return { err: VOSK.err || VOSK.state };
  if (!TK.conv) { SV.talkMode = 'conv'; TK.conv = true; recEnsure(); }
  if (!MIC.on) {
    const mix = AC.createGain(); micAttach(mix); MIC.mix = mix; if (o.leak) { TK.leak = mix; voxG.connect(mix); }
    const n = AC.createBufferSource(), nb = AC.createBuffer(1, AC.sampleRate, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * .018; // room hiss at the same level as the test WAVs' own hiss (~-40 dBFS)
    n.buffer = nb; n.loop = true; n.connect(mix); n.start();
  }
  const ab = await (await fetch(url)).arrayBuffer(); const buf = await new Promise((res, rej) => AC.decodeAudioData(ab, res, rej));
  const s = AC.createBufferSource(); s.buffer = buf; s.connect(MIC.mix); const t0 = now(); s.start(); MIC.sim = s;
  return { t0, dur: buf.duration };
}
window.__bb = {
  state: () => ({ scr, vosk: VOSK.state, voskProg: VOSK.prog, fps: window.__fps, said: vlog.slice(-8), sv: SV, resp: (window.__resp || []).slice(-5),
    gb: scr === 'gobble' ? { state: GB.state, r: Math.round(GB.r), eaten: GB.eaten, total: GB.total, t: +GB.t.toFixed(1), hole: [(GB.hx - GB.camx) * GB.z + VW / 2, (GB.hy - GB.camy) * GB.z + VH / 2], z: GB.z,
      near: (() => { let b = null, bd = 1e9; for (const o of GB.items) if (o.fall < 0 && (o.r < GB.r * .9)) { const d = hyp(o.x - GB.hx, o.y - GB.hy); if (d < bd) { bd = d; b = o; } } return b ? [(b.x - GB.camx) * GB.z + VW / 2, (b.y - GB.camy) * GB.z + VH / 2] : null; })() } : null,
    rk: scr === 'rocket' ? { state: RK.state, d: Math.round(RK.d), len: RK_LEN, y: Math.round(RK.y), got: RK.got, next: (() => { const s = RK.stars.find(s => !s.got && s.x - RK.d > -20); return s ? Math.round(s.y) : null; })() } : null,
    hb: scr === 'hero' ? { state: HB.state, hp: HB.j.hp, t: +HB.t.toFixed(1) } : null,
    win: scr === 'win' ? { game: WIN.game, phase: WIN.phase, given: WIN.given, lvl: !!WIN.levelUp } : null }),
  go: (s, a) => { initAudio(); go(s, a); }, respond: k => respond(k, 'test'), simMic, startConv: () => startConv(true), micOff: () => { micClose(); TK.conv = false; },
  talk: () => ({ cap: MIC.kind, eng: ENG.state, floor: ENG.floor, mic: MIC.on, conv: TK.conv, asleep: TK.rig.asleep, lat: TK.lat.slice(), heard: TK.heard.slice(), resp: (window.__resp || []).slice(), choice: TK.choice ? TK.choice.ch : null, mem: DLG.mem, busy: botBusy(), ignored: ENG.ignored, turn: TK.turn ? { partial: TK.turn.partial, answered: TK.turn.answered } : null, said: DLG.said.slice() }),
  choiceTap, ask: k => askQuestion(k), dbg: on => dbgShow(on), tapBolt, rig: () => ({ move: TK.rig.move, listening: TK.rig.listening, face: TK.rig.face }), view: () => ({ ox, oy, sc, VW, VH }),
  reset: () => { SV = JSON.parse(JSON.stringify(DEF)); save(); }, openParent, closeParent, ls: () => LS.lastText,
};
// ---------------- boot ----------------
loadSave(); resize(); setTimeout(() => dbgShow(SV.debug), 0);
if (QS.get('icon')) { // icon renderer (used once at build time to make the home-screen icons)
  const S = +QS.get('icon');
  cv.width = S; cv.height = S; cv.style.width = S + 'px'; cv.style.height = S + 'px';
  const draw = () => {
    cx.setTransform(1, 0, 0, 1, 0, 0); const g = cx.createRadialGradient(S * .5, S * .35, S * .05, S * .5, S * .5, S * .75); g.addColorStop(0, '#6a4fe0'); g.addColorStop(.6, '#2a1d78'); g.addColorStop(1, '#120c33');
    cx.fillStyle = g; cx.fillRect(0, 0, S, S); cx.save(); cx.translate(S / 2, S / 2); for (let i = 0; i < 40; i++) { const a = i * 2.4, r = (i * 37 % 100) / 100 * S * .5; circ(Math.cos(a) * r, Math.sin(a) * r, S * .004 + (i % 3) * S * .002, 'rgba(255,255,255,.7)'); } cx.restore();
    const k = QS.get('mask') ? .72 : .84; drawBoltHeadFace(S / 2, S * (QS.get('mask') ? .55 : .57), S / 250 * k * .99, 'joy');
    document.title = 'icon-ready';
  };
  const wait = () => { draw(); };
  setTimeout(wait, 300);
} else requestAnimationFrame(frame);
