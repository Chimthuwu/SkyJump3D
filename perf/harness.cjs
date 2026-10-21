const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = 'C:/Users/Serge/Desktop/SkyDive/index.html';
exports.launch = async function (extra) {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--mute-audio','--window-size=1280,800'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) {
      let h = fs.readFileSync(SRC, 'utf8');
      h = h.replace('window.__ng = {', 'window.__dbg = { scene, camera, renderer, get lvl() { return lvl; }, get CULL_R() { return CULL_R; }, get cull() { return cull; }, get preset() { return retroPreset; }, get enemies() { return enemies; }, get items() { return items; }, get props() { return props; }, get portals() { return portals; }, get solids() { return solids; }, cullTick, platforms, specials, dressings, buildingBoxes, fx, clouds, skyProps, shots, homeGuides, watchers, decalMesh, decals, gibsList, peers: null, set CULL(v) { CULL_R = v; } }; window.__ng = {');
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///' + SRC, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__dbg', { timeout: 120000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 6000));
  return { browser, page, errors };
};
