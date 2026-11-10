# जादुई जंगल का रहस्य – एक छोटी सी दोस्ती

An 88-second Hindi 3D cartoon short (1920x1080, 30 fps) made with the `cartoon-3d-short` skill.
three.js + @react-three/fiber inside Remotion. Chintu, Sheru, the magic tree and the other characters are
2D Canvas cards in a 3D forest.

The rendered film isn't in git because it's too big (~245 MB). Rebuild it with the steps below.

## Rebuild

```bash
npm install
pip install numpy scipy soundfile espeakng_loader

python3 tools/make_voice.py      # Hindi voice -> voice/voice.wav, voice/lines.json, src/lines.ts (subtitle timings)
python3 tools/audio.py           # music + SFX + voice mix -> audio/mix.wav
bash tools/render_chunks.sh      # renders 8 chunks to out/chunks/ (skips ones already done)
bash tools/finalize.sh           # joins chunks, adds audio -> out/final.mp4, then runs QA
```

- `CHROME_PATH` sets the Chromium / headless-shell binary. The default is the Playwright one in `/opt/pw-browsers`.
- Speed: about 3.5 s per frame on 4 CPU cores with no GPU (software GL), so about 2.5 h for the whole film.
- Stills for checking the look: `node tools/stills.mjs out/x_ 300,1200,2000 0.5`.

## Files

| File | What it holds |
| --- | --- |
| `SCRIPT.md` | Scene table |
| `tools/make_voice.py` | Lines, speakers, start times, voice settings |
| `src/jungle/story.ts` | Layout, timing, acting, the 18 camera shots |
| `src/jungle/world.ts` | Sky, ground, trees, river, magic tree, flowers, posing every frame |
| `src/jungle/chars.ts` | How Chintu, Sheru, the tree face, the bird and the animals are drawn |
| `src/jungle/Film.tsx` | Post effects (ink, bloom, grade), title, subtitles, moral, end card |
| `tools/audio.py` | Synthesized score, sound effects, ducking, loudness |

## Replacing the voice

The voice is espeak-ng, which sounds robotic; no neural Hindi voice could be installed where this was built. To use a
real recording:
1. Put one wav per line in the order of `LINES` in `tools/make_voice.py`.
2. Change it to load those wavs instead of calling `synth()`.
3. Fix each line's word times (they drive the subtitle highlight and mouth movement).
4. Rerun `audio.py`, the render and `finalize.sh`.

If a line gets longer, move the following start times so lines don't overlap.
