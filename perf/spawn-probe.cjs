const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--allow-file-access-from-files','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--mute-audio','--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.goto('file:///C:/Users/Serge/Desktop/SkyDive/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng && window.__ng.lvl', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 6000));
  const out = await page.evaluate(() => {
    const L = window.__ng.lvl(), res = [], v = new (L.position.constructor)();
    L.traverse(o => {
      if (!o.isMesh || o.geometry.type !== 'BoxGeometry') return;
      o.getWorldPosition(v);
      if (Math.hypot(v.x - 610, v.z) > 70 || v.y < 540 || v.y > 600) return;
      const g = o.geometry.parameters; if (g.width < 6 && g.depth < 6) return;
      res.push([v.x | 0, v.y | 0, v.z | 0, +g.width.toFixed(1), +g.height.toFixed(1), +g.depth.toFixed(1), '#' + (o.material.emissive ? o.material.emissive.getHexString() : o.material.color.getHexString()), o.parent && o.parent !== L ? 'grp' : 'top']);
    });
    return res.slice(0, 40);
  });
  out.forEach(r => console.log(r.join(' ')));
  await browser.close();
})();
