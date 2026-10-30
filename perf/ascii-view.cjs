// ASCII luminance map of the interior view: what is actually dark on screen?
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const path = require('path');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHARS = ' .:-=+*#%@';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng && typeof window.__ng.towers === "function"', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await sleep(1200);

  for (const [theme, yaw, pitch] of [['server', 0.9, -0.05], ['server', 0.9, 0.35], ['atrium', 2.4, 0.0]]) {
    await page.evaluate(async (theme, yaw, pitch) => {
      window.__ng.level = 1; await new Promise(r => setTimeout(r, 500));
      const t = window.__ng.towers()[0];
      window.__ng.openTower(0, theme); await new Promise(r => setTimeout(r, 200));
      window.__ng.tp(t.x, 1.5, t.z); await new Promise(r => setTimeout(r, 1200));
      window.__ng.look(yaw, pitch);
    }, theme, yaw, pitch);
    await sleep(900);
    const b64 = await page.screenshot({ encoding: 'base64' });
    const art = await page.evaluate(async (data) => {
      const CHARS = ' .:-=+*#%@';
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + data; });
      const c = document.createElement('canvas'); c.width = 64; c.height = 24;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 24);
      const d = g.getImageData(0, 0, 64, 24).data;
      const rows = [];
      for (let y = 0; y < 24; y++) {
        let line = '';
        for (let x = 0; x < 64; x++) {
          const i = (y * 64 + x) * 4;
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          line += CHARS[Math.min(9, Math.floor(l / 25.6))];
        }
        rows.push(line);
      }
      return rows.join('\n');
    }, b64);
    const state = await page.evaluate(() => ({
      zone: window.__ng.info().zone,
      fog: [window.__ng.info() && null, null],
    }));
    console.log(`\n=== ${theme} yaw ${yaw} pitch ${pitch} ===\n${art}`);
  }
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(2); });
