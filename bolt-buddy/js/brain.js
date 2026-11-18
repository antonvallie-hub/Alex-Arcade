'use strict';
// Bolt Buddy v2 - understanding a toddler. Pure functions (no DOM), shared by the game and the node tests.
// classify(text, ctx) -> { intent, slot, score, tier, phrase, words }
//   intent: one of INTENTS keys, or 'color' | 'animal' | 'food' | 'thing' (with slot), or null (nothing usable heard)
//   tier: 'exact' | 'key' (toddler-normalised spelling) | 'fuzzy' (one sound off) ; ctx: { kid, bot, expect }
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./intents.js') : root;
  const { INTENTS, COLOR, ANIMAL, FOOD, THING, GAME, NEAR, NOGRAM } = D;
  const SLOT_P = { color: 6, animal: 6, food: 5.2, thing: 4.2, game: 1.5 }; // game words only matter when Bolt just offered games (expect boost)
  const FUNC = new Set(['a', 'an', 'the', 'i', 'you', 'me', 'my', 'is', 'it', 'to', 'and', 'uh', 'um', 'oh', 'so', 'do', 'of', 'he', 'she', 'we', 'can', 'be', 'are', 'am', 'with', 'in', 'on', 'at', 'for', 'your', 'its', 'im', 'up', 'go', 'see', 'there', 'have', 'has', 'was', 'will', 'get', 'got']);
  const STOP = new Set([...FUNC, 'want', 'wanna', 'like', 'that', 'this', 'too', 'some']);
  function normText(t) {
    return (' ' + String(t || '').toLowerCase().replace(/\[unk\]/g, ' ').replace(/[’']/g, '').replace(/[^a-z ]+/g, ' ') + ' ').replace(/\s+/g, ' ').trim();
  }
  // toddler-normalised sound key: th->f, r/l->w (wabbit, wobot, pway), s-cluster reduction (seepy, nake), final silent e,
  // y/ie/ey -> i, vowel groups -> a|i|o class, doubled letters collapsed. "hungwy"=="hungry", "fank"=="thank", "bowt"=="bolt", "dans"=="dance".
  const KC = {};
  function tkey(w) {
    if (KC[w]) return KC[w];
    let k = String(w).toLowerCase().replace(/[^a-z]/g, '');
    k = k.replace(/ph/g, 'f').replace(/th/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/x/g, 'ks').replace(/gh/g, '')
      .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k');
    k = k.replace(/(ey|ie|y)$/, 'i');
    k = k.replace(/[rl]/g, 'w');
    k = k.replace(/^s(w)/, 's').replace(/^s([ptkmn])/, '$1');
    if (k.length > 3) k = k.replace(/e$/, '');
    k = k.replace(/^y/, 'Y').replace(/[aeiouy]+/g, m => /^[eiy]/.test(m) ? 'i' : /^[ou]/.test(m) ? 'o' : 'a').replace(/Y/g, 'y').replace(/(.)\1+/g, '$1');
    return KC[w] = k;
  }
  function lev(a, b) {
    if (a === b) return 0; const m = a.length, n = b.length; if (Math.abs(m - n) > 1) return 2;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  let LEX = null, LEXSIG = '';
  function buildLex(kid, bot) {
    const sig = kid + '|' + bot; if (LEX && LEXSIG === sig) return LEX;
    const L = [];
    const add = (intent, slot, phrase, p) => { const toks = normText(phrase).split(' ').filter(Boolean); if (!toks.length) return; L.push({ intent, slot, phrase: toks.join(' '), toks, keys: toks.map(tkey), p }); };
    for (const k in INTENTS) for (const ph of INTENTS[k].ph) Array.isArray(ph) ? add(k, null, ph[0], ph[1]) : add(k, null, ph, INTENTS[k].p);
    const slots = { color: COLOR, animal: ANIMAL, food: FOOD, thing: THING, game: GAME };
    for (const t in slots) for (const s in slots[t]) for (const ph of slots[t][s]) add(t, s, ph, SLOT_P[t]);
    if (kid && /^[a-z]+$/.test(kid)) add('kid', null, kid, INTENTS.kid.p);
    if (bot && /^[a-z]+$/.test(bot)) add('bolt', null, bot, INTENTS.bolt.p);
    LEXSIG = sig; return LEX = L;
  }
  // every phrase vosk should listen for (grammar mode); [unk] soaks up everything else
  function grammarPhrases(kid, bot) {
    const s = new Set(), skip = new Set(NOGRAM || []); for (const e of buildLex(kid, bot)) if (!skip.has(e.phrase)) s.add(e.phrase);
    for (const n in NEAR) s.add(n);
    return [...s].sort().concat(['[unk]']);
  }
  const TIER = { exact: 3, key: 2, fuzzy: 1 }; // per matched word: exact beats toddler-spelling match beats one-sound-off guess; more matched words win
  // a phrase matches word by word: exact (3 pts), toddler-spelling key (2), one sound off (1). Little function words
  // ("me", "be", "you") only ever match exactly and count half, and a multi-word phrase needs at least one real content
  // word that is exact or key-matched - so "dog me" is a doggy, not "hug me", and "wanna be" is never "bye".
  function matchAt(e, T, K, i) {
    let tier = 'exact', pts = 0, solid = 0;
    for (let j = 0; j < e.toks.length; j++) {
      const t = T[i + j], k = K[i + j]; if (t === undefined) return null;
      const stop = FUNC.has(e.toks[j]);
      if (t === e.toks[j]) { pts += stop ? 1.5 : 3; if (!stop) solid++; continue; }
      if (stop || FUNC.has(t)) return null;
      if (k === e.keys[j]) { if (tier === 'exact') tier = 'key'; pts += 2; solid++; continue; }
      const v = e.keys[j];
      if (!STOP.has(t) && ((k.length >= 3 && v.length >= 3 && lev(k, v) <= 1) || (k.length >= 2 && v.length === k.length + 1 && v.startsWith(k) && /[tdkpgs]$/.test(v)))) { tier = 'fuzzy'; pts += 1; continue; } // one sound off / dropped last sound
      return null;
    }
    const content = e.toks.filter(w => !FUNC.has(w)).length;
    if (e.toks.length > 1 && content && !solid) pts = e.toks.length - e.toks.filter(w => FUNC.has(w)).length;  // only guessed sounds: little words don't count
    return [tier, pts];
  }
  function classify(text, ctx) {
    ctx = ctx || {};
    const kid = String(ctx.kid || 'alex').trim().toLowerCase(), bot = String(ctx.bot || 'bolt').trim().toLowerCase();
    const L = buildLex(kid, bot);
    let T = normText(text).split(' ').filter(Boolean).map(w => NEAR[w] || w);
    T = T.join(' ').split(' ').filter(Boolean);
    const K = T.map(tkey);
    const words = T.filter(w => !STOP.has(w));
    const out = { intent: null, slot: null, score: 0, tier: null, phrase: '', words, text: T.join(' '), all: [] };
    if (!T.length) return out;
    const hasKid = T.some((w, i) => w === kid || (K[i] === tkey(kid)));
    const ex = ctx.expect || null;
    for (const e of L) {
      for (let i = 0; i + e.toks.length <= T.length; i++) {
        const mt = matchAt(e, T, K, i); if (!mt) continue; const tier = mt[0];
        if (e.intent === 'my_name' && !hasKid) continue;
        if (e.toks.length === 1 && e.toks[0].length <= 2 && tier !== 'exact') continue; // never guess tiny words
        let sc = mt[1] * 100 + e.p * 10 + e.phrase.length * .03;
        if (ex) {
          if (ex.choices && ex.choices.some(c => c.intent === e.intent && (!c.slot || c.slot === e.slot))) sc += 25;
          if (ex.yn && (e.intent === 'yes' || e.intent === 'no')) sc += 40;
        }
        out.all.push([e.intent + (e.slot ? ':' + e.slot : ''), +sc.toFixed(2), tier]);
        if (sc > out.score) { out.score = sc; out.intent = e.intent; out.slot = e.slot; out.tier = tier; out.phrase = e.phrase; }
      }
    }
    if (out.intent === 'my_name' || (out.intent === 'kid' && /\b(my name|i am|im)\b/.test(out.text))) out.intent = 'my_name';
    out.all.sort((a, b) => b[1] - a[1]); out.all = out.all.slice(0, 5);
    return out;
  }
  const exp = { classify, tkey, normText, grammarPhrases, buildLex, lev };
  if (typeof module !== 'undefined' && module.exports) module.exports = exp; else root.BRAIN = exp;
})(typeof window !== 'undefined' ? window : globalThis);
