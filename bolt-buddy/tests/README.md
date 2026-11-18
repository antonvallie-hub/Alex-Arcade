# Bolt Buddy tests (not part of the game; excluded from the offline cache)
- `node tests/test_brain.js` - intent matching on toddler-style phrases (`toddler_phrases.json`) + always-respond/expectation checks.
- `node tests/test_turn.js` - hands-free turn engine: onset, toddler endpointing, clicks, Bolt-never-hears-himself, noise floor, sleep.
- `python3 tests/kid_audio_eval.py WAVDIR OUT.json` (env WARP=0.85) - synthetic toddler audio -> vosk grammar mode -> intents.
Browser end-to-end (simulated mic, latency, screenshots, demo video) lives in the build workspace: bolt-buddy/alive/e2e.py.
