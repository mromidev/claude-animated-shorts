import fs from "node:fs"; import path from "node:path";
const tmp = path.resolve("../.remotion-tmp"); process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const browserExecutable = "/opt/pw-browsers/chromium", chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "MolassesShort", browserExecutable, chromiumOptions });
const [frame, scale] = [Number(process.argv[2] || 420), Number(process.argv[3] || 1.3333)];
const variants = { warm: {}, all: {}, noink: { ink: false }, nolens: { lens: false }, nobloom: { bloom: false }, bare: { ink: false, lens: false, bloom: false, grade: false } };
for (const [k, post] of Object.entries(variants)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame, output: `out/prof_${k}.jpg`, imageFormat: "jpeg", scale, browserExecutable, chromiumOptions, inputProps: { post }, timeoutInMilliseconds: 600000 });
  console.log(k, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
