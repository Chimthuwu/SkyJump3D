const { launch } = require('./harness.cjs');
(async () => {
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    const d = window.__dbg, lvl = d.lvl, out = {};
    const want = { '6a727f_lam': m => m.color.getHexString() === '6a727f', '4ef6ff_lam': m => m.type === 'MeshLambertMaterial' && m.color.getHexString() === '4ef6ff', '91ff53_lam': m => m.color.getHexString() === '91ff53' && m.type === 'MeshLambertMaterial', '8aff3e_ADD': m => m.color.getHexString() === '8aff3e' && m.blending === 2, 'ff3fc8_ADD': m => m.color.getHexString() === 'ff3fc8' && m.blending === 2, '8c98b0_cyl': m => m.color.getHexString() === '8c98b0', 'ffe14a_plane': m => m.color.getHexString() === 'ffe14a' };
    for (const c of lvl.children) { if (!c.isMesh || Array.isArray(c.material)) continue; for (const k in want) { if (want[k](c.material)) { const o = out[k] || (out[k] = { n: 0, samples: [] }); o.n++; if (o.samples.length < 2) { c.geometry.computeBoundingBox(); const b = c.geometry.boundingBox; o.samples.push({ geo: c.geometry.type, size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map(v => +(v * 1).toFixed(2)), scale: c.scale.toArray().map(v => +v.toFixed(2)), pos: c.position.toArray().map(Math.round), opacity: c.material.opacity, ud: Object.keys(c.userData) }); } } } }
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); await browser.close();
})();
