// usage: node preview/shot.cjs bundle.js out.png
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 2400, height: 2200 } });
  pg.on('console', m => console.log('console:', m.text())); pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.setContent('<body style="margin:0"></body>'); await pg.addScriptTag({ content: fs.readFileSync(process.argv[2], 'utf8') });
  await pg.waitForFunction('window.done'); await (await pg.$('canvas')).screenshot({ path: process.argv[3] }); await b.close(); })();
