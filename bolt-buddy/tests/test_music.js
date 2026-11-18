// node bolt-buddy/tests/test_music.js -> music levels + ducking (v2.1) and "music can't fool the VAD" checks.
// Reads the real MUS_LV / MUS_DUCK tables out of js/audio.js and the real loudness envelope of the talk-screen track
// (tests/music_env.json = per-frame RMS of music/bolt-space-aaa.mp3), then plays that music into the turn engine as if the
// tablet speaker were feeding straight into its mic with NO echo cancellation (worst case: 0 dB coupling, master .9).
const fs = require('fs'), path = require('path');
const { TurnEngine } = require(path.join(__dirname, '../js/turn.js'));
const src = fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8');
const grab = n => eval('(' + src.match(new RegExp('const ' + n + ' = (\\{[^;]*\\});'))[1] + ')');
const LV = grab('MUS_LV'), DK = grab('MUS_DUCK');
const ENV = JSON.parse(fs.readFileSync(path.join(__dirname, 'music_env.json'), 'utf8')).db;
const F = 1024 / 48000 * 1000, MASTER = .9, OLD = { base: .55, talkConv: .14, voiceDuck: .35 };
const db = g => 20 * Math.log10(g);
const R = []; const ok = (name, v, info) => { R.push([name, !!v, info || '']); console.log((v ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

// --- levels ---
const low = LV.low, med = LV.medium;
ok('default talk bed (Low) is 12-15 dB below v2.0 talk level', db(low.talk / OLD.talkConv) <= -12 && db(low.talk / OLD.talkConv) >= -15.5, (db(low.talk / OLD.talkConv)).toFixed(1) + ' dB');
ok('mic listening ducks below the bed', DK.listen < DK.bed, 'listen ' + db(DK.listen).toFixed(1) + ' dB re bed');
ok('Alex talking -> music near-silent (>= 20 dB under bed)', db(DK.hear) <= -20, 'hear ' + db(DK.hear).toFixed(1) + ' dB re bed = ' + db(low.talk * DK.hear).toFixed(1) + ' dB bus');
ok('Bolt speaking ducks music under his voice', DK.bolt < DK.bed && DK.bolt > DK.hear, 'bolt ' + db(DK.bolt).toFixed(1) + ' dB re bed');
ok('mini-games lowered moderately (3-8 dB)', db(low.game / OLD.base) <= -3 && db(low.game / OLD.base) >= -8, db(low.game / OLD.base).toFixed(1) + ' dB');
ok('Off is silent everywhere', Object.values(LV.off).every(v => v === 0));
ok('Medium louder than Low but still under v2.0', med.talk > low.talk && med.game > low.game && med.talk < OLD.talkConv && med.game <= OLD.base);

// --- VAD with music leaking into the mic ---
// gainAt(t): music bus gain over time; returns onsets/endpoints from the real TurnEngine
function sim(ms, gainAt, extra) {
  const evs = []; let t = 1000, i = 0; const E = TurnEngine({ promptAfter: 1e9, sleepAfter: 1e9 }, (n, d) => evs.push([n, t]));
  const room = Math.pow(10, -65 / 20);
  while (t < 1000 + ms) {
    t += F; const m = Math.pow(10, ENV[i++ % ENV.length] / 20) * gainAt(t - 1000) * MASTER;
    let rms = Math.sqrt(room * room * (1 + (Math.random() - .5) * .2) + m * m);
    if (extra) { const x = extra(t - 1000); if (x) rms = Math.sqrt(rms * rms + Math.pow(10, x / 20) ** 2); }
    E.frame(t, rms, false);
  }
  return { evs, onsets: evs.filter(e => e[0] === 'onset').length, endpoints: evs.filter(e => e[0] === 'endpoint').length };
}
for (const set of ['low', 'medium']) {
  const r = sim(30000, () => LV[set].talk * DK.listen);
  ok(`${set}: 30 s of music while the mic listens -> no false "Alex is talking"`, r.onsets === 0, r.onsets + ' onsets');
}
// music fading back up after a cancelled turn (hear -> listen, 0.5 s time constant) while the mic listens
{
  const g0 = med.talk * DK.hear, g1 = med.talk * DK.listen;
  const r = sim(8000, t => t < 2000 ? g0 : g1 + (g0 - g1) * Math.exp(-(t - 2000) / 500));
  ok('medium: music returning after Alex stops does not trigger a turn', r.onsets === 0, r.onsets + ' onsets');
}
// even the full talk bed (mic is off then, but check headroom) and Medium bed stay clear
{ const r = sim(30000, () => med.talk * DK.bed); ok('medium bed with no ducking still under the VAD threshold', r.onsets === 0, r.onsets + ' onsets'); }
// Alex speaking softly (-34 dBFS) over the listening bed is still heard as one turn
{ const r = sim(5000, () => low.talk * DK.listen, t => t > 2000 && t < 2500 ? -34 : 0); ok('soft speech over the music bed is still detected', r.onsets === 1 && r.endpoints === 1); }
// reference: soft speech under the v2.0 level - the music lifts the noise floor, so a quiet toddler voice can be missed
{ const r = sim(5000, () => OLD.talkConv, t => t > 2000 && t < 2500 ? -34 : 0); console.log('INFO v2.0 level: soft speech (-34 dBFS) detected = ' + (r.endpoints === 1)); R.push(['ref v2.0 soft speech heard', true, String(r.endpoints === 1)]); }
// reference: the v2.0 level (.14) with the same worst-case leak
{ const r = sim(30000, () => OLD.talkConv); console.log('INFO v2.0 talk level (.14) with the same leak: ' + r.onsets + ' false onsets in 30 s'); R.push(['ref v2.0 false onsets', true, String(r.onsets)]); }

const fail = R.filter(r => !r[1]).length; console.log(`music: ${R.length - fail}/${R.length} passed`);
fs.writeFileSync(path.join(process.env.OUT || __dirname, 'music_result.json'), JSON.stringify(R));
process.exit(fail ? 1 : 0);
