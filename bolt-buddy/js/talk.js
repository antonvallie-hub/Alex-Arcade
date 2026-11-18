'use strict';
// Bolt Buddy v2 talk screen: hands-free conversation with Bolt.
//   Tap Bolt (or the big talk button) once -> the mic stays open; turn.js finds when Alex starts/stops talking; vosk-browser
//   (small English model, GRAMMAR mode over brain.js's word list) runs on this tablet; brain.js picks the intent; Bolt answers
//   with a pre-rendered clip + a move. The mic is ignored while Bolt makes any sound, sleeps after ~20 s of quiet (mic off),
//   and "hold to talk" (v1 behaviour) is still available in the parent corner. Nothing is recorded, stored or sent anywhere.
const WARP = .85;   // vocal-tract warp: vosk is told the sample rate is 0.85x the real one, which slides a child's higher
                    // pitch/formants down toward the adult voices it was trained on (+16% intent matches on synthetic toddler audio)
const GUARD = new Set(['bye', 'sleep']);         // these switch the mic off, so they need a confident final result
const TK = { rig: BotRig(), listenT: 0, fxMode: null, fxT: 0, seen: false, lastKey: null, bolt: { x: 0, y: 0, s: 1 }, conv: false, turn: null, lat: [], heard: [], tint: null, choiceT: 0, hum: 0, pend: [] };
const LS = { on: false, lastText: '' };          // v1 compat (screens.js)
// ---------------- speech engine (vosk) ----------------
const VOSK = { state: 'idle', prog: 0, model: null, err: '', t0: 0, rec: null, recSig: '' };
const MODEL_BYTES = 41204980;
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
    recEnsure(); recWarm();
  } catch (e) { VOSK.state = 'failed'; VOSK.err = String(e && e.message || e); try { console.warn('Vosk unavailable, picture buttons only:', VOSK.err); } catch (x) {} }
}
// one long-lived recognizer (re-created only if the names change); after each final result vosk resets it for the next turn
function recEnsure() {
  if (VOSK.state !== 'ready' || !AC) return null;
  const sig = SV.kid + '|' + SV.bot;
  if (VOSK.rec && VOSK.recSig === sig) return VOSK.rec;
  if (VOSK.rec) try { VOSK.rec.remove(); } catch (e) {}
  const rec = new VOSK.model.KaldiRecognizer(Math.round(AC.sampleRate * WARP), JSON.stringify(BRAIN.grammarPhrases(SV.kid.trim().toLowerCase(), SV.bot.trim().toLowerCase())));
  try { rec.setWords(true); } catch (e) {}
  rec.on('partialresult', m => onPartial(m && m.result && m.result.partial || ''));
  rec.on('result', m => onResult(m && m.result || {}));
  VOSK.rec = rec; VOSK.recSig = sig; return rec;
}
// warm-up: run half a second of near-silence through the decoder at load so Alex's first word isn't the slow one
function recWarm() { workletReady(); const rec = recEnsure(); if (!rec) return; TK.warming = true; const n = Math.round(AC.sampleRate * .5), b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = (Math.random() - .5) * 1e-4; try { rec.acceptWaveformFloat(b, Math.round(AC.sampleRate * WARP)); rec.retrieveFinalResult(); } catch (e) {} setTimeout(() => { TK.warming = false; }, 400); }
function feed(buf) { const rec = VOSK.rec; if (!rec) return; try { rec.acceptWaveformFloat(buf, Math.round(AC.sampleRate * WARP)); } catch (e) {} }
// ---------------- microphone + turn engine ----------------
const MIC = { stream: null, src: null, proc: null, sink: null, on: false, opening: false, feeding: false, pre: [], level: 0, denied: false, sim: null, hold: false };
const ENG = TurnEngine({}, (n, d) => engEvent(n, d));
function engCfg() { const w = { short: [420, 340], normal: [600, 450], long: [800, 600] }[SV.talkWait || 'normal'] || [600, 450]; ENG.o.hang = w[0]; ENG.o.fastHang = w[1]; }
async function micOpen() {
  if (MIC.on || MIC.opening) return MIC.on;
  initAudio(); MIC.opening = true;
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    MIC.opening = false; MIC.stream = st; MIC.denied = false;
    micAttach(AC.createMediaStreamSource(st)); return true;
  } catch (e) { MIC.opening = false; MIC.denied = true; return false; }
}
// capture: an AudioWorklet on the audio thread packs 1024-sample frames (~21 ms) and posts them, so a busy frame on the main
// thread delays audio but never drops it; ScriptProcessor is the fallback for browsers without worklets
const WORKLET_SRC = `class BoltCap extends AudioWorkletProcessor { constructor() { super(); this.b = new Float32Array(1024); this.n = 0; }
  process(inp) { const c = inp[0] && inp[0][0]; if (c) { for (let i = 0; i < c.length; i++) { this.b[this.n++] = c[i]; if (this.n === 1024) { this.port.postMessage(this.b, [this.b.buffer]); this.b = new Float32Array(1024); this.n = 0; } } } return true; } }
registerProcessor('bolt-cap', BoltCap);`;
let workletP = null;
function workletReady() { if (!workletP) workletP = (AC.audioWorklet ? AC.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }))).then(() => true) : Promise.resolve(false)).catch(() => false); return workletP; }
function micAttach(srcNode) {
  MIC.src = srcNode; MIC.sink = AC.createGain(); MIC.sink.gain.value = 0; MIC.sink.connect(AC.destination);
  MIC.on = true; MIC.pre = []; LS.on = true; engCfg(); ENG.wake(now());
  const sp = () => { MIC.proc = AC.createScriptProcessor(1024, 1, 1); MIC.proc.onaudioprocess = e => onFrame(e.inputBuffer.getChannelData(0)); srcNode.connect(MIC.proc); MIC.proc.connect(MIC.sink); MIC.kind = 'scriptprocessor'; };
  workletReady().then(ok => {
    if (!MIC.on || MIC.src !== srcNode) return;
    if (!ok) { sp(); return; }
    try { MIC.proc = new AudioWorkletNode(AC, 'bolt-cap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' }); MIC.proc.port.onmessage = e => onFrame(e.data); srcNode.connect(MIC.proc); MIC.proc.connect(MIC.sink); MIC.kind = 'worklet'; }
    catch (e) { sp(); }
  });
}
function micClose() {
  MIC.on = false; MIC.feeding = false; LS.on = false;
  try { if (MIC.src) MIC.src.disconnect(); if (MIC.proc) { MIC.proc.disconnect(); MIC.proc.onaudioprocess = null; if (MIC.proc.port) MIC.proc.port.onmessage = null; } if (MIC.sink) MIC.sink.disconnect(); } catch (e) {}
  if (MIC.stream) MIC.stream.getTracks().forEach(t => t.stop());   // the tablet's mic light goes off
  if (MIC.sim) { try { MIC.sim.stop(); } catch (e) {} MIC.sim = null; }
  MIC.stream = null; MIC.src = null; MIC.proc = null; MIC.sink = null; MIC.pre = [];
  if (TK.leak) { try { voxG.disconnect(TK.leak); } catch (e) {} TK.leak = null; }
  if (TK.mleak) { try { musDuckG.disconnect(TK.mleak); } catch (e) {} TK.mleak = null; }
}
const endCapture = micClose;
function onFrame(d) {
  if (!MIC.on) return; let s = 0, pk = 0;
  for (let i = 0; i < d.length; i++) { const v = d[i]; s += v * v; if (v > pk) pk = v; else if (-v > pk) pk = -v; }
  const rms = Math.sqrt(s / d.length); MIC.level = Math.max(pk, MIC.level * .85);
  const buf = MIC.kind === 'worklet' ? d : new Float32Array(d), t = now();
  if (MIC.hold) { if (MIC.feeding) feed(buf); return; }
  ENG.frame(t, rms, botBusy() || TK.warming);
  if (MIC.feeding) feed(buf); else { MIC.pre.push(buf); while (MIC.pre.length > 18) MIC.pre.shift(); }   // ~380 ms pre-roll
}
function engEvent(n, d) {
  const R = TK.rig;
  if (n === 'onset') {
    TK.turn = { onset: d.t, onsetPerf: now(), react: 0, partial: '', pIntent: null, texts: [], words: [], end: 0, lastVoice: 0, answered: false };
    MIC.feeding = true; for (const b of MIC.pre) feed(b); MIC.pre = [];
    R.ear = 1; TK.wantReact = TK.turn;            // the next drawn frame shows him listening (measured)
    if (R.idle) { R.move = null; R.idle = false; }
  } else if (n === 'endpoint') {
    const T = TK.turn; if (!T) { ENG.answered(now()); return; }
    MIC.feeding = false; T.end = d.t; T.lastVoice = d.lastVoice; T.hang = d.hang;
    try { VOSK.rec && VOSK.rec.retrieveFinalResult(); } catch (e) {}
    // the final result usually lands within ~100 ms and is better than the last partial (partials can lag the audio);
    // wait briefly for it, then fall back to the partial, then to a warm reply - Alex never gets silence
    T.waitFinal = true; rigFace(R, 'curious', 900);
    setTimeout(() => { if (TK.turn !== T || T.answered) return; const pc = T.partial ? classifyNow(T.partial) : null; if (pc && pc.intent && !GUARD.has(pc.intent)) answer(pc, 'partial'); }, 140);
    setTimeout(() => { if (TK.turn === T && !T.answered) answer(classifyNow(T.texts.join(' ') || T.partial), 'timeout'); }, 320);
  } else if (n === 'cancel') { if (TK.turn && !TK.turn.answered) TK.turn = null; MIC.feeding = false; try { VOSK.rec && VOSK.rec.retrieveFinalResult(); } catch (e) {} TK.discard = true; }
  else if (n === 'prompt') { if (!R.asleep && !TK.choice && scr === 'talk') { if (Math.random() < .7) askQuestion(); else { say(isAlex() ? pick(['ip_alex', 'ip_1', 'ip_2']) : pick(['ip_1', 'ip_2']), { interrupt: true }); rigAct(R, 'smallWave', 1.3, 'curious'); } } }
  else if (n === 'sleep') { if (scr === 'talk') goSleep(); }
}
function onPartial(text) {
  const T = TK.turn; if (!T || T.answered || !MIC.feeding) return;
  text = text.replace(/\[unk\]/g, '').trim(); if (!text) return;
  T.partial = text; const c = classifyNow(text); T.pIntent = c.intent;
  ENG.partial(now(), text, c.intent && !GUARD.has(c.intent) ? c.intent + (c.slot || '') : null);
  if (c.intent) { rigFace(TK.rig, 'curious', 600); const pre = { color: 'c_', animal: 'a_', food: 'fo_', thing: 'th_', game: 'go_' }[c.intent]; if (pre && c.slot && CLIPS[pre + c.slot]) vGet(pre + c.slot).catch(() => {}); }   // he perks up as soon as he catches a word; start decoding the likely answer
}
function onResult(res) {
  if (TK.discard) { TK.discard = false; return; }   // result of a cancelled (click/bump) turn
  const T = TK.turn; if (!T) return;
  const txt = (res.text || '').replace(/\[unk\]/g, '').trim();
  if (txt) T.texts.push(txt); if (res.result) T.words.push(...res.result);
  T.finalT = now(); if (T.end) T.finalMs = Math.round(T.finalT - T.end);
  if (T.waitFinal && !T.answered && (T.end || MIC.hold)) answer(classifyNow(T.texts.join(' ')), 'final');
  else if (T.answered && T.log) { T.log.final = T.texts.join(' '); T.log.finalMs = Math.round(T.finalT - T.end); dbgDirty = true; }
}
function confOf(T) { const w = T.words.filter(x => x.word !== '[unk]'); return w.length ? w.reduce((a, x) => a + x.conf, 0) / w.length : (T.texts.length ? .5 : 0); }
function classifyNow(text) { return BRAIN.classify(text || '', { kid: SV.kid, bot: SV.bot, expect: TK.choice ? { choices: TK.choice.ch.map(c => ({ intent: c[0], slot: c[1] })), yn: TK.choice.yn } : null }); }
function answer(c, how) {
  const T = TK.turn; if (!T || T.answered) return; T.answered = true;
  const conf = how === 'partial' ? null : confOf(T);
  if (GUARD.has(c.intent) && (conf === null || conf < .85 || c.tier !== 'exact')) c = Object.assign({}, c, { intent: null, slot: null, guarded: true });
  const heard = T.texts.join(' ') || T.partial;
  const tAns = now(); const log = T.log = { epLag: Math.round(T.end - T.lastVoice), ansLag: Math.round(tAns - T.end), finalMs: T.finalMs, reactPerf: T.reactPerf, lastVoicePerf: T.lastVoice, onsetPerf: T.onsetPerf, heard, partial: T.partial, intent: c.intent ? c.intent + (c.slot ? ':' + c.slot : '') : '(none -> warm reply)', conf: conf == null ? '-' : conf.toFixed(2), how, react: T.react ? Math.round(T.react) : null, hang: T.hang, t: Date.now() };
  TK.heard.push(heard); window.__heard = TK.heard;
  const r = reply(c, how);
  log.clip = r && r.clip;
  ENG.answered(now());
  playReply(r, (startPerf) => { log.playLag = Math.round(startPerf - tAns); log.voicePerf = startPerf; log.endToVoice = Math.round(startPerf - T.lastVoice); log.endToVoiceMs = log.endToVoice; TK.lat.push(log); while (TK.lat.length > 40) TK.lat.shift(); window.__lat = TK.lat; dbgDirty = true; });
  if (MIC.hold) { TK.turn = null; }
}
// ---------------- what Bolt says and does ----------------
// pools: id list (alex-only ids end _alex / start af_alex|k_alex, bolt-name lines listed in BOLT_ONLY)
const BOLT_ONLY = new Set(['b_name_bolt', 'b_name_bolt2', 'nq_3']);
const ALEX_ONLY = id => /alex/.test(id) && id !== 'b_friend_1';
const POOLS = {
  greet: ['b_hi_1', 'b_hi_2', 'b_hi_3', 'g_hi_4', 'g_hi_5', 'g_hi_6', 'b_hi_alex', 'g_hi_alex2', 'g_hi_alex2'],
  name_q: ['b_name_bolt', 'b_name_bolt2', 'nq_3', 'b_name_gen', 'nq_gen2'],
  kid: ['b_alex_1', 'b_alex_2', 'b_alex_3', 'k_alex_4', 'k_alex_5', 'b_friend_1', 'k_gen_2'],
  bolt: ['b_bolt_1', 'b_bolt_2', 'b_bolt_3', 'bo_4'],
  play: ['p_1', 'p_2', 'p_3', 'p_alex'],
  affection: ['af_1', 'af_2', 'af_3', 'af_4', 'af_5', 'af_6', 'af_7', 'af_8', 'af_alex1', 'af_alex2', 'af_alex3', 'af_alex1'],
  dance: ['b_dance_1', 'b_dance_2', 'b_dance_3', 'd_4', 'd_5', 'd_6'], sing: ['b_sing_1', 'b_sing_2', 'b_sing_3', 'si_4', 'si_5'],
  jump: ['b_jump_1', 'b_jump_2', 'b_jump_3', 'j_4', 'j_5'], rocket: ['b_rocket_1', 'b_rocket_2', 'b_rocket_3', 'r_4', 'r_5'],
  funny: ['b_funny_1', 'b_funny_2', 'b_funny_3', 'f_4', 'f_5', 'f_6', 'f_7'],
  happy: ['ha_1', 'ha_2', 'ha_3'], sad: ['sa_1', 'sa_2', 'sa_3'], mad: ['ma_1', 'ma_2', 'ma_3'], scared: ['sc_1', 'sc_2', 'sc_3'],
  hungry: ['hu_1', 'hu_2', 'hu_3', 'b_yum'], numbers: ['nu_1', 'nu_2'], colors: ['b_color_1', 'b_color_2', 'b_color_3'], animals: ['b_animal_1', 'b_animal_2', 'b_animal_3'],
  yes: ['y_1', 'y_2', 'y_3', 'y_4'], no: ['no_1', 'no_2', 'no_3', 'no_4'], bye: ['by_1', 'by_2', 'by_3'], sleep: ['b_sleep_1', 'b_sleep_2', 's_3'],
  what: ['w_1', 'w_2', 'w_3', 'w_4'], praise: ['pr_1', 'pr_2', 'pr_3', 'pr_4'], thanks: ['t_1', 't_2', 't_3'], sorry: ['so_1', 'so_2', 'so_3'], help: ['h_1', 'h_2'],
  fallback: ['fb_1', 'fb_2', 'fb_3', 'fb_4', 'fb_5', 'fb_6', 'fb_7', 'fb_8', 'fb_9', 'fb_10'],
  tickle: ['b_tickle', 'b_boop', 'tk_3', 'tk_4', 'tk_5'], start: ['l_start_1', 'l_start_2', 'l_start_3', 'l_start_alex'], wake: ['b_awake', 'b_awake_alex', 'wk_1', 'wk_2'],
};
const DLG = { last: {}, next: {}, lastClip: '', mem: { color: null, animal: null, food: null }, turns: 0, sinceQ: 9, said: [] };
function okClip(id) { if (!CLIPS[id]) return false; if (ALEX_ONLY(id) && !isAlex()) return false; if (BOLT_ONLY.has(id) && !isBolt()) return false; return true; }
function choose(key) {
  const L = POOLS[key].filter(okClip); if (!L.length) return null;
  let c = DLG.next[key];
  if (!c || !L.includes(c) || c === DLG.last[key] || c === DLG.lastClip) { const C = L.filter(x => x !== DLG.last[key] && x !== DLG.lastClip); c = pick(C.length ? C : L); }
  DLG.last[key] = c;
  const C2 = L.filter(x => x !== c); DLG.next[key] = C2.length ? pick(C2) : c; vGet(DLG.next[key]).catch(() => {});  // pre-decode the next line
  return c;
}
function primePools() { for (const k in POOLS) { const L = POOLS[k].filter(okClip); if (L.length) { DLG.next[k] = pick(L); vGet(DLG.next[k]).catch(() => {}); } } }
const ANIM_MOVE = { dog: 'puppy', cat: 'tickle', dinosaur: 'roar', lion: 'roar', tiger: 'roar', bear: 'stomp', cow: 'puppy', pig: 'laugh', duck: 'flap', horse: 'bunny', monkey: 'dance', elephant: 'stomp', shark: 'chomp', bunny: 'bunny', bird: 'flap', fish: 'sway', frog: 'hop', snake: 'sway', unicorn: 'spinHappy', dragon: 'roar', owl: 'flap', bee: 'flap' };
const THING_MOVE = { truck: 'stomp', car: 'dance', train: 'robot', ball: 'hop', bubbles: 'spinHappy', boat: 'sway', airplane: 'hover', bus: 'robot', tractor: 'stomp', book: 'nod', blocks: 'flex', mommy: 'hug', daddy: 'hug', baby: 'hug', bath: 'laugh', outside: 'dance', slide: 'spinHappy', sun: 'stretch', star: 'hover', spidey: 'backflip', superhero: 'flex', brother: 'cheer', sister: 'cheer', toy: 'hop', snow: 'brave', rain: 'sway', potty: 'cheer' };
const COLOR_PAL = { red: 1, blue: 0, green: 2, purple: 3, orange: 4, pink: 5,
  yellow: { name: 'Yellow', base: '#ffd23f', light: '#fff4c2', dark: '#c49a06' }, black: { name: 'Black', base: '#3a3f5c', light: '#9aa3c9', dark: '#141728' },
  white: { name: 'White', base: '#e9eefc', light: '#ffffff', dark: '#9aa4c4' }, gold: { name: 'Gold', base: '#ffc61a', light: '#fff3a0', dark: '#a87400' }, rainbow: 'rainbow' };
const R_ = (clip, move, dur, face, fx, then) => ({ clip, move, dur, face, fx, then });
function reply(c, how) {
  const R = TK.rig, k = c.intent; DLG.turns++; DLG.sinceQ++;
  const ch = TK.choice; TK.choice = null;
  // an answer to Bolt's two-choice question
  if (ch) {
    let hit = ch.ch.find(x => x[0] === k && (!x[1] || x[1] === c.slot)) || ch.ch.find(x => x[0] === 'game' && ((x[1] === 'rocket' && k === 'rocket') || (x[1] === 'dance' && k === 'dance') || (x[1] === 'hero' && c.slot === 'superhero') || (x[1] === 'gobble' && k === 'hungry')));
    if (!hit && ch.yn) hit = k === 'yes' ? ch.ch[0] : k === 'no' ? ch.ch[1] : null;
    if (!hit && (k === 'yes' || k === 'play')) hit = ch.ch[0];
    if (hit) { DLG.sinceQ = 0; return replyTo(hit[0], hit[1], true); }
  }
  if (!k) return fallback(c);
  return replyTo(k, c.slot, false);
}
function replyTo(k, slot, answered) {
  const R = TK.rig, M = DLG.mem;
  switch (k) {
    case 'greet': { const r = R_(choose('greet'), pick(['wave', 'hop', 'spinHappy']), 1.6, pick(['joy', 'star', 'love'])); if (Math.random() < .35) r.then = () => bringBack() || maybeAsk(.6); return r; }
    case 'name_q': return R_(choose('name_q'), pick(['flex', 'wave']), 2, 'joy', 'sparkle');
    case 'my_name': case 'kid': return R_(choose('kid'), 'cheer', 2, 'love', 'hearts');
    case 'bolt': return R_(choose('bolt'), pick(['wave', 'hop']), 1.4, pick(['joy', 'star']));
    case 'play': return R_(choose('play'), 'spinHappy', 1.3, 'star', 'sparkle', () => askQuestion('game'));
    case 'affection': return R_(choose('affection'), 'hug', 1.9, 'love', 'love', () => { rigAct(TK.rig, 'spinHappy', 1.2, 'love'); burst(TK.bolt.x, TK.bolt.y - 300, 16, { k: 'star', cols: ['#ff7ac6', '#ffd23f', '#fff'] }); });
    case 'dance': return R_(choose('dance'), 'dance', 3.6, pick(['star', 'cool', 'joy']), 'disco');
    case 'sing': return R_(choose('sing'), pick(['sing', 'sing', 'robot']), 2.8, pick(['sing', 'whistle']), 'notes');
    case 'jump': return R_(choose('jump'), pick(['hop', 'backflip', 'hop']), 1.2, pick(['joy', 'star']), 'boing');
    case 'rocket': return R_(choose('rocket'), pick(['hover', 'rocket']), 2.4, pick(['star', 'determined']), 'jet');
    case 'funny': return R_(choose('funny'), pick(['laugh', 'tickle', 'backflip']), 2, pick(['joy', 'wink', 'dizzy']), 'giggle');
    case 'happy': return R_(choose('happy'), pick(['spinHappy', 'dance']), 1.6, 'joy', 'stars');
    case 'sad': return R_(choose('sad'), 'hug', 2.2, 'love', 'love');
    case 'mad': return R_(choose('mad'), 'stomp', 1.8, 'determined', null, () => rigAct(TK.rig, 'stretch', 1.4, 'happy'));
    case 'scared': return R_(choose('scared'), 'brave', 2, 'determined', 'sparkle');
    case 'hungry': return R_(choose('hungry'), 'chomp', 1.6, 'joy', 'chomp');
    case 'numbers': return R_(choose('numbers'), 'cheer', 1.6, 'star', 'stars');   // never counts aloud
    case 'colors': return R_(choose('colors'), 'colors', 2.4, 'star', 'rainbow', () => maybeAsk(.7, 'color'));
    case 'animals': return R_(choose('animals'), 'puppy', 2.2, 'joy', 'woof', () => maybeAsk(.7, 'animal'));
    case 'color': {
      const again = M.color === slot && !answered; if (!M.color || answered) M.color = slot;
      TK.tint = { pal: COLOR_PAL[slot], until: now() + 9000 };
      return R_(again && CLIPS['cm_' + slot] ? 'cm_' + slot : 'c_' + slot, 'spinHappy', 1.4, again ? 'love' : 'star', 'rainbow2');
    }
    case 'animal': {
      const again = M.animal === slot && !answered; if (!M.animal || answered) M.animal = slot;
      return R_(again && CLIPS['am_' + slot] ? 'am_' + slot : 'a_' + slot, ANIM_MOVE[slot] || 'hop', 2, again ? 'love' : pick(['joy', 'star']), /dog|cow/.test(slot) ? 'woof' : /dinosaur|lion|tiger|dragon/.test(slot) ? 'roar' : 'stars');
    }
    case 'food': { if (answered || !M.food) M.food = slot; return R_('fo_' + slot, 'chomp', 1.6, 'joy', 'chomp'); }
    case 'thing': return R_('th_' + slot, THING_MOVE[slot] || 'hop', 1.8, pick(['joy', 'star']), slot === 'airplane' ? 'jet' : 'stars');
    case 'game': {
      if (slot === 'dance') return replyTo('dance');
      const r = R_('go_' + slot, 'spinHappy', 1.3, 'star', 'sparkle'); r.launch = slot; return r;
    }
    case 'yes': return R_(choose('yes'), 'hop', 1, 'joy', 'stars');
    case 'no': { const r = R_(choose('no'), 'nod', 1.2, 'happy'); if (r.clip === 'no_3') r.then = () => askQuestion(); return r; }
    case 'bye': return R_(choose('bye'), 'wave', 2, 'joy', null, () => goSleep(true));
    case 'sleep': return R_(choose('sleep'), 'yawn', 1.6, 'sleepy', null, () => goSleep(true));
    case 'what': return R_(choose('what'), pick(['lookL', 'lookR']), 1.4, 'curious', 'sparkle');
    case 'praise': return R_(choose('praise'), pick(['cheer', 'spinHappy']), 1.6, 'star', 'stars');
    case 'thanks': return R_(choose('thanks'), 'nod', 1.2, 'happy', 'sparkle');
    case 'sorry': return R_(choose('sorry'), 'hug', 1.6, 'happy');
    case 'help': return R_(choose('help'), 'flex', 1.6, 'determined', 'sparkle');
  }
  return fallback({});
}
function fallback(c) {
  // ALWAYS an answer: warm, engaged, sometimes a callback to something he remembers or a simple two-choice question
  const r = R_(choose('fallback'), pick(['hop', 'lookL', 'smallWave', 'sway', 'nod']), 1.3, pick(['curious', 'joy', 'surprised', 'star']), 'q');
  const roll = Math.random();
  if (roll < .3) r.then = () => bringBack() || maybeAsk(1); else if (roll < .65) r.then = () => maybeAsk(1);
  return r;
}
function bringBack() {
  const M = DLG.mem, opts = []; if (M.color && CLIPS['cm_' + M.color]) opts.push(['cm_' + M.color, 'rainbow2']); if (M.animal && CLIPS['am_' + M.animal]) opts.push(['am_' + M.animal, 'stars']);
  if (!opts.length) return false; const o = pick(opts);
  if (o[0].startsWith('cm_')) TK.tint = { pal: COLOR_PAL[M.color], until: now() + 7000 };
  playReply(R_(o[0], 'cheer', 1.6, 'love', o[1])); return true;
}
// ---------------- two-choice questions with picture buttons ----------------
const QS2 = [
  { clip: 'q_c1', ch: [['color', 'red'], ['color', 'blue']], kind: 'color' }, { clip: 'q_c2', ch: [['color', 'green'], ['color', 'yellow']], kind: 'color' }, { clip: 'q_c3', ch: [['color', 'purple'], ['color', 'orange']], kind: 'color' },
  { clip: 'q_a1', ch: [['animal', 'dog'], ['animal', 'cat']], kind: 'animal' }, { clip: 'q_a2', ch: [['animal', 'dinosaur'], ['animal', 'lion']], kind: 'animal' }, { clip: 'q_a3', ch: [['animal', 'duck'], ['animal', 'cow']], kind: 'animal' },
  { clip: 'q_m1', ch: [['dance'], ['jump']], kind: 'move' }, { clip: 'q_m2', ch: [['rocket'], ['sing']], kind: 'move' }, { clip: 'q_f1', ch: [['food', 'cookie'], ['food', 'apple']], kind: 'food' },
  { clip: 'q_feel', ch: [['happy'], ['sad']], yn: true, kind: 'feel' },
];
const GAME_PAIRS = { gr: ['gobble', 'rocket'], gh: ['gobble', 'hero'], rh: ['rocket', 'hero'], rd: ['rocket', 'dance'], gd: ['gobble', 'dance'], hd: ['hero', 'dance'] };
const qRot = rotor(QS2.map((q, i) => i)), gRot = rotor(Object.keys(GAME_PAIRS));
function maybeAsk(p, kind) { if (DLG.sinceQ < 2 || Math.random() > p) return false; askQuestion(kind); return true; }
function askQuestion(kind) {
  let q;
  if (kind === 'game') { const g = gRot(); q = { clip: 'pk_' + g, ch: GAME_PAIRS[g].map(x => ['game', x]), kind: 'game' }; }
  else { const L = QS2.filter(x => !kind || x.kind === kind); q = kind ? pick(L) : QS2[qRot()]; }
  DLG.sinceQ = 0;
  say(q.clip, { interrupt: true, who: 'b', onStart: () => {} });
  rigAct(TK.rig, pick(['lookL', 'lookR']), 1.2, 'curious');
  TK.choice = { ...q, t0: now(), until: now() + 14000 }; TK.choiceT = 0;
}
function choiceTap(i) {
  const ch = TK.choice; if (!ch) return; const c = ch.ch[i]; TK.choice = null; DLG.sinceQ = 0;
  sfx('pop'); const r = replyTo(c[0], c[1], true); playReply(r);
  if (TK.turn) TK.turn.answered = true;
}
// ---------------- playing a reply: voice + move + effects (+ follow-up after the line) ----------------
function playReply(r, onStart) {
  if (!r || !r.clip) return; const R = TK.rig; lastInput = now();
  if (R.asleep) { R.asleep = false; R.move = null; }
  DLG.lastClip = r.clip; DLG.said.push(r.clip); (window.__resp = window.__resp || []).push((TK.turn && TK.turn.log ? TK.turn.log.intent : '') + ':' + r.clip);
  clearVoiceQ();
  say(r.clip, { interrupt: true, who: 'b', onStart, onEnd: () => {
    if (r.launch) { const g = r.launch; setTimeout(() => { if (scr === 'talk') { micClose(); TK.conv = false; go(g); } }, 250); return; }
    if (r.then) setTimeout(() => { if (scr === 'talk' && !TK.rig.asleep) r.then(); }, 150);
  } });
  if (r.move) rigAct(R, r.move, r.dur, r.face, null);
  TK.fxMode = r.fx || null; TK.fxT = 0; TK.lastKey = r.key || null;
  const b = TK.bolt, hx = b.x, hy = b.y - 330 * b.s;
  switch (r.fx) {
    case 'boing': setTimeout(() => sfx('boing'), 200); break;
    case 'jet': sfx('whoosh'); break;
    case 'notes': for (let i = 0; i < 4; i++) setTimeout(() => sfx('note'), i * 280); break;
    case 'sparkle': sfx('sparkle'); burst(hx, hy, 18, { k: 'star', g: 200 }); break;
    case 'rainbow': case 'rainbow2': sfx('rainbow'); burst(hx, hy, 26, { k: 'conf', g: 260 }); break;
    case 'woof': setTimeout(() => sfx('woof'), 700); setTimeout(() => sfx('woof'), 950); break;
    case 'roar': setTimeout(() => shake(RM ? 0 : 8), 500); break;
    case 'giggle': sfx('chirp'); break;
    case 'chomp': for (let i = 0; i < 3; i++) setTimeout(() => sfx('chomp', i), 300 + i * 220); break;
    case 'hearts': case 'love': sfx('heart'); for (let i = 0; i < (RM ? 8 : 18); i++) fx({ k: 'heart', x: hx + rnd(-140, 140), y: hy + rnd(40, 160), vy: rnd(-180, -60), vx: rnd(-50, 50), life: rnd(1.3, 2.2), s: rnd(14, 28), c: pick(['#ff5a8a', '#ff7ac6', '#ff3b6b', '#ffb3d6']) }); break;
    case 'stars': sfx('star'); burst(hx, hy, 24, { k: 'star' }); break;
    case 'q': sfx('chirp'); break;
    case 'disco': sfx('yay'); break;
  }
}
// ---------------- conversation mode on / off ----------------
async function startConv(byTap) {
  const R = TK.rig; initAudio();
  if (VOSK.state !== 'ready') { if (VOSK.state === 'failed') { say('b_pictures', { interrupt: true }); rigAct(R, 'shake', .8, 'curious'); } else { say('b_ears', { interrupt: true }); rigAct(R, 'think', 1.4, 'curious'); voskLoad(); } return; }
  if (R.asleep) { R.asleep = false; R.move = null; TK.napUntil = 0; rigAct(R, 'hop', 1, 'surprised'); sfx('chirp'); }
  const ok = MIC.on || await micOpen();
  if (!ok) { say('b_pictures', { interrupt: true }); rigAct(R, 'shake', .8, 'curious'); return; }
  recEnsure(); TK.conv = true;
  const c = choose('start'); playReply(R_(c, 'spinHappy', 1.2, 'joy', 'sparkle'));
}
function goSleep(said) {
  const R = TK.rig; ENG.sleep(); TK.choice = null;
  const fin = () => { micClose(); TK.conv = false; R.asleep = true; rigAct(R, 'sleep', 999, 'asleep'); R.asleep = true; R.sleepSnore = now(); };
  if (said) { setTimeout(fin, 300); return; }
  say(pick(['zz_1', 'zz_2']), { interrupt: true, onEnd: fin }); rigAct(R, 'yawn', 1.8, 'sleepy');
}
function wakeTalk() { startConv(true); }
// v1 entry points still used by screens.js
function wake(silent) {
  const R = TK.rig; R.asleep = false; R.move = null; TK.napUntil = 0; HUB.rig.asleep = false; HUB.rig.move = null;
  if (M) M.hold(false);
  if (scr === 'talk' && SV.talkMode !== 'hold') { startConv(true); return; }
  if (!silent) { sfx('chirp'); say(isAlex() ? 'b_awake_alex' : 'b_awake', { interrupt: true }); }
  rigAct(R, 'hop', 1.1, 'surprised'); rigAct(HUB.rig, 'hop', 1.1, 'surprised');
}
function respond(k, src) { const r = replyTo(k, null, false); playReply(r); }
// ---------------- hold-to-talk (parent option) ----------------
async function micDown() {
  initAudio(); lastInput = now();
  if (SV.talkMode !== 'hold') { if (!TK.conv) startConv(true); return; }
  if (TK.rig.asleep) { TK.rig.asleep = false; TK.rig.move = null; }
  if (VOSK.state !== 'ready') { if (VOSK.state === 'failed') say('b_pictures', { interrupt: true }); else { say('b_ears', { interrupt: true }); voskLoad(); } return; }
  stopVoice(); clearVoiceQ(); recEnsure();
  const ok = MIC.on || await micOpen(); if (!ok) { say('b_pictures', { interrupt: true }); return; }
  if (!pressed('mic')) { micClose(); return; }
  MIC.hold = true; MIC.feeding = true; TK.turn = { onset: now(), onsetPerf: now(), react: 0, partial: '', texts: [], words: [], end: 0, lastVoice: 0, answered: false, hold: true }; TK.wantReact = TK.turn;
  sfx('listen'); TK.rig.ear = 1; sfxUntil = 0;
}
function micUp() {
  if (!MIC.hold) return; const T = TK.turn;
  MIC.feeding = false; MIC.hold = false; micClose(); sfx('listenEnd');   // mic off the moment the button is let go
  if (!T) return;
  T.end = now(); T.lastVoice = now(); T.waitFinal = true;
  try { VOSK.rec.retrieveFinalResult(); } catch (e) {}
  setTimeout(() => { if (!T.answered) answer(classifyNow(T.texts.join(' ') || T.partial), 'timeout'); }, 700);
}
// ---------------- picture buttons (work with no mic at all) ----------------
const PICS = [
  { id: 'p_music', key: 'dance', col: '#ffc61a', icon: 'music' }, { id: 'p_rocket', key: 'rocket', col: '#dfe9ff', icon: 'rocket' },
  { id: 'p_moon', key: 'sleep', col: '#3b6dff', icon: 'moon' }, { id: 'p_star', key: 'funny', col: '#ffc61a', icon: 'star' },
  { id: 'p_paw', key: 'animals', col: '#ff9a3d', icon: 'paw' }, { id: 'p_rainbow', key: 'colors', col: '#ffffff', icon: 'rainbow' },
];
function enterTalk() {
  TK.rig = BotRig(); rigAct(TK.rig, 'wave', 1.8, 'joy'); TK.conv = false; TK.choice = null; TK.tint = null;
  music('space'); voskLoad(); primePools();
  const first = !TK.seen; TK.seen = true;
  setTimeout(() => { if (scr !== 'talk') return; if (VOSK.state === 'failed') say('b_pictures'); else say(SV.talkMode === 'hold' ? 'b_holdtalk' : pick(['l_tapme', 'l_tapme2'])); }, first ? 500 : 300);
}
function leaveTalk() { micClose(); TK.conv = false; }
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
// speech bubble: wraps to two balanced lines (shrinking a little only if a line is still too wide) and always stays fully on screen
function bubbleLines(text, maxTW) {
  if (cx.measureText(text).width <= maxTW) return [text];
  const w = text.split(' '); let best = null;
  for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(' '), b = w.slice(k).join(' '), m = Math.max(cx.measureText(a).width, cx.measureText(b).width); if (!best || m < best[0]) best = [m, [a, b]]; }
  return best ? best[1] : [text];
}
function drawBubble(x, y, center) {
  if (!bubble || now() > bubble.until) return;
  const k = clamp((now() - bubble.t0) / 220, 0, 1), sc2 = easeBack(k);
  const isN = bubble.who === 'n';
  let text = bubble.text; if (!isAlex()) text = text.replace(/Alex/g, SV.kid || 'friend');
  const maxW = Math.min(500, VW - 40), pad = 25; let fs = 26;
  cx.save(); cx.font = '900 ' + fs + 'px ' + FONT;
  const lines = bubbleLines(text, maxW - pad * 2);
  let tw = Math.max(...lines.map(l => cx.measureText(l).width));
  if (tw > maxW - pad * 2) { fs = Math.max(18, Math.floor(fs * (maxW - pad * 2) / tw)); cx.font = '900 ' + fs + 'px ' + FONT; tw = Math.max(...lines.map(l => cx.measureText(l).width)); }
  const lh = fs * 1.25, w = Math.min(maxW, tw + pad * 2), h = lines.length === 1 ? 60 : Math.round(lh * 2 + 28);
  const ax = x;                                   // where the tail should point (Bolt's head)
  if (isN) { x = VW / 2 - w / 2; y = 80; } else if (center) x = x - w / 2;
  x = clamp(x, 10, VW - w - 10); y = clamp(y, 10, VH - h - 40);
  window.__bubbleRect = { x, y, w, h, lines: lines.length, fs, VW, VH };
  cx.translate(x + w / 2, y + h / 2); cx.scale(sc2, sc2); cx.translate(-w / 2, -h / 2);
  const fill = isN ? '#ffd23f' : bubble.who === 'j' ? '#ffd9f0' : '#fff';
  cx.fillStyle = 'rgba(0,0,0,.25)'; rr(4, 6, w, h, 26); cx.fill();
  cx.fillStyle = fill; rr(0, 0, w, h, 26); cx.fill();
  if (!isN) { const tx = clamp(center ? w / 2 - 20 : ax - x + 30, 26, w - 60); cx.beginPath(); cx.moveTo(tx, h - 8); cx.lineTo(tx - 20, h + 24); cx.lineTo(tx + 30, h - 4); cx.fill(); }
  lines.forEach((l, i) => txt(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh + 1, fs, '#2a2060', { stroke: false }));
  cx.restore();
}
function backBtn(cb) {
  const x = 56, y = 52, prs = pressed('back');
  glossBall(x, y, 38 * (prs ? .9 : 1), '#7a5cff'); drawIcon('back', x - 2, y, 1.05);
  BTN.push({ id: 'back', x, y, r: 42, cb: () => { sfx('click'); cb(); } });
}

// ---------------- music ducking (audio.js musicTick) ----------------
// hear: Alex is talking (or holding the talk button) -> near-silent; bolt: Bolt/narrator speaking -> under his voice;
// listen: mic open, waiting for Alex -> quieter than the bed; bed: mic off / asleep -> quiet bed
function talkDuck() {
  const T = TK.turn, live = T && !T.answered && (MIC.feeding || T.waitFinal);
  if (live || MIC.hold || (MIC.on && ENG.state === 'speech')) return 'hear';
  if (voiceBusy()) return 'bolt';
  if (MIC.on && TK.conv && !TK.rig.asleep) return 'listen';
  return 'bed';
}
// ---------------- per-frame ----------------
function updateTalk(dt) {
  const R = TK.rig;
  TK.fxT += dt;
  const turnLive = TK.turn && !TK.turn.answered && (MIC.feeding || TK.turn.waitFinal);
  R.listening = lerp(R.listening, turnLive ? 1 : (TK.conv && !R.asleep && !botBusy() ? .25 : 0), Math.min(1, dt * (turnLive ? 22 : 5)));
  R.talking = voiceBusy() && bubble && bubble.who === 'b' ? voiceLevel() : 0;
  if (turnLive) R.ear = Math.max(R.ear, .6 + MIC.level * 2);
  if (TK.tint && now() > TK.tint.until) TK.tint = null;
  if (TK.choice && now() > TK.choice.until) TK.choice = null;
  if (TK.hadChoice && !TK.choice) TK.choiceEnd = now(); TK.hadChoice = !!TK.choice;
  if (TK.napUntil && now() > TK.napUntil) { TK.napUntil = 0; R.asleep = false; R.move = null; rigAct(R, 'yawn', 1.4, 'sleepy', () => rigAct(R, 'hop', .8, 'joy')); }
  if (R.asleep && Math.random() < dt * 1.2) fx({ k: 'z', x: TK.bolt.x + 90 * TK.bolt.s, y: TK.bolt.y - 380 * TK.bolt.s, vx: 30, vy: -50, life: 2, s: 12, c: '#bff' });
  if (TK.fxMode === 'notes' && TK.fxT < 3 && Math.random() < dt * 6) fx({ k: 'note', x: TK.bolt.x + rnd(-120, 120), y: TK.bolt.y - 300 * TK.bolt.s, vy: -90, vx: rnd(-30, 30), life: 1.6, s: 10, c: pick(['#ffd23f', '#7ff', '#ff7ac6']), ch: pick(['♪', '♫']) });
  if (TK.fxMode === 'jet' && TK.fxT < 2.2 && Math.random() < dt * 30) fx({ k: 'dot', x: TK.bolt.x + rnd(-40, 40), y: TK.bolt.y + 20, vy: rnd(40, 120), vx: rnd(-60, 60), life: .8, s: rnd(14, 26), c: 'rgba(255,255,255,.6)' });
  if (TK.fxMode === 'disco' && TK.fxT < 3.4 && Math.random() < dt * (RM ? 3 : 9)) burst(TK.bolt.x + rnd(-220, 220), rnd(60, 200), 3, { k: 'star', g: 100, sp0: 40, sp1: 120 });
  if ((TK.fxMode === 'love') && TK.fxT < 2 && Math.random() < dt * 10) fx({ k: 'heart', x: TK.bolt.x + rnd(-60, 60), y: TK.bolt.y - 150 * TK.bolt.s, vy: rnd(-160, -80), vx: rnd(-70, 70), life: 1.4, s: rnd(10, 18), c: pick(['#ff5a8a', '#ff7ac6']) });
  // idle life: little actions, and the odd hum (only when nobody is talking - the mic ignores his hums anyway)
  if (!turnLive && !voiceBusy() && !R.asleep) {
    rigIdleTick(R, dt);
    TK.hum -= dt; if (TK.hum < 0) { TK.hum = 18 + Math.random() * 22; if (ENG.state === 'idle' && now() - ENG.quietSince > 3000 && !RM) { sfx('hum'); rigFace(R, 'whistle', 1500); if (!R.move) rigIdle(R, 'sway', 1.6); } }
  }
  if (!TK.conv) idleSleepCheck(R);
  if (TK.dbgOn) dbgTick();
}
function drawTalk(dt) {
  if (!cover(IMG.bg_talk, 0, 0, VW, VH, .5, .6)) { cx.fillStyle = '#5a3a6a'; cx.fillRect(0, 0, VW, VH); }
  const R = TK.rig, T = now() / 1000;
  if (TK.fxMode === 'disco' && TK.fxT < 3.4) { cx.save(); cx.globalAlpha = .18 * Math.sin(Math.min(1, TK.fxT) * PI / 2); rays(VW * .48, -40, 12, 900, 70, ['#ff7ac6', '#7ff', '#ffd23f'][Math.floor(TK.fxT * 4) % 3], TK.fxT * .8); cx.restore(); }
  if (R.listening > .3) { cx.fillStyle = 'rgba(10,0,40,' + (.22 * R.listening) + ')'; cx.fillRect(0, 0, VW, VH); }
  const bs = 1.0 + (level() * .04), bx = VW * .47, by = 572;
  TK.bolt = { x: bx, y: by, s: bs };
  const p = rigPose(R, dt);
  if (TK.wantReact && R.listening > .05) { TK.wantReact.react = now() - TK.wantReact.onsetPerf + (1024 / (AC ? AC.sampleRate : 48000)) * 1000; TK.wantReact.reactPerf = now(); TK.wantReact = null; }
  let pal = null;
  if (TK.tint) pal = TK.tint.pal === 'rainbow' ? COLORS[Math.floor(T * 5) % 6] : typeof TK.tint.pal === 'number' ? COLORS[TK.tint.pal] : TK.tint.pal;
  if ((TK.fxMode === 'rainbow') && TK.fxT < 2.6) pal = COLORS[Math.floor(TK.fxT * 5) % 6];
  // listening rings from the ears, pumped by Alex's voice level
  if (R.ear > 0 || R.listening > .3) {
    const a = Math.max(R.ear, R.listening);
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
      const k = ((T * 1.6) + i / 3) % 1, ex = bx + (sd * 104 + (p.bx || 0)) * bs, ey = by - 290 * bs + (p.bob || 0) * bs;
      cx.strokeStyle = 'rgba(110,255,250,' + (a * (1 - k)) + ')'; cx.lineWidth = 7; cx.beginPath(); cx.arc(ex, ey, 40 + k * 90 + (MIC.level || 0) * 90 * R.listening, sd < 0 ? PI - .7 : -.7, sd < 0 ? PI + .7 : .7); cx.stroke();
    }
  }
  const face = R.talking > .02 ? talkFace(p.face, R.talking) : p.face;
  drawBolt({ x: bx, y: by, s: bs, color: SV.color, pal, hat: SV.hat, face, pose: p, ear: Math.max(R.ear, R.listening > .5 ? .7 + .3 * Math.sin(T * 10) : 0), cape: level() >= 2, core: SV.bolts / CORE_CAP });
  drawFx();
  // Bolt is a big button: tap to start talking / tickle him
  BTN.push({ id: 'bolt', x: bx + (p.bx || 0) * bs, y: by - 230 * bs + (p.bob || 0) * bs, w: 260 * bs, h: 440 * bs, cb: () => tapBolt() });
  backBtn(() => { leaveTalk(); go('hub'); });
  // picture buttons
  const pk = TK.choice ? Math.max(0, 1 - (now() - TK.choice.t0) / 220) : Math.min(1, (now() - (TK.choiceEnd || 0)) / 300);   // pictures make room for a question
  if (pk > .01) PICS.forEach((pc, i) => {
    const col = i % 2, row = (i / 2) | 0, x = 78 + col * 118, y = 168 + row * 140 + col * 50, prs = pressed(pc.id);
    const r = 54 * (prs ? .92 : 1) * easeOut(pk);
    glossBall(x, y, r, pc.col); drawIcon(pc.icon, x, y, r / 46);
    BTN.push({ id: pc.id, x, y, r: 58, cb: () => { sfx('pop'); burst(x, y, 10, { g: 300, sp1: 260 }); respond(pc.key, 'pic'); } });
  });
  drawChoice(bx, T);
  drawTalkButton(T);
  // hidden parent lock (same as the hub): hold 3 s on the faint dot top-right
  const f = holdFrac('plock'); BTN.push({ id: 'plock', x: VW - 24, y: 24, r: 18, cb: () => openParent(), hold: 3000 });
  circ(VW - 24, 24, 12, 'rgba(255,255,255,' + (.12 + f * .5) + ')'); if (f > 0) { cx.strokeStyle = '#ffd23f'; cx.lineWidth = 4; cx.beginPath(); cx.arc(VW - 24, 24, 17, -PI / 2, -PI / 2 + f * TAU); cx.stroke(); }
  drawBubble(bx + 150, by - 470 * bs);
}
function tapBolt() {
  const R = TK.rig; lastInput = now();
  if (SV.talkMode !== 'hold' && (!TK.conv || R.asleep || !MIC.on)) { startConv(true); return; }
  if (voiceBusy()) { R.antV += 14; rigFace(R, 'surprised', 500); return; }
  playReply(R_(choose('tickle'), pick(['tickle', 'laugh', 'spinHappy']), 1.5, pick(['joy', 'wink', 'dizzy']), 'giggle'));
}
// two big picture answers float either side of Bolt's head
function choiceIcon(c, x, y, r) {
  const [kind, slot] = c;
  if (kind === 'color') { const P = typeof COLOR_PAL[slot] === 'number' ? COLORS[COLOR_PAL[slot]] : COLOR_PAL[slot]; glossBall(x, y, r * .62, P.base); return; }
  const EMO = { dog: '🐶', cat: '🐱', dinosaur: '🦖', lion: '🦁', duck: '🦆', cow: '🐮', cookie: '🍪', apple: '🍎', happy: '😀', sad: '😢', jump: '🦘' };
  if (kind === 'game') {
    if (slot === 'rocket') { cx.save(); cx.translate(x, y); cx.scale(r / 40, r / 40); drawRocketIcon(); cx.restore(); }
    else if (slot === 'dance') drawIcon('music', x, y, r / 40);
    else if (slot === 'gobble') { drawItem('bolt', x - r * .2, y + r * .1, r * .8, -.3); drawItem('nut', x + r * .28, y - r * .15, r * .55); }
    else if (slot === 'hero') { drawBoltHeadFace(x, y + r * .05, r / 150, 'determined'); }
    return;
  }
  if (kind === 'dance') { drawIcon('music', x, y, r / 40); return; }
  if (kind === 'rocket') { cx.save(); cx.translate(x, y); cx.scale(r / 40, r / 40); drawRocketIcon(); cx.restore(); return; }
  if (kind === 'sing') { cx.save(); txt('♪', x, y, r * 1.1, '#fff', { lw: 6 }); cx.restore(); return; }
  const e = EMO[slot || kind]; if (e) { cx.save(); cx.font = Math.round(r * 1.05) + 'px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(e, x, y + r * .05); cx.restore(); }
}
function drawChoice(bx, T) {
  const ch = TK.choice; if (!ch) return;
  const k = clamp((now() - ch.t0) / 350, 0, 1), s = easeBack(k);
  ch.ch.forEach((c, i) => {
    const x = 150 + Math.sin(T * 2.2 + i * 2) * 6, y = (i ? 445 : 205) + Math.sin(T * 3 + i * 2) * 8, r = 92 * s * (pressed('ch' + i) ? .92 : 1);
    if (r < 2) return;
    glow(x, y, r * 1.9, i ? 'rgba(255,200,90,1)' : 'rgba(120,255,250,1)', .45 + .15 * Math.sin(T * 5 + i * 3));
    glossBall(x, y, r, i ? '#ffb347' : '#5ad1ff', { rim: 'rgba(255,255,255,.95)' });
    choiceIcon(c, x, y, r * .78);
    BTN.push({ id: 'ch' + i, x, y, r: r + 12, cb: () => choiceTap(i) });
  });
  txt('or', 150, 325, 34 * s, '#fff', { lw: 7 });
}
// the big round button on the right: hands-free = start talking / shows he is listening; hold mode = hold to talk
function drawTalkButton(T) {
  const mx = VW - 210, my = 330, mr = 120, hold = SV.talkMode === 'hold';
  const listening = hold ? (MIC.hold || pressed('mic')) : (TK.conv && !TK.rig.asleep && MIC.on);
  const turnLive = TK.turn && !TK.turn.answered && MIC.feeding;
  for (let i = 0; i < 3; i++) { const k = ((T * (listening ? 1.4 : .5)) + i / 3) % 1; cx.strokeStyle = (listening ? 'rgba(120,255,250,' : 'rgba(255,170,150,') + ((listening ? .7 : .35) * (1 - k)) + ')'; cx.lineWidth = 6; cx.beginPath(); cx.arc(mx, my, mr + 10 + k * 70 + (turnLive ? MIC.level * 80 : 0), 0, TAU); cx.stroke(); }
  glow(mx, my, mr * 1.7, listening ? 'rgba(90,255,240,1)' : 'rgba(255,90,70,1)', listening ? .55 : .35);
  const ms = pressed('mic') ? .9 : 1 + Math.sin(T * 3) * .02 + (turnLive ? MIC.level * .25 : 0);
  glossBall(mx, my, mr * ms, VOSK.state === 'failed' || MIC.denied ? '#b0657a' : listening ? '#1fc8c0' : '#ff4436', { rim: 'rgba(255,230,220,.9)' });
  drawIcon('mic', mx, my + 4, ms * 1.45);
  if (VOSK.state === 'loading' || VOSK.state === 'idle') {
    cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.lineWidth = 12; cx.beginPath(); cx.arc(mx, my, mr + 18, 0, TAU); cx.stroke();
    cx.strokeStyle = '#7ffff7'; cx.lineCap = 'round'; cx.beginPath(); cx.arc(mx, my, mr + 18, -PI / 2, -PI / 2 + TAU * Math.max(.04, VOSK.prog)); cx.stroke();
    for (let i = 0; i < 3; i++) circ(mx - 24 + i * 24, my + mr + 52, 7 + 3 * Math.sin(T * 6 - i), '#7ffff7');
  }
  BTN.push({ id: 'mic', x: mx, y: my, r: mr + 10, cb: () => {}, down: () => micDown(), up: () => micUp() });
}
function idleSleepCheck(R) {
  if (!R.asleep && !voiceBusy() && !R.move && now() - lastInput > 60000) {
    R.asleep = true; rigAct(R, 'sleep', 999, 'asleep'); R.asleep = true; say('b_sleepy'); if (M) M.hold(true); TK.napUntil = 0; R.sleepSnore = now();
  }
  if (R.asleep && scr !== 'talk' && now() - (R.sleepSnore || 0) > 3200) { R.sleepSnore = now(); sfx('snore'); }
}
// ---------------- debug overlay (parent corner -> "Show talk debug") ----------------
let dbgDirty = true, dbgLast = 0;
function dbgShow(on) { TK.dbgOn = !!on; const el = document.getElementById('dbg'); if (el) el.style.display = on ? 'block' : 'none'; dbgDirty = true; }
function dbgTick() {
  const el = document.getElementById('dbg'); if (!el || !TK.dbgOn || now() - dbgLast < 100) return; dbgLast = now();
  const L = TK.lat, avg = (k) => { const v = L.map(x => x[k]).filter(x => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : '-'; };
  const T = TK.turn, bar = n => '█'.repeat(Math.max(0, Math.min(20, Math.round(n))));
  const rows = L.slice(-6).reverse().map(x => `<tr><td>${esc(x.heard || '∅')}</td><td>${esc(x.intent)}</td><td>${x.conf}</td><td>${x.react ?? '-'}</td><td>${x.endToVoice ?? '-'}</td><td>${x.how}</td></tr>`).join('');
  el.innerHTML = `<b>Bolt talk debug</b> · mode ${SV.talkMode || 'conv'} · engine <b>${ENG.state}</b> · mic ${MIC.on ? 'ON' : 'off'} · vosk ${VOSK.state}${botBusy() ? ' · <i>Bolt speaking: mic ignored</i>' : ''}<br>
  level ${ENG.db.toFixed(0)} dB ${bar((ENG.db + 70) / 3)}<br>floor ${ENG.floor.toFixed(0)} · on ${ENG.thrOn.toFixed(0)} · off ${ENG.thrOff.toFixed(0)} · wait ${ENG.o.hang}/${ENG.o.fastHang} ms<br>
  hearing: <b>${esc(T && !T.answered ? T.partial || '…' : '')}</b> ${TK.choice ? '· waiting for: ' + TK.choice.ch.map(c => c.join(':')).join(' / ') : ''}<br>
  avg react ${avg('react')} ms · avg reply ${avg('endToVoice')} ms (after Alex stops)
  <table><tr><th>heard</th><th>intent</th><th>conf</th><th>react</th><th>reply</th><th>via</th></tr>${rows}</table>`;
}
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
