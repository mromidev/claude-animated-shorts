// node fort_shots.js page.html outPrefix t1 t2 ...   (frames via window.__renderAt, 1080x1920)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [html, out, ...times] = process.argv.slice(2);
const three = fs.readFileSync(path.join(__dirname, 'node_modules/three/build/three.module.min.js'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 }); p.setDefaultTimeout(300000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.module')) return r.fulfill({ body: three, contentType: 'application/javascript' }); if (u.startsWith('file:') || u.startsWith('data:')) return r.continue(); return r.abort(); });
  const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + fs.readFileSync(html, 'utf8') + '</body></html>';
  const tmp = out + '_page.html'; fs.writeFileSync(tmp, doc);
  await p.goto('file://' + tmp); await p.waitForTimeout(5000);
  if (errs.length) console.log('errors:', errs.slice(0, 6));
  for (const t of times) { const t0 = Date.now(); const url = await p.evaluate((x) => window.__renderAt(x), Number(t)); fs.writeFileSync(`${out}_${String(t).padStart(5, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log(t, ((Date.now() - t0) / 1000).toFixed(1) + 's'); }
  console.log('errors:', errs.slice(0, 6)); await b.close();
})();
