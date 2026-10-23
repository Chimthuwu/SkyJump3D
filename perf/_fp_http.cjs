// Same fingerprint probe, but served over http://localhost so HEAD's module isn't blocked on file:// .
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TARGET = process.argv[2] === 'head' ? path.join(ROOT, '__head_probe.html') : path.join(ROOT, 'index.html');
const HK = "window.__hk = { setLevelDefById, buildLevel, stats: () => ({ solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length }), sig: () => solids.map(s => [Math.round(s.minx), Math.round(s.maxx), Math.round(s.miny), Math.round(s.maxy), Math.round(s.minz), Math.round(s.maxz)]) }; window.__ng = {";
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/__probe_target.html';
  const file = p === '/__probe_target.html' ? TARGET : path.join(ROOT, p);
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    let body = d;
    if (p === '/__probe_target.html') {
      let s = body.toString('utf8');
      s = s.replace('window.__ng = {', HK);
      body = s;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  });
}).listen(0);
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 120000 });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(6000);
  const A = await page.evaluate(() => ({ n: window.__hk.stats(), sig: window.__hk.sig() }));
  await page.evaluate(() => { window.__hk.setLevelDefById('descent'); window.__hk.buildLevel(); });
  await sleep(6000);
  const B = await page.evaluate(() => ({ n: window.__hk.stats(), sig: window.__hk.sig() }));
  await page.evaluate(() => { window.__hk.setLevelDefById('descent'); window.__hk.buildLevel(); });
  await sleep(6000);
  const C = await page.evaluate(() => ({ n: window.__hk.stats(), sig: window.__hk.sig() }));
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  console.log('BOOT:', JSON.stringify(A.n));
  console.log('REBUILD1:', JSON.stringify(B.n));
  console.log('REBUILD2:', JSON.stringify(C.n));
  console.log('bootSig==reb1Sig:', same(A.sig, B.sig), ' reb1Sig==reb2Sig:', same(B.sig, C.sig));
  await browser.close();
  server.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
