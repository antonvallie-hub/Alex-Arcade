'use strict';
// Bolt Buddy v2 - hands-free turn-taking (voice activity detection + endpointing), pure logic so node tests can drive it.
// Feed it one frame per audio callback: frame(tMs, rmsLinear, botBusy). It calls ev(name, data):
//   'onset'    first loud frame of a possible turn (Bolt lights his ears and leans in right away)
//   'endpoint' Alex stopped talking (silence >= hang) -> answer now        'cancel' it was a click/bump, not speech
//   'prompt'   ~9 s of quiet -> Bolt may nudge once                        'sleep'  ~20 s of quiet -> yawn, mic off
// While botBusy (Bolt talking / beeping) every frame is ignored, plus a short tail for room echo: Bolt never hears himself.
(function (root) {
  const DEF = { hang: 600, fastHang: 450, minSpeech: 80, maxTurn: 7000, tail: 260, promptAfter: 9000, sleepAfter: 20000, onDb: 11, offDb: 6, absMin: -52, floor0: -62 };
  function TurnEngine(opts, ev) {
    const o = Object.assign({}, DEF, opts || {});
    const S = { o, state: 'idle', floor: o.floor0, cal: 0, t: 0, onsetT: 0, lastVoice: 0, voiced: 0, lastFrame: 0, botEnd: -1e9, quietSince: 0, prompted: false,
      partialText: '', partialIntent: null, partialHits: 0, db: -100, thrOn: 0, thrOff: 0, frames: 0, ignored: 0 };
    const emit = (n, d) => { try { ev && ev(n, d || {}); } catch (e) { if (typeof console !== 'undefined') console.error(e); } };
    S.reset = (t) => { S.state = 'idle'; S.quietSince = t; S.lastKid = t; S.prompted = false; S.partialText = ''; S.partialIntent = null; S.partialHits = 0; };
    S.frame = (t, rms, botBusy) => {
      const dt = S.lastFrame ? Math.min(200, t - S.lastFrame) : 20; S.lastFrame = t; S.t = t; S.frames++;
      const db = 20 * Math.log10(Math.max(1e-6, rms)); S.db = db;
      // noise floor: calibrate on the first ~400 ms, then minimum-tracking (fast down, ~3 dB/s up, in every state) so a TV or fan
      // becomes "room" instead of an endless turn, while the dips between a child's words keep it low during real speech
      if (S.cal < 400) { S.floor = S.cal === 0 ? db : Math.min(S.floor + (db - S.floor) * .3, Math.max(S.floor, db)); S.cal += dt; if (S.cal >= 400) S.floor = Math.min(S.floor, -30); }
      else if (db < S.floor) S.floor += (db - S.floor) * Math.min(1, .25 * dt / 21);
      else S.floor = Math.min(db, S.floor + .003 * dt);
      S.thrOn = Math.max(o.absMin, S.floor + o.onDb); S.thrOff = Math.max(o.absMin - 5, S.floor + o.offDb);
      if (S.state === 'asleep' || S.state === 'off') return;
      if (botBusy) {                                 // Bolt is making sound: never listen to him
        if (S.state === 'speech') { S.state = 'idle'; emit('cancel', { why: 'bot' }); }
        S.botEnd = t; S.ignored++; S.quietSince = t; return;
      }
      if (t - S.botEnd < o.tail) { S.ignored++; S.quietSince = t; return; }
      if (S.state === 'wait') return;                // endpoint fired, waiting for the answer to start
      const loud = db > S.thrOn, voice = db > S.thrOff;
      if (S.state === 'idle') {
        if (!loud || S.cal < 400) {
          if (!S.prompted && t - S.quietSince > o.promptAfter) { S.prompted = true; emit('prompt', { t }); }
          if (t - (S.lastKid || 0) > o.sleepAfter && t - S.quietSince > 6000) { S.state = 'asleep'; emit('sleep', { t }); }   // ~20 s after Alex last spoke (and never right after Bolt asked something)
          return;
        }
        S.state = 'speech'; S.lastKid = t; S.onsetT = t - dt; S.lastVoice = t; S.voiced = dt; S.partialText = ''; S.partialIntent = null; S.partialHits = 0;
        emit('onset', { t, db, floor: S.floor }); return;
      }
      if (S.state === 'speech') {
        if (voice) { S.lastVoice = t; S.voiced += dt; }
        const hang = (S.partialIntent && S.partialHits >= 2) ? o.fastHang : o.hang;
        const long = t - S.onsetT > o.maxTurn;
        if (t - S.lastVoice >= hang || long) {
          if (S.voiced < o.minSpeech && !S.partialText) { S.state = 'idle'; S.quietSince = t; emit('cancel', { why: 'short', voiced: S.voiced }); return; }
          S.state = 'wait';
          emit('endpoint', { t, lastVoice: S.lastVoice, onset: S.onsetT, voiced: S.voiced, hang, long, partial: S.partialText, partialIntent: S.partialIntent });
        }
      }
    };
    // vosk partials: also count as speech (catches soft voices the energy gate missed) and enable the fast endpoint
    S.partial = (t, text, intent) => {
      if (!text || S.state === 'asleep' || S.state === 'off' || S.state === 'wait') return;
      if (S.state === 'idle' && t - S.botEnd >= o.tail) { S.state = 'speech'; S.onsetT = t; S.lastVoice = t; S.voiced = o.minSpeech; emit('onset', { t, via: 'partial' }); }
      if (S.state !== 'speech') return;
      if (text !== S.partialText) S.lastVoice = Math.max(S.lastVoice, t - 60);
      if (intent && intent === S.partialIntent) S.partialHits++; else { S.partialIntent = intent || null; S.partialHits = intent ? 1 : 0; }
      S.partialText = text;
    };
    S.answered = (t) => { if (S.state === 'wait') { S.state = 'idle'; S.quietSince = t; S.lastKid = t; S.prompted = false; } };
    S.sleep = () => { S.state = 'asleep'; };
    S.wake = (t) => { S.reset(t); S.botEnd = t; };
    return S;
  }
  const exp = { TurnEngine, TURN_DEFAULTS: DEF };
  if (typeof module !== 'undefined' && module.exports) module.exports = exp; else Object.assign(root, exp);
})(typeof window !== 'undefined' ? window : globalThis);
