/* AAAMusic v1 (+rate() for the final-stretch speed-up in Turbo Toy Racers): plays Alex's AAA soundtrack files (separate mp3s beside the game) with WebAudio.
   - lazy: a file is fetched + decoded only when first asked for (or preloaded after the first tap)
   - gapless: one AudioBufferSource per track with loop=true + loopStart/loopEnd, so the intro plays once
     and the loop section repeats sample-accurately (files are built by /workspace/work/music-aaa/ship.py)
   - crossfades between tracks; keeps playing the old track until the new one is decoded
   - duck(on) / duckFor(s) for voice lines, hold(on) for pause menus
   API: var A = AAAMusic.create(audioCtx, destNode, {base, vol, tracks:{name:{url | b64, loopStart, loopEnd}}});
        A.play(name,{fade}) A.stop(fade) A.preload(name) A.want() A.duck(on) A.duckFor(s) A.hold(on) */
var AAAMusic = (function () {
  "use strict";
  function create(ac, dest, opt) {
    opt = opt || {};
    var tracks = opt.tracks || {}, base = opt.base || "";
    var out = ac.createGain(), duckG = ac.createGain(), holdG = ac.createGain();
    out.gain.value = opt.vol == null ? 1 : opt.vol;
    out.connect(duckG); duckG.connect(holdG); holdG.connect(dest);
    var bufs = {}, loading = {}, want = null, cur = null, dT = null, held = false, rateV = 1;
    var A = {};
    function decode(ab) {
      return new Promise(function (res, rej) {
        try { var p = ac.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
      });
    }
    function load(name) {
      if (bufs[name]) return Promise.resolve(bufs[name]);
      if (loading[name]) return loading[name];
      var t = tracks[name]; if (!t) return Promise.reject(new Error("no track " + name));
      var src = t.b64 ? new Promise(function (res) { var bin = atob(t.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); res(u.buffer); })
        : fetch(base + t.url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); });
      var p = src.then(decode).then(function (b) { bufs[name] = b; delete loading[name]; return b; });
      p.catch(function () { delete loading[name]; });
      loading[name] = p; return p;
    }
    function fadeOut(c, d) {
      var nw = ac.currentTime, g = c.g.gain;
      try { g.cancelScheduledValues(nw); g.setValueAtTime(Math.max(g.value, 0.0001), nw); g.linearRampToValueAtTime(0.0001, nw + d); c.src.stop(nw + d + 0.05); } catch (e) {}
    }
    function start(name, fadeIn) {
      var t = tracks[name], b = bufs[name], nw = ac.currentTime;
      var g = ac.createGain(), s = ac.createBufferSource();
      s.buffer = b; s.playbackRate.value = rateV; s.loop = true; s.loopStart = t.loopStart; s.loopEnd = t.loopEnd;
      g.gain.setValueAtTime(0.0001, nw); g.gain.linearRampToValueAtTime(1, nw + Math.max(0.02, fadeIn));
      s.connect(g); g.connect(out); s.start(nw + 0.01);
      cur = { name: name, src: s, g: g };
    }
    A.preload = function (name) { return load(name).catch(function () {}); };
    A.play = function (name, o) {
      o = o || {};
      if (want === name) return;
      want = name;
      var fade = o.fade == null ? 1.2 : o.fade;
      load(name).then(function () {
        if (want !== name || (cur && cur.name === name)) return;
        var hadOld = !!cur;
        if (cur) { fadeOut(cur, fade); cur = null; }
        start(name, hadOld ? fade : (o.fadeIn == null ? 0.25 : o.fadeIn));
      }).catch(function (e) { if (want === name) want = null; try { console.warn("AAAMusic", name, e); } catch (x) {} });
    };
    A.stop = function (fade) { want = null; if (cur) { fadeOut(cur, fade == null ? 1 : fade); cur = null; } };
    A.rate = function (r) { rateV = r; if (cur) { try { cur.src.playbackRate.setTargetAtTime(r, ac.currentTime, 0.5); } catch (e) {} } };
    A.want = function () { return want; };
    A.playing = function () { return cur ? cur.name : null; };
    A.duck = function (on) { duckG.gain.setTargetAtTime(on ? 0.35 : 1, ac.currentTime, on ? 0.06 : 0.3); };
    A.duckFor = function (s) { A.duck(true); if (dT) clearTimeout(dT); dT = setTimeout(function () { dT = null; A.duck(false); }, Math.max(300, s * 1000)); };
    A.hold = function (on) { on = !!on; if (on === held) return; held = on; holdG.gain.setTargetAtTime(on ? 0.3 : 1, ac.currentTime, 0.15); };
    return A;
  }
  return { create: create };
})();
