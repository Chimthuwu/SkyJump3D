// Screenshot pass: twilight palette + touch controls, for a human visual review.
// Outputs -> perf/_shots/twilight_menu.png, twilight_select.png, touch_play_twilight.png, touch_play_neon.png
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
const OUT = require('path').resolve(__dirname, '_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 300000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() => {
    window.matchMedia = q => ({ matches: /pointer: coarse/.test(q), media: String(q), onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
  });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng', { timeout: 150000 });
  await sleep(2500);

  // 1) main menu in TWILIGHT
  await page.evaluate(() => { window.__ng.twilight = true; });
  await sleep(500);
  await page.screenshot({ path: OUT + '/twilight_menu.png' });

  // 2) level select in twilight
  await page.evaluate(() => { window.__gpMenu('Enter'); });
  await sleep(700);
  await page.screenshot({ path: OUT + '/twilight_select.png' });

  // 3) in-game with the touch overlay (twilight still on)
  await page.evaluate(() => { window.__gpMenu('Enter'); });   // launch selected level (descent)
  await page.waitForFunction('window.__ng.mv().st === \'play\'', { timeout: 60000 });
  await sleep(3000);
  await page.screenshot({ path: OUT + '/touch_play_twilight.png' });

  // 4) same view in the default neon palette, touch overlay on
  await page.evaluate(() => { window.__ng.twilight = false; });
  await sleep(500);
  await page.screenshot({ path: OUT + '/touch_play_neon.png' });

  console.log('SHOTS DONE');
  await browser.close();
})().catch(e => { console.error('SHOTS FAILED:', e.message); process.exit(1); });
