// node tools/stills.mjs <outprefix> <frames comma list> [scale]
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import path from "path";
const [prefix, list, scale = "0.5"] = process.argv.slice(2);
const serveUrl = process.env.BUNDLE || await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.CHROME_PATH || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const inputProps = JSON.parse(process.env.PROPS || "{}");
const composition = await selectComposition({ serveUrl, id: "JaduiJungle", inputProps, browserExecutable, chromiumOptions: { gl: "swangle" } });
for (const fr of list.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame: fr, output: `${prefix}${String(fr).padStart(4, "0")}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale), inputProps, browserExecutable, chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 120000, onBrowserLog: (l) => { if (l.type === "error" || l.type === "warning") console.log("LOG", l.type, l.text.slice(0, 300)); } });
  console.log(fr, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
