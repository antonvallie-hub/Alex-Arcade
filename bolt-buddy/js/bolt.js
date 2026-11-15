'use strict';
// Bolt: glossy 3D-toy robot drawn in code (same blue helmet, antenna, ear discs and glowing pixel face as V-Remote),
// with V-Remote's own pixel-face glyphs on the visor (copied 1:1 from tv-control robot.js v1.4), an animation rig and moves.
const COLORS = [
  { name: 'Sky Blue', base: '#4da6ff', light: '#c4e8ff', dark: '#1d5bbf' },
  { name: 'Ruby Red', base: '#ff5a5f', light: '#ffd0d0', dark: '#b81d2a' },
  { name: 'Lime Green', base: '#5fd45a', light: '#d6ffcf', dark: '#22861f' },
  { name: 'Grape Purple', base: '#a46bff', light: '#e6d6ff', dark: '#5a2cc0' },
  { name: 'Sunny Orange', base: '#ffa53a', light: '#ffe6c2', dark: '#c45e06' },
  { name: 'Bubblegum Pink', base: '#ff7ac6', light: '#ffd9ef', dark: '#c4307f' },
];
const HATS = ['none', 'cap', 'crown', 'party', 'astro', 'chef', 'pirate'];
// ---- V-Remote face glyphs ('#' = one pixel block) and faces: identical to tv-control/app/public/js/robot.js ----
const G = {
  eye: { u: 3, rows: ['.##.', '####', '####', '####', '####', '.##.'] }, eyeWide: { u: 4, rows: ['.##.', '####', '####', '####', '.##.'] },
  eyeShut: { u: 3, rows: ['....', '....', '####'] }, eyeLid: { u: 3, rows: ['....', '####', '####', '.##.'] },
  eyeHappy: { u: 3, rows: ['.##.', '#..#', '#..#'] }, eyeSad: { u: 4, rows: ['#.#', '.#.'] },
  heart: { u: 3, rows: ['##.##', '#####', '#####', '.###.', '..#..'] }, star: { u: 3, rows: ['..#..', '..#..', '#####', '.###.', '##.##'] },
  ex: { u: 4, rows: ['#.#', '.#.', '#.#'] }, gt: { u: 4, rows: ['#..', '.#.', '#..'] }, lt: { u: 4, rows: ['..#', '.#.', '..#'] },
  dot: { u: 4, rows: ['##', '##'] }, spiral: { u: 3, rows: ['####', '#..#', '#.##', '#...', '####'] },
  browSadL: { u: 3, rows: ['..##', '##..'] }, browSadR: { u: 3, rows: ['##..', '..##'] },
  browMadL: { u: 3, rows: ['##..', '..##'] }, browMadR: { u: 3, rows: ['..##', '##..'] }, browUp: { u: 3, rows: ['.##.', '#..#'] },
  smile: { u: 4, rows: ['#...#', '.###.'] }, grin: { u: 4, rows: ['#####', '#...#', '.###.'] }, flat: { u: 4, rows: ['####'] },
  small: { u: 4, rows: ['##'] }, oh: { u: 3, rows: ['.##.', '#..#', '#..#', '.##.'] }, frown: { u: 4, rows: ['.###.', '#...#'] },
  smirk: { u: 4, rows: ['....#', '####.'] }, wavy: { u: 3, rows: ['.#...#.', '#.#.#.#', '...#...'] }, zip: { u: 3, rows: ['#.#.#.#', '#######', '#.#.#.#'] },
  whistle: { u: 3, rows: ['.#.', '#.#', '.#.'] }, shades: { u: 3, rows: ['################', '.######..######.', '..####....####..'] },
  zz: { u: 3, rows: ['###', '..#', '.#.', '###'] }, q: { u: 3, rows: ['.##.', '#..#', '..#.', '.#..', '....', '.#..'] },
  sweat: { u: 3, rows: ['.#', '##', '##'] }, note: { u: 3, rows: ['.###', '.#.#', '.#.#', '##.#', '##..'] },
};
const EL = [86, 95], ER = [129, 95], MO = [109, 113];
const FACES = {
  happy: ['eye', 'eye', 'smile'], blink: ['eyeShut', 'eyeShut', 'smile'], joy: ['eyeHappy', 'eyeHappy', 'grin'], yes: ['eyeHappy', 'eyeHappy', 'smile'],
  no: ['eye', 'eye', 'flat', [['browMadL', 86, 80], ['browMadR', 129, 80]]], love: ['heart', 'heart', 'smile'], star: ['star', 'star', 'grin'],
  surprised: ['eyeWide', 'eyeWide', 'oh'], sad: ['eye', 'eye', 'frown', [['browSadL', 86, 80], ['browSadR', 129, 80]]],
  angry: ['eye', 'eye', 'flat', [['browMadL', 86, 81], ['browMadR', 129, 81]]], worried: ['eye', 'eye', 'wavy', [['browSadL', 86, 80], ['browSadR', 129, 80], ['sweat', 146, 86]]],
  determined: ['gt', 'lt', 'flat'], sleepy: ['eyeLid', 'eyeLid', 'small'], asleep: ['eyeShut', 'eyeShut', 'small'], dizzy: ['spiral', 'spiral', 'wavy'],
  ko: ['ex', 'ex', 'oh'], shh: ['eye', 'eye', 'zip'], wink: ['eye', 'eyeHappy', 'smirk'], smug: ['eyeLid', 'eyeLid', 'smirk'],
  cool: [null, null, 'smirk', [['shades', 108, 95]]], whistle: ['eyeHappy', 'eye', 'whistle', [['note', 150, 78]]], focus: ['dot', 'dot', 'small'],
  curious: ['eye', 'eyeWide', 'small', [['browUp', 129, 79]]], meh: ['eyeLid', 'eyeLid', 'flat'],
  sing: ['eyeHappy', 'eyeHappy', 'oh'], listen: ['eyeWide', 'eyeWide', 'small', [['browUp', 86, 79], ['browUp', 129, 79]]],
};
const FACE_K = 2.45, FCX = 107.5, FCY = 99, FW_ = 160, FH_ = 116, FRES = 2.5; // face canvas in visor units, rendered at FRES px/unit
const FACE_CACHE = {};
function faceCanvas(name) {
  if (FACE_CACHE[name]) return FACE_CACHE[name];
  const f = FACES[name] || FACES.happy, c = document.createElement('canvas'); c.width = FW_ * FRES; c.height = FH_ * FRES; const g = c.getContext('2d');
  g.scale(FRES, FRES); g.translate(FW_ / 2, FH_ / 2);
  const draw = (blur) => {
    g.save(); g.fillStyle = blur ? 'rgba(80,255,240,.9)' : '#7ffff7'; g.shadowColor = 'rgba(80,255,240,1)'; g.shadowBlur = blur ? 14 * FRES : 4 * FRES;
    const gl = (gname, sx, sy) => {
      const gg = G[gname]; if (!gg) return; const u = gg.u * FACE_K, w = gg.rows[0].length * u, hh = gg.rows.length * u;
      const x0 = (sx - FCX) * FACE_K - w / 2, y0 = (sy - FCY) * FACE_K - hh / 2;
      for (let j = 0; j < gg.rows.length; j++) for (let i = 0; i < gg.rows[j].length; i++) if (gg.rows[j][i] === '#') {
        // LED-matrix look: each block is 2x2 rounded dots
        const bx = x0 + i * u, by = y0 + j * u, d = u / 2;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { g.beginPath(); const r = d * .42; g.arc(bx + d * a + d / 2, by + d * b + d / 2, r, 0, TAU); g.fill(); }
      }
    };
    if (f[0]) gl(f[0], EL[0], EL[1]); if (f[1]) gl(f[1], ER[0], ER[1]); if (f[2]) gl(f[2], MO[0], MO[1]);
    if (f[3]) for (const [gname, gx, gy] of f[3]) gl(gname, gx, gy);
    g.restore();
  };
  draw(true); draw(false);
  return FACE_CACHE[name] = c;
}

// ---- body drawing ----
function capsule(x0, y0, x1, y1, w) { cx.lineCap = 'round'; cx.lineWidth = w; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke(); }
function shinyLimb(len, w, P) {
  // a limb from (0,0) down to (0,len) in local space, glossy
  const g = cx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, P.dark); g.addColorStop(.35, P.base); g.addColorStop(.55, P.light); g.addColorStop(1, P.dark);
  cx.strokeStyle = g; capsule(0, 0, 0, len, w);
}
function joint(x, y, r) { const g = cx.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r); g.addColorStop(0, '#6d7ba8'); g.addColorStop(1, '#2a3359'); circ(x, y, r, g); }
function hand(P, open) {
  // mitten hand with a thumb, at local origin
  const g = cx.createRadialGradient(-5, -5, 2, 0, 0, 20); g.addColorStop(0, P.light); g.addColorStop(.5, P.base); g.addColorStop(1, P.dark);
  cx.fillStyle = g; cx.beginPath(); cx.ellipse(0, 6, 15, 18, 0, 0, TAU); cx.fill();
  if (open) { for (let k = -1; k <= 1; k++) { cx.beginPath(); cx.ellipse(k * 8, 22, 4.5, 9, k * .2, 0, TAU); cx.fill(); } }
  cx.beginPath(); cx.ellipse(-13, 2, 6, 9, -.6, 0, TAU); cx.fill();
}
function arm(sd, P, a, e, open) {
  cx.save(); cx.rotate(-sd * a); shinyLimb(40, 26, P); cx.translate(0, 40); joint(0, 0, 11);
  cx.rotate(-sd * e); shinyLimb(34, 24, P); cx.translate(0, 38); if (sd < 0) cx.scale(-1, 1); hand(P, open); cx.restore();
}
function drawHat(h, P, t) {
  const hat = HATS[h]; if (hat === 'none') return;
  cx.save(); cx.translate(0, -372);
  if (hat === 'cap') {
    let g = cx.createLinearGradient(0, -40, 0, 20); g.addColorStop(0, '#ff6b6b'); g.addColorStop(1, '#c41e2a');
    cx.fillStyle = g; cx.beginPath(); cx.ellipse(0, 6, 92, 58, 0, PI, TAU); cx.fill();
    cx.fillStyle = '#a3141f'; cx.beginPath(); cx.ellipse(18, 14, 104, 20, -.04, 0, TAU); cx.fill();
    cx.fillStyle = '#ff4b55'; cx.beginPath(); cx.ellipse(18, 10, 100, 15, -.04, 0, TAU); cx.fill();
    star5(0, -24, 16, '#ffd23f'); circ(0, -50, 7, '#fff');
  } else if (hat === 'crown') {
    const g = cx.createLinearGradient(0, -60, 0, 20); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ffc61a'); g.addColorStop(1, '#c98a00');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(-70, 18); cx.lineTo(-78, -40); cx.lineTo(-40, -8); cx.lineTo(0, -58); cx.lineTo(40, -8); cx.lineTo(78, -40); cx.lineTo(70, 18); cx.closePath(); cx.fill();
    cx.strokeStyle = '#a06c00'; cx.lineWidth = 3; cx.stroke();
    circ(-78, -42, 8, '#fff3a0'); circ(78, -42, 8, '#fff3a0'); circ(0, -60, 9, '#fff3a0');
    circ(0, -2, 10, '#ff3b6b'); circ(-38, 4, 8, '#3bc4ff'); circ(38, 4, 8, '#5fd45a');
  } else if (hat === 'party') {
    cx.rotate(.18); const g = cx.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, '#9f5bff'); g.addColorStop(1, '#ff5bc8');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(-46, 14); cx.lineTo(0, -110); cx.lineTo(46, 14); cx.closePath(); cx.fill();
    cx.save(); cx.clip(); cx.strokeStyle = '#ffe14d'; cx.lineWidth = 9; for (let k = -2; k < 5; k++) { cx.beginPath(); cx.moveTo(-60, k * 30 - 40); cx.lineTo(60, k * 30 - 80); cx.stroke(); } cx.restore();
    for (let k = 0; k < 6; k++) circ(Math.cos(k) * 9, -114 + Math.sin(k) * 9, 9, ['#fff', '#7ff', '#ffd23f'][k % 3]);
  } else if (hat === 'astro') {
    cx.restore(); cx.save();
    const g = cx.createRadialGradient(-50, -340, 10, 0, -290, 150); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(.7, 'rgba(180,230,255,.10)'); g.addColorStop(1, 'rgba(200,240,255,.35)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(0, -292, 146, 0, TAU); cx.fill(); cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 4; cx.stroke();
    cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 10; cx.beginPath(); cx.arc(0, -292, 130, -2.5, -1.9); cx.stroke();
    const r = cx.createLinearGradient(0, -170, 0, -140); r.addColorStop(0, '#f2f4ff'); r.addColorStop(1, '#a9b3d6');
    cx.fillStyle = r; rr(-90, -176, 180, 30, 15); cx.fill(); circ(-50, -161, 6, '#ff5a5f'); circ(-30, -161, 6, '#ffd23f'); circ(-10, -161, 6, '#5fd45a');
  } else if (hat === 'chef') {
    cx.fillStyle = '#e9eef8'; rr(-58, -30, 116, 44, 10); cx.fill();
    cx.fillStyle = '#fff'; for (const [px, py, pr] of [[-44, -58, 34], [0, -76, 42], [44, -58, 34], [-20, -50, 34], [22, -50, 34]]) { cx.beginPath(); cx.arc(px, py, pr, 0, TAU); cx.fill(); }
    cx.strokeStyle = '#d4dbea'; cx.lineWidth = 3; for (let k = -2; k <= 2; k++) { cx.beginPath(); cx.moveTo(k * 22, -26); cx.lineTo(k * 22, 10); cx.stroke(); }
  } else if (hat === 'pirate') {
    const g = cx.createLinearGradient(0, -70, 0, 20); g.addColorStop(0, '#3a3a52'); g.addColorStop(1, '#151522');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(-120, 14); cx.quadraticCurveTo(-60, -20, -50, -60); cx.quadraticCurveTo(0, -96, 50, -60); cx.quadraticCurveTo(60, -20, 120, 14); cx.quadraticCurveTo(0, -6, -120, 14); cx.fill();
    cx.strokeStyle = '#ffc61a'; cx.lineWidth = 5; cx.stroke(); star5(0, -40, 18, '#fff');
    cx.fillStyle = '#ff5a5f'; cx.beginPath(); cx.ellipse(70, -30, 10, 22, .6, 0, TAU); cx.fill();
  }
  cx.restore();
}
function drawCape(P, t, flap, col) {
  cx.save(); const c = col || 'rgba(120,220,255,.75)';
  const w = Math.sin(t * 6) * 10 * flap;
  const g = cx.createLinearGradient(0, -190, 0, -30); g.addColorStop(0, c); g.addColorStop(1, c.replace(/[\d.]+\)$/, '0.35)'));
  cx.fillStyle = g; cx.beginPath(); cx.moveTo(-50, -190); cx.quadraticCurveTo(-120 - w, -100, -140 - w * 2, -20 + w); cx.quadraticCurveTo(0, 10 + w, 140 + w * 2, -20 - w); cx.quadraticCurveTo(120 + w, -100, 50, -190); cx.closePath(); cx.fill();
  cx.restore();
}
// o: {x,y,s,color,hat,face,pose,ear,cape,capeCol,core,aura,headOnly,alpha}
function drawBolt(o) {
  const P = o.pal || COLORS[o.color || 0], p = o.pose || {}, T = now() / 1000;
  const s = o.s || 1;
  cx.save(); cx.translate(o.x, o.y);
  if (o.alpha != null) cx.globalAlpha = o.alpha;
  // ground shadow
  if (!o.noShadow) { const lift = Math.max(0, -(p.bob || 0)); cx.fillStyle = 'rgba(10,0,40,' + (0.32 * clamp(1 - lift / 300, .2, 1)) + ')'; cx.beginPath(); cx.ellipse(0, 4 * s, 92 * s * clamp(1 - lift / 400, .4, 1), 18 * s, 0, 0, TAU); cx.fill(); }
  cx.scale(s, s);
  cx.translate(p.bx || 0, p.bob || 0);
  if (o.aura) { glow(0, -200, 230 + Math.sin(T * 8) * 12, 'rgba(255,220,90,1)', .55 * o.aura); }
  cx.rotate(p.rot || 0);
  cx.scale((p.sx || 1) * (p.flip || 1), p.sy || 1);
  // cape
  if (o.cape) drawCape(P, T, 1, o.capeCol);
  // legs
  for (const sd of [-1, 1]) {
    cx.save(); cx.translate(sd * 30, -96); cx.rotate(-sd * ((sd < 0 ? p.lL : p.lR) || 0)); cx.translate(0, (sd < 0 ? p.lyL : p.lyR) || 0);
    shinyLimb(62, 34, P); joint(0, 4, 13);
    const fg = cx.createLinearGradient(0, 60, 0, 92); fg.addColorStop(0, P.light); fg.addColorStop(.4, P.base); fg.addColorStop(1, P.dark);
    cx.fillStyle = fg; cx.beginPath(); cx.ellipse(sd * 6, 80, 30, 18, 0, 0, TAU); cx.fill(); cx.fillStyle = '#2a3359'; cx.beginPath(); cx.ellipse(sd * 6, 92, 26, 5, 0, 0, TAU); cx.fill();
    cx.restore();
  }
  // jet flames (rocket move)
  if (p.jet) { for (const sd of [-1, 1]) { const L = 50 + Math.random() * 40 * p.jet; const g = cx.createLinearGradient(0, 90, 0, 90 + L); g.addColorStop(0, 'rgba(255,255,220,.95)'); g.addColorStop(.4, 'rgba(255,170,40,.9)'); g.addColorStop(1, 'rgba(255,60,20,0)'); cx.fillStyle = g; cx.beginPath(); cx.moveTo(sd * 36 - 16, 92); cx.lineTo(sd * 36, 92 + L); cx.lineTo(sd * 36 + 16, 92); cx.fill(); } }
  // torso
  {
    const g = cx.createRadialGradient(-26, -170, 8, 0, -140, 90); g.addColorStop(0, P.light); g.addColorStop(.45, P.base); g.addColorStop(1, P.dark);
    cx.fillStyle = g; rr(-64, -196, 128, 108, 48); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.18)'; rr(-42, -176, 84, 70, 30); cx.fill();
    cx.strokeStyle = 'rgba(20,30,80,.25)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(-60, -120); cx.quadraticCurveTo(0, -108, 60, -120); cx.stroke();
    // power core on the chest
    const cl = o.coreCol || 'rgba(120,255,250,1)';
    circ(0, -146, 19, '#1b2450'); circ(0, -146, 13, cl.replace(/[\d.]+\)$/, '1)'));
    glow(0, -146, 42 + Math.sin(T * 4) * 4, cl, .7 + (o.core || 0) * .3);
    circ(-4, -150, 4, 'rgba(255,255,255,.8)');
  }
  // arms
  for (const sd of [-1, 1]) { cx.save(); cx.translate(sd * 62, -176); joint(0, 0, 14); arm(sd, P, (sd < 0 ? p.aL : p.aR) || 0, (sd < 0 ? p.eL : p.eR) || 0, (sd < 0 ? p.openL : p.openR)); cx.restore(); }
  // neck + head
  cx.save(); cx.translate(0, -196); cx.rotate(p.hr || 0); cx.translate(p.hx || 0, p.hy || 0); cx.translate(0, 196);
  joint(0, -198, 18);
  drawHead(P, o, p, T);
  cx.restore();
  cx.restore();
}
function drawHead(P, o, p, T) {
  // antenna (behind hats)
  cx.save(); cx.translate(0, -380); cx.rotate(p.ant || 0);
  cx.strokeStyle = '#3c4a7a'; cx.lineWidth = 9; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(0, -38); cx.stroke();
  const ag = cx.createRadialGradient(-4, -48, 2, 0, -44, 15); ag.addColorStop(0, '#e9fbff'); ag.addColorStop(.5, P.light); ag.addColorStop(1, P.base); circ(0, -44, 14, ag);
  if (o.ear) glow(0, -44, 30, 'rgba(120,255,250,1)', o.ear);
  cx.restore();
  // ears
  for (const sd of [-1, 1]) {
    const ex = sd * 104, ey = -290;
    const g = cx.createRadialGradient(ex - 6, ey - 8, 2, ex, ey, 32); g.addColorStop(0, P.light); g.addColorStop(.5, P.base); g.addColorStop(1, P.dark);
    circ(ex, ey, 30, g);
    const ea = o.ear || 0;
    circ(ex, ey, 18, ea > 0 ? 'rgb(' + (90 + 100 * ea | 0) + ',' + (200 + 55 * ea | 0) + ',250)' : P.dark);
    circ(ex, ey, 10, ea > 0 ? '#e8ffff' : shade(P.base, .2));
    if (ea > 0) glow(ex, ey, 60 + 20 * ea, 'rgba(120,255,250,1)', ea);
  }
  // helmet
  const g = cx.createRadialGradient(-44, -350, 10, 0, -292, 130); g.addColorStop(0, '#ffffff'); g.addColorStop(.18, P.light); g.addColorStop(.55, P.base); g.addColorStop(1, P.dark);
  cx.fillStyle = g; cx.beginPath(); cx.ellipse(0, -290, 106, 96, 0, 0, TAU); cx.fill();
  cx.strokeStyle = 'rgba(20,30,80,.22)'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(0, -290, 106, 96, 0, 0, TAU); cx.stroke();
  // visor
  const vg = cx.createLinearGradient(0, -350, 0, -228); vg.addColorStop(0, '#1d2b5e'); vg.addColorStop(1, '#070b22');
  cx.fillStyle = vg; rr(-84, -350, 168, 122, 46); cx.fill();
  cx.strokeStyle = shade(P.dark, -.2); cx.lineWidth = 5; cx.stroke();
  // face (V-Remote pixel faces)
  const fn = o.face || 'happy', fc = faceCanvas(fn);
  cx.save(); rr(-80, -346, 160, 114, 42); cx.clip();
  cx.drawImage(fc, -FW_ / 2 + (p.lookX || 0), -290 - FH_ / 2 + (p.lookY || 0), FW_, FH_);
  const rg = cx.createLinearGradient(0, -344, 0, -300); rg.addColorStop(0, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = rg; cx.beginPath(); cx.ellipse(-10, -330, 70, 22, -.08, 0, TAU); cx.fill();
  cx.restore();
  // helmet shine
  cx.fillStyle = 'rgba(255,255,255,.55)'; cx.beginPath(); cx.ellipse(-52, -356, 22, 11, -.6, 0, TAU); cx.fill();
  drawHat(o.hat || 0, P, T);
}

// ---- animation rig ----
function BotRig() {
  return { move: null, mt: 0, md: 0, face: 'happy', faceUntil: 0, blinkAt: now() + 2500, ear: 0, earT: 0, asleep: false, sleepT: 0, T: 0, onDone: null, flip: 1, look: [0, 0], lookT: 0, hue: null };
}
const MOVES = {
  wave: (t, k) => ({ aR: 1.95, eR: .55 + Math.sin(t * 14) * .4, hr: .08, openR: 1, aL: .2 }),
  hop: (t, k) => { const h = Math.sin(k * PI); return { bob: -70 * h, sy: k < .1 || k > .9 ? .9 : 1.04, aL: .6 + h, aR: .6 + h }; },
  jump: (t, k) => {
    if (k < .18) { const q = k / .18; return { bob: 10 * q, sy: 1 - .15 * q, sx: 1 + .1 * q, aL: .2, aR: .2 }; }
    if (k < .72) { const q = (k - .18) / .54, h = Math.sin(q * PI); return { bob: -170 * h, sy: 1.08, sx: .95, aL: 2.0, aR: 2.0, eL: .6, eR: .6, lL: .2, lR: .2, openL: 1, openR: 1 }; }
    const q = (k - .72) / .28; return { bob: 0, sy: 1 - .18 * Math.sin(q * PI), sx: 1 + .14 * Math.sin(q * PI), aL: .6, aR: .6 };
  },
  dance: (t, k) => { const b = Math.sin(t * 9); return { bx: b * 22, rot: b * .12, aL: 1.6 + Math.sin(t * 9) * .9, aR: 1.6 - Math.sin(t * 9) * .9, eL: 1, eR: 1, lyL: Math.max(0, b) * -14, lyR: Math.max(0, -b) * -14, bob: -Math.abs(Math.sin(t * 9)) * 18, hr: -b * .1, openL: 1, openR: 1 }; },
  spin: (t, k) => ({ sx: Math.cos(k * TAU * 2), bob: -Math.sin(k * PI) * 60, aL: 1.4, aR: 1.4, openL: 1, openR: 1 }),
  robot: (t, k) => { const st = Math.floor(t * 4) % 4; return { aL: [0, 1.57, 1.57, .3][st], eL: [0, 1.57, 0, 1.57][st], aR: [1.57, 0, .3, 1.57][st], eR: [1.57, 0, 1.57, 0][st], hr: [-.12, .12, -.12, .12][st], bob: st % 2 ? -6 : 0 }; },
  nod: (t, k) => ({ hy: Math.abs(Math.sin(t * 10)) * 10, hr: 0 }),
  shake: (t, k) => ({ hr: Math.sin(t * 22) * .16 * (1 - k) }),
  sing: (t, k) => ({ rot: Math.sin(t * 4) * .07, aL: 1.1 + Math.sin(t * 4) * .25, aR: 1.1 - Math.sin(t * 4) * .25, eL: .5, eR: .5, openL: 1, openR: 1, hr: Math.sin(t * 4) * .1, bob: -Math.abs(Math.sin(t * 4)) * 6 }),
  sleep: (t, k) => ({ bob: 16, sy: .93, hr: .22, hy: 12, aL: .05, aR: .05, eL: .3, eR: .3, rot: .04 }),
  yawn: (t, k) => ({ aL: 2.0 * Math.sin(k * PI), aR: 2.0 * Math.sin(k * PI), eL: .6, eR: .6, sy: 1 + .06 * Math.sin(k * PI), hr: -.1 * Math.sin(k * PI) }),
  cheer: (t, k) => ({ aL: 2.0 + Math.sin(t * 16) * .2, aR: 2.0 - Math.sin(t * 16) * .2, eL: .6, eR: .6, bob: -Math.abs(Math.sin(t * 8)) * 34, openL: 1, openR: 1 }),
  laugh: (t, k) => ({ bx: Math.sin(t * 40) * 3, rot: Math.sin(t * 20) * .05, aL: .5, aR: .5, eL: 1.8, eR: 1.8, hr: Math.sin(t * 10) * .08, bob: -Math.abs(Math.sin(t * 12)) * 6 }),
  puppy: (t, k) => ({ hr: .28, aL: .7, aR: .7, eL: 1.3, eR: 1.3, bob: -Math.abs(Math.sin(t * 7)) * 22, rot: Math.sin(t * 14) * .05 }),
  roar: (t, k) => { const q = k < .3 ? k / .3 : 1; return { rot: k < .3 ? -.12 * q : .1, aL: 1.9 * q, aR: 1.9 * q, eL: .9, eR: .9, openL: 1, openR: 1, bx: k > .3 ? Math.sin(t * 50) * 3 : 0 }; },
  rocket: (t, k) => { const up = k < .15 ? 0 : k < .85 ? Math.sin((k - .15) / .7 * PI) : 0; return { bob: -160 * up + (k < .15 ? 10 : 0), jet: k > .1 && k < .9 ? 1 : 0, aL: 2.0, aR: 2.0, eL: .5, eR: .5, sy: k < .15 ? .9 : 1.05 }; },
  think: (t, k) => ({ aR: .9, eR: 2.3, hr: .14, aL: .15 }),
  tickle: (t, k) => ({ sx: 1 + Math.sin(t * 30) * .05 * (1 - k), sy: 1 - Math.sin(t * 30) * .05 * (1 - k), aL: .8, aR: .8, eL: 1.6, eR: 1.6, bob: -Math.abs(Math.sin(t * 15)) * 10 }),
  point: (t, k) => ({ aR: 1.5, eR: .1, hr: -.05, openR: 0 }),
  flex: (t, k) => ({ aL: 1.6, aR: 1.6, eL: 2.2, eR: 2.2, sy: 1.03, bob: -Math.abs(Math.sin(t * 6)) * 8 }),
  bonk: (t, k) => { const q = k < .4 ? k / .4 : 1 - (k - .4) / .6; return { aR: 2.1 * q, eR: .5, aL: .4, rot: .08 * q, bob: -20 * q }; },
  colors: (t, k) => ({ sx: Math.cos(k * TAU * 1.5) * 1, bob: -Math.sin(k * PI) * 40, aL: 1.9, aR: 1.9, eL: .5, eR: .5, openL: 1, openR: 1 }),
};
function rigAct(R, name, dur, face, onDone) {
  R.move = name; R.mt = 0; R.md = dur || 1.2; R.onDone = onDone || null;
  if (face) { R.face = face; R.faceUntil = now() + R.md * 1000 + 150; }
  if (name !== 'sleep') R.asleep = false;
}
function rigFace(R, face, ms) { R.face = face; R.faceUntil = now() + (ms || 1500); }
function rigPose(R, dt) {
  R.T += dt; const T = R.T;
  const base = { bob: Math.sin(T * 2.4) * 3, sy: 1 + Math.sin(T * 2.4) * .012, aL: .14 + Math.sin(T * 2.4) * .04, aR: .14 + Math.sin(T * 2.4 + .5) * .04, eL: .25, eR: .25, ant: Math.sin(T * 3.1) * .1, sx: 1, rot: 0, hr: Math.sin(T * .9) * .03 };
  let p = base;
  if (R.move) {
    R.mt += dt; const k = clamp(R.mt / R.md, 0, 1), mv = MOVES[R.move](R.mt, k);
    const w = R.move === 'sleep' ? clamp(R.mt / .6, 0, 1) : Math.min(1, R.mt / .12, (R.md - R.mt) / .15 + (R.move === 'spin' || R.move === 'colors' ? 1 : 0));
    p = Object.assign({}, base);
    for (const key in mv) { const v = mv[key]; p[key] = typeof v === 'number' && typeof base[key] === 'number' ? lerp(base[key], v, clamp(w, 0, 1)) : (w > .02 ? v : (base[key] || 0)); }
    if (R.mt >= R.md && R.move !== 'sleep') { const f = R.onDone; R.move = null; R.onDone = null; if (f) f(); }
  }
  p.ant = (p.ant || 0) + Math.sin(T * 9) * (R.move ? .12 : 0);
  // face: blink + look-around
  let face = R.face;
  if (R.faceUntil && now() > R.faceUntil) { R.faceUntil = 0; R.face = face = 'happy'; }
  if (R.asleep) face = 'asleep';
  else if (!R.faceUntil && face === 'happy') {
    if (now() > R.blinkAt) { if (now() > R.blinkAt + 130) R.blinkAt = now() + 2200 + Math.random() * 3500; else face = 'blink'; }
  }
  if ((R.lookT -= dt) < 0) { R.lookT = 1.5 + Math.random() * 2.5; R.look = Math.random() < .5 ? [0, 0] : [rnd(-6, 6), rnd(-3, 3)]; }
  R.lx = lerp(R.lx || 0, R.look[0], .12); R.ly = lerp(R.ly || 0, R.look[1], .12); p.lookX = R.lx; p.lookY = R.ly;
  R.ear = Math.max(0, R.ear - dt * 2);
  p.face = face; return p;
}
