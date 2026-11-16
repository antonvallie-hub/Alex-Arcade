// Turbo Toy Racers v2: 3D toy-track circuits. Pure JS (no three.js), so Node can verify every track.
// A track is a turtle program (heading starts +x, y up). Left turns are positive degrees.
// Ops: ['S',len,dh,flag]  straight (dh = smooth climb), flag 'ax'/'az' = auto-length straights that close the circuit
//      ['T',deg,radius,dh,'bank']  arc turn (banked when 'bank')
//      ['LOOP',R]  vertical loop-the-loop (shifts sideways so it never hits itself)
//      ['JUMP',gap]  ramp, a gap with no road, a landing ramp
//      ['PAD']  boost pad      ['SC',r,len,dir]  a road bulge with a straight secret shortcut through it
export const RW = 7;          // road half width (m)
export const LOOPW = 2 * RW + 5;
const TAU = Math.PI * 2;

// Every circuit is four edges joined by four left corners; the four flagged straights stretch to close it.
const C = (r, bank, dh) => ['T', 90, r, dh || 0, bank ? 'bank' : ''];
const SCURVE = [['T', 30, 40], ['T', -30, 40]];
const HILL = h => [['S', 40, h], ['S', 40, -h]];
const JMP = (h, g) => [['S', 35, h], ['JUMP', g], ['S', 35, -h]];
const circuit = (e1, c1, e2, c2, e3, c3, e4, c4) => [['S', 25, 0, 'x+'], ...e1, c1, ['S', 20, 0, 'z-'], ...e2, c2, ['S', 20, 0, 'x-'], ...e3, c3, ['S', 20, 0, 'z+'], ...e4, c4, ['S', 25]];
export const RACES = [
  // ---- Bedroom Mega Track
  { laps: 2, seed: 11, prog: circuit([['PAD'], ['S', 20], ...HILL(4)], C(34, 1), [...JMP(5, 11)], C(30), [['SC', 18, 26, -1], ['S', 20]], C(36, 1), [['LOOP', 11], ['S', 25], ['PAD']], C(34)) },
  { laps: 2, seed: 23, prog: circuit([...SCURVE, ['PAD'], ['S', 20]], C(34, 1), [['LOOP', 11], ['S', 25]], C(32), [...JMP(6, 12)], C(34, 1), [['SC', 16, 26, -1], ['S', 15], ['PAD']], C(34)) },
  // boss: Mega Crusher
  { laps: 2, seed: 37, prog: circuit([['PAD'], ['S', 20], ['LOOP', 12], ['S', 25]], C(36, 1), [...JMP(6, 13)], C(32), [['SC', 18, 30, -1], ['S', 20], ['PAD'], ...SCURVE], C(36, 1), [...JMP(5, 12), ['S', 10], ['LOOP', 12], ['S', 20]], C(34)) },
  // ---- Desert Canyon
  { laps: 2, seed: 41, prog: circuit([['PAD'], ['S', 20], ...JMP(7, 12)], C(36, 1), [...SCURVE, ['LOOP', 11], ['S', 20]], C(32), [...HILL(6)], C(34, 1, 0), [['SC', 18, 28, -1], ['S', 15], ['PAD']], C(34)) },
  { laps: 2, seed: 53, prog: circuit([['PAD'], ['S', 15], ['LOOP', 11], ['S', 20]], C(30, 1), [...JMP(6, 12)], C(34), [['SC', 16, 30, -1], ['S', 20], ...HILL(5)], C(32, 1), [...SCURVE, ['PAD'], ['S', 20]], C(34)) },
  { laps: 2, seed: 67, prog: circuit([['PAD'], ['S', 20], ...JMP(7, 13)], C(36, 1), [['LOOP', 12], ['S', 25], ['PAD']], C(34), [['SC', 18, 30, -1], ['S', 20], ...SCURVE], C(36, 1), [...JMP(6, 12), ['S', 10], ['LOOP', 12], ['S', 20]], C(34)) },
  // ---- Dino Jungle
  { laps: 2, seed: 71, prog: circuit([['PAD'], ['S', 20], ['LOOP', 11], ['S', 25]], C(34, 1), [...JMP(6, 12)], C(32), [['SC', 16, 28, -1], ['S', 20], ...SCURVE], C(34, 1), [...HILL(4), ['PAD']], C(34)) },
  { laps: 2, seed: 83, prog: circuit([...SCURVE, ['PAD'], ['S', 20]], C(34, 1), [['SC', 16, 26, -1], ['S', 20]], C(32), [['LOOP', 11], ['S', 25]], C(34, 1), [...JMP(6, 12), ['PAD']], C(34)) },
  { laps: 2, seed: 97, prog: circuit([['PAD'], ['S', 20], ...JMP(7, 13)], C(36, 1), [['LOOP', 12], ['S', 25]], C(34), [['SC', 18, 32, -1], ['S', 20], ['PAD'], ...SCURVE], C(36, 1), [...JMP(6, 13), ['S', 10], ['LOOP', 12], ['S', 20]], C(34)) },
];

function rng(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

function run(prog, lens) {
  let x = 0, y = 0, z = 0, a = 0;
  const X = [], Y = [], Z = [], B = [], LP = [], GAP = [], LU = [];
  const mk = { jumps: [], pads: [], sc: [], loops: [], flags: [], ramps: [] };
  const push = (b, lp, gap, lu) => { X.push(x); Y.push(y); Z.push(z); B.push(b || 0); LP.push(lp || 0); GAP.push(gap ? 1 : 0); LU.push(lu || null); };
  push();
  const last = () => X.length - 1;
  function straight(len, dh, prof) {
    const n = Math.max(1, Math.ceil(len)), y0 = y;
    for (let k = 1; k <= n; k++) { const t = k / n; x += Math.cos(a) * len / n; z += Math.sin(a) * len / n; y = y0 + dh * (prof ? prof(t) : (1 - Math.cos(Math.PI * t)) / 2); push(); }
  }
  function turn(deg, r, dh, bank) {
    const sg = Math.sign(deg), rad = Math.abs(deg) * Math.PI / 180, len = rad * r, n = Math.max(2, Math.ceil(len)), y0 = y;
    const Bm = bank ? 0.42 : Math.min(0.14, 4 / r);
    for (let k = 1; k <= n; k++) {
      const t = k / n, da = -sg * rad / n; a += da / 2; x += Math.cos(a) * len / n; z += Math.sin(a) * len / n; a += da / 2;
      y = y0 + (dh || 0) * (1 - Math.cos(Math.PI * t)) / 2;
      const e = Math.min(1, t / 0.22, (1 - t) / 0.22); push(sg * Bm * smooth(e));
    }
  }
  let li = 0, fi = 0;
  for (const op of prog) {
    const k = op[0];
    if (k === 'S') { let len = op[1]; if (op[3]) { len = lens && lens[op[3]] != null ? lens[op[3]] : len; mk.flags.push({ f: op[3], a, len }); } straight(len, op[2] || 0); }
    else if (k === 'T') turn(op[1], op[2], op[3] || 0, op[4] === 'bank');
    else if (k === 'PAD') mk.pads.push(last());
    else if (k === 'LOOP') {
      const R = op[1], i0 = last(), p0 = [x, y, z], F0 = [Math.cos(a), 0, Math.sin(a)], L0 = [Math.sin(a), 0, -Math.cos(a)];
      const n = Math.ceil(TAU * R * 1.15); li++;
      for (let j = 1; j <= n; j++) {
        const th = TAU * j / n, sh = LOOPW * (th - Math.sin(th)) / TAU;
        x = p0[0] + F0[0] * R * Math.sin(th) - L0[0] * sh; z = p0[2] + F0[2] * R * Math.sin(th) - L0[2] * sh; y = p0[1] + R * (1 - Math.cos(th));
        const U = [-F0[0] * Math.sin(th), Math.cos(th), -F0[2] * Math.sin(th)];
        push(0, j < n ? li : 0, 0, j < n ? U : null);
      }
      y = p0[1]; mk.loops.push({ i0, i1: last(), R });
    }
    else if (k === 'JUMP') {
      const gap = op[1], H = 2.6, y0 = y, i0 = last();
      straight(13, H, t => t * t);
      const lip = last();
      const n = Math.ceil(gap);
      for (let j = 1; j <= n; j++) { x += Math.cos(a) * gap / n; z += Math.sin(a) * gap / n; push(0, 0, 1); }
      const land = last() + 1;
      straight(17, -H, t => 1 - (1 - t) * (1 - t));
      y = y0; mk.jumps.push({ i0, lip, land, end: last() });
    }
    else if (k === 'SC') {
      const r = op[1], L = op[2], d = op[3] || 1, i0 = last();
      turn(90 * d, r, 0); straight(L, 0); turn(-180 * d, r, 0); straight(L, 0); turn(90 * d, r, 0);
      mk.sc.push({ i0, i1: last(), side: -d });
    }
  }
  return { X, Y, Z, B, LP, GAP, LU, mk, end: [x, y, z], a };
}

export function buildTrack(r) {
  const rec = RACES[r];
  // close the circuit: solve the two auto straights so the end lands on the start
  let res = run(rec.prog);
  const base = {}; for (const f of res.mk.flags) base[f.f] = f.len;
  const ex = res.end[0], ez = res.end[2], lens = Object.assign({}, base);
  if (ex > 0) lens['x-'] += ex; else lens['x+'] -= ex;
  if (ez > 0) lens['z-'] += ez; else lens['z+'] -= ez;
  res = run(rec.prog, lens);
  const { X, Y, Z, B, LP, GAP, LU, mk } = res;
  // tiny leftover (and any height mismatch) spread along the lap
  const m = X.length - 1;           // last sample duplicates the first
  const err = [X[m] - X[0], Y[m] - Y[0], Z[m] - Z[0]];
  const n = m;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  let tot = 0; const cum = [0]; for (let i = 1; i <= m; i++) { tot += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1], Z[i] - Z[i - 1]); cum.push(tot); }
  for (let i = 0; i < n; i++) { const f = cum[i] / tot; px[i] = X[i] - err[0] * f; py[i] = Y[i] - err[1] * f; pz[i] = Z[i] - err[2] * f; }
  const S = new Float32Array(n + 1); let L = 0;
  for (let i = 1; i <= n; i++) { const j = i % n; L += Math.hypot(px[j] - px[i - 1], py[j] - py[i - 1], pz[j] - pz[i - 1]); S[i] = L; }
  // frames
  const F = new Float32Array(n * 3), U = new Float32Array(n * 3), Lv = new Float32Array(n * 3), curv = new Float32Array(n);
  const lp = new Uint8Array(n), gap = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n; let fx2 = px[b] - px[a], fy = py[b] - py[a], fz2 = pz[b] - pz[a]; const fl = Math.hypot(fx2, fy, fz2) || 1; fx2 /= fl; fy /= fl; fz2 /= fl;
    F[i * 3] = fx2; F[i * 3 + 1] = fy; F[i * 3 + 2] = fz2; lp[i] = LP[i]; gap[i] = GAP[i];
    let ux, uy, uz;
    if (LU[i]) { [ux, uy, uz] = LU[i]; }
    else { ux = 0; uy = 1; uz = 0; }
    const dt = ux * fx2 + uy * fy + uz * fz2; ux -= fx2 * dt; uy -= fy * dt; uz -= fz2 * dt; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    // left = U x F
    let lx = uy * fz2 - uz * fy, ly = uz * fx2 - ux * fz2, lz = ux * fy - uy * fx2;
    if (!LU[i] && B[i]) { const c = Math.cos(B[i]), s = Math.sin(B[i]); const nux = ux * c + lx * s, nuy = uy * c + ly * s, nuz = uz * c + lz * s; ux = nux; uy = nuy; uz = nuz; lx = uy * fz2 - uz * fy; ly = uz * fx2 - ux * fz2; lz = ux * fy - uy * fx2; }
    U[i * 3] = ux; U[i * 3 + 1] = uy; U[i * 3 + 2] = uz; Lv[i * 3] = lx; Lv[i * 3 + 1] = ly; Lv[i * 3 + 2] = lz;
  }
  for (let i = 0; i < n; i++) { // signed horizontal curvature (+ = turning left), smoothed
    let acc = 0, w = 0;
    for (let k = -4; k <= 4; k++) {
      const a = (i + k - 1 + n) % n, b = (i + k + 1) % n, ha = Math.atan2(F[a * 3 + 2], F[a * 3]), hb = Math.atan2(F[b * 3 + 2], F[b * 3]);
      let d = hb - ha; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      let ds = S[b] - S[a]; if (ds < 0) ds += L; if (!(ds > 0.2) || ds > 50) ds = 2; const cv = -d / ds; if (!lp[(i + k + n) % n] && isFinite(cv)) { acc += cv; w++; }
    }
    curv[i] = w ? acc / w : 0;
  }
  const T = { r, n, len: L, px, py, pz, F, U, Lv, S, curv, lp, gap, laps: rec.laps, closeErr: Math.hypot(...err), lens };
  T.jumps = mk.jumps.map(j => ({ lip: j.lip, land: j.land, s0: S[j.i0], sLip: S[j.lip], sLand: S[j.land], sEnd: S[j.end] }));
  T.loops = mk.loops.map(o => ({ s0: S[o.i0], s1: S[o.i1 % n], R: o.R }));
  T.pads = mk.pads.map(i => S[i] + 2);
  T.sc = mk.sc.map(o => {
    const i0 = o.i0, i1 = o.i1 % n, off = o.side * RW * 0.5;
    const A = [px[i0] + Lv[i0 * 3] * off, py[i0], pz[i0] + Lv[i0 * 3 + 2] * off], Bp = [px[i1] + Lv[i1 * 3] * off, py[i1], pz[i1] + Lv[i1 * 3 + 2] * off];
    const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]);
    const dir = [(Bp[0] - A[0]) / len, (Bp[1] - A[1]) / len, (Bp[2] - A[2]) / len];
    return { sa: S[i0], sb: S[i1], side: o.side, off, A, B: Bp, len, dir, left: [dir[2] / Math.hypot(dir[0], dir[2]), 0, -dir[0] / Math.hypot(dir[0], dir[2])] };
  });
  placeThings(T, rec.seed);
  return T;
}

// ---- lookups
export function idxAt(T, s) { s = ((s % T.len) + T.len) % T.len; let lo = 0, hi = T.n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T.S[m] <= s) lo = m; else hi = m; } return lo; }
// fills o with position/frame at lap distance s and lateral d (+ = left)
export function frameAt(T, s, d, o) {
  s = ((s % T.len) + T.len) % T.len; const i = idxAt(T, s), j = (i + 1) % T.n, f = (s - T.S[i]) / ((T.S[i + 1] - T.S[i]) || 1);
  const I = i * 3, J = j * 3, g = 1 - f;
  o.fx = T.F[I] * g + T.F[J] * f; o.fy = T.F[I + 1] * g + T.F[J + 1] * f; o.fz = T.F[I + 2] * g + T.F[J + 2] * f;
  o.ux = T.U[I] * g + T.U[J] * f; o.uy = T.U[I + 1] * g + T.U[J + 1] * f; o.uz = T.U[I + 2] * g + T.U[J + 2] * f;
  o.lx = T.Lv[I] * g + T.Lv[J] * f; o.ly = T.Lv[I + 1] * g + T.Lv[J + 1] * f; o.lz = T.Lv[I + 2] * g + T.Lv[J + 2] * f;
  let l = Math.hypot(o.fx, o.fy, o.fz); o.fx /= l; o.fy /= l; o.fz /= l; l = Math.hypot(o.ux, o.uy, o.uz); o.ux /= l; o.uy /= l; o.uz /= l; l = Math.hypot(o.lx, o.ly, o.lz); o.lx /= l; o.ly /= l; o.lz /= l;
  o.x = T.px[i] * g + T.px[j] * f + o.lx * d; o.y = T.py[i] * g + T.py[j] * f + o.ly * d; o.z = T.pz[i] * g + T.pz[j] * f + o.lz * d;
  o.curv = T.curv[i] * g + T.curv[j] * f; o.lp = T.lp[i] || T.lp[j]; o.gap = T.gap[i] && T.gap[j]; o.i = i; o.s = s;
  return o;
}

// ---- coins, star trails, item boxes, obstacles (deterministic per race)
function placeThings(T, seed) {
  const R = rng(seed), L = T.len, busy = [];
  const add = (a, b, k) => busy.push([a, b, k]);
  const isBusy = (s, pad) => busy.some(([a, b]) => s > a - pad && s < b + pad);
  add(-20, 40, 'start'); add(L - 25, L + 1, 'start');
  for (const j of T.jumps) add(j.s0 - 6, j.sEnd + 6, 'jump');
  for (const o of T.loops) add(o.s0 - 8, o.s1 + 8, 'loop');
  for (const c of T.sc) add(c.sa - 50, c.sb + 8, 'sc');
  for (const p of T.pads) add(p - 8, p + 10, 'pad');
  const straightish = s => { const i = idxAt(T, s); return Math.abs(T.curv[i]) < 0.03; };
  T.coins = []; T.boxes = []; T.obs = [];
  // star trails into every shortcut ("follow the stars!")
  for (const c of T.sc) for (let k = 0; k < 9; k++) { const t = k / 8; T.coins.push({ s: c.sa - 44 + t * 42, d: c.side * RW * 0.55 * smooth(t * 1.3), star: 1 }); }
  // item box rows
  const boxS = [];
  for (let s = 120; s < L - 60; s += 30) { if (isBusy(s, 6) || !straightish(s)) continue; if (boxS.length && s - boxS[boxS.length - 1] < 190) continue; boxS.push(s); }
  for (const s of boxS) { for (const d of [-4.6, -1.55, 1.55, 4.6]) T.boxes.push({ s, d }); add(s - 6, s + 6, 'box'); }
  // obstacles
  const kinds = ['cone', 'ball', 'block', 'puddle'];
  for (let s = 90; s < L - 50; s += 15) {
    if (isBusy(s, 10) || R() < 0.55) continue;
    const k = kinds[(R() * kinds.length) | 0], d = (R() * 2 - 1) * (RW - 2.2);
    T.obs.push({ s, d, k, ph: R() * TAU, amp: k === 'ball' ? 2.5 + R() * 2 : 0 }); add(s - 8, s + 8, 'ob'); s += 50;
  }
  // coin lines
  for (let s = 50; s < L - 30; s += 12) {
    if (isBusy(s, 2) || isBusy(s + 20, 2)) continue;
    const pat = (R() * 3) | 0, lane = [-4, 0, 4][(R() * 3) | 0];
    for (let k = 0; k < 6; k++) { const ss = s + k * 3.5; const d = pat === 0 ? lane : pat === 1 ? Math.sin(k / 5 * Math.PI) * 4 * (lane >= 0 ? 1 : -1) : lane * (1 - k / 5) ; T.coins.push({ s: ss, d, star: 0 }); }
    add(s, s + 21, 'coin'); s += 40 + R() * 40;
  }
  T.busy = busy;
}
