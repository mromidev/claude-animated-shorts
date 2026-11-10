// node tools/render.mjs out.mp4 [from-to] [concurrency]
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import path from "path";
const [out, range, conc = "2"] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.CHROME_PATH || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const composition = await selectComposition({ serveUrl, id: "TajMahal", browserExecutable, chromiumOptions });
const frameRange = range && range !== "all" ? range.split("-").map(Number) : null;
const t0 = Date.now(); let last = 0;
await renderMedia({ serveUrl, composition, codec: "h264", crf: 17, outputLocation: out, browserExecutable, chromiumOptions, concurrency: Number(conc), frameRange, scale: Number(process.env.SCALE || 1), timeoutInMilliseconds: 180000,
  onProgress: ({ renderedFrames }) => { if (renderedFrames - last >= 30) { last = renderedFrames; console.log(`${renderedFrames} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`); } } });
console.log("done", ((Date.now() - t0) / 1000).toFixed(0) + "s");
