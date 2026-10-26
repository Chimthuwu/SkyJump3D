// Dump the commonsMidTick early-gate values live, before + after midsGo(nest), via the midsGates hook.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => { if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(SRC, 'utf8') }); else req.continue(); });
  page.on('pageerror', e => console.log('pageerror:', e.message, '|', (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.mids', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 5000));
  const evl = fn => page.evaluate(fn);
  const w = ms => new Promise(r => setTimeout(r, ms));

  const gates = () => evl(() => window.__ng.midsGates());
  console.log('gates BOOT:', JSON.stringify(await gates(), null, 1));
  console.log('enterPlay ->', await evl(() => window.__ng.enterPlay()));
  await w(1000);
  const where = await evl(() => window.__ng.midsGo('nest'));
  console.log('midsGo(nest):', where);
  await w(700);

  for (let pass = 1; pass <= 10; pass++) {
    const st = (await gates()).sites.nest;
    if (st.waves >= 3) {
      if (!st.bossSpawned) console.log('pass' + pass + ': waves>=3 -> kill (' + (await evl(() => window.__ng.midsKill('nest'))) + '):', JSON.stringify(await evl(() => window.__ng.midsGates().sites.nest)));
    } else if (pass % 2 === 1) console.log('pass' + pass + ': step+kill (' + (await evl(() => window.__ng.midsStep('nest')), await evl(() => window.__ng.midsKill('nest'))) + ');', JSON.stringify(st));
    await w(2500);
    const gs = await gates();
    console.log('pass' + pass + ' end:', JSON.stringify(gs.sites.nest), 'roster n=' + (await evl(() => window.__ng.midsRoster().nest)).length, 'state:', gs.state);
  }
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
