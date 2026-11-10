// node fort_frames.js page.html outdir fps from to
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [html, outDir, fps, from, to] = process.argv.slice(2);
const three = fs.readFileSync(path.join(__dirname, 'node_modules/three/build/three.module.min.js'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 }); p.setDefaultTimeout(300000);
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.module')) return r.fulfill({ body: three, contentType: 'application/javascript' }); if (u.startsWith('file:') || u.startsWith('data:')) return r.continue(); return r.abort(); });
  const doc = '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + fs.readFileSync(html, 'utf8') + '</body></html>';
  const tmp = path.join(outDir, `_page_${from}.html`); fs.writeFileSync(tmp, doc);
  await p.goto('file://' + tmp); await p.waitForTimeout(5000);
  const t0 = Date.now();
  for (let f = Number(from); f <= Number(to); f++) {
    const url = await p.evaluate((x) => window.__renderAt(x), f / Number(fps));
    fs.writeFileSync(path.join(outDir, `f_${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    if ((f - Number(from)) % 100 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  console.log('DONE', from, to); await b.close();
})();
