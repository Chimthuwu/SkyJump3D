const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) {
        let html = fs.readFileSync(SRC, 'utf8');
        html = html.replace('window.__ng = {', `window.__hk = { palace: () => { const a = []; scene.traverse(o => { if (o.isGroup && o.userData.noCull && o.children.length > 150) a.push({ x:o.position.x, y:o.position.y, z:o.position.z, yaw:o.rotation.y, kids:o.children.length }); }); return a; } }; window.__ng = {`);
        req.respond({ status: 200, contentType: 'text/html', body: html });
      } else req.continue();
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__ng && window.__ng.midsGates', { timeout: 180000 });
    await new Promise(r => setTimeout(r, 5000));
    await page.evaluate(() => window.__ng.enterPlay());
    await new Promise(r => setTimeout(r, 1000));
    await page.mouse.click(640, 400);
    await new Promise(r => setTimeout(r, 300));
    const view = await page.evaluate(() => {
      const nest = window.__ng.midsGates().sites.nest;
      const groups = window.__hk.palace();
      const mon = groups.sort((a, b) => Math.hypot(a.x - nest.x, a.z - nest.z) - Math.hypot(b.x - nest.x, b.z - nest.z))[0];
      return mon ? { x: mon.x, y: mon.y, z: mon.z, yaw: mon.yaw, children: mon.kids } : null;
    });
    if (!view) throw new Error('Could not locate the Pussy Palace monument group');
    await page.evaluate(({x,y,z,yaw}) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F4', bubbles: true }));
      const frontX = Math.sin(yaw), frontZ = Math.cos(yaw);
      const px = x + frontX * 470, py = y + 135, pz = z + frontZ * 470;
      window.__ng.tp(px, py, pz);
      window.__ng.look(yaw, 0.04);
    }, view);
    await new Promise(r => setTimeout(r, 250));
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '#hud,#hp,#radarWrap,#hotbar,#hint,#toast,#cross,#bossbar{display:none!important}';
      document.head.appendChild(style);
    });
    const status = await page.evaluate(() => ({ site: window.__ng.midsGates().sites.nest, me: window.__ng.me(), cam: window.__ng.info().cam, errors: document.querySelectorAll('[style*="z-index:9999"]').length }));
    const out = path.join(__dirname, '_pussy_entrance_review.png');
    await page.screenshot({ path: out });
    console.log(JSON.stringify({ screenshot: out, status, runtimeErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error('PUSSY VISUAL PROBE FAILED:', e.stack || e.message); process.exit(1); });
