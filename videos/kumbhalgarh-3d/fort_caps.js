// node fort_caps.js page.src.html outDir  -> title.png, cap_N.png (transparent, 1080x1920) + caps.json [[start,end],...]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [html, outDir] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || u.startsWith('data:')) return r.continue(); return r.abort(); });
  const css = fs.readFileSync(path.join(__dirname, 'fonts_fort.css'), 'utf8'), src = fs.readFileSync(html, 'utf8');
  const doc = '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}' + css + ' html,body,#frame{background:transparent!important} canvas,#dock,#start,#err{display:none!important}</style></head><body class="rec">' + src.replace(/<script type="module">[\s\S]*<\/script>/, '') + '</body></html>';
  const tmp = path.join(outDir, '_caps.html'); fs.writeFileSync(tmp, doc);
  await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready);
  const CH = JSON.parse(src.match(/\/\*STARTS\*\/(\[.*?\])\/\*END\*\//)[1]), DUR = Number(src.match(/\/\*DUR\*\/([\d.]+)\/\*END\*\//)[1]);
  const LABELS = eval(src.match(/const LABELS = (\[[\s\S]*?\]);/)[1]);
  await p.evaluate(() => { document.getElementById('cap').style.opacity = 0; document.getElementById('title').style.opacity = 1; });
  await p.screenshot({ path: path.join(outDir, 'title.png'), omitBackground: true });
  await p.evaluate(() => { document.getElementById('title').style.opacity = 0; document.getElementById('cap').style.opacity = 1; });
  const times = [];
  for (let i = 1; i < LABELS.length; i++) {
    await p.evaluate((t) => { document.querySelector('#cap .t').textContent = t; }, LABELS[i]);
    await p.screenshot({ path: path.join(outDir, `cap_${i - 1}.png`), omitBackground: true });
    times.push([+(CH[i] - .45 + .5).toFixed(2), +((i + 1 < CH.length ? CH[i + 1] - .45 : DUR - 1.5) - .5).toFixed(2)]);
  }
  fs.writeFileSync(path.join(outDir, 'caps.json'), JSON.stringify(times)); console.log('caps', times.length); await b.close();
})();
