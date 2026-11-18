// node bolt-buddy/tests/test_turn.js -> VAD / turn-taking state machine checks (synthetic frames, 21.3 ms like a 1024-sample callback at 48 kHz)
const path = require('path');
const { TurnEngine } = require(path.join(__dirname, '../js/turn.js'));
const F = 1024 / 48000 * 1000;
const rmsOf = db => Math.pow(10, db / 20);
function run(script, opts) {
  // script: list of [ms, db, botBusy, partial?]
  const evs = []; let t = 1000;
  const E = TurnEngine(opts, (n, d) => evs.push([n, Math.round(t), d]));
  for (const [ms, db, bot, part] of script) {
    const end = t + ms;
    while (t < end) { t += F; E.frame(t, rmsOf(db + (Math.random() - .5) * 2), !!bot); if (part) E.partial(t, part[0], part[1]); }
  }
  return { evs, E, t };
}
const R = []; const ok = (name, v, info) => { R.push([name, !!v]); console.log((v ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
// 1. quiet room, then "hi" (250 ms) then silence -> one onset, one endpoint ~600 ms after the voice stops
{
  const { evs } = run([[1500, -65], [250, -30], [1200, -65]]);
  const on = evs.find(e => e[0] === 'onset'), ep = evs.find(e => e[0] === 'endpoint');
  ok('short "hi" gives onset + endpoint', on && ep);
  ok('onset within two frames (~43 ms) of voice start', on && on[1] - 2500 <= 2 * F + 1, on && ('onset at +' + (on[1] - 2500).toFixed(0) + ' ms'));
  const lag = ep && ep[1] - ep[2].lastVoice; ok('endpoint ~hang after last voiced frame', ep && lag >= 590 && lag <= 640, 'lag ' + (lag | 0) + ' ms');
}
// 2. click / bump (one 20 ms frame) -> cancel, no endpoint
{ const { evs } = run([[1500, -65], [F, -25], [1200, -65]]); ok('20 ms click is not a turn', evs.some(e => e[0] === 'cancel') && !evs.some(e => e[0] === 'endpoint')); }
// 3. Bolt talking loudly into the mic -> nothing (never hears himself), including the echo tail
{ const { evs } = run([[1000, -65], [1800, -20, true], [200, -35], [1000, -65]]); ok('loud audio while Bolt speaks + 200 ms echo tail ignored', !evs.some(e => e[0] === 'onset')); }
// 4. Alex talks right after Bolt (after the tail) -> heard
{ const { evs } = run([[1000, -65], [1500, -20, true], [400, -65], [400, -30], [900, -65]]); ok('speech after Bolt finishes is heard', evs.some(e => e[0] === 'endpoint')); }
// 5. toddler pauses mid-sentence for 400 ms -> still one turn
{ const { evs } = run([[1000, -65], [500, -30], [400, -65], [600, -30], [1000, -65]]); ok('400 ms pause does not split the turn', evs.filter(e => e[0] === 'endpoint').length === 1); }
// 6. a confident partial (same intent twice) -> fast endpoint (~450 ms)
{
  const { evs } = run([[1000, -65], [300, -30, false, ['dance', 'dance']], [900, -65]]);
  const ep = evs.find(e => e[0] === 'endpoint'); const lag = ep && ep[1] - ep[2].lastVoice;
  ok('stable partial intent -> fast endpoint', ep && lag < 520, 'lag ' + (lag | 0) + ' ms');
}
// 7. steady background noise (TV hum at -45 dB) -> floor adapts, no endless turns; speech above it still detected
{
  const { evs, E } = run([[4000, -45], [400, -22], [1000, -45]]);
  ok('floor adapts to steady noise', E.floor > -50, 'floor ' + E.floor.toFixed(1) + ' dB');
  ok('speech over noise still makes one turn', evs.filter(e => e[0] === 'endpoint').length === 1);
}
// 8. silence -> one prompt at ~9 s, sleep at ~20 s
{ const { evs } = run([[21000, -65]]); ok('prompt then sleep on long silence', evs.filter(e => e[0] === 'prompt').length === 1 && evs.some(e => e[0] === 'sleep')); }
// 9. endless talking (TV) -> forced endpoint at maxTurn
{ const { evs } = run([[1000, -65], [8000, -30], [500, -65]]); const ep = evs.find(e => e[0] === 'endpoint'); ok('long speech is cut at maxTurn', ep && ep[2].long); }
// 10. after endpoint the engine waits (no new turn) until answered
{
  const evs = []; let t = 0; const E = TurnEngine({}, (n) => evs.push(n));
  for (let i = 0; i < 60; i++) { t += F; E.frame(t, rmsOf(-65), false); }
  for (let i = 0; i < 15; i++) { t += F; E.frame(t, rmsOf(-30), false); }
  for (let i = 0; i < 40; i++) { t += F; E.frame(t, rmsOf(-65), false); }
  for (let i = 0; i < 15; i++) { t += F; E.frame(t, rmsOf(-30), false); }
  ok('no second turn while waiting for the answer', evs.filter(n => n === 'onset').length === 1 && E.state === 'wait');
}
const fail = R.filter(r => !r[1]).length; console.log(`turn engine: ${R.length - fail}/${R.length} passed`);
require('fs').writeFileSync(path.join(process.env.OUT || __dirname, 'turn_result.json'), JSON.stringify(R));
process.exit(fail ? 1 : 0);
