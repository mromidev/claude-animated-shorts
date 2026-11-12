// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]  (bundles once, GPU via ANGLE, jpeg)
// BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
import fs from "node:fs";
// Remotion bundles fill the temp folder (~1.3 GB each): set REMOTION_TMP to a folder on a big drive.
// Windows reads TEMP/TMP, macOS/Linux read TMPDIR, so set all three.
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
// Browser: REMOTION_BROWSER if set; else the installed Chrome on Windows (as before); else null = Remotion's own
// Chrome Headless Shell (downloaded on first run), which is what macOS/Linux need.
const WIN_CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browserExecutable = process.env.REMOTION_BROWSER || (process.platform === "win32" && fs.existsSync(WIN_CHROME) ? WIN_CHROME : null);
// BRIDGE_COMP=<CompositionId> renders a renamed short (SKILL.md step 4 registers a new composition); default BridgeShort.
const compId = process.env.BRIDGE_COMP || "BridgeShort";
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: compId, browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
