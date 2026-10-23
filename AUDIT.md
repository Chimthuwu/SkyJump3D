# SkyJump3D — Full Game Audit (2026-10-23)

Scope: concept, performance, biomes, aesthetics, missed/half-built features, mechanics, level design, direction, bugs.
Nothing in the game was changed for this audit. Evidence is tagged:
**[measured]** = I ran it today (headless Edge + SwiftShader software GL, so *absolute* ms are inflated; counts and ratios are exact),
**[code]** = read directly in `index.html`, **[inferred]** = reasoned, not verified, **[screenshot]** = seen on screen.
Real-GPU numbers are still missing — press **F2** in the game on a real GPU browser and send me the panel.

---

## 0. TL;DR — top priorities

**Technical (in order)**
1. **Freeze static matrices.** 65,557 scene objects, *zero* have `matrixAutoUpdate=false`; `scene.updateMatrixWorld` costs **19.5 ms/call** [measured]. This is the single biggest CPU cost and is nearly free to fix. Expect a large CPU saving on weak machines (unproven until measured on real hardware).
2. **Instance the static world (platforms first).** 28,864 unique materials and 44,653 unique geometries for ~59k meshes [measured]. Collapse platforms/coins/ore/ammo/decals into a few dozen `InstancedMesh` chunks. That is what lets you **keep full draw distance on platforms** (your requirement) *and* cut draw calls — it replaces distance-culling instead of trading against it.
3. **Stream enemies instead of spawning 1,157 at load** [measured]; keep the enemy-only distance cull you proposed.
4. **Adaptive resolution scaler** (target 60 fps, scale 0.6–1.0) + cheaper AA — the safety net for weak GPUs, invisible when not needed.
5. **Amortise level/planet-leg builds** (synchronous, 1,100–1,500 platforms per planet leg [code]) → hitches.

**Creative (in order)**
1. **Give the game a spine.** Right now it is ~15 systems (skate, vehicles, crafting, NPC missions, universes, planets, PvP, voices…) without one clear loop. Proposal in §6: *"jump off the home tower, fall through stacked biome chapters, come home, warp back, get stronger"* — the home-respawn + warp-pad change you just asked for is already the right skeleton.
2. **Rebuild Kaomoji, Glitch and Hellscape as real mechanics biomes** (they are currently visual-only). Concrete designs in §3.
3. **Fix the input/onboarding mess**: key `2` can't select the new Rifle (§7 bug #1), toast says "KeyE", HUD banner overlaps the stats panel.
4. **Style/flow meter** that fuses shooting + traversal + tricks into one score feeling.
5. **Make far-away stuff beautiful** (silhouette landmarks, light pillars) since draw distance is core to the identity.

---

## 1. Measurements (current build, today)

| What | Value |
|---|---|
| `index.html` | 8,365 lines, 660 KB, single file, Three.js r160 from jsDelivr CDN |
| Scene objects | **65,557** (58,957 meshes, 809 sprites, 481 InstancedMesh, 3 lights) |
| Unique materials / geometries | **28,864 / 44,653** (only ~1k materials are distinct *by value* in the earlier audit) |
| Transparent / additive objects | 5,974 / 4,184 |
| Objects with frozen matrices | **0** |
| `scene.updateMatrixWorld(true)` | **19.5 ms** per call (was 12–17 ms at 37k objects: it grows with content) |
| Level tracked by culler / hidden at spawn | 15,911 / 14,591 (92 %) — culling works |
| World at start | 2,918 platforms, 567 specials, 5,306 solids, **1,157 enemies**, 8,242 items, 43 props |
| Draw calls at the spawn roof | **930 – 3,656** depending which way you face (earlier audit: 18,585 before culling) |
| Other viewpoints (4 headings each) | dense cell 582–2,261 · opposite roof 484–1,224 · low centre 195–2,626 · high 109–527 |
| Game-logic CPU | ~3.5 ms/frame (player 0.74, items+street 1.34, enemies 0.37, specials 0.32, rest tiny) |
| Render submit | 23 ms at 456 calls under software GL (relative only) |

Reading: logic is cheap; **the scene graph is the problem** (object count, matrix updates, per-object materials, frustum walk). Fill-rate is a second-order risk (see §2.6).

---

## 2. Performance audit

### 2.1 What is already good
- Distance culling exists and works (`cullTick`: 92 % hidden at spawn), enemy bodies hide beyond 170 m, whole enemies beyond 460 m, pickups/props beyond 380 m [code].
- Retro `customProgramCacheKey` keeps shader programs at ~20–28 [measured earlier + today]. No GC trouble, no leak in earlier heap tests.
- Game logic is cheap; physics uses a near-solid grid (`refreshNearSolids`).
- You now have an in-game profiler (F2).

### 2.2 The platform draw-distance conflict (your concern)
`cullTick` hides anything within `CULL_R=290 m` if small, `CULL_BIG_R=450 m` if ≥8 m [code]. So **platforms *are* being distance-culled** at 450 m — the opposite of what you want. The earlier audit justified it ("fog is opaque past ~270 m"), but that removes the far skyline silhouettes that sell the scale.
**Fix direction:** do not cull static scenery at all; make it cheap enough to always draw (2.3, 2.4). Keep culling only for *enemies, pickups, props, auras* (small, animated, the bulk of per-object cost, invisible in fog anyway). Your instinct is correct.

### 2.3 Freeze static matrices — easiest big win
Three recomputes every object's world matrix every frame unless told not to. Level geometry never moves.
- After `buildLevel`, traverse `lvl`; for every object that is not animated, set `matrixAutoUpdate=false; updateMatrix();` and mark chunk groups `matrixWorldAutoUpdate=false`.
- Detect the animated set automatically: run 60 frames in the headless harness, record which objects' `position/rotation/scale` change, and exempt exactly those (movers, crumblers, enemies, spinning pickups, anim-dressing). Hard-coding the list invites bugs.
- Expected: most of the 19.5 ms disappears. Risk: low if the exempt list is generated, not guessed.

### 2.4 Instance + merge the static world
Per the earlier render report (still valid; platforms ≈ 40 % of calls):
- **Platforms**: slab, plate, underside cone, bullseye, bounce springs → 4–5 `InstancedMesh` with `setColorAt` (the Alien Void route already does this — reuse that pattern). ~3,000 platforms × ~6 meshes ≈ 18k objects → ~20 draw calls.
- **Coins, ammo, ore, weapon pickups** (8,242 items): one `InstancedMesh` per type; update only instances near the player; `taken` hides an instance.
- **Rails, road boxes, additive halo boxes, ground pads**: `mergeGeometries` per spatial chunk (~250 m cells) so per-chunk frustum culling still works.
- Result: 28.9k materials → a few hundred; 44.6k geometries → a few hundred. Big drop in load time, VRAM and GC too. Because chunks are frustum-culled by Three for free, **you can delete the distance cull for static things.**

### 2.5 Enemies
- **1,157 alive at game start** [measured] (~19 meshes each + additive aura/beacon/aggro cone with `fog:false`). Logic is cheap, but they inflate object count, matrix updates and draw calls.
- Stream by region: keep a *budget* (e.g. 120 live within ~450 m); spawn on approach, despawn behind you. Persist "cleared" flags per arena so it still feels like a world.
- Far LOD: below ~170 m show one shared low-poly body (or a single billboard + beacon); ≥460 m hide (already done). Share materials per variant (currently per-enemy `lam(...)`); instance the aura/beacon tori and cones.
- Multiplayer [inferred]: the host simulates all enemies and snapshots at 10 Hz — 1,157 enemies makes snapshots heavy; streaming fixes this too.

### 2.6 GPU / fill rate [inferred from earlier report + code]
- 5,974 transparent and 4,184 additive objects; the universe light pillar (r≈350 m, α 0.3) and big cloud sprites cover 20–25 % of the screen each. On iGPUs this overdraw is the likely GPU ceiling once draw calls are fixed.
- MODERN preset: native resolution up to DPR 2 with MSAA. Add an **adaptive resolution scaler** driven by the F2 frame-time ring (drop scale when avg > 18 ms for 1 s, raise slowly). Offer FXAA instead of MSAA when scaled.
- Depth range `near .1 / far 2500 (14,000 on Mars)` [code] wastes precision and defeats far culling. Render the `fog:false` backdrop (stars, moon, Mars, pillars) in a separate pass or on a layer so the main camera far can drop to ~1,200.
- `renderer.domElement.style.filter` is set for glitch/psychedelic effects [code] — CSS filters force a compositor pass; consider doing them in the upscale shader.

### 2.7 Hitches and CPU extras
- `buildMarsRoute` and `buildPlanetLeg` run synchronously when you touch a pad [code] → multi-hundred-ms stalls. Build in slices (N platforms/frame) or pre-build when the player is within X m of the trigger.
- `updateItems` scans 8,242 items per frame (1.3 ms) → bucket by grid cell. Gib `surfaceY` scans solids per gib → use the nearSolids grid; cap gibs.
- **Load**: Three.js comes from a CDN (single point of failure, no offline play). `esbuild` is already in `node_modules` — a build step would let you minify (660 KB → ~250 KB), split modules and self-host Three.

### 2.8 Suggested measurement protocol
Use F2 on a real-GPU machine in three scenes: spawn roof facing the city, arena fight, post-moon Alien Void. Record FPS, 1 % low, calls, tris, heap. Re-record after each of 2.3 / 2.4 / 2.5 so each win is proven.

---

## 3. Biome audit

### 3.1 State of play [code]
| Biome | Gameplay effect | Visual identity | Gaps |
|---|---|---|---|
| Jungle | −12 % jump on its platforms, tower→trunk morph | strong | only used in **levels 1–2** (and the fall ladder) — the tutorial biome |
| Psychedelic | 0.7× gravity, trip/invert platforms | hue-cycling sky | decent |
| Frozen | slippery platforms | ok | slide is a penalty only |
| Inferno | slower glide fall | ok | weak mechanic |
| Storm | wind gusts + lightning | strong | lightning is cosmetic (no rods/risk) |
| Horror | extra gore, jump scares, spiders/roaches/skeletons | strong | fear is *scripted*, not systemic |
| **Hellscape** | **none** (fire monkeys hurt) | good | cosmetic only |
| **Glitch** | **none** (screen tearing, platform shudder) | good | cosmetic only |
| **Kaomoji** | **none** | weak | see below |

Two selection systems disagree: `zoneFor` (fall-ladder index), `biomeForRegion`/`pickAmbientZone` (routes), and per-planet `biomes[]` lists, so the same biome can feel different/unpredictable by where you are.

### 3.2 Why Kaomoji feels empty and weird
Everything it has is decoration: 2–6 face sprites per platform, a few white puff clusters, 12 faces drifting around the camera, pastel hop-blobs, petal weather [code]. No verb, no hazard, no reward — the player cannot *do* anything different there, and the cheerful palette contradicts the game's dread tone with no payoff. The faces also don't react to you.

**Redesign: "Kaomoji = the emotional biome" (cute that turns).**
- **Mochi platforms**: squash-and-stretch bounce on every landing (a global mini-trampoline), soft shadows, candy rails to grind.
- **Faces react to the player's HP/combo**: `(◕‿◕)` when you're healthy → `(ಠ_ಠ)` as you get hurt → `(╯°□°)╯︵ ┻━┻` flips platforms (a real mechanic: a flipped platform tilts/falls) → `ヽ(`Д´)ﾉ` rage swarm. The biome mood escalates with your death count: more rage the more you die.
- **Balloon faces you shoot**: floating `(*´ω｀*)` balloons drop ammo/hearts when popped; wrong ones burst into sad rain (slows you). Gives the pretty clutter a *job*.
- **Emoticon projectiles**: enemies throw `>:(` / `(╬ಠ益ಠ)` text sprites; speech-bubble subtitles instead of voice; sticker-blob enemies that merge into a bigger one.
- **Audio**: a music-box / chiptune pentatonic track (currently it plays the *city* track, see §7).
- **Mix**: a *Kaomoji × Horror* hybrid ("uncanny") where faces slowly turn to watch you, is the strongest tone payoff in the whole game.

### 3.3 Fix Glitch and Hellscape the same way
- **Glitch**: platforms that flicker/relocate on a beat you can learn; "ghost" platforms that are visual-only; a *rewind* pickup that snaps you back 3 s; corrupted enemies that duplicate on death; checkpoints store state (save-scum glitch).
- **Hellscape**: rising lava/heat from below with a "stay above the line" tension, burn DoT, souls as currency, brimstone vents as launch pads, enemies that gain strength with every kill you don't clear.
- **Frozen**: make sliding a *weapon* — a slide button that preserves/boosts speed on ice; breakable ice that drops enemies.
- **Inferno**: thermals as rideable updrafts (rising columns) rather than "slower fall".
- **Storm**: lightning rods — standing near a rod attracts strikes that charge your weapon; wind lanes to surf.
- **Jungle**: vines/ziplines (swing mechanic) — it should be the *movement-teaching* biome.
- **Horror**: flashlight/dark-adaptation + "they move when you don't look" enemies, so fear is systemic.
- **Alien Void**: gravity wells / orbital low-g hops between space cities.

### 3.4 Mixing biomes
- Replace "one biome per region" with **two overlapping noise fields** (primary + secondary). Border zones blend palette/weather/enemies and may unlock *hybrid* rules (Frozen+Inferno = steam jets; Storm+Glitch = lightning that rewrites platforms).
- Use the existing zone lerp (`updateEnv`) for the blend; add 6–8 curated hybrids rather than N², named in the HUD toast.
- Unify the three selection systems into one function `biomeAt(x,y,z)`; everything (music, enemies, decor, planet legs, hub labels) asks it.

---

## 4. Aesthetic audit

What works: neon-retro identity, strong biome palettes, pixel-upscale, glowing guns, fog-coloured silhouettes.

Opportunities (ordered by impact per effort):
1. **Far-field landmarks**: giant lit silhouettes (a sunken rocket, a face in the clouds, a ring station) that you can see from the spawn roof and *want to reach*. This pays off the "don't cut draw distance" requirement.
2. **Bloom-style glow** without a postprocess pass: additive halo billboards on emissive parts (you already have `fog:false` additive sprites); drive intensity from a *music-beat uniform* so the whole world pulses.
3. **Gradient everything**: the new rifle's vertex-colour gradients are cheap (no extra draw cost). Apply the same pattern to platform undersides, tower shafts and enemies instead of flat-shaded primitives.
4. **Lighting mood per biome**: coloured rim light on enemies matching the biome accent, god-rays through light pillars, per-biome fog *shape* (low ground fog in Horror, high haze in Kaomoji).
5. **UI polish**: unify the HUD (neon-panel style used for hearts) — Glide/Grip/Energy as thin glowing arcs around the crosshair; toast text overlaps the stats panel [screenshot]; the long white controls strip along the bottom is wallpaper — fade after first jump and show contextual prompts instead.
6. **Juice**: hit-stop on kills, screen-space speed lines while gliding/falling, camera roll on grapple/wall-run, impact decals per biome.
7. **Per-biome music/sfx identity** (see §7).

---

## 5. Level design

- **Reads as a scatter of platforms** with 6 arena archetypes and branches [code]. Needs **authored set-pieces** along the route: a "reveal" (come out of fog onto a huge vista), a "gauntlet", a "vertical climb", a "breather", then a "boss". Repeat the rhythm per biome chapter.
- **Verticality is the identity.** Add **long free-falls with objectives**: rings to thread, catchable platforms spaced on a curve, a mid-fall encounter. The existing "fall ladder" (numbered platforms to −72) is the seed of this.
- **Readable routes**: colour-coded path beacons (a faint breadcrumb of lit platforms) so the right path is visible at a distance without a minimap.
- **Branch payoff** exists (dead-end rewards, per recent commit) — make each branch lead to a *named* mini-challenge with a guaranteed upgrade.
- **Checkpoint density**: with warp-pad recall they're now fast travel — space them as chapter gates, not every ~6 stones (§2 of this session's change makes every one a destination, so a list of dozens gets unwieldy; add a map/list UI and cap to ~1 per region).
- **Home tower as hub**: six universes (PLAN-UNIVERSES) were "not started" but six towers exist. Decide whether the *6 slots are for multiplayer only* or for *6 distinct starting worlds*; the plan doc and the code disagree.

---

## 6. Game-design and direction

### 6.1 Core loop proposal
**"Fall → fight → bank → return → upgrade."**
1. Jump off the home tower; the descent is the toy (glide, hoverboard, ground-pound, tricks).
2. Each biome is a *chapter* (≈6–10 min) ending at a guardian and a gate.
3. Coins/ore/souls are *at risk* until banked at a checkpoint (you already have `runPayout`).
4. Death → home tower (done) with a **"death marker" warp destination** to retrieve dropped loot (one-shot, souls-like) — makes death interesting rather than a reset.
5. Home tower: craft upgrades, change loadout, take a contract, warp back.
This uses almost everything already built (missions, crafting, guide NPC, warp pad, upgrades) instead of adding more.

### 6.2 Mechanics
- **Unify scoring into a Style meter**: kills, tricks, grinds, bullseyes, glide time and no-damage streaks feed one multiplier with rank letters; banked on landing. Right now combo systems are separate (bullseye combo, trick combo).
- **Weapon verbs**: blade (parry), rifle (burst/aim), scatter (knockback), plasma (rocket-jump), rail (pierce), beam, arc — give each a *movement* use (rocket-jump exists, scatter-hop, rail-pull). Add alt-fire on the rifle (charged green→purple shot, matching the new colourway).
- **Enemy design**: most are chase-and-contact. Add roles: *flankers* that use the grid, *snipers* with visible lasers, *summoners*, *shield-breakers* — and biome-specific behaviours (Frozen stalkers slide, Glitch clones).
- **Fall damage & fear**: fall deaths + void respawn at home are harsh now that checkpoints don't respawn you. Offer *catch-up*: slow-mo + air-brake on a double-tap near the ground, or a "last-second hover" upgrade.
- **Difficulty curve**: levels grow taller/enemies tougher [code]; add *mutators* ("Low-gravity Tuesday", "Enemies explode") per level for variety instead of pure scaling.

### 6.3 Creative features worth building
1. **Boss as level**: a giant boss you descend *along* (surf its body, shoot weak points).
2. **Grapple/zipline** (Jungle vines, Storm cables) — the missing traversal tool between glide and double-jump.
3. **Co-op rescue / revive** & shared checkpoint warp (multiplayer already exists).
4. **Daily seeded run** (levels are already seeded by level number) with a shared leaderboard (Cloudflare Worker + KV).
5. **Photo mode / replay of the best fall** — the game is inherently shareable.
6. **Biome remix shrines**: optional altars that mix two biomes for a run (the hybrid rules in §3.4) with bigger rewards.
7. **Pet/familiar** from the Kaomoji biome that follows you (a tiny face that reacts to events).

---

## 7. Bugs and half-built / lost features

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **Key `2` can't select the Rifle.** Digit2 is hijacked by the block-builder hand (`hotbarSel=1`), so the starter gun has no hotkey; only Tab/wheel return you to it. The HUD even shows "[2] Rifle". | [code] `index.html` Digit[1-7] handler (~4275) + [screenshot] | **High — fix first** |
| 2 | Toast says **"KeyE to place a block"** (raw key code leaked into copy). | [code] ~4275 | Low |
| 3 | Banner toast overlaps the stats panel at the top-left. | [screenshot] | Low |
| 4 | **Hellscape, Glitch, Kaomoji (and Alien Void/Moon/Ride Park) have no music** — `MUSIC` only defines city + 6 biomes, so they play the city track. | [code] `MUSIC` (~5593), line 5626 | Med |
| 5 | **Hub labels / cluster themes** missing the 3 newer biomes → generic "ZONE". | [code] `clusterThemes` (~1732), `zoneLabel` (~1778) | Low |
| 6 | **"Evolves" toast** falls back to "creatures" for newer biomes. | [code] ~1465 | Low |
| 7 | **`VOICE` table covers only 8 kinds**; newer enemies (dinosaur, skeleton, spider, demon, glitchling, kaomoji, alien…) fall back to `walker` voice/colour/name. | [code] `VOICE` (~7720), `voiceKind` | Med |
| 8 | Biome selection logic is **duplicated in three places** (zoneFor / biomeForRegion / planet `biomes[]`). | [code] | Design debt |
| 9 | **Void Maw is solo-only** (`!net.on`); PvP is always on in rooms with no toggle. | TODO.md | Med |
| 10 | Planet legs lack space cities / cross-links; hell/kaomoji decor on instanced platforms is minimal. | TODO.md | Med |
| 11 | Skyline background towers have no interiors. | TODO.md | Low |
| 12 | **Multiple warp destinations UI**: list order is discovery order, selection by Q cycling — fine for ≤8, awkward beyond. Needs a list/map panel. | [code] (this session) | Med (new feature debt) |
| 13 | `PLAN-UNIVERSES.md` says "not started" but six towers/universe slots already exist; docs and code disagree. | docs vs [code] | Doc |
| 14 | `localStorage` keys still `towerdrop.*`; AGENT_INSTRUCTIONS/OVERVIEW are stale (4,050-line era). | docs | Doc |
| 15 | Three.js loaded from a CDN with no fallback — offline/blocked network = blank page (the new WebGL message doesn't cover it). | [code] importmap | Med |
| 16 | `renderer` creation was unguarded (now shows a message) but any exception in the 8,000-line inline module still yields a blank screen; add a global `window.onerror` overlay. | [code] | Med |

Verified fine today: respawn → home tower, warp pad unlock + warp back, death state machine, F2 HUD, 0 console errors in headless runs.

---

## 8. Suggested roadmap

**Week 1 — quick wins (hours each)**
1. Fix Digit2 / Rifle hotkey + toast copy + banner overlap. (#1–3)
2. Freeze static matrices with an auto-generated exempt list (§2.3).
3. Music/voice/label entries for Hellscape, Glitch, Kaomoji (#4–7).
4. Global error overlay + CDN fallback (#15–16).

**Weeks 2–3 — performance foundation**
5. Instance platforms/items; delete platform distance culling (§2.4).
6. Enemy streaming + shared materials (§2.5).
7. Adaptive resolution scaler (§2.6).
8. Real-GPU measurement on 3 machines with F2.

**Weeks 3–5 — design**
9. Kaomoji redesign (§3.2), then Glitch/Hellscape mechanics (§3.3).
10. Style meter + death marker + warp-pad list UI (§6).
11. Authored set-pieces & landmarks per chapter (§4–5).

**Later**
12. Biome mixing (§3.4), grapple, boss-as-level, daily seed leaderboard, build step/modules.

---

*Method note: the profile numbers come from `perf/harness.cjs`-style headless runs using the existing `__ng` hooks; the scene census used an injected `window.__dbg`. All scripts live in the session scratchpad, not the repo.*
