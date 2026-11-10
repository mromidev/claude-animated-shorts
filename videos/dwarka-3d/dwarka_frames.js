// node dwarka_frames.js page.html outdir mapjson fps width height from to
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [html, outDir, mapPath, fps, W, H, from, to] = process.argv.slice(2);
const three = fs.readFileSync(path.join(__dirname, 'node_modules/three/build/three.module.min.js'));
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8')); // [[videoTime, tourTime], ...]
const tour = (t) => { if (t <= map[0][0]) return map[0][1]; for (let i = 1; i < map.length; i++) if (t <= map[i][0]) { const [a, x] = map[i - 1], [b, y] = map[i]; return x + (t - a) / (b - a) * (y - x); } return map[map.length - 1][1]; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 1 });
  p.setDefaultTimeout(300000);
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.module')) return r.fulfill({ body: three, contentType: 'application/javascript' }); if (u.startsWith('file:') || u.startsWith('data:')) return r.continue(); return r.abort(); });
  const fontCss = fs.existsSync(path.join(__dirname, 'fonts.css')) ? '<style>' + fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8') + '</style>' : '';
  const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style>' + fontCss + '</head><body class="rec">' + fs.readFileSync(html, 'utf8') + '</body></html>';
  const tmp = path.join(outDir, '_page.html'); fs.writeFileSync(tmp, doc);
  await p.goto('file://' + tmp); await p.waitForTimeout(4000); await p.evaluate(() => { window.__manual = true; });
  await p.evaluate(() => { document.body.classList.add('rec'); document.getElementById('hint').hidden = true; });
  const t0 = Date.now();
  for (let f = Number(from); f <= Number(to); f++) {
    const T = tour(f / Number(fps));
    const url = await p.evaluate((x) => window.__renderAt(x), T);
    fs.writeFileSync(path.join(outDir, `f_${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    if ((f - Number(from)) % 30 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await b.close();
})();
