# Bolt Buddy tests (not part of the game; excluded from the offline cache)
- `node tests/test_brain.js` - intent matching on toddler-style phrases (`toddler_phrases.json`) + always-respond/expectation checks.
- `node tests/test_turn.js` - hands-free turn engine: onset, toddler endpointing, clicks, Bolt-never-hears-himself, noise floor, sleep.
- `node tests/test_music.js` - music levels per screen/setting, ducking (listen / Alex talking / Bolt speaking), and the real music envelope (`music_env.json`) leaked into the turn engine with no echo cancellation: no false turns, soft speech still heard.
- `python3 tests/kid_audio_eval.py WAVDIR OUT.json` (env WARP=0.85) - synthetic toddler audio -> vosk grammar mode -> intents.
Browser end-to-end (simulated mic, latency, screenshots, demo video) lives in the build workspace: bolt-buddy/alive/e2e.py.
