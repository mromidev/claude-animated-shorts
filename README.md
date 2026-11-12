# Claude Animated Shorts

The free Claude skill from the video **"How to Make Viral Animated Shorts Using Claude (Full Workflow)"**.

It makes 55-70 s vertical animated story shorts: 2D characters in a colourful 3D world, with ink outlines, a painted town, lens blur, gliding cameras, a march score and sound effects. Everything is rendered with three.js inside Remotion on your own PC, with no AI video generator.

Proven on **The Bridge That Fell for a Song**, a 67 s short about the 1831 Broughton bridge.

## What's inside
| Path | What it is |
|---|---|
| `SKILL.md` | The skill: the full pipeline, every rule, every fix, and the final look values |
| `templates/bridge/` | The full source of the bridge short: world, characters, ink, lens blur, grade, story/camera |
| `templates/audio/` | The synthesized sound: SFX, march music, the mix with ducking and loudness |
| `templates/scripts/` | Stills, side-by-side sheets, shot merge and frame-by-frame QA helpers |
| `references/STYLE_BIBLE.md` | The script and visual formula measured from 20 reference shorts |
| `references/reports/` | Seven measured reports: motion, depth, textures, characters, lighting, outlines, grade |
| `references/frames/` | 38 full-size reference frames (540x960) to compare your frames against |
| `references/sheets/` | 20 contact sheets, one per reference short, 60 frames each (1,200 frames) |

## Install
1. Copy this folder to `~/.claude/skills/cartoon-3d-short/` (clone it there, or download the ZIP).
2. You need [Remotion](https://www.remotion.dev/) with `@remotion/three`, plus Node, Python 3 and ffmpeg.
3. In Claude Code, say: *"Use the cartoon short skill and make a short about …"*.

### Remotion project setup (fresh install)
The templates go into a Remotion project of your own (`src/videos/bridge/`, `scripts/`, `public/bridge/kenney/`). A set of versions that renders the bridge short correctly:

```bash
npm i remotion@4.0.541 @remotion/cli@4.0.541 @remotion/three@4.0.541 @remotion/bundler@4.0.541 @remotion/renderer@4.0.541 \
  react@19.2.9 react-dom@19.2.9 three@0.187.0 @react-three/fiber@9.8.2 postprocessing@6.39.6 \
  @react-three/postprocessing@3.0.4
pip install numpy scipy pillow   # audio/ and scripts/ helpers
```

- **Keep `@react-three/postprocessing` at 3.0.4.** From 3.0.5 on, `EffectComposer` builds its composer inside an effect. Remotion advances each frame once, before that composer exists, so every frame renders as an empty canvas: just the `#cfe3f2` background, with no error. Before you upgrade, check that a still is not one flat colour.
- `three` must stay below 0.188 (the `postprocessing@6.39` peer range), and `react` below 19.4 (the `@react-three/fiber@9` peer range).
- **Props:** `world.ts` loads 26 Kenney CC0 models from `public/bridge/kenney/<name>.glb`. A missing model is skipped silently, so the trees and stalls just disappear.
  - From the [Nature Kit](https://kenney.nl/assets/nature-kit) (`Models/GLTF format/`): `tree_oak tree_default tree_detailed tree_fat tree_cone plant_bushLarge plant_bushDetailed plant_bush flower_redA flower_yellowA flower_purpleA grass_large grass lily_large canoe`
  - From the [Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) (`Models/GLB format/`): `tree-high-round tree hedge lantern cart stall-red stall-green stall-bench banner-red banner-green windmill`, plus `Textures/colormap.png` copied to `public/bridge/kenney/Textures/`, because these models reference that texture.
- **macOS / Linux:** `scripts/bridge-stills.mjs` uses Remotion's own Chrome Headless Shell unless you set `REMOTION_BROWSER`. Set `BRIDGE_COMP=<CompositionId>` once you rename the composition.

Claude then follows `SKILL.md`: topic and facts, then script, then voice, then the shot plan in `story.ts`, then stills, then renders. Agents check your frames against the reports and the frames, and you get the final 2K render and sound mix.

## Notes
- Set `REMOTION_TMP` to a folder on a big drive. Every Remotion bundle copies `public/` (~1.3 GB) into the temp folder.
- Story, characters and voice should always be your own. Use the references for the look, not the content.

## License
The code and docs are MIT (see `LICENSE`). The reference frames are included for style study only.
