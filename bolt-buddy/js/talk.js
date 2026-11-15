'use strict';
// Talk screen: hold the giant mic, Bolt's ears glow, on-device keyword recognition (vosk-browser WASM, small English model,
// GRAMMAR mode limited to the word list below). Mic is open only while the button is held; no audio is stored anywhere.
const GRAMMAR = JSON.parse(document.getElementById('grammar').textContent);
const KW_ORDER = ['dance', 'jump', 'sing', 'name', 'colors', 'animals', 'rocket', 'sleep', 'funny', 'hi', 'alex', 'bolt'];
function grammarList() {
  const s = new Set(); for (const k in GRAMMAR) GRAMMAR[k].forEach(p => s.add(p));
  const kid = SV.kid.trim().toLowerCase(); if (kid && /^[a-z]+$/.test(kid)) s.add(kid);
  const bot = SV.bot.trim().toLowerCase(); if (bot && /^[a-z]+$/.test(bot)) s.add(bot);
  return [...s].sort().concat(['[unk]']);
}
function classify(text) {
  // every keyword phrase found in the text scores its length; the longest match wins (so "night night bounce" -> sleep),
  // names ("Alex", "Bolt") only win when nothing else was said; ties go by KW_ORDER
  const t = ' ' + text.toLowerCase().replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const kid = SV.kid.trim().toLowerCase(), bot = SV.bot.trim().toLowerCase();
  let best = null, bs = 0;
  for (const k of KW_ORDER) {
    const list = GRAMMAR[k].slice(); if (k === 'alex' && kid) list.push(kid); if (k === 'bolt' && bot) list.push(bot);
    for (const p of list) if (t.includes(' ' + p + ' ')) { const sc2 = (k === 'alex' || k === 'bolt') ? .5 : p.length; if (sc2 > bs) { bs = sc2; best = k; } }
  }
  return best;
}
const VOSK = { state: 'idle', prog: 0, model: null, err: '', t0: 0 };
const MODEL_BYTES = 41206507;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script ' + src)); document.head.appendChild(s); }); }
async function voskLoad() {
  if (VOSK.state !== 'idle') return; VOSK.state = 'loading'; VOSK.t0 = now();
  try {
    if (typeof Vosk === 'undefined') await loadScript('vosk/vosk.js');
    VOSK.prog = .05;
    const r = await fetch('vosk/model.tar.gz'); if (!r.ok) throw new Error('model HTTP ' + r.status);
    const total = +r.headers.get('content-length') || MODEL_BYTES; let blob;
    if (r.body && r.body.getReader) {
      const rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; VOSK.prog = .05 + .8 * Math.min(1, got / total); }
      blob = new Blob(parts, { type: 'application/gzip' });
    } else blob = await r.blob();
    VOSK.prog = .88;
    const url = URL.createObjectURL(blob);
    const model = await Promise.race([Vosk.createModel(url, -2), new Promise((_, rej) => setTimeout(() => rej(new Error('model init timeout')), 60000))]);
    VOSK.model = model; VOSK.state = 'ready'; VOSK.prog = 1;
    window.__voskReadyMs = Math.round(now() - VOSK.t0);
  } catch (e) { VOSK.state = 'failed'; VOSK.err = String(e && e.message || e); try { console.warn('Vosk unavailable, picture buttons only:', VOSK.err); } catch (x) {} }
}
// ---- listening session ----
const LS = { on: false, pending: false, stream: null, src: null, proc: null, rec: null, texts: [], partial: '', t0: 0, denied: false, sink: null };
function startRecognizer() {
  const rec = new VOSK.model.KaldiRecognizer(AC.sampleRate, JSON.stringify(grammarList()));
  rec.on('result', m => { const t = m && m.result && m.result.text; if (t) LS.texts.push(t); LS.gotFinal = true; });
  rec.on('partialresult', m => { const t = m && m.result && m.result.partial; if (t && t !== LS.partial) { LS.partial = t; if (TK.rig) TK.rig.ear = 1; } });
  return rec;
}
async function micDown() {
  initAudio(); lastInput = now();
  if (TK.rig.asleep) { wake(); }
  if (VOSK.state !== 'ready') {
    if (VOSK.state === 'failed') { say('b_pictures', { interrupt: true }); rigAct(TK.rig, 'shake', .8, 'curious'); }
    else { say('b_ears', { interrupt: true }); rigAct(TK.rig, 'think', 1.4, 'curious'); voskLoad(); }
    return;
  }
  if (LS.on || LS.pending) return;
  LS.pending = true; LS.texts = []; LS.partial = ''; LS.gotFinal = false; LS.t0 = now();
  stopVoice(); clearVoiceQ(); if (M) M.hold(true);
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    LS.pending = false;
    if (!pressed('mic')) { st.getTracks().forEach(t => t.stop()); if (M) M.hold(false); hintHold(); return; }
    LS.stream = st; LS.denied = false; beginCapture(st);
  } catch (e) {
    LS.pending = false; LS.denied = true; if (M) M.hold(false);
    say('b_pictures', { interrupt: true }); rigAct(TK.rig, 'shake', .8, 'curious');
  }
}
function beginCapture(stream) {
  LS.rec = startRecognizer();
  LS.src = AC.createMediaStreamSource(stream);
  LS.proc = AC.createScriptProcessor(4096, 1, 1);
  LS.proc.onaudioprocess = e => { if (!LS.on || !LS.rec) return; try { LS.rec.acceptWaveform(e.inputBuffer); } catch (x) {} let m = 0; const d = e.inputBuffer.getChannelData(0); for (let i = 0; i < d.length; i += 16) m = Math.max(m, Math.abs(d[i])); LS.level = m; };
  LS.sink = AC.createGain(); LS.sink.gain.value = 0;
  LS.src.connect(LS.proc); LS.proc.connect(LS.sink); LS.sink.connect(AC.destination);
  LS.on = true; sfx('listen'); rigFace(TK.rig, 'listen', 60000); TK.listenT = 0;
}
function endCapture() {
  LS.on = false;
  try { if (LS.src) LS.src.disconnect(); if (LS.proc) { LS.proc.disconnect(); LS.proc.onaudioprocess = null; } if (LS.sink) LS.sink.disconnect(); } catch (e) {}
  if (LS.stream) LS.stream.getTracks().forEach(t => t.stop());   // mic off the moment the button is let go
  LS.stream = null; LS.src = null; LS.proc = null; LS.sink = null;
}
function micUp() {
  if (LS.pending) return; // getUserMedia still resolving: micDown sees the release and closes it
  if (!LS.on) return;
  const held = now() - LS.t0;
  endCapture(); sfx('listenEnd'); if (M) M.hold(false);
  const rec = LS.rec; LS.rec = null;
  rigAct(TK.rig, 'think', 3, 'curious'); sfx('think');
  LS.gotFinal = false;
  try { rec.retrieveFinalResult(); } catch (e) {}
  const t0 = now();
  const done = () => {
    try { rec.remove(); } catch (e) {}
    const text = LS.texts.join(' ').trim(); LS.lastText = text; (window.__heard = window.__heard || []).push(text);
    const k = classify(text);
    if (k) respond(k, 'voice');
    else if (held < 600 && !text) hintHold();
    else respond('huh', 'voice');
  };
  const wait = () => { if (LS.gotFinal || now() - t0 > 1600) done(); else setTimeout(wait, 50); };
  wait();
}
function hintHold() { TK.rig.move = null; say('b_holdtalk', { interrupt: true }); rigAct(TK.rig, 'point', 1.6, 'happy'); }

// ---- responses: 2-3 animated reactions per keyword (face + body move + voice) ----
const RESP = {
  hi: [() => ({ clip: hiClip(), move: 'wave', dur: 1.8, face: 'joy' }), () => ({ clip: 'b_hi_2', move: 'hop', dur: .8, face: 'star' }), () => ({ clip: isAlex() ? 'b_hi_alex' : 'b_hi_3', move: 'cheer', dur: 1.6, face: 'love' })],
  dance: [() => ({ clip: 'b_dance_1', move: 'dance', dur: 3.2, face: 'star', fx: 'disco' }), () => ({ clip: 'b_dance_2', move: 'robot', dur: 3, face: 'cool', fx: 'disco' }), () => ({ clip: 'b_dance_3', move: 'spin', dur: 1.6, face: 'joy', fx: 'disco' })],
  jump: [() => ({ clip: 'b_jump_1', move: 'jump', dur: 1.1, face: 'joy', fx: 'boing' }), () => ({ clip: 'b_jump_2', move: 'jump', dur: 1.1, face: 'star', fx: 'boing' }), () => ({ clip: 'b_jump_3', move: 'rocket', dur: 2.2, face: 'star', fx: 'jet' })],
  sing: [() => ({ clip: 'b_sing_1', move: 'sing', dur: 3, face: 'sing', fx: 'notes' }), () => ({ clip: 'b_sing_2', move: 'sing', dur: 3, face: 'whistle', fx: 'notes' }), () => ({ clip: 'b_sing_3', move: 'robot', dur: 2.4, face: 'sing', fx: 'notes' })],
  name: [() => ({ clip: isBolt() ? 'b_name_bolt' : 'b_name_gen', move: 'flex', dur: 2, face: 'joy', fx: 'sparkle' }), () => ({ clip: isBolt() ? 'b_name_bolt2' : 'b_name_gen', move: 'wave', dur: 2, face: 'happy', fx: 'sparkle' })],
  colors: [() => ({ clip: 'b_color_1', move: 'colors', dur: 2.6, face: 'star', fx: 'rainbow' }), () => ({ clip: 'b_color_2', move: 'spin', dur: 2, face: 'joy', fx: 'rainbow' }), () => ({ clip: 'b_color_3', move: 'cheer', dur: 2.4, face: 'love', fx: 'rainbow' })],
  animals: [() => ({ clip: 'b_animal_1', move: 'puppy', dur: 2.4, face: 'joy', fx: 'woof' }), () => ({ clip: 'b_animal_2', move: 'roar', dur: 2, face: 'determined', fx: 'roar' }), () => ({ clip: 'b_animal_3', move: 'puppy', dur: 2.2, face: 'surprised', fx: 'moo' })],
  rocket: [() => ({ clip: 'b_rocket_1', move: 'rocket', dur: 2.4, face: 'star', fx: 'jet' }), () => ({ clip: 'b_rocket_2', move: 'rocket', dur: 2.4, face: 'determined', fx: 'jet' }), () => ({ clip: 'b_rocket_3', move: 'jump', dur: 1.1, face: 'star', fx: 'stars' })],
  sleep: [() => ({ clip: 'b_sleep_1', move: 'yawn', dur: 1.6, face: 'sleepy', fx: 'nap' }), () => ({ clip: 'b_sleep_2', move: 'yawn', dur: 1.6, face: 'sleepy', fx: 'nap' })],
  funny: [() => ({ clip: 'b_funny_1', move: 'laugh', dur: 2.4, face: 'joy', fx: 'giggle' }), () => ({ clip: 'b_funny_2', move: 'tickle', dur: 2, face: 'wink', fx: 'honk' }), () => ({ clip: 'b_funny_3', move: 'laugh', dur: 2.4, face: 'dizzy', fx: 'honk' })],
  alex: [() => (isAlex() ? { clip: pick(['b_alex_1', 'b_alex_2', 'b_alex_3']) } : { clip: 'b_friend_1' }), () => (isAlex() ? { clip: 'b_alex_2' } : { clip: 'b_friend_1' })].map(f => () => Object.assign({ move: 'cheer', dur: 2, face: 'love', fx: 'hearts' }, f())),
  bolt: [() => ({ clip: 'b_bolt_1', move: 'wave', dur: 1.6, face: 'joy' }), () => ({ clip: 'b_bolt_2', move: 'nod', dur: 1.4, face: 'happy' }), () => ({ clip: 'b_bolt_3', move: 'hop', dur: .9, face: 'star', fx: 'sparkle' })],
  huh: ['b_huh_1', 'b_huh_2', 'b_huh_3', 'b_huh_4', 'b_huh_5'].map(c => () => ({ clip: c, move: 'shake', dur: 1.2, face: pick(['curious', 'surprised', 'dizzy']), fx: 'q' })),
};
const RESP_ROT = {}; for (const k in RESP) RESP_ROT[k] = rotor(RESP[k]);
const TK = { rig: BotRig(), listenT: 0, fxMode: null, fxT: 0, hue: 0, seen: false, lastKey: null, bolt: { x: 0, y: 0, s: 1 } };
function respond(k, src) {
  lastInput = now(); const R = TK.rig;
  if (R.asleep) wake(true);
  const r = RESP_ROT[k]()(); TK.lastKey = k; (window.__resp = window.__resp || []).push(k + ':' + r.clip);
  say(r.clip, { interrupt: true, who: 'b' });
  rigAct(R, r.move, r.dur, r.face, r.fx === 'nap' ? () => napFor(4.5) : null);
  TK.fxMode = r.fx || null; TK.fxT = 0;
  const b = TK.bolt, hx = b.x, hy = b.y - 330 * b.s;
  switch (r.fx) {
    case 'boing': sfx('boing'); break;
    case 'jet': sfx('whoosh'); break;
    case 'notes': for (let i = 0; i < 4; i++) setTimeout(() => sfx('note'), i * 280); break;
    case 'sparkle': sfx('sparkle'); burst(hx, hy, 18, { k: 'star', g: 200 }); break;
    case 'rainbow': sfx('rainbow'); break;
    case 'woof': setTimeout(() => sfx('woof'), 900); setTimeout(() => sfx('woof'), 1150); break;
    case 'roar': setTimeout(() => shake(8), 500); break;
    case 'honk': setTimeout(() => sfx('honk'), 600); break;
    case 'giggle': sfx('chirp'); break;
    case 'hearts': sfx('sparkle'); for (let i = 0; i < 12; i++) fx({ k: 'heart', x: hx + rnd(-120, 120), y: hy + rnd(-20, 60), vy: rnd(-160, -60), vx: rnd(-40, 40), life: rnd(1.2, 2), s: rnd(14, 26), c: pick(['#ff5a8a', '#ff7ac6', '#ff3b6b']) }); break;
    case 'stars': sfx('star'); burst(hx, hy, 24, { k: 'star' }); break;
    case 'q': sfx('chirp'); break;
    case 'disco': sfx('yay'); break;
  }
}
function napFor(s) { const R = TK.rig; R.asleep = true; rigAct(R, 'sleep', 999, 'asleep'); R.asleep = true; TK.napUntil = now() + s * 1000; }
function wake(silent) {
  const R = TK.rig; R.asleep = false; R.move = null; TK.napUntil = 0; HUB.rig.asleep = false; HUB.rig.move = null;
  if (M) M.hold(false);
  if (!silent) { sfx('chirp'); say(isAlex() ? 'b_awake_alex' : 'b_awake', { interrupt: true }); }
  rigAct(R, 'jump', 1.1, 'surprised'); rigAct(HUB.rig, 'jump', 1.1, 'surprised');
}
// ---- picture buttons (work with no mic at all) ----
const PICS = [
  { id: 'p_music', key: 'dance', col: '#ffc61a', icon: 'music' }, { id: 'p_rocket', key: 'rocket', col: '#dfe9ff', icon: 'rocket' },
  { id: 'p_moon', key: 'sleep', col: '#3b6dff', icon: 'moon' }, { id: 'p_star', key: 'funny', col: '#ffc61a', icon: 'star' },
  { id: 'p_paw', key: 'animals', col: '#ff9a3d', icon: 'paw' }, { id: 'p_rainbow', key: 'colors', col: '#ffffff', icon: 'rainbow' },
];
function drawIcon(k, x, y, s) {
  cx.save(); cx.translate(x, y); cx.scale(s, s);
  if (k === 'music') { cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(120,70,0,.5)'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(-14, 14, 11, 8, -.4, 0, TAU); cx.fill(); cx.stroke(); cx.beginPath(); cx.ellipse(16, 8, 11, 8, -.4, 0, TAU); cx.fill(); cx.stroke(); cx.fillRect(-5, -22, 6, 36); cx.fillRect(25, -28, 6, 36); cx.beginPath(); cx.moveTo(-5, -22); cx.lineTo(31, -28); cx.lineTo(31, -18); cx.lineTo(-5, -12); cx.fill(); }
  else if (k === 'rocket') drawRocketIcon();
  else if (k === 'moon') { cx.fillStyle = '#fff6c2'; cx.beginPath(); cx.arc(0, 0, 26, 0, TAU); cx.fill(); cx.globalCompositeOperation = 'destination-out'; cx.beginPath(); cx.arc(12, -8, 22, 0, TAU); cx.fill(); cx.globalCompositeOperation = 'source-over'; star5(14, 6, 10, '#ffd23f'); }
  else if (k === 'star') { star5(0, 2, 30, '#fff8d0'); star5(0, 2, 22, '#ffd23f'); }
  else if (k === 'paw') { cx.fillStyle = '#7a3c0d'; cx.beginPath(); cx.ellipse(0, 10, 16, 13, 0, 0, TAU); cx.fill(); for (const [px, py] of [[-18, -8], [-7, -20], [7, -20], [18, -8]]) { cx.beginPath(); cx.ellipse(px, py, 6.5, 8, 0, 0, TAU); cx.fill(); } }
  else if (k === 'rainbow') { const C = ['#ff4b55', '#ff9a3d', '#ffd23f', '#5fd45a', '#3bc4ff', '#a46bff']; cx.lineWidth = 5.5; C.forEach((c, i) => { cx.strokeStyle = c; cx.beginPath(); cx.arc(0, 14, 32 - i * 5.5, PI, TAU); cx.stroke(); }); cx.fillStyle = '#fff'; for (const sx of [-26, 26]) { cx.beginPath(); cx.arc(sx, 14, 9, 0, TAU); cx.arc(sx + (sx < 0 ? 8 : -8), 10, 8, 0, TAU); cx.fill(); } }
  else if (k === 'mic') { cx.fillStyle = '#fff'; rr(-17, -48, 34, 64, 17); cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = 8; cx.lineCap = 'round'; cx.beginPath(); cx.arc(0, -2, 30, .15, PI - .15); cx.stroke(); capsule(0, 28, 0, 44, 8); capsule(-18, 46, 18, 46, 8); cx.fillStyle = 'rgba(220,60,60,.35)'; for (let i = 0; i < 3; i++) rr(-10, -36 + i * 11, 20, 4, 2), cx.fill(); }
  else if (k === 'home') { cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(-22, 0); cx.lineTo(0, -21); cx.lineTo(22, 0); cx.lineTo(15, 0); cx.lineTo(15, 19); cx.lineTo(-15, 19); cx.lineTo(-15, 0); cx.closePath(); cx.fill(); }
  else if (k === 'back') { cx.strokeStyle = '#fff'; cx.lineWidth = 9; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.beginPath(); cx.moveTo(8, -18); cx.lineTo(-12, 0); cx.lineTo(8, 18); cx.stroke(); }
  else if (k === 'lock') { cx.strokeStyle = '#fff'; cx.lineWidth = 6; cx.beginPath(); cx.arc(0, -6, 10, PI, 0); cx.stroke(); cx.fillStyle = '#fff'; rr(-15, -6, 30, 24, 5); cx.fill(); }
  else if (k === 'brush') { cx.rotate(-.6); cx.fillStyle = '#c98a45'; rr(-5, -6, 10, 40, 4); cx.fill(); cx.fillStyle = '#ccc'; rr(-7, -14, 14, 10, 2); cx.fill(); cx.fillStyle = '#ff5a8a'; cx.beginPath(); cx.moveTo(-7, -14); cx.quadraticCurveTo(0, -46, 7, -14); cx.fill(); }
  cx.restore();
}
function drawRocketIcon() {
  cx.save(); cx.rotate(.6);
  cx.fillStyle = '#e8202a'; cx.beginPath(); cx.moveTo(-10, 14); cx.lineTo(-22, 30); cx.lineTo(-8, 26); cx.fill(); cx.beginPath(); cx.moveTo(10, 14); cx.lineTo(22, 30); cx.lineTo(8, 26); cx.fill();
  const g = cx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#c9d3ea'); g.addColorStop(.5, '#fff'); g.addColorStop(1, '#aab5d4');
  cx.fillStyle = g; cx.beginPath(); cx.moveTo(0, -36); cx.quadraticCurveTo(18, -14, 12, 24); cx.lineTo(-12, 24); cx.quadraticCurveTo(-18, -14, 0, -36); cx.fill();
  cx.fillStyle = '#e8202a'; cx.beginPath(); cx.moveTo(0, -36); cx.quadraticCurveTo(10, -26, 12, -18); cx.lineTo(-12, -18); cx.quadraticCurveTo(-10, -26, 0, -36); cx.fill();
  circ(0, -2, 7, '#2f8ee8'); circ(-2, -4, 2.5, '#bfe6ff');
  cx.fillStyle = '#ffb21f'; cx.beginPath(); cx.moveTo(-7, 25); cx.lineTo(0, 40); cx.lineTo(7, 25); cx.fill();
  cx.restore();
}
function enterTalk() {
  TK.rig = BotRig(); rigAct(TK.rig, 'wave', 1.8, 'joy');
  music('space'); voskLoad();
  if (!TK.seen) { TK.seen = true; setTimeout(() => { if (scr === 'talk') say(VOSK.state === 'ready' || VOSK.state === 'loading' ? 'b_holdtalk' : 'b_pictures'); }, 500); }
  else say(hiClip());
}
function updateTalk(dt) {
  const R = TK.rig;
  if (LS.on) { TK.listenT += dt; R.ear = 1; }
  TK.fxT += dt;
  if (TK.napUntil && now() > TK.napUntil) { TK.napUntil = 0; R.asleep = false; R.move = null; rigAct(R, 'yawn', 1.4, 'sleepy', () => rigAct(R, 'hop', .8, 'joy')); }
  if (R.asleep && Math.random() < dt * 1.2) fx({ k: 'z', x: TK.bolt.x + 90 * TK.bolt.s, y: TK.bolt.y - 380 * TK.bolt.s, vx: 30, vy: -50, life: 2, s: 12, c: '#bff' });
  if (TK.fxMode === 'notes' && TK.fxT < 3 && Math.random() < dt * 6) fx({ k: 'note', x: TK.bolt.x + rnd(-120, 120), y: TK.bolt.y - 300 * TK.bolt.s, vy: -90, vx: rnd(-30, 30), life: 1.6, s: 10, c: pick(['#ffd23f', '#7ff', '#ff7ac6']), ch: pick(['♪', '♫']) });
  if (TK.fxMode === 'jet' && TK.fxT < 2.2 && Math.random() < dt * 30) fx({ k: 'dot', x: TK.bolt.x + rnd(-40, 40), y: TK.bolt.y + 20 - (R.move === 'rocket' ? 0 : 0), vy: rnd(40, 120), vx: rnd(-60, 60), life: .8, s: rnd(14, 26), c: 'rgba(255,255,255,.6)' });
  if (TK.fxMode === 'disco' && TK.fxT < 3.2 && Math.random() < dt * 8) burst(TK.bolt.x + rnd(-200, 200), rnd(60, 200), 3, { k: 'star', g: 100, sp0: 40, sp1: 120 });
  idleSleepCheck(R);
}
function drawTalk(dt) {
  if (!cover(IMG.bg_talk, 0, 0, VW, VH, .5, .6)) { cx.fillStyle = '#5a3a6a'; cx.fillRect(0, 0, VW, VH); }
  const R = TK.rig, T = now() / 1000;
  // disco light wash
  if (TK.fxMode === 'disco' && TK.fxT < 3.2) { cx.save(); cx.globalAlpha = .18 * Math.sin(Math.min(1, TK.fxT) * PI / 2); rays(VW * .48, -40, 12, 900, 70, ['#ff7ac6', '#7ff', '#ffd23f'][Math.floor(TK.fxT * 4) % 3], TK.fxT * .8); cx.restore(); }
  if (LS.on) { cx.fillStyle = 'rgba(10,0,40,.25)'; cx.fillRect(0, 0, VW, VH); }
  const bs = 1.0 + (level() * .04), bx = VW * .47, by = 572;
  TK.bolt = { x: bx, y: by, s: bs };
  const p = rigPose(R, dt);
  let colIdx = SV.color, pal = null;
  if (TK.fxMode === 'rainbow' && TK.fxT < 2.6) pal = COLORS[Math.floor(TK.fxT * 5) % 6];
  // listening rings from the ears
  if (LS.on || R.ear > 0) {
    const a = LS.on ? 1 : R.ear;
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
      const k = ((T * 1.6) + i / 3) % 1, ex = bx + sd * 104 * bs, ey = by - 290 * bs + (p.bob || 0) * bs;
      cx.strokeStyle = 'rgba(110,255,250,' + (a * (1 - k)) + ')'; cx.lineWidth = 7; cx.beginPath(); cx.arc(ex, ey, 40 + k * 90 + (LS.level || 0) * 60, sd < 0 ? PI - .7 : -.7, sd < 0 ? PI + .7 : .7); cx.stroke();
    }
  }
  drawBolt({ x: bx, y: by, s: bs, color: colIdx, pal, hat: SV.hat, face: p.face, pose: p, ear: Math.max(R.ear, LS.on ? .7 + .3 * Math.sin(T * 10) : 0), cape: level() >= 2, core: SV.bolts / CORE_CAP });
  drawFx();
  // back to hub
  backBtn(() => go('hub'));
  // picture buttons
  PICS.forEach((pc, i) => {
    const col = i % 2, row = (i / 2) | 0, x = 78 + col * 118, y = 168 + row * 140 + col * 50, prs = pressed(pc.id);
    const r = 54 * (prs ? .92 : 1) * (1 + (TK.lastKey === pc.key && TK.fxT < .3 ? .12 * Math.sin(TK.fxT / .3 * PI) : 0));
    glossBall(x, y, r, pc.col); drawIcon(pc.icon, x, y, r / 46);
    BTN.push({ id: pc.id, x, y, r: 58, cb: () => { sfx('pop'); burst(x, y, 10, { g: 300, sp1: 260 }); respond(pc.key, 'pic'); } });
  });
  // giant mic button
  const mx = VW - 210, my = 330, mr = 120;
  const held = pressed('mic') || LS.on;
  for (let i = 0; i < 3; i++) { const k = ((T * (LS.on ? 1.4 : .5)) + i / 3) % 1; cx.strokeStyle = 'rgba(255,170,150,' + ((LS.on ? .7 : .35) * (1 - k)) + ')'; cx.lineWidth = 6; cx.beginPath(); cx.arc(mx, my, mr + 10 + k * 70, 0, TAU); cx.stroke(); }
  glow(mx, my, mr * 1.7, 'rgba(255,90,70,1)', LS.on ? .7 : .35);
  const ms = held ? .9 : 1 + Math.sin(T * 3) * .02;
  glossBall(mx, my, mr * ms, VOSK.state === 'failed' || LS.denied ? '#b0657a' : '#ff4436', { rim: 'rgba(255,230,220,.9)' });
  drawIcon('mic', mx, my + 4, ms * 1.45);
  if (VOSK.state === 'loading' || VOSK.state === 'idle') { // friendly loading ring: his ears are warming up
    cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.lineWidth = 12; cx.beginPath(); cx.arc(mx, my, mr + 18, 0, TAU); cx.stroke();
    cx.strokeStyle = '#7ffff7'; cx.lineCap = 'round'; cx.beginPath(); cx.arc(mx, my, mr + 18, -PI / 2, -PI / 2 + TAU * Math.max(.04, VOSK.prog)); cx.stroke();
    for (let i = 0; i < 3; i++) circ(mx - 24 + i * 24, my + mr + 52, 7 + 3 * Math.sin(T * 6 - i), '#7ffff7');
  }
  BTN.push({ id: 'mic', x: mx, y: my, r: mr + 10, cb: () => {}, down: () => micDown(), up: () => micUp() });
  drawBubble(bx + 150, by - 470 * bs);
}
function idleSleepCheck(R) {
  if (!R.asleep && !LS.on && !voiceBusy() && !R.move && now() - lastInput > 60000) {
    R.asleep = true; rigAct(R, 'sleep', 999, 'asleep'); R.asleep = true; say('b_sleepy'); if (M) M.hold(true); TK.napUntil = 0; R.sleepSnore = now();
  }
  if (R.asleep && now() - (R.sleepSnore || 0) > 3200) { R.sleepSnore = now(); sfx('snore'); }
}
function drawBubble(x, y, center) {
  if (!bubble || now() > bubble.until) return;
  const k = clamp((now() - bubble.t0) / 220, 0, 1), sc2 = easeBack(k);
  const isN = bubble.who === 'n';
  let text = bubble.text; if (!isAlex()) text = text.replace(/Alex/g, SV.kid || 'friend');
  cx.save(); cx.font = '900 26px ' + FONT; const w = Math.min(460, cx.measureText(text).width + 50);
  if (isN) { x = VW / 2 - w / 2; y = 80; } else if (center) x = x - w / 2;
  x = clamp(x, 10, VW - w - 10);
  cx.translate(x + w / 2, y + 30); cx.scale(sc2, sc2); cx.translate(-w / 2, -30);
  cx.fillStyle = 'rgba(0,0,0,.25)'; rr(4, 6, w, 60, 26); cx.fill();
  cx.fillStyle = isN ? '#ffd23f' : bubble.who === 'j' ? '#ffd9f0' : '#fff'; rr(0, 0, w, 60, 26); cx.fill();
  if (!isN) { cx.beginPath(); cx.moveTo(30, 52); cx.lineTo(10, 84); cx.lineTo(60, 56); cx.fill(); }
  txt(text, w / 2, 31, 26, '#2a2060', { stroke: false });
  cx.restore();
}
function backBtn(cb) {
  const x = 56, y = 52, prs = pressed('back');
  glossBall(x, y, 38 * (prs ? .9 : 1), '#7a5cff'); drawIcon('back', x - 2, y, 1.05);
  BTN.push({ id: 'back', x, y, r: 42, cb: () => { sfx('click'); cb(); } });
}
