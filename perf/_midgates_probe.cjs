// Diagnose why commonsMidTick stopped pushing the site pipeline: dump gates + guards live.
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
  page.on('pageerror', e => console.log('pageerror:', e.message, '|', (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' || /blocked|skip|guard/i.test(m.text())) console.log('console.' + m.type() + ':', m.text()); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.mids', { timeout: 180000 });
  const evl = fn => page.evaluate(fn);
  console.log('gates boot:', JSON.stringify(await evl(() => window.__ng.midsGates())));
  console.log('enterPlay ->', await evl(() => window.__ng.enterPlay()));
  await w(6000);
  const g1 = await evl(() => window.__ng.midsGates());
  console.log('gates +6s:', JSON.stringify(g1));
  if (!g1 || !g1.sites || !g1.sites.nest) { console.log('SITES MISSING — build failed'); await browser.close(); return; }
  console.log('midsGo(nest) ->', await evl(() => window.__ng.midsGo('nest')));
  await w(2500);
  console.log('gates @nest:', JSON.stringify(await evl(() => window.__ng.midsGates()), null, 1));
  console.log('dbg:', JSON.stringify(await evl(() => window.__ng.midsDbg()), null, 1));
  await w(14000);
  const g3 = await evl(() => window.__ng.midsGates());
  console.log('gates +14s:', JSON.stringify(g3, null, 1));
  console.log('dbg:', JSON.stringify(await evl(() => window.__ng.midsDbg()), null, 1));
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
