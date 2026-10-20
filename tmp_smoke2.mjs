import { readFileSync } from 'fs';
import vm from 'vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8').replace(/\r/g, '');
const extract = (name) => {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing fn ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return html.slice(start, j + 1); }
  }
  throw new Error('unclosed ' + name);
};

const code = `
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const burst = () => {}, toast = () => {}, sfx = { jump() {}, coin() {}, click() {}, eshay() {} };
const JUMP = 11.5, TERM = 48;
const gearPlate = (g) => (g === 'board' ? 0xff3fc8 : 0xb0ff63);
// THREEstub: only needs Group/position/mesh basics for prop + rider visuals
const makeObj = () => { const o = { children: [], boolVisible: true, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { setScalar() {} }, add() {}, remove() {}, removeFromParent() {}, traverse() {}, userData: {} }; o.material = Object.assign(o.m || (o.m = {}), { color: {} }); return o; };
const THREE = { Group: function () { return Object.assign(makeObj()); } };
const retroMaterial = () => ({});
const lam = () => ({});
const lamC = () => ({});
const basicC = () => ({});
for (const k of ['Mesh', 'Group', 'Sprite', 'Points', 'Object3D', 'CylinderGeometry', 'SphereGeometry', 'PlaneGeometry', 'BoxGeometry', 'TorusGeometry', 'ConeGeometry', 'CircleGeometry', 'MeshBasicMaterial', 'MeshLambertMaterial', 'SpriteMaterial', 'CanvasTexture']) THREE[k] = function () { return Object.assign(this, makeObj()); };
THREE.AdditiveBlending = 3; THREE.DoubleSide = 2; THREE.BackSide = 1;

let gear = 'board', grinding = null, onVehicle = null, parkSeen = false, hintProp = null, grindScore = 0, score = 0;
let pos = { x: 0, y: 5, z: 0 }, vel = { x: 0, y: -5, z: 0 };
let onGround = false, riding = false;
let jumpPress = false, poundPress = false;
const props = [];

// synthetic rail: horizontal bar along X
const rail = { minx: -20, maxx: 20, miny: 1.78, maxy: 2.22, minz: -0.35, maxz: 0.35,
  rail: { x1: -20, z1: 0, x2: 20, z2: 0, len: 40, ux: 1, uz: 0, height: 2, t: 0.5 } };
const solids = [rail];
const overlapXZ = s => pos.x + 0.45 > s.minx && pos.x - 0.45 < s.maxx && pos.z + 0.45 > s.minz && pos.z - 0.45 < s.maxz;
const overlapY = s => pos.y < s.maxy - 0.01 && pos.y + 1.8 > s.miny;

${extract('addProp').replace(/scene\.add\([^)]*\);/g, '')}
${extract('nearestProp')}
${extract('mount').replace('p.mesh.visible = true;', '')}
${extract('dismount')}
${extract('useProp')}
${extract('tryLatchRail')}
${extract('grindExit')}
${extract('handleGrind').replace('Math.random() < dt * 40', 'false')}
${extract('updateStreet')}

// rider spawn without the world
const riderSpawns = [];
globalThis.spawnTrack = (x, y, z) => riderSpawns.push([x, y, z]);
${extract('spawnRiderGroup').replace('makeWalker(rx, y, rz, slab, 1, false, \'rider\')', 'spawnTrack(rx, y, rz)')}
${extract('makeRiderVisual')}

globalThis.__test = {
  propsCount: () => props.length,
  addParkProps: () => { props.length = 0; addProp('bike', 4, 1, 0); addProp('buggy', -4, 1, 2); addProp('board', 2, 1, -2); addProp('skates', -2, 1, 2); return props.length; },
  nearProp: (x, y, z) => { pos = { x, y, z }; const p = nearestProp(); if (p) mount(p); return { kind: onVehicle && onVehicle.kind, riding: !!onVehicle }; },
  dismountForce: () => { useProp(); return { riding: !!onVehicle, gear }; },
  latch: () => { pos = { x: 0, y: 3, z: 0 }; vel = { x: 3, y: -5, z: 0 }; gear = 'board'; onGround = false; grinding = null; onVehicle = null; return tryLatchRail() ? grinding : null; },
  grind: (dt) => { jumpPress = false; handleGrind(dt); return { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), t: +grinding.rail.t.toFixed(2), score }; },
  endGrind: () => { jumpPress = true; handleGrind(0.016); return { grinding, vy: +vel.y.toFixed(1) }; },
  riders: (n) => spawnRiderGroup(0, 5, 0, { minx: -20, maxx: 20, minz: -20, maxz: 20 }, n, 4),
  riderCount: () => riderSpawns.length,
  bag: () => ({ gear, grinding: !!grinding, score, vy: +vel.y.toFixed(1) }),
};
`;

const ctx = vm.createContext({ console, Math, Number, String, Object, Array, JSON, Promise, Date, THREE, retroMaterial, lam, lamC, basicC, makeObj });
vm.runInContext(code, ctx, { timeout: 5000 });
const t = ctx.__test;
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } };

assert(t.propsCount() === 0, 'no props initially');
assert(t.addParkProps() === 4, '4 park props added');

const mounted = t.nearProp(4, 1.8, 0);
assert(mounted.riding && mounted.kind === 'bike', 'mounted hover-bike near prop');

const beforeLatch = t.latch();
assert(beforeLatch === null, 'cannot latch while riding');

t.dismountForce();
const latched = t.latch();
assert(latched && latched.rail, 'latched to the rail after dismount (board gear)');

const s1 = t.grind(0.02), s2 = t.grind(0.02);
assert(s2.x > s1.x, 'grind slides along the rail');
assert(s2.score > s1.score, 'grind earns score');
assert(Math.abs(s2.y - 2.75) < 0.01, 'rider height pinned to the rail');

const end = t.endGrind();
assert(!end.grinding && end.vy > 0, 'rail jump launches off the grind');

t.riders(3);
assert(t.riderCount() === 3, '3 rider spawns tracked');

console.log('SMOKE2 COMPLETE: grind / mount / rider paths verified');
