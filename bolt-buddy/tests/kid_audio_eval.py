# Audio-level toddler test: synthetic toddler WAVs (kid_gen.py) -> vosk small model in GRAMMAR mode (same phrase list the game
# builds with brain.grammarPhrases) -> brain.classify (node). Reports intent match rate and how often Bolt would answer at all.
# usage: python3 kid_audio_eval.py WAVDIR OUTJSON
import sys, os, re, json, subprocess, numpy as np, soundfile as sf
from vosk import Model, KaldiRecognizer, SetLogLevel
SetLogLevel(-1)
HERE = os.path.dirname(os.path.abspath(__file__))
WAV, OUT = sys.argv[1], sys.argv[2]
MODEL = os.environ.get('VOSK_MODEL', '/workspace/work/bolt-buddy/vosk-model-small-en-us-0.15')
P = json.load(open(os.path.join(HERE, 'toddler_phrases.json')))
gram = json.loads(subprocess.check_output(['node', '-e', f"process.stdout.write(JSON.stringify(require('{HERE}/../js/brain.js').grammarPhrases('alex','bolt')))"]))
m = Model(MODEL)
WARP = float(os.environ.get('WARP', '1'))  # vocal-tract warp: tell vosk the sample rate is WARP x the real one (WARP<1) -> it upsamples, so child formants/pitch slide down into the adult range
rec = KaldiRecognizer(m, 16000, json.dumps(gram))
from fractions import Fraction
from scipy.signal import resample_poly
FR = Fraction(WARP).limit_denominator(40)
slug = lambda t: re.sub('[^a-z]+', '_', t.lower()).strip('_')
rows = []
for t, exp in P:
    for v in os.environ.get('VOICES', 'kA,kB,kC').split(','):
        f = f'{WAV}/{slug(t)}__{v}.wav'
        if not os.path.exists(f): continue
        y, sr = sf.read(f, dtype='int16')
        if WARP != 1: y = np.clip(resample_poly(y.astype(np.float64), FR.denominator, FR.numerator), -32768, 32767).astype(np.int16)  # same as the game's claimed-rate trick
        texts = []
        for i in range(0, len(y), 4000):
            if rec.AcceptWaveform(y[i:i + 4000].tobytes()): texts.append(json.loads(rec.Result())['text'])
        texts.append(json.loads(rec.FinalResult())['text'])
        rows.append({'phrase': t, 'exp': exp, 'voice': v, 'heard': ' '.join(x for x in texts if x).strip()})
js = "const B=require('%s/../js/brain.js');const R=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(R.map(r=>{const c=B.classify(r.heard,{kid:'alex',bot:'bolt'});return c.intent?c.intent+(c.slot?':'+c.slot:''):'none';})))" % HERE
got = json.loads(subprocess.run(['node', '-e', js], input=json.dumps(rows), capture_output=True, text=True, check=True).stdout)
ok = 0; ans = 0
for r, g in zip(rows, got):
    r['got'] = g; r['ok'] = g == r['exp'] or {g, r['exp']} == {'kid', 'my_name'}; ok += r['ok']; ans += g != 'none'
n = len(rows)
summary = {'warp': WARP, 'utterances': n, 'intent_ok': ok, 'match_rate': round(ok / n, 3), 'heard_something_rate': round(ans / n, 3)}
by = {}
for r in rows: by.setdefault(r['phrase'], []).append(r['ok'])
summary['phrases_all3_ok'] = sum(all(v) for v in by.values()); summary['phrases'] = len(by)
json.dump({'summary': summary, 'rows': rows}, open(OUT, 'w'), indent=1)
print(json.dumps(summary))
for r in rows:
    if not r['ok']: print('MISS', r['voice'], repr(r['phrase']), '->', repr(r['heard']), r['got'], '(want', r['exp'] + ')')
