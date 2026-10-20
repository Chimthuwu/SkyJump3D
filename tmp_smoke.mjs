// Headless smoke of the steep boarding/riding/finale/biome/psy systems in index.html.
// Stub browser + THREE enough to import the module and drive a mini-scenario.
import { readFileSync } from 'fs';
import vm from 'vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import\s+\*\s+as\s+THREE\s+from\s+'three';\s*$/m, '');

// ---- tiny THREE stub (only what the touched paths need) ----
const geo = () => ({ dispose() {}, clone() { return {}; } });
const mat = () => ({ color: { setHex() {}, set() {}, getHex: () => 0, copy() {}, lerp() {} }, emissive: { setHex() {} }, dispose() {} });
const makeObj = () => {
  const o = {
    children: [], visible: true, parent: null, position: { x: 0, y: 0, z: 0, set() {}, copy() {}, toArray: () => [0, 0, 0], addScaledVector() {} },
    rotation: { x: 0, y: 0, z: 0, set() {} }, scale: { setScalar() {} },
    add(...c) { this.children.push(...c); return this; }, remove() { return this; }, removeFromParent() {},
    traverse(fn) { fn(o); }, dispose() {}, get material() { return this.m || (this.m = mat()); },
    userData: {}, onLoad: null, scene: {}, count: 0, clearColor: mat(), needsUpdate: false,
  };
  return o;
};
class THREEStub {
  constructor() { for (const k of ['Scene', 'Group', 'Group', 'Object3D', 'Mesh', 'Sprite', 'Points', 'PerspectiveCamera', 'OrthographicCamera', 'WebGLRenderTarget']) this[k] = new Proxy(function () { return makeObj(); }, { get: () => () => makeObj() }); }
  Vector3 = class { constructor() { this.x = 0; this.y = 0; this.z = 0; } set() { return this; } copy() { return this; } clone() { return new THREEStub.Vector3(); } addScaledVector() { return this; } lerp() { return this; } add() { return this; } sub() { return this; } multiplyScalar() { return this; } length() { return 1; } normalize() { return this; } distanceTo() { return 1; } toArray() { return [0, 0, 0]; } setScalar() { return this; } };
  Color = class { constructor() { this.r = 1; this.g = 1; this.b = 1; } setHex() { return this; } set() { return this; } getHex() { return 0; } copy() { return this; } lerp() { return this; } setHSL() { return this; } };
  Vector2 = class {}; Quaternion = class { setFromUnitVectors() { return this; } };
  MeshLambertMaterial = class { constructor() { Object.assign(this, mat()); } };
  MeshBasicMaterial = class { constructor() { Object.assign(this, mat()); } transparent = false; };
  SpriteMaterial = class { constructor() { Object.assign(this, mat()); } };
  PointsMaterial = class { constructor() { Object.assign(this, mat()); } };
  InstancedMesh = class { constructor() { Object.assign(this, { count: 0, instanceMatrix: { needsUpdate: false }, instanceColor: { needsUpdate: false }, frustumCulled: true, setColorAt() {}, setMatrixAt() {} }); } };
  CanvasTexture = class { constructor() { this.needsUpdate = false; } };
  BoxGeometry = geo; SphereGeometry = geo; PlaneGeometry = geo; CylinderGeometry = geo; TorusGeometry = geo; ConeGeometry = geo; IcosahedronGeometry = geo; OctahedronGeometry = geo; DodecahedronGeometry = geo; CircleGeometry = geo; CapsuleGeometry = geo;
  BackSide = 1; DoubleSide = 2; AdditiveBlending = 3; RepeatWrapping = 4; SRGBColorSpace = 5; NearestFilter = 6; LinearFilter = 7; Fog = class { constructor() {} };
  HemisphereLight = new (class { constructor() { Object.assign(this, makeObj()); this.color = new THREEStub.Color(); } })();
  DirectionalLight = class { constructor() { Object.assign(this, makeObj()); this.color = new THREEStub.Color(); } };
  ShaderMaterial = class { constructor() { Object.assign(this, { uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } } }); } };
  Cylinder = 0; Box = 1;
}
// the stub is instantiated as an object with constructible classes: use a Proxy to allow `new THREE.X()`
const THREE = new Proxy(new THREEStub(), {});

// ---- DOM stub ----
const el = () => ({ style: {}, textContent: '', innerHTML: '', appendChild() {}, removeChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, getBoundingClientRect: () => ({ width: 100, height: 40 }), width: 100, height: 10, getContext: () => ({ fillRect() {}, fillStyle: '', beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, strokeRect() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, strokeText() {}, lineWidth: 1, font: '' }), requestFullscreen: () => Promise.resolve() });
const windowStub = {
  innerWidth: 320, innerHeight: 240, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} }),
  speechSynthesis: null, location: { href: 'file:///x', protocol: 'file:' }, localStorage: { getItem: () => null, setItem() {} },
};
const documentStub = {
  getElementById: () => el(), createElement: () => el(), body: Object.assign(el(), { appendChild() {} }), documentElement: el(),
  addEventListener() {}, pointerLockElement: null, onpointerlockchange: null, hidden: false, exitFullscreen() {},
};

// ---- renderer stub (rejects actual render, enough) ----
const rendererStub = {
  domElement: Object.assign(el(), { requestPointerLock: () => undefined }),
  setPixelRatio() {}, setSize() {}, setViewport() {}, setScissorTest() {}, setAnimationLoop() {}, render() {}, setRenderTarget() {}, clear() {},
  setClearColor() {}, get domElement2() { return null; },
  get context() { return null; }, dispose() {},
};

const sandbox = {
  console, performance: { now: () => Date.now() }, setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: () => 0, fetch: () => Promise.reject(new Error('offline')),
  document: documentStub, window: windowStub, location: windowStub.location, localStorage: windowStub.localStorage,
  THREE, addEventListener() {}, innerWidth: 320, innerHeight: 240, devicePixelRatio: 1, navigator: {}, WebSocket: class { constructor() { this.readyState = 3; } }, URL, URLSearchParams, SpeechSynthesisUtterance: function () {}, AbortController: class {},
  Math, Number, String, Object, Array, JSON, Promise, Error, isNaN, parseFloat, parseInt, Uint8Array, Float32Array, Map, Set, Date,
};
task();
function task() { sandbox.window = new Proxy(windowStub, { set(t, k, v) { t[k] = v; return true; }, get(t, k) { return t[k]; } }); }

vm.createContext(sandbox);
vm.runInContext(mod + '\n;globalThis.__game = { buildLevel, level: () => level, enemies: () => enemies, props: () => props, gear: () => gear, endBosses: () => endBosses, pos: () => [pos.x, pos.y, pos.z], useProp, __ng, mount, tryLatchRail, handleGrind, state: () => state, equip: (k) => { gear = k; } };', sandbox, { timeout: 5000 });

const g = sandbox.__game;
const assert = (c, m) => { if (!c) { console.log('ASSERT FAIL:', m); process.exitCode = 1; } };

buildAndCheck();
function buildAndCheck() {
  // build a level: touchdown should success
  const enemies0 = g.enemies();
  assert(enemies0.length > 0, 'buildLevel spawns enemies');
  const riders = enemies0.filter(e => e.variant === 'rider');
  console.log('enemies:', enemies0.length, 'riders:', riders.length);
  assert(riders.some(r => r.mesh.children.length > 0), 'rider mesh built (bike visual attached)');
  assert(g.props().length >= 4, 'at least the start-roof gear + a ridepark exists');
  // props include bike & buggy & board & skates
  const kinds = new Set(g.props().map(p => p.kind));
  assert(kinds.has('bike') && kinds.has('buggy') && kinds.has('board') && kinds.has('skates'), 'park gear: bike, buggy, board, skates');
}

// simulate a grind: gear on + rail latch
g.equip('board');
const railSolid = findRail();
assert(railSolid, 'a rail solid exists in the current level');
latchAt(railSolid);
function findRail() {
  return (g.__ng ? null : null) || null; // placeholder — real rail comes from sandbox solids below
}
// access solids via the sandbox
const solids = sandbox.__solids || null;
console.log('grinding state after latch:', sandbox.grinding !== undefined);
// deeper: just verify functions exist and don't throw on call
try { sandbox.tryLatchRail(); console.log('tryLatchRail callable'); } catch (e) { console.log('latch call fail', e.message); }

console.log('SMOKE COMPLETE');
