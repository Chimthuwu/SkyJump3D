// Diagnose the house stall: drive the site pipeline and dump the roster (x/z/d/g/b/hp) each pass.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => { if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(SRC, 'utf8') }); else req.continue(); });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.mids', { timeout: 180000 });
  const evl = (fn, ...args) => page.evaluate(fn, ...args);   // args MUST be forwarded
  console.log('enterPlay ->', await evl(() => window.__ng.enterPlay()));
  await w(5000);
  console.log('midsGo(house) ->', await evl(() => window.__ng.midsGo('house')));
  const roster = () => evl(() => window.__ng.midsRoster());
  for (let pass = 1; pass <= 10; pass++) {
    await evl(() => window.__ng.midRespawn());
    await evl(() => window.__ng.midsGo('house'));
    await evl(s => window.__ng.midsStep(s), 'house');
    const k = await evl(s => window.__ng.midsKill(s), 'house');
    await w(2600);
    const r = (await roster()).house;
    console.log('pass' + pass, 'kill ->', k, '| roster:', JSON.stringify(r));
    if (r && r.some(u => u.b)) console.log('   BOSS VISIBLE');
  }
  console.log('final gates:', JSON.stringify(await evl(() => window.__ng.midsGates()), null, 1));
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
