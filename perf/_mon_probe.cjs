// Monument boot probe: verify the three themed monuments build (pussy / house / shroom), fog:false + noCull, zero page errors.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] }).catch(async () => puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files', '--no-sandbox'] }));
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) {
      let h = fs.readFileSync(SRC, 'utf8');
      h = h.replace('window.__ng = {', `window.__hk = {
        mon: () => { const out = []; scene.traverse(o => { if (o.isGroup && o.userData.noCull && o.children.length >= 10) { let fogOk = true, mats = 0, cull = 0; o.traverse(c => { if (c.isMesh) { mats++; if (!(c.material && c.material.fog === false)) fogOk = false; if (!c.userData.noCull) cull++; } }); out.push({ at: o.position.toArray().map(v => Math.round(v)), kids: o.children.length, meshes: mats, fogAll: fogOk, notMarked: cull }); } }); return out; },
        enterPlay: () => { LEVELS[0].startFn(); return state; },
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 6000));
  const mons = await page.evaluate(() => window.__hk.mon());
  console.log('monuments:', JSON.stringify(mons, null, 1));
  await page.evaluate(() => window.__hk.enterPlay());
  await new Promise(r => setTimeout(r, 2500));
  const mons2 = await page.evaluate(() => window.__hk.mon());
  console.log('monuments in play:', JSON.stringify(mons2, null, 1));
  console.log('runtime errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('MON PROBE FAILED:', e.message); process.exit(1); });
