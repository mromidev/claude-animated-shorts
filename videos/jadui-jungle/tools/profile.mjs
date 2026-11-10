import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import path from "path";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.CHROME_PATH || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const cases = JSON.parse(process.argv[2]);
for (const [name, post] of Object.entries(cases)) {
  const inputProps = { post };
  const composition = await selectComposition({ serveUrl, id: "JaduiJungle", browserExecutable, chromiumOptions, inputProps });
  const t0 = Date.now();
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: `out/prof_${name}.mp4`, browserExecutable, chromiumOptions, inputProps, frameRange: [1150, 1189], concurrency: Number(process.env.CONC || 1) });
  console.log(name, ((Date.now() - t0) / 40000).toFixed(2) + " s/frame");
}
