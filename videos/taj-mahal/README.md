# ताज महल के टेढ़े मीनार

An ~86 s vertical Hindi 3D cartoon short (1080x1920, 30 fps) made with the `cartoon-3d-short` skill: three.js +
@react-three/fiber inside Remotion. Bean-head characters (Shah Jahan, Mumtaz, Aurangzeb, workers, a father and
his kid) are Canvas2D cards in a 3D world; elephants and camels are side-view cards.

The rendered film is not in git (too big). Rebuild it:

```bash
npm ci
bash tools/voice.sh          # (optional) rebuild voice + score from voice/raw_tts.mp3, see SCRIPT.md
cp voice/mix_final.wav audio/mix.wav   # or any final mix
bash tools/render_chunks.sh  # renders chunks of 330 frames to out/chunks/ (skips finished ones)
bash tools/finalize.sh       # joins chunks + audio -> out/final.mp4, then QA
```

- Stills for look checks: `node tools/stills.mjs out/x_ 121,1475,2141 0.5`
- Speed: ~1.8 s per frame on 4 CPU cores without a GPU (software GL), ~75 min for the film.

| File | What it holds |
| --- | --- |
| `SCRIPT.md` | Facts with sources, the narration, beats, voice + score notes |
| `src/taj/story.ts` | Line/word timings, sets, the 24 camera shots, build progress, minaret lean, quake, props timing |
| `src/taj/world.ts` | The Taj (facades, dome, minarets), garden, river, Agra Fort, Burhanpur room, quarry, courtyard, fort door, crypt, cards |
| `src/taj/chars.ts` | Cast outfits, elephant, camel, lying figures, the plan sheet, pietra dura, jali |
| `src/taj/toon.ts` | Bean-head character drawing (with turban, beard, veil, both-hands-up added) |
| `src/taj/Film.tsx` | Post (ink, bloom, tone map, grade), the flash after the hook, dips and fades. No captions |
