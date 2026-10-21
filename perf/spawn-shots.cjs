const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const OUT = 'Z:/Temp/claude/C--Users-Serge-Desktop-SkyDive/9beff56d-5316-46e3-9283-e3631bd49b26/scratchpad/';
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--allow-file-access-from-files','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--mute-audio','--window-size=1280,800'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
  await page.goto('file:///C:/Users/Serge/Desktop/SkyDive/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng && window.__ng.lvl', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 6000));
  for (const yaw of [0, 1.57, 3.14, 4.71]) {
    await page.evaluate(y => window.__ng.look(y, -0.1), yaw);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: OUT + 'spawn-' + yaw + '.png' });
  }
  const info = await page.evaluate(() => { const L = window.__ng.lvl(); const out = []; L.children.forEach(o => { const p = o.position; if (Math.hypot(p.x - 610, p.z) < 40 && Math.abs(p.y - 580) < 12 && o.isMesh && o.geometry.type === 'BoxGeometry') { const g = o.geometry.parameters; if (g.width > 4 || g.depth > 4) out.push([o.position.x | 0, o.position.y | 0, o.position.z | 0, g.width | 0, g.height | 0, g.depth | 0, '0x' + (o.material.color ? o.material.color.getHexString() : '?')]); } }); return out; });
  console.log(JSON.stringify(info));
  await browser.close();
})();
