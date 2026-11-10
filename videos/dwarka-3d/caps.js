const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [html, outDir] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || u.startsWith('data:')) return r.continue(); return r.abort(); });
  const css = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
  const doc = '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}' + css + ' html,body{background:transparent!important} #frame{background:transparent!important} canvas,#dock,#hint,#err{display:none!important} #title .l{letter-spacing:.06em!important} *{transition:none!important}</style></head><body class="rec portrait">' + fs.readFileSync(html, 'utf8').replace(/<script type="module">[\s\S]*<\/script>/, '') + '</body></html>';
  const tmp = path.join(outDir, '_caps.html'); fs.writeFileSync(tmp, doc);
  await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready);
  const src = fs.readFileSync(html, 'utf8'); const caps = eval(src.match(/const CAPS = (\[[\s\S]*?\n\]);/)[1]);
  await p.evaluate(() => { document.getElementById('cap').style.opacity = 0; document.getElementById('title').style.opacity = 1; });
  await p.screenshot({ path: path.join(outDir, 'title.png'), omitBackground: true });
  await p.evaluate(() => { document.getElementById('title').style.opacity = 0; document.getElementById('cap').style.opacity = 1; });
  for (let i = 0; i < caps.length; i++) {
    await p.evaluate(([t, s]) => { document.querySelector('#cap .t').textContent = t; document.querySelector('#cap .s').textContent = s; }, [caps[i][2], caps[i][3]]);
    await p.screenshot({ path: path.join(outDir, `cap_${i}.png`), omitBackground: true });
  }
  fs.writeFileSync(path.join(outDir, 'caps.json'), JSON.stringify(caps.map(c => [c[0], c[1]])));
  await b.close(); console.log('caps', caps.length);
})();
