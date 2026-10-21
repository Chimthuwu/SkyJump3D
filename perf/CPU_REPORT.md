# CPU profile report (headless Edge, SwiftShader; GPU time ignored)
Harness: perf/cpu-profile.cjs (CDP Profiler @0.5 ms + __ng.perf laps), perf/heap-cull.cjs. Raw: perf/cpu-profile-*.json.
Headless fps is 4-5 (software raster); "(program)" = SwiftShader rasterising, ignore it. Frame JS CPU is what counts.

## World size at spawn
tracked 10954 level objects, 12094 lvl children, 2923 solids, 1772 platforms, 416 specials, **544 enemies alive**, 4867 items, 53 props.
Draw calls ~3100/frame, ~86k tris/frame (tiny per call => draw-call/submission bound), 2464 geometries, 72 textures.
Heap: 169 -> 152 MB over 30 s, sawtooth only; no leak, GC pressure low ((garbage collector) 0.7% of samples).

## JS ms per frame by phase (PERF laps; render from CDP)
| phase | spawn idle | arena fight (15 foes firing) |
|---|---|---|
| WebGLRenderer.render JS (submission) | ~52 | ~45 |
| of which updateMatrixWorld (whole scene, 12k objs, every frame) | ~17 | ~12 |
| projectObject (frustum cull walk) | ~13 | ~12 |
| renderBufferDirect + setProgram + uniforms (3100 calls) | ~22 | ~20 |
| player/physics | 0.76 | 1.39 |
| enemies | 0.22 | 0.51 |
| shots | 0 | 0.39 |
| items+street (updateItems loop 4867 items, playerShadowTick, home base) | 1.99 | 1.52 |
| missions/evolve/music | 0.12 | 0.18 |
| fx (updateFx/Gibs/clouds) | 0.02 | 1.94 (4.9 while gore is flying, scene 2b) |
| specials | 0.23 | 0.20 |
| visuals+HUD | 0.37 | 0.36 |
| net | 0.00 | 0.00 |
Game logic total is ~4-6 ms/frame; **rendering submission is ~45-50 ms/frame = ~90% of JS time.**

## Ranked bottlenecks
1. **Draw calls ~3100/frame (7x over a healthy budget).** Cull is OFF: index.html:5969 comment "cullTick disabled"; setCull(150..1000) changes nothing (calls 6154->6132 for 2 frames). Fix: re-enable cullTick (5858) but it is O(tracked) and needs `Box3.setFromObject` once (already cached), or better merge static level meshes by material (BufferGeometryUtils.mergeGeometries per city/universe) and use InstancedMesh for repeated windows/props. Biggest win, ~25-35 ms.
2. **Object3D.updateMatrixWorld over ~12k objects every frame: 12-17 ms/frame** (three.module.js:7720). Static level/dressing objects should have `matrixAutoUpdate=false; updateMatrix()` once after build (or `matrixWorldAutoUpdate=false` on `lvl`, calling lvl.updateMatrixWorld(true) only when something moves). Hook after buildLevel / universe build; skip groups with animated children.
3. **projectObject frustum walk: ~13 ms/frame** over 12k objects (13353 intersectsObject). Fix: universe/city-level parent Groups with a bounding-sphere early-out, or distance-based `visible=false` for whole universes beyond ~500 m (cheap: 6 universes, test 6 distances per 0.35 s). Parent `visible=false` skips the whole subtree in projectObject and in updateMatrixWorld.
4. **Per-call state setup: renderBufferDirect/setProgram/uniform upload ~20 ms/frame** driven by #1; also 23-24 programs, 2464 geometries. Reduces with merging / sharing materials (fewer program switches).
5. **Gore/FX bursts: updateFx+updateGibs+splatter+surfaceY = 1.9 ms avg, 4.9 ms/frame while gibs fly** (updateGibs index.html:3603 9.4 ms/s self, surfaceY 3476 loops solids per gib, splatter 3506). Fix: cap gibs/decals, make surfaceY use a spatial grid or cache per gib every N frames, pool meshes.
6. **updateItems (5176): ~1.0 ms/frame**, 4867 items iterated each frame with Math.abs reject. Fix: bucket items by grid cell/zone and only iterate cells within 90 m, or sleep-list far items; coarse reject only every 4th frame.
7. **updateStreet (5968) + playerShadowTick (5878): ~0.5-1 ms/frame** (playerShadowTick is live, contrary to PERFORMANCE_PLAN 0.1). Throttle to 20 Hz / skip when state!=play.
8. **544 enemies alive at spawn** (cull().enemies) across 6 universes. Logic is cheap now (0.2 ms, distance-gated) but their meshes count toward draw calls/matrix updates; set far enemies `mesh.visible=false` (parent invisibility also skips matrix updates) or spawn lazily per universe on approach. Also player/physics goes to 1.4 ms with fight (solids 2923 scanners: blocked/inSolid/heightAbove loop all solids -> spatial grid).

Not issues: HUD (0.37 ms), net (0), missions/music (0.1-0.2), GC/heap.
Caveat: scene 2 (teleport +300,+200) rendered only 47 calls (landed in empty space) -> 15.7 fps; shows the cost is geometry in view, not logic. Scripted-move scene = 2b. Headless SwiftShader inflates GL-call cost (renderBufferDirect/setProgram) somewhat; items 1-3 are pure JS traversal and are real.
