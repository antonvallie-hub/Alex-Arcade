// node bolt-buddy/tests/test_brain.js  -> intent match rate on toddler-style phrases + always-respond checks
const path = require('path');
const B = require(path.join(__dirname, '../js/brain.js'));
const P = require(path.join(__dirname, 'toddler_phrases.json'));
let ok = 0; const bad = [];
for (const [t, exp] of P) {
  const r = B.classify(t, { kid: 'alex', bot: 'bolt' });
  const got = r.intent ? r.intent + (r.slot ? ':' + r.slot : '') : 'none';
  const pass = got === exp || (exp === 'kid' && got === 'my_name') || (exp === 'my_name' && got === 'kid');
  if (pass) ok++; else bad.push([t, exp, got, r.tier]);
}
const rate = ok / P.length;
console.log(`toddler text phrases: ${ok}/${P.length} = ${(rate * 100).toFixed(1)}%`);
for (const b of bad) console.log('  MISS', JSON.stringify(b));
// expectation: two-choice answers win over generic words
const q = B.classify('bwue', { expect: { choices: [{ intent: 'color', slot: 'red' }, { intent: 'color', slot: 'blue' }] } });
const yn = B.classify('yeah dans', { expect: { yn: true } });
const fe = B.classify('i sad doggy', {});
const checks = [['choice blue', q.intent === 'color' && q.slot === 'blue'], ['yes/no expected wins', yn.intent === 'yes'], ['feelings beat everything', fe.intent === 'sad'],
  ['empty -> null intent', B.classify('', {}).intent === null], ['[unk] only -> null', B.classify('[unk] [unk]', {}).intent === null],
  ['custom kid name', B.classify('my name is sam', { kid: 'sam' }).intent === 'my_name']];
let fail = 0; for (const [n, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + n); if (!v) fail++; }
const json = { total: P.length, ok, rate: +rate.toFixed(3), misses: bad };
require('fs').writeFileSync(path.join(process.env.OUT || __dirname, 'brain_result.json'), JSON.stringify(json, null, 1));
if (rate < .9 || fail) process.exit(1);
