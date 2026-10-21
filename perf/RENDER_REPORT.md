# Render-side audit (scene graph / draw calls / GPU cost)

Raw data: `perf/render-audit.json`. Scripts: `perf/harness.cjs` (serves index.html with an injected `window.__dbg` so scene/renderer/lvl/arrays are reachable; index.html on disk is untouched), `render-spots.cjs`, `render-cull.cjs`, `render-dynhide.cjs`, `render-scene.cjs`, `render-matrix.cjs`.
Environment: headless Edge + SwiftShader, 1280x800, dpr 1, default preset **MODERN**. "render ms" is JS submission time under software GL: use it only as a relative number. Draw calls / object counts are exact.
Spots all face the middle of the six-universe ring: spawn roof (610,582,0), dense cell (-250,478,474), opposite roof (-590,582,0), low centre (0,60,0), Alien Void edge (after `__ng.mars()`).

## Headline

At the spawn roof, looking toward the city, **one frame = 18,600 draw calls** (509k triangles). Triangles are tiny, so this is a draw-call and CPU-submission problem, not a vertex or fill problem. (Facing away from the city the same spot is ~100 calls, which is why a spot check can look fine.) `cullTick` is currently **disabled** (line 5969 comment), so nothing beyond the frustum is removed, although fog is fully opaque at 270 m.

| spot | draw calls | triangles | transparent | additive | scene objects |
|---|---|---|---|---|---|
| spawn roof | 18,585 | 508k | 2,309 | 1,286 | 37,649 |
| dense cell | 18,903 | 492k | 2,262 | 1,286 | 37,649 |
| opposite roof | 19,814 | 533k | 2,426 | 1,327 | 37,653 |
| low centre | 5,973 | 158k | 824 | 620 | 37,649 |
| Alien Void edge | 3,473 | 129k | 315 | 227 | 42,442 |

Scene totals (whole scene, hidden or not): 37.6k objects, 33.9k renderables (31.9k Mesh, 620 InstancedMesh, 437 Sprite, 2 Points, 3 Lights: Hemi + Ambient + one Directional with no shadow), 3.7k plain Groups, only 5 `frustumCulled=false`, 0 objects with `matrixAutoUpdate=false`.
Uniqueness: **20,609 materials** (only **985** distinct by value, 18.5k used by exactly one mesh), **26,325 geometries** (26,249 used by exactly one mesh), 594 canvas textures. Shader programs only 25-28 (good: the retro `customProgramCacheKey` works). GPU geometry count grows 13.9k -> 28.5k as you fly around (geometries upload lazily on first draw and are never freed), so travelling causes upload hitches.

## Draw calls by category (drawn per frame, no cull)

| category | spawn | dense | opp. roof | low | void | instancing / merging verdict |
|---|---|---|---|---|---|---|
| enemy body parts | 4,706 | 5,570 | 5,173 | 2,536 | 1,345 | NOT safe to merge (animated limbs). **Safe: hide body beyond ~330 m** (fog makes it invisible). 544 enemies x ~19 meshes |
| enemy aura/beacon/warn (additive torus, octahedron, aggro cone, `fog:false`) | 746 | 870 | 848 | 413 | 193 | cone/octa/torus are shared-geometry: InstancedMesh per kind is possible but they track enemies per frame; cheaper: drop beyond 120 m |
| enemy opaque rings | 473 | 566 | 558 | 282 | 237 | same as above |
| coins/bananas | 1,843 | 1,583 | 1,812 | 410 | 202 | **Safe, best candidate**: spinning shared geo, one InstancedMesh, update matrices only for those near the player, per-instance hide on pickup (`items[].taken`) |
| platform slab | 1,112 | 1,033 | 1,199 | 246 | 352 | **Safe for static platforms** (1,772 total, 416 are specials that move): InstancedMesh of unit box + unit disc, scale per instance (the Alien Void route at line 1634 already does this) |
| platform plate | 1,113 | 1,033 | 1,200 | 244 | 359 | same, one InstancedMesh per colour (`setColorAt`) |
| platform underside cone | 1,360 | 1,346 | 1,474 | 277 | 363 | Safe: one shared geometry per size class; or drop the cone beyond 200 m |
| platform bounce springs | 652 | 608 | 685 | 150 | 0 | Safe: one shared `springGeo`, 4 per bouncy platform, 76-vertex torus each (this is also 78k of the triangles); instanced or merged into the plate |
| platform bullseye decal (transparent, polygonOffset) | 524 | 469 | 529 | 114 | 0 | Safe: shared material and per-radius geometry already; instance it |
| checkpoint flag/pole | 49 | 49 | 61 | 12 | 59 | tiny |
| other lambert boxes (ground pads y=-1 60x3x56, thin 0.25 m road/ledge boxes, pad cylinders) | 1,077 | 1,177 | 1,206 | 171 | 29 | Safe: static, merge by material colour (BufferGeometryUtils.mergeGeometries) per city chunk |
| additive halo boxes around platforms (8aff3e, opacity 0.22) | 499 (total 'additive other') | 379 | 442 | 196 | 2 | static; merge per chunk, or fold into the plate shader |
| prop/vehicle | 1,151 | 1,087 | 1,062 | 287 | 0 | 53 props, ~35 meshes each; parked vehicles far away can be `visible=false` (+ skip their idle spin) |
| item weapon pickups | 952 | 889 | 1,038 | 172 | 76 | 377 pickups x 4 meshes (core, ring, pip, label sprite); hide beyond fog |
| item ore | 701 | 631 | 728 | 161 | 23 | static cubes, instancing safe |
| item ammo | 400 | 354 | 392 | 108 | 58 | instancing safe |
| rails (tubes, posts) | 142 | 150 | 216 | 0 | 0 | static, merge per rail (curveRail) or per chunk |
| building boxes | 41 | 44 | 42 | 24 | 0 | already cheap (6 per tower) |
| HUD viewmodel (guns on camera) | 14 | 14 | 14 | 14 | 14 | fine |
| labels/sprites, clouds, sky, points, beams/pillars | ~100 | | | | | fine; see overdraw |

Plain totals at the spawn roof: platforms 4,810, enemies 5,925 (incl. auras), items 4,026, props 1,151, other static boxes 1,691 plus 499 additive. Roughly 40% of calls are static level geometry that could be instanced, 60% are dynamic objects (enemies, items, props) that should simply not be drawn when far.

## cullTick (CULL_R) effect — calls per frame

Driven by calling `cullTick` manually (it is disabled in the loop). "tracked" = 10.4k lvl children.

| spot | no cull | R=1000 | R=600 | R=450 | R=330 |
|---|---|---|---|---|---|
| spawn roof | 18,597 | 13,852 | 9,509 | 8,360 | 8,294 |
| dense cell | 18,625 | 17,476 | 11,637 | 10,797 | 10,452 |
| opposite roof | 20,018 | 15,456 | 11,088 | 9,794 | 9,516 |
| low centre | 6,214 | 6,375 | 5,101 | 4,123 | 4,087 |
| void | 3,516 | 2,388 | 2,241 | 2,165 | 2,119 |

* The shipped `CULL_R = 1000` removes only 0-25% because the whole world is ~1,300 m across. The useful values are 450-600 (fog is opaque at 270).
* cullTick leaves ~4,700 enemy-part calls untouched even at R=330: `cullable()` (line 5851) rejects every enemy group because they contain `fog:false` additive aura/aggro meshes and sprites. Enemies, items, props are the majority of what remains.
* Experiment, same spots: hide enemy/item/prop roots farther than 330 m in addition to cullTick R=450 -> spawn 469 calls, dense 2,112, opposite 1,663, low 663, void 426. Without cullTick, dynamic-hide alone: 10.7k at the spawn roof, so both parts are needed.
* `camera.far = 330` alone gives 329 / 2,482 / 1,479 / 852 / 397 calls (frustum culling does everything, zero CPU) but it also clips the `fog:false` backdrop (stars, moon, Mars, universe pillar, glow sprites at 1.6-2.2 km). Only usable if those are moved to a second far-plane pass or kept via layers.
* Risk to flag: hiding at 450 shows the fog-colour silhouette vanishing against the sky gradient; if you want distant skyline silhouettes, keep R >= 600 for large static things and use 330 for small things (coins, ammo, ore, aura, enemies, weapons, props).

## Fill rate / GPU state

* Default preset is **MODERN**: direct render to the canvas, **1 world pass, 0 post passes** (PS1/N64 use a 320x240 target + one upscale quad; much cheaper per pixel). MODERN uses `antialias:true` (MSAA, `maxSamples` 4), pixel ratio `min(devicePixelRatio, 2)` (line 439; the `setPixelRatio(1)` at 293 is overwritten), ACES tone mapping (292-298) in every material shader, fog on all lit/basic meshes, no shadow maps, 3 lights. On a 2x display (4K or retina) the target is 4x the pixels of what I measured: ~8 Mpx with 4x MSAA.
* Transparent/additive at the spawn view: 2,309 drawn transparent, 1,286 additive, 1,621 with depthWrite off. Large ones: universe light pillar cylinder radius 350 m opacity 0.3 (about 25% of the screen), three dark cloud sprites 0.24 opacity radius 130 m at 250-340 m (about 25%, 19%, 12% of the screen), glow sprites radius 400-500 m at 1.6-2.2 km (about 4-8% each, `fog:false`), pink additive beam cylinders next to the camera (24% and 8%). Summed projected coverage is an upper bound of about 2.6 screens of blended overdraw on top of the opaque pass. Not the first problem, but it gets expensive at dpr 2 on an iGPU.
* Triangles 500k/frame, fine. Bounce springs (76-vertex torus per corner, 4 per pad, 652 drawn) are 78k of them.

## CPU-side render overhead

* `scene.updateMatrixWorld()` (run by `renderer.render` every frame): **12.7 ms** for 37.6k objects here; every object has `matrixAutoUpdate=true`, and `scene`/`lvl` themselves recompute each frame which forces (`force=true`) the whole subtree.
  Experiment: `scene.matrixAutoUpdate=false; lvl.matrixAutoUpdate=false`, static lvl children with `matrixAutoUpdate=false; matrixWorldAutoUpdate=false` (5,573 roots) -> **8.1 ms**; additionally freezing enemy/item/prop roots farther than 450 m the same way -> **1.2 ms**. (Three r160 skips a child only when the parent is not forced, hence the need to freeze `scene` and `lvl` themselves; update the transform manually when the root does move.)
* Hidden objects (`visible=false`) are still visited by `updateMatrixWorld`, so cullTick alone does not remove this cost; `traverseVisible` (renderer's projectObject) falls from 4.6 ms to 2.2 ms at R=450.
* Total render() JS time under SwiftShader (includes the above): 121 ms at 18.6k calls, 65-69 ms at 8.3k (R=450), i.e. about 5-6 us per call. Real GPUs/drivers are faster per call but the ratio holds: halving calls roughly halves render CPU.
* Static subset: 11.8k objects (of 37.6k) are provably static (not enemy/item/prop/portal/special/fx/cloud/dressing/camera subtree), 1,436 of them plain Groups.
* `Object3D.add` monkey patch (287-291): 38,107 calls and 61.8k nodes traversed during one full level build, 32 ms inclusive of a 1,000 ms build, so **negligible** (the level build cost is elsewhere). It does the work again for every nesting level, but for particles it is a single node. Low priority.
* `frustumCulled=false`: only 5 objects (decal InstancedMesh, 2 Points, 2 octahedron instanced). Not a problem. The 620 InstancedMeshes (the tower/building facade batches) do get proper bounding-sphere culling in r160.

## Ranked problems and fixes (index.html line numbers as of this audit)

1. **Everything beyond the frustum-visible wedge is drawn with no distance limit: 18.6k calls at the spawn roof.** `cullTick` call removed at line 5969 (function at 5858, `CULL_R=1000` at 5850). Re-enable with R about 450-600 for static lvl children: 18.6k -> 8.4-9.5k. Expected -9k to -10k calls.
2. **Enemies/items/props are never distance-culled (about 11k of the 18.6k calls) and cullTick skips them (`cullable()` at 5851 rejects `fog:false` groups).** Add per-0.35 s `mesh.visible=false` for enemy bodies beyond ~330 m (keep the 1 nofog beacon/arrow if the far marker is wanted), for weapon/ammo/ore/coin/heart items and parked props beyond ~330 m, with the check done inside `updateEnemies` (starts 5156) / `updateItems`. Expected with item 1: 8.4k -> ~0.5-2k calls at the three city spots.
3. **`updateMatrixWorld` 12.7 ms/frame for 37.6k auto-updating objects.** Set `scene.matrixAutoUpdate=false`, `lvl.matrixAutoUpdate=false`, freeze static lvl roots (`matrixAutoUpdate=false; updateMatrix(); matrixWorldAutoUpdate=false` after construction; level building at `buildLevelBody` 3131, `addPlatform` 635), and set `matrixWorldAutoUpdate=false` on culled roots in the same tick that sets `visible=false`. Measured 12.7 -> 8.1 -> 1.2 ms. No draw change, pure CPU.
4. **Static platform pieces are 4.8k separate meshes at the spawn view (slab 1.1k, plate 1.1k, underside cone 1.4k, springs 650, bullseye 520), each with its own geometry and material.** `addPlatform` (635-668): `new BoxGeometry` + `lam()` per platform = 26k geometries / 20.6k materials (985 unique by value). Instance non-special platforms the way `buildAlienRoute` (1634-1647) does (unit box/disc, scale and colour per instance; keep `s.slab`/`s.plate` handles for `scaleSpecial` (628) and `bounceDress` (620), which read `plate.material.color`). Expected: -4.8k calls (to ~20) at the spawn view even without culling, and drops 20k materials/geometries (GPU memory, upload hitches while travelling).
5. **Coins (1.8k calls at spawn) and other pickups (weapons 950, ore 700, ammo 400, hearts 80).** One shared InstancedMesh per kind; spin by shader time or update only instances within ~60 m. Lines 684-760 (`coin`, `ammoBox`, `weaponPickup`, `heart`). Expected -3.5k calls without culling (less with it).
6. **Enemy rig cost: 544 enemies x ~19 meshes = 10.5k meshes, plus 3 additive aux meshes each (aura torus, beacon octahedron, aggro cone at 1020-1042).** After item 2 only near ones draw. Still worth: aura/beacon `visible=false` beyond ~120 m, and `makeWalker` (765) materials shared per variant (not per enemy). Expected -1.2k additive calls at spawn.
7. **Static boxes/rails/additive halos: 1.1k grey/neon lambert boxes, 500 additive halo boxes, 142 rail meshes.** Merge per city chunk by colour (`mergeGeometries`), rails per `addRail` group (5647). Expected -1.5k to -1.7k calls without culling. Keep the colliders (`solids`) separate; merging only affects meshes.
8. **Overdraw and per-pixel settings at high dpr**: MODERN default has MSAA + dpr up to 2 (line 439) + ACES per fragment and about 2.6 screens of blended fill (350 m pillar cylinder 25%, dark cloud sprites 25/19/12%, pink beams next to the camera 24%/8%). Add a render-scale option (0.7-0.85) or cap dpr at 1.5 for MODERN; drop MSAA or use `antialias:false` + FXAA at dpr >= 1.5; hide the far light-pillar and cloud sprites when `fog` would already cover them; shrink beams. Also: the GPU geometry count climbs from 13.9k to 28.5k while travelling (item 4 fixes it).

Not a problem: shader programs (25-28), 3 lights, no shadows, triangle count, `Object3D.add` patch, `frustumCulled=false` count, MODERN render passes (1).
