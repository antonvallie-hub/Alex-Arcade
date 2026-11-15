'use strict';
// Bolt Buddy audio: WebAudio master bus, synthesized UI sounds, voice clips (narrator + Bolt + Jelly King), AAA music loops.
let AC = null, master = null, musG = null, sfxG = null, voxG = null, M = null, muted = false;
const MUSIC = { // loop points from /workspace/work/music-aaa/ship_bolt.py (music.json)
  space: { url: 'music/bolt-space-aaa.mp3', loopStart: 7.741927, loopEnd: 61.935488 },
  gobble: { url: 'music/bolt-gobble-aaa.mp3', loopStart: 4.210522, loopEnd: 37.894739 },
  boss: { url: 'music/bolt-boss-aaa.mp3', loopStart: 3.428571, loopEnd: 30.857143 },
};
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
  master = AC.createGain(); master.gain.value = .9; master.connect(comp); comp.connect(AC.destination);
  musG = AC.createGain(); musG.gain.value = .55; musG.connect(master);
  sfxG = AC.createGain(); sfxG.gain.value = .7; sfxG.connect(master);
  voxG = AC.createGain(); voxG.gain.value = 1.0; voxG.connect(master);
  M = AAAMusic.create(AC, musG, { tracks: MUSIC });
  if (wantMusic) M.play(wantMusic, { fade: 1 });
}
let wantMusic = null;
function music(name) { wantMusic = name; if (M) { if (name) M.play(name, { fade: 1.2 }); else M.stop(1); } }
let NB = null;
function noiseBuf() { if (NB) return NB; const b = AC.createBuffer(1, AC.sampleRate * 1.5, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return NB = b; }
function tone(type, f0, f1, dur, vol, t0, dest) {
  const t = AC.currentTime + (t0 || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, vol, ft, f0, f1, q, t0) {
  const t = AC.currentTime + (t0 || 0), s = AC.createBufferSource(); s.buffer = noiseBuf(); const f = AC.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
  const g = AC.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(sfxG); s.start(t, Math.random()); s.stop(t + dur + .05);
}
let combo = 0, comboT = 0;
function sfx(n, a) {
  if (!AC || muted) return;
  try {
    switch (n) {
      case 'click': tone('triangle', 520, 1100, .1, .16); break;
      case 'pop': noise(.1, .25, 'highpass', 1500, 0, 1); tone('sine', 500, 1300, .09, .2); break;
      case 'boing': tone('sine', 180, 520, .16, .26); tone('sine', 520, 260, .22, .14, .14); break;
      case 'chomp': { const p = a || 0; tone('square', 140 + p * 18, 70, .12, .12); tone('sine', 380 * Math.pow(1.06, p), 760 * Math.pow(1.06, p), .1, .2, .03); noise(.08, .15, 'lowpass', 1600, 400, 1); break; }
      case 'gulp': tone('sine', 300, 80, .3, .35); tone('triangle', 900, 200, .25, .12, .05); break;
      case 'grow': [392, 523, 659, 784, 1046].forEach((f, i) => tone('square', f, 0, .16, .06, i * .06)); tone('sine', 120, 260, .6, .3); noise(.6, .25, 'bandpass', 400, 3000, 2); break;
      case 'sparkle': [1568, 2093, 2637, 3136].forEach((f, i) => tone('sine', f, 0, .25, .07, i * .05)); break;
      case 'star': tone('triangle', 880, 1760, .2, .13); tone('sine', 1760, 2640, .25, .07, .07); break;
      case 'whoosh': noise(.6, .35, 'bandpass', 300, 2600, 2); break;
      case 'bonk': tone('sine', 220, 60, .35, .55); noise(.25, .45, 'lowpass', 2500, 200, 1); tone('square', 900, 300, .08, .08); break;
      case 'wobble': { const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), l = AC.createOscillator(), lg = AC.createGain(); o.type = 'sine'; o.frequency.value = 200; l.frequency.value = 9; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .6); o.connect(g); g.connect(sfxG); o.start(t); l.start(t); o.stop(t + .65); l.stop(t + .65); break; }
      case 'powerup': tone('sawtooth', 110, 880, 1.2, .12); tone('square', 220, 1760, 1.2, .05); noise(1.3, .3, 'bandpass', 200, 6000, 3); [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, 0, .3, .08, .9 + i * .07)); break;
      case 'slowmo': tone('sawtooth', 400, 60, 1.2, .12); noise(1.2, .3, 'lowpass', 3000, 150, 1); break;
      case 'hit': tone('sine', 160, 40, .5, .6); noise(.5, .5, 'lowpass', 4000, 150, 1); break;
      case 'chirp': tone('square', 880, 0, .07, .07); tone('square', 1320, 0, .09, .07, .08); tone('square', 990, 0, .1, .06, .18); break;
      case 'listen': tone('sine', 660, 0, .12, .18); tone('sine', 990, 0, .2, .16, .09); break;
      case 'listenEnd': tone('sine', 990, 0, .1, .14); tone('sine', 660, 0, .18, .14, .08); break;
      case 'think': [700, 900, 760, 1000].forEach((f, i) => tone('square', f, 0, .06, .04, i * .09)); break;
      case 'snore': tone('sawtooth', 70, 55, 1.1, .05); noise(1.1, .06, 'lowpass', 500, 300, 1); break;
      case 'thrust': noise(.25, .12, 'lowpass', 900, 600, 1); break;
      case 'land': tone('sine', 140, 40, .4, .5); noise(.4, .35, 'lowpass', 1200, 150, 1); break;
      case 'fanfare': [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .6], [1046, .72]].forEach(([f, t]) => { tone('square', f, 0, .22, .07, t); tone('sawtooth', f / 2, 0, .22, .05, t); }); tone('triangle', 1318, 0, .9, .1, .84); break;
      case 'levelup': [523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => tone('square', f, 0, .22, .06, i * .08)); noise(1, .25, 'highpass', 3000, 0, 1, .5); break;
      case 'coin': tone('square', 1320, 0, .07, .06); tone('square', 1760, 0, .15, .06, .06); break;
      case 'locked': tone('triangle', 300, 200, .15, .12); break;
      case 'yay': for (let k = 0; k < 6; k++) noise(1.2 + Math.random() * .5, .05 + Math.random() * .04, 'bandpass', 600 + k * 280, 700 + k * 300, 3, Math.random() * .2); break;
      case 'note': { const f = pick([523, 587, 659, 784, 880, 1046]); tone('triangle', f, 0, .25, .1); tone('sine', f * 2, 0, .2, .04); break; }
      case 'woof': tone('sawtooth', 300, 180, .14, .12); noise(.14, .12, 'bandpass', 700, 400, 2); break;
      case 'rainbow': [523, 587, 659, 698, 784, 880, 988, 1046].forEach((f, i) => tone('sine', f, 0, .18, .08, i * .05)); break;
      case 'honk': tone('square', 330, 300, .25, .1); tone('square', 335, 305, .25, .08); break;
    }
  } catch (e) {}
}

// ===== voice clips =====
const CLIPS = JSON.parse(document.getElementById('clips').textContent); // id -> [text, secs]
const vBuf = {}, vLoad = {};
let vEnd = 0, vSrc = null, vQ = [], vOnEnd = null; const vlog = []; window.__vlog = vlog;
function vGet(id) {
  if (vBuf[id]) return Promise.resolve(vBuf[id]); if (vLoad[id]) return vLoad[id]; if (!AC) return Promise.reject(new Error('no audio'));
  const p = fetch('voice/' + id + '.mp3').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((res, rej) => { const q = AC.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); })).then(b => { vBuf[id] = b; delete vLoad[id]; return b; });
  p.catch(() => { delete vLoad[id]; }); return vLoad[id] = p;
}
let vPre = false;
function voicePreload() { if (vPre || !AC) return; vPre = true; const q = Object.keys(CLIPS); let i = 0; const nx = () => { if (i < q.length) vGet(q[i++]).catch(() => {}).then(nx); }; nx(); nx(); nx(); }
const voiceBusy = () => now() < vEnd;
let bubble = null; // {text, who, t0, until}
// say(id, {who, interrupt, onEnd}) - plays a clip, shows a speech bubble, ducks music
function say(id, o) {
  o = o || {}; if (!CLIPS[id]) return;
  const who = o.who || (id[0] === 'n' ? 'n' : id[0] === 'j' ? 'j' : 'b');
  if (!o.interrupt && voiceBusy()) { if (o.queue !== false) vQ.push([id, o]); return; }
  stopVoice(); vlog.push(id);
  const secs = CLIPS[id][1];
  vEnd = now() + secs * 1000 + 120; bubble = { text: CLIPS[id][0], who, t0: now(), until: vEnd + 500 };
  if (o.onEnd) vOnEnd = o.onEnd; else vOnEnd = null;
  if (M) M.duckFor(secs + .2);
  if (!AC || muted) return;
  vGet(id).then(b => {
    if (!vlog.length || vlog[vlog.length - 1] !== id) return;
    const s = AC.createBufferSource(); s.buffer = b; const g = AC.createGain(); g.gain.value = 1; s.connect(g); g.connect(voxG); s.start(); vSrc = s;
    vEnd = now() + b.duration * 1000 + 80; if (bubble) bubble.until = vEnd + 500;
  }).catch(() => {});
}
function stopVoice() { if (vSrc) { try { vSrc.stop(); } catch (e) {} vSrc = null; } vEnd = 0; }
function voiceTick() {
  if (!voiceBusy()) {
    if (vOnEnd) { const f = vOnEnd; vOnEnd = null; f(); }
    if (vQ.length) { const [id, o] = vQ.shift(); say(id, Object.assign({}, o, { interrupt: true })); }
  }
}
function clearVoiceQ() { vQ.length = 0; }
// name-aware picks: clips that say "Alex" only when the kid is Alex; "Bolt" lines only when the robot is Bolt
const PRAISE = rotor(['n_awesome', 'n_amazing', 'n_wayto', 'n_superstar', 'n_hooray', 'n_woohoo']);
function hiClip() { return isAlex() ? pick(['b_hi_alex', 'b_hi_alex', 'b_hi_1', 'b_hi_2']) : pick(['b_hi_1', 'b_hi_2', 'b_hi_3']); }
