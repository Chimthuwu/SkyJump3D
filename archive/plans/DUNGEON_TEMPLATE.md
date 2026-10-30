# DUNGEON_TEMPLATE.md — The GLITCH.EXE Pattern for D2/D3/D5

This document describes the reference implementation pattern established by **D1 GLITCH.EXE** that **D2 VHS REWIND**, **D3 THE GULLET**, and **D5 LIMINAL POOLS** must follow. Each dungeon is a **full-height vertical descent** from Canopy (Y=120) to Foundation (Y=0) with a **unique mechanic** (no shared code between dungeons).

---

## 1. Dungeon Architecture Overview

### 1.1 Shared Skeleton (DO NOT FORK)
All dungeons use the same vertical shaft builder:
```js
function buildBetweenDungeonShaft(mouth, dungeonIndex, zone, levels, arenaType, deco) {
  // Golden-angle spiral of hubs from Canopy to Y=0
  // 9 levels, connected via connect()
  // deco(hub, i, levels, slab) — layer unique mechanic HERE
  // Returns { hubs, A (arena), geyser (return), last (boss floor) }
}
```

### 1.2 Boss Framework (REUSE, DON'T REPLACE)
```js
function swapArenaBoss(A, bodyVariant, customVariant, scale, hp, nameStr, dungeonIndex) {
  // Swaps buildArena()'s generic Guardian for a named custom boss
  // Reuses EXISTING body variant mesh, overrides e.variant for AI dispatch
  // Returns mini-boss with .anchorIndex = dungeonIndex
}
```

### 1.3 Required Per-Dungeon Deliverables
| Component | D1 (Reference) | D2/D3/D5 Must Implement |
|-----------|----------------|-------------------------|
| Full-height descent (9 levels) | ✅ | ✅ |
| Unique mechanic system | ✅ Cycle platforms, momentum gates, HUD lies, input swap, fake crash | **Unique per dungeon** |
| Boss (Guardian framework) | ✅ null_pointer | ✅ THE TAPE / THE UVULA / THE THING |
| Gravity Anchor at bottom | ✅ activateGravityAnchor(dungeonIndex) | ✅ Same call |
| Return geyser at Y=0 | ✅ Added by buildBetweenDungeonShaft | ✅ Auto-added |
| Local wiring circuit | ✅ Boss floor pulse → wire | ✅ Per dungeon design |
| Enemy spawns (re-skinned) | ✅ glitchlings, watchers | ✅ Per biome roster |

---

## 2. The GLITCH.EXE Reference Pattern (D1)

### 2.1 State Management (Module-Level, Not Per-Instance)
```js
// GLITCH.EXE state — all dungeons follow this pattern
let glitchCycleT = 0;           // Global cycle timer
let glitchCyclePhase = 0;       // 0=spawn, 1=despawn
let glitchPlatforms = [];       // Tracked mechanic platforms
let glitchInputSwapped = false; // Input swap state
let glitchInputSwapT = 0;       // Input swap timer
let glitchHudLieT = 0;          // HUD lie timer
let glitchFakeCrashT = 0;       // Fake crash timer
let glitchCrashActive = false;  // Fake crash active
let glitchBossArena = null;     // Reference to boss floor
```

**Rule:** Each dungeon gets its own state namespace (e.g., `d4SanityT`, `d6GravityOrientation`). No shared mechanic state.

### 2.2 Decorator Function (Mechanic Layering)
```js
function glitchDeco(hub, i, levels, slab) {
  // 1. Existing behavior (blink platforms every 3rd level)
  if (i % 3 === 1) { addPlatform(...); makeSpecial(p, 'blink', {}); }
  
  // 2. NEW mechanic platforms — layered ON TOP, not replacing
  if (i % 2 === 0 && i > 0 && i < levels - 1) {
    slab.glitchCycle = true;
    slab.glitchCycleOffset = (i * 0.7) % 1;
    slab.glitchMomentumGate = rand() < 0.4;
    // Visual tells: ghost mesh, momentum arrows
    glitchPlatforms.push({ slab, cycleOffset, momentumGate, solid: true });
  }
  
  // 3. Boss floor special handling
  if (i === levels - 1) {
    slab.isGlitchBossFloor = true;
    glitchBossArena = slab;
  }
}
```

**Rule:** The `deco` callback is where the dungeon's unique mechanic attaches to the shared shaft skeleton.

### 2.3 Dungeon Build Function
```js
function buildDungeonGlitchExe(mouth, dungeonIndex) {
  const zone = ZONES.find(z => z.name === 'Glitch') || ZONES[0];
  const { A, last, hubs } = buildBetweenDungeonShaft(mouth, dungeonIndex, zone, 9, 'reactor', glitchDeco);
  
  // Boss: swapArenaBoss + custom visuals
  const mini = swapArenaBoss(A, 'walker', 'null_pointer', 1.9, 42, 'null_pointer', dungeonIndex);
  mini.mat.color.setHex(0x9aa0a8); // Untextured grey tell
  // T-pose, wireframe cage, etc.
  
  // Boss floor tell (wireframe outline on REAL platform)
  const outline = new THREE.Mesh(...); outline.position.set(last.x, 8.2, last.z); scene.add(outline);
  
  // Fake decoys (non-solid, NO wireframe tell)
  for (let k = 0; k < 3; k++) { ... gm.isGlitchDecoy = true; }
  
  // Boss custom behavior data
  mini.glitchPhase = 0; mini.glitchPhaseT = 0;
  
  // Local wiring circuit
  wireRegister(last, bossPlateId, { signalType: 'pulse', pulseLen: 1.0, receivers: [bossWireId] });
  wireRegister({ wire: {...} }, bossWireId, { signalType: 'hold', fake: true, receivers: [] });
  
  // Boss hit callback
  mini.onHit = () => { outline.material.opacity = 1; setTimeout(...); spawnNewDecoys(); };
  
  // Enemy spawns in shaft
  for (const hub of hubs) if (hub.kind !== 'arena' && rand() < 0.3) spawnBiomeEnemy(...);
  
  // Gravity Anchor on death
  mini.onDeath = () => { activateGravityAnchor(dungeonIndex); cleanupGlitchState(); };
}
```

### 2.4 Update Function (Called Every Frame from Main Tick)
```js
function updateGlitchExe(dt) {
  // 1. Global cycle timer (8s period)
  glitchCycleT += dt;
  const cyclePos = (glitchCycleT % 8) / 8;
  const newPhase = cyclePos < 0.5 ? 0 : 1;
  if (newPhase !== glitchCyclePhase) { /* toggle all cycle platforms */ }
  
  // 2. Momentum-gated re-evaluation every frame
  if (glitchCyclePhase === 0) { /* check player speed vs threshold */ }
  
  // 3. Input swap timer
  if (glitchInputSwapped) { glitchInputSwapT -= dt; if (<=0) restore(); }
  
  // 4. HUD lie timer (random)
  if (glitchHudLieT > 0) glitchHudLieT -= dt; else if (rand() < dt * 0.1) glitchHudLieT = 3 + rand() * 4;
  
  // 5. Fake crash timer
  if (glitchCrashActive) { glitchFakeCrashT -= dt; if (<=0) recover(); }
  
  // 6. Random triggers when in dungeon
  if (inGlitchDungeon) { if (rand() < dt * 0.02) triggerInputSwap(); if (rand() < dt * 0.005) triggerFakeCrash(); }
}
```

### 2.5 Input System Integration (playerUpdate)
```js
// In playerUpdate(dt):
const swappedKeys = glitchApplyInputSwap(keys);  // Apply swap FIRST
const ix = (swappedKeys.KeyD ...) - ...;         // Use swappedKeys for ALL input reads
const iz = (swappedKeys.KeyW ...) - ...;
if (swappedKeys.KeyE ...) camYaw -= 1.9 * dt;    // Camera rotation uses swappedKeys
sprintNow = !!(swappedKeys.ShiftLeft ...) ...;   // Sprint uses swappedKeys
const fireHeld = mouseHeld || swappedKeys.KeyF || swappedKeys.KeyJ;
```

**Rule:** Input swap applies to ALL keys uniformly. The `glitchApplyInputSwap(keys)` function returns a new object with swapped mappings.

### 2.6 HUD Lie System
```js
function glitchGetHudLie(key) {
  if (glitchHudLieT <= 0) return null;
  const lies = {
    health: () => Math.max(1, health + (rand() < 0.5 ? -rand() * 3 : rand() * 5)),
    ammo: () => Math.max(0, (ammo[weapon] || 0) + ...),
    score: () => score + ...,
    weapon: () => WEAPONS[(weapon + 1) % WEAPONS.length].name,
    level: () => level + (rand() < 0.5 ? -1 : 1),
  };
  return lies[key] ? lies[key]() : null;
}
// HUD render code should call glitchGetHudLie('health') || health
```

### 2.7 Fake Crash Freeze
```js
function glitchTriggerFakeCrash() {
  // Visual: Full-screen "CRASH" overlay div
  // Audio: Harsh 60Hz square wave buzz
  // Game LOGIC continues running (physics, enemies, timers)
  // Only RENDER appears frozen (overlay blocks view)
}
```

---

## 3. Pattern Requirements for D2/D3/D5

### 3.1 Each Dungeon Must Have:
1. **Unique state namespace** (e.g., `d2TapeT`, `d3BreathPhase`, `d5MemoryMeter`)
2. **Decorator function** (`vhsDeco`, `gulletDeco`, `liminalDeco`) attaching mechanic to shaft
3. **Build function** (`buildDungeonVhsRewind`, `buildDungeonTheGullet`, `buildDungeonLiminalPools`)
4. **Update function** (`updateVhsRewind`, `updateTheGullet`, `updateLiminalPools`) called from main tick
5. **Boss** using `swapArenaBoss` with custom `variant` name matching `variantAI`
6. **Local wiring circuit** on boss floor (at minimum)
7. **Enemy spawns** in shaft using existing families (re-skinned only)
8. **Cleanup on boss death** (`mini.onDeath = () => { activateGravityAnchor(...); cleanupDungeonState(); }`)

### 3.2 Input Integration (If Needed)
- D2 (VHS REWIND): Record/rewind input buffer — hook into `playerUpdate` input capture
- D3 (THE GULLET): No new input — breath cycle is autonomous
- D5 (LIMINAL POOLS): Observation input — track camera direction vs platforms

### 3.3 Visual Tell Standards
Every mechanic element must have a **consistent, readable tell**:
| Dungeon | Mechanic | Tell |
|---------|----------|------|
| D1 | Cycle platforms | Wireframe ghost when despawned |
| D1 | Momentum gates | Faint arrow particles on platform |
| D1 | Input swap | Screen tear (betweenTear) |
| D1 | Fake crash | "GLITCH.EXE HAS STOPPED WORKING" overlay |
| D1 | Real boss platform | Wireframe outline (decoys lack this) |
| D2 | Ghost platform | VHS tracking lines |
| D3 | Breath phase | Visual inhale/exhale pulse |
| D5 | Observed platforms | Subtle shimmer / memory meter |

### 3.4 Determinism (Co-op Critical)
- **All timers use `dt` accumulation** (not `Date.now()`) for frame-perfect sync
- **All randomness uses seeded `rand()`** — never `Math.random()`
- **Platform spawn/despawn driven by global cycle timer** — identical on all clients
- **No network messages for level geometry** — state derived from shared seed + time

### 3.5 Performance Budget
- ~350 Canopy platforms + ~50 per dungeon shaft = ~650 platforms max
- Each dungeon update must be <0.5ms/frame (check F2 HUD)
- Reuse geometries/materials via `geo()` cache and shared materials
- Particle systems (reorient, crash) auto-cleanup via `setTimeout` or life timers

---

## 4. Wiring Integration Checklist
Each dungeon floor must have at least one local circuit:
- [ ] Source node (boss plate, anchor, reorient trigger, etc.)
- [ ] Signal type (pulse/hold/toggle/delay/echo)
- [ ] Receiver(s) (gate platforms, boss tell, visual feedback)
- [ ] Registered in `wireNodes` via `wireRegister`
- [ ] Circuit registered via `wireCircuit`
- [ ] Vein built via `buildVein` for visual feedback
- [ ] `resolveWiring()` called after all nodes registered (done once in buildBetween)

---

## 5. Enemy Spawn Rules
- Use **existing families only** (Walker, Gunner, Charger, Shield, Bomber, Drone, Dinosaur, Gorilla, FrozenStalker, Infernal, StormWraith, Stalker, Kaomoji blobs)
- **Only re-skin** — change `mat.color`, `mat.emissive`, add decorative meshes
- **Do not fork AI** — use `variantAI` aliases via `AI_ALIAS`
- Spawn in shaft: `for (const hub of hubs) if (hub.kind !== 'arena' && rand() < 0.3) spawnBiomeEnemy(...)`
- Boss arena: additional spawns via `mini.onHit` / phase transitions

---

## 6. Gravity Anchor & Return Geyser (Auto-Handled)
- `buildBetweenDungeonShaft` already adds:
  - Return geyser at boss floor (`geyser.returnGeyser = true`, `geyser.geyserTarget = {mouth cx, mouth top + 3, mouth cz}`)
  - Gravity Well anchor slot in `betweenWell.anchors[dungeonIndex]`
- On boss death: `activateGravityAnchor(dungeonIndex)` — increments `betweenWell.anchorsActive`, lights shaft beam
- When all 6 anchors active: Gravity Well unlocks (Phase 4)

---

## 7. Quick Reference: D1 Function Index

| Function | Purpose |
|----------|---------|
| `glitchDeco` | Mechanic decorator for shaft platforms |
| `buildDungeonGlitchExe` | Full dungeon construction |
| `updateGlitchExe` | Per-frame mechanic update |
| `glitchTriggerInputSwap` | Activate input swap + screen tear |
| `glitchTriggerFakeCrash` | Activate fake crash overlay |
| `glitchGetHudLie` | Falsified HUD values |
| `glitchApplyInputSwap` | Transform keys object for swapped input |
| `mini.onHit` | Boss hit callback (flash tell, spawn decoys) |
| `mini.onDeath` | Boss death callback (anchor, cleanup) |

---

## 8. Phase 3 (Freebuff) Assumptions
- D1/D4/D6 are **complete and playable** as reference implementations
- D2/D3/D5 follow this exact pattern with their unique mechanics
- No shared mechanic code between any two dungeons
- All wiring, anchors, geysers, bosses use the same framework
- Enemy roster additions (7 common + 6 uniques) handled separately
- Sanity system (Phase 8) will hook into D4's `d4SanityT` as level-wide float

---

*End of DUNGEON_TEMPLATE.md — Follow this pattern exactly for D2, D3, D5.*