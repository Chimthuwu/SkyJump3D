// T-VIEW: overhead (orthographic) + angled screenshots of a loaded level with start / checkpoints / cells / exit labelled. Markers are drawn by the harness
// (extra meshes + a 2D label pass on a copy of the frame); nothing here ships in the game. Usage: node tests/t-view.cjs [level-id]
const fs = require('fs'), path = require('path');
const { serve, launch, openGame } = require('./lib.cjs');
const id = process.argv[2] || 'nostalgia-overdose';
const out = path.join(__dirname, 'out', id); fs.mkdirSync(out, { recursive: true });
(async () => {
  const { srv, url } = await serve(); const br = await launch();
  const { page, errors } = await openGame(br, url, { dbg: true, viewport: { width: 1600, height: 900 }, query: '?spec=' + id });
  await page.click('#bStart');
  await page.waitForFunction(() => __ng.levels.state().active && __dbg.state === 'play', null, { timeout: 120000 }); await page.waitForTimeout(2000);
  const shots = await page.evaluate(async () => {
    const { THREE, scene, renderer, solids } = __dbg; const spec = __ng.levels.spec(), g = __ng.levels.graph();
    const bb = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 }; for (const s of solids) { bb.x0 = Math.min(bb.x0, s.minx); bb.x1 = Math.max(bb.x1, s.maxx); bb.y0 = Math.min(bb.y0, s.miny); bb.y1 = Math.max(bb.y1, s.maxy); bb.z0 = Math.min(bb.z0, s.minz); bb.z1 = Math.max(bb.z1, s.maxz); }
    const marks = [{ t: 'START', x: -322, y: 0, z: 0, c: '#44ff66' }];
    for (const s of solids) if (s.checkpoint) marks.push({ t: 'CP', x: s.cx, y: s.top, z: s.cz, c: '#36f6ff' });
    for (const c of spec.cells) marks.push({ t: 'CELL ' + c.id, x: c.x, y: c.y, z: c.z, c: '#ffd23a' });
    marks.push({ t: 'EXIT', x: 318, y: 10, z: 0, c: '#ff4466' });
    for (const m of marks) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 90, 8), new THREE.MeshBasicMaterial({ color: m.c })); p.position.set(m.x, m.y + 45, m.z); p.name = 'qa-marker'; scene.add(p); }
    scene.fog = null;
    const W = renderer.domElement.width, H = renderer.domElement.height, saved = renderer.getRenderTarget();
    const shot = (cam, label) => {
      renderer.setRenderTarget(null); renderer.setViewport(0, 0, W, H); renderer.clear(true, true, true); renderer.render(scene, cam);
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(renderer.domElement, 0, 0);
      x.font = 'bold 20px sans-serif'; x.lineWidth = 4;
      for (const m of marks) { const v = new THREE.Vector3(m.x, m.y + 6, m.z).project(cam); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue; const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H; x.strokeStyle = '#000'; x.fillStyle = m.c; x.strokeText(m.t, sx + 6, sy); x.fillText(m.t, sx + 6, sy); x.beginPath(); x.arc(sx, sy, 5, 0, 7); x.fill(); }
      x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.strokeText(label, 14, 28); x.fillText(label, 14, 28);
      return c.toDataURL('image/png');
    };
    const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, w = bb.x1 - bb.x0, d = bb.z1 - bb.z0, aspect = W / H;
    const half = Math.max(w / aspect, d) / 2 * 1.08;
    const top = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 1, 2000); top.position.set(cx, 800, cz); top.up.set(0, 0, -1); top.lookAt(cx, 0, cz);
    const out = { overhead: shot(top, 'OVERHEAD (north=up)  x:' + Math.round(bb.x0) + '..' + Math.round(bb.x1) + '  z:' + Math.round(bb.z0) + '..' + Math.round(bb.z1)) };
    const ang = new THREE.PerspectiveCamera(48, aspect, 1, 3000); ang.position.set(cx - 90, 330, cz + 520); ang.lookAt(cx + 20, 20, cz); out.angled = shot(ang, 'ANGLED (from south-west... looking east)');
    const west = new THREE.PerspectiveCamera(50, aspect, 1, 3000); west.position.set(bb.x0 - 120, 120, cz + 140); west.lookAt(cx, 25, cz); out.west = shot(west, 'ANGLED from the spawn end looking along the axis');
    const stack = new THREE.PerspectiveCamera(50, aspect, 1, 3000); stack.position.set(cx + 30, 70, 230); stack.lookAt(0, 38, 0); out.stack = shot(stack, 'BEDROOM STACK from the south');
    renderer.setRenderTarget(saved); return out;
  });
  for (const [k, v] of Object.entries(shots)) fs.writeFileSync(path.join(out, `view-${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
  console.log('views written', Object.keys(shots), 'errors', errors); await br.close(); srv.close();
})().catch(e => { console.error(e); process.exit(2); });
