// stall probe: midsGo(house/shroom) then read midsDbg repeatedly
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => { if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(SRC, 'utf8') }); else req.continue(); });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.mids', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 5000));
  const evl = (fn, ...args) => page.evaluate(fn, ...args);   // args MUST be forwarded
  const w = ms => new Promise(r => setTimeout(r, ms));

  console.log('enterPlay ->', await evl(() => window.__ng.enterPlay()));
  await w(3000);
  console.log('state now ->', JSON.stringify(await evl(() => window.__ng.midsDbg())));
  for (const site of ['house', 'shroom']) {
    console.log('=== ' + site + ' ===');
    console.log('go ->', await evl(s => window.__ng.midsGo(s), site));
    for (let i = 0; i < 4; i++) {
      await w(2000);
      console.log('t+' + ((i + 1) * 2) + 's:', JSON.stringify(await evl(() => window.__ng.midsDbg())));
    }
  }
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
