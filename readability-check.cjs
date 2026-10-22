// Readability probe: luminance histogram of the view inside each interior theme.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const path = require('path');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng && typeof window.__ng.towers === "function"', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await sleep(1200);

  const rows = [];
  for (const theme of ['server', 'atrium', 'reactor', 'club', 'vault']) {
    await page.evaluate(async (theme) => {
      window.__ng.level = 1; await new Promise(r => setTimeout(r, 400));
      const t = window.__ng.towers()[0];
      window.__ng.openTower(0, theme); await new Promise(r => setTimeout(r, 200));
      window.__ng.tp(t.x, 1.5, t.z); await new Promise(r => setTimeout(r, 1000));
      window.__ng.look(0.9, -0.05);
    }, theme);
    await sleep(700);
    const b64 = await page.screenshot({ encoding: 'base64' });
    const h = await page.evaluate(async (data) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + data; });
      const c = document.createElement('canvas'); c.width = 320; c.height = 200;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 320, 200);
      const d = g.getImageData(0, 0, 320, 200).data;
      const bins = new Array(10).fill(0); let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        bins[Math.min(9, Math.floor(l / 25.6))]++; n++;
      }
      return bins.map(v => +(100 * v / n).toFixed(1));
    }, b64);
    rows.push({ theme, binsPct: h, above60: +(h.slice(2).reduce((a, b) => a + b, 0)).toFixed(1) });
  }
  console.log(JSON.stringify(rows, null, 1));
  console.log(errors.length ? 'ERRORS: ' + errors.join('\n') : 'NO JS ERRORS');
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(2); });
