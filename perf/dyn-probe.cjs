const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--allow-file-access-from-files','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--mute-audio','--window-size=1280,800'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
  await page.goto('file:///C:/Users/Serge/Desktop/SkyDive/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng && window.__ng.lvl', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 5000));
  const res = await page.evaluate(async () => {
    const L = window.__ng.lvl(); const kids = L.children.slice();
    const snap = o => { const a = o.matrixAutoUpdate ? null : 1; o.updateMatrix(); return o.matrix.elements.join(',') + '|' + o.visible; };
    const before = kids.map(snap);
    await new Promise(r => setTimeout(r, 8000));
    const after = kids.map(snap);
    const sig = o => o.isGroup ? 'Group(' + o.children.length + ')' : o.isInstancedMesh ? 'Inst' : o.isMesh ? 'Mesh:' + o.geometry.type : o.isSprite ? 'Sprite' : o.type;
    const stat = {};
    kids.forEach((o, i) => { const k = sig(o), e = stat[k] || (stat[k] = { n: 0, moved: 0 }); e.n++; if (before[i] !== after[i]) e.moved++; });
    const arr = Object.entries(stat).sort((a, b) => b[1].n - a[1].n).slice(0, 25);
    return { total: kids.length, groupsWithKids: kids.filter(o => o.children.length).length, totalNodes: (() => { let n = 0; L.traverse(() => n++); return n; })(), arr };
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
