// boot probe: read the JS ERROR overlay div (message + stack) after load
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 300000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  page.on('console', c => { const t = c.text(); if (/\[mids\]/.test(t)) console.log('console>', t.slice(0, 200)); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await new Promise(r => setTimeout(r, 30000));
  const divs = await page.evaluate(() => Array.from(document.querySelectorAll('div')).filter(d => d.style && d.style.zIndex === '9999').map(d => d.textContent));
  if (divs.length) divs.forEach(d => console.log('--- error div ---\n' + d));
  else console.log('no error overlay');
  try { await page.waitForFunction('window.__ng && window.__ng.mids', { timeout: 15000 }); console.log('BOOT OK'); }
  catch (e) { console.log('BOOT FAILED'); }
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
