const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs=require('fs'); const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--allow-file-access-from-files','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--mute-audio','--enable-precise-memory-info','--js-flags=--expose-gc','--window-size=1280,800'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
  await page.goto('file:///C:/Users/Serge/Desktop/SkyDive/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng', { timeout: 90000 });
  await page.evaluate(() => document.getElementById('bStart').click()); await w(6000);
  const out = {};
  await page.evaluate(() => window.__ng.perf.scenes.spawn()); await w(1500);
  const heap = [];
  for (let i = 0; i < 7; i++) { heap.push(await page.evaluate(() => performance.memory.usedJSHeapSize)); await w(5000); }
  out.heapBytesEvery5s = heap;
  for (const cr of [1000, 400, 250, 150]) {
    await page.evaluate(r => window.__ng.setCull(r), cr); await w(1500);
    out['cull' + cr] = await page.evaluate(() => window.__ng.renderInfo());
  }
  out.cullNote = 'setCull only matters if cullTick is called (disabled at index.html:5969)';
  fs.writeFileSync('cpu-profile-heap.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
  await browser.close();
})();
