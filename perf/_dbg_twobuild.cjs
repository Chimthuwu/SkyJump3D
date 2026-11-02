// _dbg_twobuild.cjs — build descent twice on the current index.html, print stats + detail, to chase a -5 solids drift.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '_dbg_snapshot.html');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /_dbg_snapshot\.html/.test(req.url())) {
      const h = fs.readFileSync(SRC, 'utf8')
        .replace('window.__ng = {', `window.__hk = {
        setLevelDefById, buildLevel,
        stats: () => ({ solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length, seed }),
        detail: () => { const c = (f) => solids.filter(f).length; return { hubs: buildingHubs.length, decor: decorSites.length, moon: c(s => s.moon), building: c(s => s.building), arena: c(s => s.arena), ladder: c(s => s.ladder), bounce: c(s => s.bounce), big: c(s => (s.top - s.y0) > 100), tall: c(s => s.top > 300) }; }
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  fs.copyFileSync(path.resolve(__dirname, '..', 'index.html'), SRC);
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('!!window.__hk', { timeout: 120000 });
  const evl = f => page.evaluate(f);
  await evl(() => { window.__hk.setLevelDefById('descent'); window.__hk.buildLevel(); });
  console.log('build1:', JSON.stringify(await evl(() => ({ ...window.__hk.stats(), ...window.__hk.detail() }))));
  await evl(() => { window.__hk.buildLevel(); });
  console.log('build2:', JSON.stringify(await evl(() => ({ ...window.__hk.stats(), ...window.__hk.detail() }))));
  await browser.close();
})().catch(e => console.error('ERR', e && e.message || e));
