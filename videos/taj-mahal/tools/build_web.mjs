// Build the self-contained web player: bundle src/web/main.ts (three.js included) and inline it with the narration.
// usage: node tools/build_web.mjs <audio.mp3> <out.html>
import { build } from "esbuild";
import fs from "fs";
const [audioPath, out] = process.argv.slice(2);
const audio = "data:audio/mpeg;base64," + fs.readFileSync(audioPath).toString("base64");
const res = await build({ entryPoints: ["src/web/main.ts"], bundle: true, minify: true, format: "iife", write: false, target: "es2020", define: { AUDIO_URL: JSON.stringify(audio) }, legalComments: "none" });
const js = res.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
const page = fs.readFileSync("src/web/page.html", "utf8").replace("/*__SCRIPT__*/", () => js);
fs.writeFileSync(out, page);
console.log(out, (page.length / 1e6).toFixed(2) + " MB");
