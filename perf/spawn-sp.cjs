const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--allow-file-access-from-files','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--mute-audio'] });
  const page = await browser.newPage();
  await page.goto('file:///C:/Users/Serge/Desktop/SkyDive/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng && window.__ng.lvl', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 6000));
  console.log(JSON.stringify(await page.evaluate(() => window.__ng.spKinds())));
  await browser.close();
})();
