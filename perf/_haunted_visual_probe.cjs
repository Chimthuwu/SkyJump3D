const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => req.url().startsWith('file:') && /index\.html$/.test(req.url())
    ? req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(SRC, 'utf8') })
    : req.continue());
  page.on('pageerror', err => console.error('pageerror:', err.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.midsGates', { timeout: 180000 });
  await new Promise(resolve => setTimeout(resolve, 5000));
  await page.evaluate(() => window.__ng.enterPlay());
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.mouse.click(640, 400);
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.evaluate(() => {
    const house = window.__ng.midsGates().sites.house;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F4', bubbles: true }));
    window.__ng.tp(house.x + 110, house.y + 70, house.z - 115);
    window.__ng.look(Math.PI, -0.08);
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  const house = await page.evaluate(() => window.__ng.midsGates().sites.house);
  await page.screenshot({ path: path.join(__dirname, '_haunted_before.png') });
  await page.evaluate(({ x, y, z }) => {
    window.__ng.tp(x, y, z);
    window.__ng.look(-Math.PI / 2, -0.05);
  }, { x: house.x + 70, y: house.y + 20, z: house.z - 12 });
  await new Promise(resolve => setTimeout(resolve, 700));
  await page.screenshot({ path: path.join(__dirname, '_haunted_detail.png') });
  console.log('Saved exterior and detail views; game state:', await page.evaluate(() => window.__ng.midsDbg()));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
