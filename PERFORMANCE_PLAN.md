# SkyJump3D — Performance Optimisation Playbook

**Audience:** Coding agents working on the SkyJump3D repository (`Chimthuwu/SkyJump3D`).
**Source of truth for behaviour:** the code in `index.html`, not the `PERFORMANCE_AUDIT.md` hypotheses. Where this document and the audit disagree, follow this document.
**Principle:** one measured change per commit, with a before/after baseline from the same device and the same three reference scenes.

---

## 0. Read this before touching anything

### 0.1 What the current code actually contains

Verify each of the following with `grep` before editing. Do not trust the audit's function names blindly.

| Thing | Reality in the source |
|---|---|
| Solid shape | `addSolid()` returns `{ minx, maxx, miny, maxy, minz, maxz }`. **No `aabb` property.** |
| Collision scanners | `blocked()`, `inSolid()`, `heightAbove()`, player-movement helpers each loop over `solids`. |
| Dead function | `playerShadowTick()` is defined but **not called from the main loop**. Do not instrument it. |
| Per-frame HUD write | Happens inside `updateVisuals()`, which rebuilds `#hud.innerHTML` and calls `setHint()` (which re-assigns fixed text) and `heightAbove()` every frame. |
| Particle spawning | `burst()` creates a new `Mesh` + `MeshBasicMaterial` per particle, adds to scene, disposes on death. |
| `Object3D.add` | Monkey-patched to `traverse(retrofitObject)` on every added object. This includes every particle. |
| Resource tracking | `retroMaterials` and `retroTextures` are **iterable `Set`s** iterated by the preset switcher. |
| Renderer presets | `MODERN` → direct `render(scene, camera)`. `PS1`/`N64` → world to a 320×240 render target, then upscale pass. **Two `render()` calls.** |
| `renderer.info` | Default `autoReset = true`, so the second `render()` wipes the first call's counters. |
| Keybinding | `P` opens the multiplayer menu. Do not reuse it. |
| Dev API | `window.__ng` already exists. Extend it. Do not add ad-hoc globals. |
| Level generation | Seeded RNG. **Do not change the number or order of `rand()` calls.** |

### 0.2 The three reference scenes

Every change is validated against these, captured the same way before and after:

1. **Spawn roof** — worst-case view distance, dense buildings.
2. **Arena fight** — ~15 enemies + weapons firing.
3. **Alien Void** — 900 platforms, 21 cities, ~130 aliens.

For each scene, capture for 6 seconds on a mid-range device with **4× CPU throttling** in DevTools:

- Average frame time (ms) and 95th-percentile frame time.
- `renderer.info.render.calls` and `renderer.info.render.triangles` (aggregated over **both** passes).
- `renderer.info.memory.geometries` and `renderer.info.memory.textures`.
- Per-system timings from the overlay (see §1).
- Heap snapshot before scene load and after 60 s.

Save the baseline JSON/CSV in `perf/baseline-<git-sha>.json` in the repo.

### 0.3 Rules for every commit

1. **Instrument first, then optimise.** A change that has no before/after number is not accepted.
2. **One optimisation per commit.** Do not combine the spatial grid with the HUD guard.
3. **Determinism is sacred.** Level generation and multiplayer sync must produce identical results for the same seed. Preserve the RNG call sequence exactly (see §2.1.3).
4. **No visual regressions.** Capture screenshots of the three reference scenes before and after. Diff them. If a change alters the look, it needs explicit sign-off and must be listed in the commit message.
5. **Preserve public behaviour.** Collision results, jump heights, enemy hit reactions, boss patterns, and multiplayer messages must be unchanged unless the task explicitly says otherwise.
6. **No speculative rewrites.** Do not pre-emptively refactor unrelated code, remove unused functions, or restructure the main loop.

---

## 1. Phase 1 — Instrumentation (merge before any optimisation)

The goal is a **safe, opt-in profiling layer** that does not change gameplay. This phase must be merged and produce a baseline before Phase 2 begins.

### 1.1 Extend the existing `window.__ng` dev API

Add to the existing `window.__ng` object (grep for `__ng` to find where it is defined). Do not add new globals.

```js
window.__ng.perf = {
  enabled: false,
  start() { this.enabled = true; this._reset(); },
  stop()  { this.enabled = false; },
  dump()  { console.table(this._snapshot()); },
  reset() { this._reset(); },
  // internals used by the game loop
  _timers: {},
  _frames: 0,
  _reset() { this._timers = {}; this._frames = 0; },
  _snapshot() {
    const out = {};
    for (const k in this._timers) {
      out[k + ' (ms avg)'] = (this._timers[k] / Math.max(1, this._frames)).toFixed(3);
    }
    return out;
  },
};
The game loop should only read window.__ng.perf.enabled once per frame.

1.2 Renderer instrumentation — do it correctly
Two mistakes to avoid, both called out in the review:

Do not time after renderer.render() returns. Capture performance.now() before and after the call, and record the difference.

The performance.now() measurement is JS submission time, not GPU time. Never report it as "GPU time". Use DevTools' GPU track for that.

Because renderer.info.autoReset is true by default, calling renderer.render() twice (as PS1/N64 do) means renderer.info.render.calls after the second call reports only the upscale pass. Set autoReset = false at init and call renderer.info.reset() once per frame.

js
// once, at renderer init:
renderer.info.autoReset = false;

// inside the main loop:
if (window.__ng.perf.enabled) renderer.info.reset();

const tRender0 = performance.now();
if (usesRenderTarget) {
  renderer.setRenderTarget(worldRT);
  renderer.render(worldScene, worldCamera);
  renderer.setRenderTarget(null);
  renderer.render(upscaleScene, upscaleCamera);
} else {
  renderer.render(scene, camera);
}
const tRender1 = performance.now();

if (window.__ng.perf.enabled) {
  const p = window.__ng.perf;
  p._timers.render = (p._timers.render || 0) + (tRender1 - tRender0);
  p._timers.calls  = (p._timers.calls  || 0) + renderer.info.render.calls;
  p._timers.tris   = (p._timers.tris   || 0) + renderer.info.render.triangles;
}
1.3 Per-system timers — cover the whole loop
The main loop calls: physics, enemies, shots, effects, vehicles, portals, world animation, HUD/visuals, multiplayer. Instrument all of them, not just three. Wrap each in a performance.now() pair and add to window.__ng.perf._timers.

js
function timeIt(name, fn) {
  if (!window.__ng.perf.enabled) return fn();
  const t0 = performance.now();
  fn();
  const p = window.__ng.perf;
  p._timers[name] = (p._timers[name] || 0) + (performance.now() - t0);
}
At the end of each frame, increment window.__ng.perf._frames.

1.4 Overlay
When window.__ng.perf.enabled is true, render a small fixed <div> (updated at most 4× per second, not every frame) showing:

FPS and average frame time.

renderer.info.render.calls and triangles for both passes.

The four largest per-system timers from _snapshot().

Do not write to the DOM every frame — the overlay itself must not distort the measurements.

1.5 Baseline capture
For each of the three reference scenes:

window.__ng.perf.start()

Run for 6 s.

window.__ng.perf.dump() → screenshot the table.

Save the numbers in perf/baseline-<sha>.json.

Commit this file before starting Phase 2.

2. Phase 2 — Fix the measured CPU bottleneck
Read the baseline first. Only implement the sections whose corresponding timer is a top-3 contributor. If collision is not in the top 3, skip §2.1 this round.

2.1 Spatial grid for solids
Why: blocked(), inSolid(), heightAbove(), and the player-movement helpers all scan the full solids array. On the Alien Void route, heightAbove() alone runs every frame and scans 900+ solids.

2.1.1 The data shape is {minx, maxx, miny, maxy, minz, maxz}
Do not write solid.aabb. Index the horizontal extent only; test the vertical extent after retrieval.

2.1.2 Grid implementation
js
const CELL = 8;
const solidsGrid = new Map();   // key = (cx * 100000 + cz) → array of solids
let queryStamp = 0;

function gridKey(cx, cz) { return cx * 100000 + cz; }

function indexSolid(s) {
  const cxMin = Math.floor(s.minx / CELL), cxMax = Math.floor(s.maxx / CELL);
  const czMin = Math.floor(s.minz / CELL), czMax = Math.floor(s.maxz / CELL);
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cz = czMin; cz <= czMax; cz++) {
      const k = gridKey(cx, cz);
      let arr = solidsGrid.get(k);
      if (!arr) solidsGrid.set(k, arr = []);
      arr.push(s);
      if (!s._cells) s._cells = [];
      s._cells.push(k);
    }
  }
}

function unindexSolid(s) {
  if (!s._cells) return;
  for (const k of s._cells) {
    const arr = solidsGrid.get(k);
    if (!arr) continue;
    const i = arr.indexOf(s);
    if (i !== -1) arr.splice(i, 1);
    if (arr.length === 0) solidsGrid.delete(k);
  }
  s._cells = null;
}

// Call this whenever a solid's bounds change (moving/expanding platforms).
function updateSolidBounds(s, newBounds) {
  unindexSolid(s);
  Object.assign(s, newBounds);
  indexSolid(s);
}

const _queryOut = [];
function querySolids(minx, maxx, minz, maxz) {
  _queryOut.length = 0;
  queryStamp++;
  const cxMin = Math.floor(minx / CELL), cxMax = Math.floor(maxx / CELL);
  const czMin = Math.floor(minz / CELL), czMax = Math.floor(maxz / CELL);
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cz = czMin; cz <= czMax; cz++) {
      const arr = solidsGrid.get(gridKey(cx, cz));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (s._qstamp === queryStamp) continue;
        s._qstamp = queryStamp;
        _queryOut.push(s);
      }
    }
  }
  return _queryOut;
}
Order note: querySolids returns candidates in grid order, not solids.indexOf order. If any consumer's correctness depends on iteration order, sort _queryOut by s._id (assign a monotonic _id at addSolid time) before returning.

2.1.3 RNG determinism — check before you merge
Before applying the grid to any function:

bash
grep -n "rand(" index.html
For each of blocked(), inSolid(), heightAbove(), and the player-movement helpers, check whether rand() is called inside the candidate-scan loop. If it is, stop. Extract the rand() call out of the scan loop first (as a separate, verified-safe commit), verify the level for a fixed seed is byte-identical, then apply the grid.

If rand() is only called before the scan, the grid is safe as long as querySolids returns the same set of solids that the linear scan would have accepted — which it does, because it only narrows the candidate set, not the acceptance test.

2.1.4 Rewrite the consumers
For each of blocked(), inSolid(), heightAbove(), and player-movement helpers:

Replace for (const s of solids) with for (const s of querySolids(minx, maxx, minz, maxz)).

Keep the vertical test (s.miny <= y && s.maxy >= y) inside the loop. The grid does not filter vertically.

Keep the acceptance test unchanged.

For inSolid(point) and heightAbove(x, z), use a small query box around the point, e.g. querySolids(x - ε, x + ε, z - ε, z + ε).

2.1.5 Level build
Call indexSolid(s) for every solid after its bounds are final. If a generator creates a solid then mutates its bounds, call updateSolidBounds instead.

Call unindexSolid and solidsGrid.clear() at the start of buildLevel().

2.1.6 Acceptance
Frame time on the Alien Void scene improves by ≥ 15 % or the collision timers drop by ≥ 50 %.

Same seed → identical level geometry (compare addSolid call counts and a hash of solids).

Playthrough of the three reference scenes produces identical collision results (spot-check with a fixed input script if available).

No visual change.

2.2 HUD / updateVisuals() change guard
The audit says updateHud(). The actual function is updateVisuals(). It rebuilds #hud.innerHTML and calls setHint() every frame, and calls heightAbove() — see §2.1 for that cost.

js
let _lastHud = '';
let _lastHint = '';

function updateVisuals() {
  // ... existing gameplay reads ...
  const nextHud = `HP ${hp} | SCORE ${score} | ...`; // build the string as before
  if (nextHud !== _lastHud) {
    hudEl.innerHTML = nextHud;
    _lastHud = nextHud;
  }
  // setHint currently re-assigns its argument every call; guard it:
  const nextHint = hintText; // whatever setHint used to assign
  if (nextHint !== _lastHint) {
    hintEl.textContent = nextHint;
    _lastHint = nextHint;
  }
  // heightAbove() remains — it is covered by §2.1.
}
Acceptance: HUD timer drops by ≥ 80 %; HUD visibly updates when values change.

2.3 Material sharing
makeWalker() creates materials per component. Where two components render with identical MeshBasicMaterial / MeshLambertMaterial parameters and neither mutates the material after creation, share one instance via a small cache:

js
const _matCache = new Map();
function sharedBasicMaterial(colorHex, opts = {}) {
  const key = 'basic:' + colorHex + ':' + JSON.stringify(opts);
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: colorHex, ...opts });
    _matCache.set(key, m);
    // shared/cached materials go into retroMaterials so preset switching still works
    retroMaterials.add(m);
  }
  return m;
}
Do not share a material that any caller mutates (colour pulse, emissive flash, opacity fade). Grep for .color.set, .emissive, .opacity, .visible writes on the material after creation before applying this. If in doubt, do not share.

Acceptance: geometry count in renderer.info.memory drops; enemy visuals are unchanged.

3. Phase 3 — Effects and draw calls
3.1 Particle pool — replace burst()'s per-particle mesh allocation
The audit's sketch does not run as written (particleData[i] = {} has no position/velocity; p.color.copy(color) assumes a THREE.Color but burst() takes a hex number). Use the version below.

Two visual changes to accept explicitly:

Scale fade instead of alpha fade — the current burst() fades alpha; the pool will fade scale. This is the cheapest visually-close behaviour without a custom shader.

One draw call for all particles instead of N.

If either is unacceptable, stop and escalate; the alternative is a custom instanced shader with a per-instance alpha attribute.

js
class ParticlePool {
  constructor(scene, capacity = 2000) {
    this.capacity = capacity;
    this.geo = new THREE.SphereGeometry(0.05, 4, 4);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.userData.skipRetrofit = true;      // see §3.2
    this.mesh.count = 0;
    scene.add(this.mesh);

    this.data = Array.from({ length: capacity }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      color: new THREE.Color(),
      life: 0,
      maxLife: 1,
    }));
    this.active = 0;
    this._dummy = new THREE.Object3D();
    this._tmpColor = new THREE.Color();
  }

  // hexColor must be a hex number, as `burst()` already passes.
  spawn(x, y, z, vx, vy, vz, hexColor, life) {
    if (this.active >= this.capacity) return;
    const p = this.data[this.active++];
    p.pos.set(x, y, z);
    p.vel.set(vx, vy, vz);
    p.color.setHex(hexColor);
    p.life = p.maxLife = life;
  }

  update(dt) {
    const d = this._dummy;
    for (let i = 0; i < this.active; i++) {
      const p = this.data[i];
      p.life -= dt;
      if (p.life <= 0) {
        // swap with last active, keep the array packed
        const last = this.data[this.active - 1];
        this.data[this.active - 1] = p;
        this.data[i] = last;
        this.active--;
        i--;
        continue;
      }
      p.pos.addScaledVector(p.vel, dt);
      d.position.copy(p.pos);
      d.scale.setScalar(p.life / p.maxLife);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = this.active;
    if (this.active > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
Key differences from the audit's sketch (all required):

Records are pre-allocated with real Vector3 / Color instances.

spawn() takes hex, not THREE.Color.

update() iterates active only, not capacity.

Scale fades, not colour-multiplied.

mesh.count tracks active instances so the GPU does not draw dead slots.

userData.skipRetrofit = true so the Object3D.add patch does not traverse 2000 instances.

Wire burst() to call particlePool.spawn(...) instead of creating meshes.

Acceptance: GC pause during Arena fight ≤ 1 ms; frame time not worse; particle look within acceptable tolerance (screenshot diff + human review).

3.2 Object3D.add fast path
The Object3D.prototype.add override traverses and retrofits every added object, including every pooled particle. Add a fast path for objects explicitly marked userData.skipRetrofit = true.

js
const _origAdd = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (...objs) {
  for (const o of objs) {
    _origAdd.call(this, o);
    if (!o.userData || !o.userData.skipRetrofit) {
      this.traverse(retrofitObject);
    }
  }
  return this;
};
Do not mark objects that contain retro-materials (skybox, retro-styled props) as skipRetrofit. Only pooled, code-controlled objects (particles, decals) opt out.

Acceptance: no visual regressions in any preset (PS1/N64/MODERN all checked); effects timer drops.

3.3 Instancing / merging — per-category rules
Apply one category at a time, capturing screenshots between each.

Category	Approach	Constraints
Static road/lane segments	BufferGeometryUtils.mergeBufferGeometries per material	Do not merge across material boundaries.
Static platform slabs/plates	InstancedMesh per geometry+material pair	Rebuild instance matrices only when the level changes.
Coins, ammo, hearts	InstancedMesh	Do not instance if each item animates independently with a distinct phase — use per-instance matrices updated each frame, or leave as-is.
Enemy bodies (per variant)	InstancedMesh	Do not merge animation into one mesh — see constraint below.
Enemy decorations (static)	Merge or instance	Must not break hit-flash per enemy.
Labels, banners	Atlas the textures	Cull by distance.
Enemy constraint: different enemy variants have distinct silhouettes, and animations/colour changes/hit effects are per-enemy. If any of the following is true for a component, do not instance it:

The component's colour changes per-frame per-instance.

The component's transform is driven by per-enemy animation state and cannot be expressed as a pure instance matrix.

The component is hidden/shown per-enemy.

For enemy instancing that is safe, keep one InstancedMesh per (variant, component) pair and update the instance matrix from the animation state each frame, just like the particle pool.

Acceptance: renderer.info.render.calls drops by ≥ 40 % on the reference scenes, and each of the three scenes renders pixel-equivalent at a screenshot level (small AA differences tolerated, silhouette changes not).

4. Phase 4 — Resource lifetime and quality scaling
4.1 Level-owned resource tracking
Do not replace retroMaterials / retroTextures with WeakSet — they are iterated by the preset switcher, and WeakSet is not iterable.

Instead, add per-level ownership alongside the global sets:

js
const levelOwnedMaterials = new Set();
const levelOwnedTextures  = new Set();

// whenever buildLevel creates a level-specific material:
function trackLevelMaterial(m) { levelOwnedMaterials.add(m); }
function trackLevelTexture(t)  { levelOwnedTextures.add(t); }

function disposeLevel() {
  for (const m of levelOwnedMaterials) {
    m.dispose();
    retroMaterials.delete(m);   // keep the global set consistent
  }
  for (const t of levelOwnedTextures) {
    t.dispose();
    retroTextures.delete(t);
  }
  levelOwnedMaterials.clear();
  levelOwnedTextures.clear();
}
Rule: shared/cached resources stay in the global sets and are never disposed per level; level-owned resources go in the per-level sets and are disposed on teardown.

Audit buildLevel() for every new THREE.Material(...), new THREE.Texture(...), new THREE.CanvasTexture(...) that is created per level and is not in the shared cache. Route those through trackLevelMaterial / trackLevelTexture.

Acceptance: after 10 consecutive level rebuilds, renderer.info.memory.geometries and renderer.info.memory.textures return to the same value (within ±2), and the JS heap does not grow monotonically.

4.2 Adaptive resolution — extend the existing preset system
Do not create a new quality system. Extend MODERN with a resolution scale, and keep PS1 / N64 at their fixed targets.

js
let _resolutionScale = 1.0;
const TARGET_MS = 16.7, SCALE_STEP = 0.05, MIN_SCALE = 0.5, MAX_SCALE = 1.0;
let _frameTimeAvg = TARGET_MS;

function adaptResolution(avgFrameMs) {
  if (preset !== 'MODERN') return;
  if (avgFrameMs > TARGET_MS * 1.2) _resolutionScale = Math.max(MIN_SCALE, _resolutionScale - SCALE_STEP);
  else if (avgFrameMs < TARGET_MS * 0.8) _resolutionScale = Math.min(MAX_SCALE, _resolutionScale + SCALE_STEP);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * _resolutionScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
}
Call adaptResolution at most once every 30 frames with a smoothed average.

Recompute the render target and camera aspect on resize, and re-clamp _resolutionScale.

Only enable this if the baseline shows a GPU-bound profile (JS timers small, frame time high). If CPU-bound, adaptive resolution will not help.

Acceptance: on a GPU-bound device, average frame time converges to ≤ 20 ms within 3 s and oscillates by < 1 ms.

5. Phase 5 — Deferred (do not start without a Phase 1–4 baseline)
Only attempt these if the earlier phases left the game short of target and the baseline shows these systems as the remaining top cost. Each requires its own regression plan.

Enemy AI LOD. Bucket enemies by squared distance. near → full update. mid → 10 Hz (throttled by frame index). far → sleep, but still test player proximity to wake. Exempt bosses, multiplayer-visible enemies, and enemies with a pending hit reaction. Do not skip emissive/aura for visible enemies.

Staged level generation. Time-slice buildLevel across frames with a progress UI, or move it to a Web Worker (plain-data output only). Must preserve the seeded RNG sequence and produce the same level for the same seed.

Multiplayer network tuning. Out of scope for this playbook.

6. Explicit "do not do" list
Agents must not:

Copy the audit's particle-pool snippet as written. It throws on the first spawn.

Replace retroMaterials / retroTextures with WeakSet.

Write solid.aabb anywhere. The field is minx/maxx/miny/maxy/minz/maxz.

Instrument playerShadowTick() — it is unused.

Use P for the perf toggle — it opens multiplayer. Use window.__ng.perf.

Leave renderer.info.autoReset = true while timing two-pass renders.

Report performance.now() around renderer.render() as "GPU time".

Reorder or add rand() calls anywhere in blocked(), level generation, or enemy spawning.

Merge or instance enemy components that animate, flash, or hide independently.

Build a new quality/preset system. Extend PS1 / N64 / MODERN.

Do more than one optimisation per commit.

Touch gameplay code before the instrumentation baseline is committed.

7. Definition of done (per change)
A change is accepted only if all of the following are in the commit:

Before / after numbers from the same device and the same three reference scenes, taken with window.__ng.perf.

Screenshot diff of the three scenes. Any visual change is explained in the message and explicitly approved.

Determinism check (for any change touching collision, generation, or spawning): same seed → identical addSolid count and a stable hash of solids after build.

No new console errors across a 2-minute playthrough of each reference scene.

No regression in any of the other timers — a change that fixes one system by shifting cost to another is not accepted without justification.

8. Quick reference: what to run before each commit
text
1. window.__ng.perf.start()
2. Spawn roof / Arena / Alien Void, 6 s each
3. window.__ng.perf.dump() → screenshot + paste into commit message
4. Screenshot each scene at the same camera position → attach
5. If the change touches collision / generation: build the same seed twice, compare solids hash
6. Repeat steps 1–5 on the pre-change build for the before column