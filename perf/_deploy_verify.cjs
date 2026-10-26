// Quick post-deploy verification: the live URL must serve the gamepad build.
(async () => {
  const r = await fetch('https://sky-jump.pages.dev');
  const t = await r.text();
  console.log('status:', r.status, '| bytes:', t.length);
  console.log('has gamepadTick:', t.includes('function gamepadTick'));
  console.log('has pad menu dispatch:', t.includes('gpPrev.msDir'));
  console.log('has look settings keys:', t.includes('towerdrop.gp.sens') && t.includes('towerdrop.gp.invertY'));
  console.log('has menuKey arrows:', t.includes('offsetParent !== null'));
  console.log('has X/Y multi mapping:', t.includes("gpEdge(gp, 2)) menuKey") || t.includes('Multiplayer screen: X = host'));
})().catch(e => { console.error('FETCH FAILED:', e.message); process.exit(1); });
