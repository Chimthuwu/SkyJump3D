# NEON GENOCIDE — Multi-Agent Work Assignment

**Goal:** Make the game look **immersive, inspiring, impressive** — visual polish, atmosphere, and "wow" moments that land in a real browser.

---

## PROJECT STATE SNAPSHOT

### What's Already Working (Impressive Baseline)
- **Single-file Three.js game** (~5.3k lines) + Node relay server
- **6 biome zones** (City, Jungle, Inferno, Frozen, Psychedelic, Horror/Storm) with reactive skies, fog, weather, palette
- **Full co-op multiplayer** (WebSocket relay, host migration, Tailscale wizard, room codes)
- **Fish Audio TTS** — cached enemy voices per variant (walker/gunner/charger/shield/bomber/drone/boss/inner)
- **Weapon system** — 9 weapons, beacons on every pickup, checkpoints double as ammo stands
- **Enemy density** — 137–862/level, aggro arrows (red inverted cones, fog-free), spontaneous ambush arenas (12% chance)
- **Minecraft layer** — 9-slot hotbar, biome resources (STONE/WOOD/EMBER/LEAF/CYBERITE), walk-over mining, placeBlock (E), slot 2 = builder hand
- **Platform network** — morphing specials (orbit/piston/breath/trampoline), bouncy ~10%, fall corridor 230 platforms, void loop
- **Horror/Schizo systems** — dread (HP/enemies/zone/void), schizo (global vignette/grain/HUD jitter/hallucination daemon)
- **Procedural funk soundtrack** — per-zone key/tempo, enemy proximity/fall intensity, space=pad+arp
- **Lore terminals** — 20 transmissions on glowing hubs
- **Kill streaks** — DOUBLE→UNSPEAKABLE, ×25 bonuses, arterial fountains, gore caps 420
- **Easter eggs** — ROCK BOTTOM (-152y, +9999, all weapons)
- **Retro shader presets** — PS1/N64/MODERN, chroma-split CRT wobble (Crazy Mode, Key B)
- **Cyberpunk/EVA enemy reskins** — shoulder pylons, torso vents, boss twin-horn crest, magenta optic, neon sigils

### What's NOT Verified / Needs Work (The Gaps)
| Area | Status | Why It Matters |
|------|--------|----------------|
| **Jungle/Psy/Frozen/Storm/Horror zone visuals** | Never eyeballed in real browser | Palettes rebalanced (fog halved, +50% sun, richer mid-tones) but untested |
| **Skyline buildings** | Pitch black | Noted in TODO 2026-10-20 — kills immersion at distance |
| **Cyberpunk/EVA enemy accents** | Syntax/geometry pass only | Need real-browser smoke test at distance + in fog |
| **Platform labels** | Spawn logic works, never eyeballed | Ladder labels (12 sprites) + HUD current/deepest/highest |
| **Multiplayer wizard** | Code complete, never click-tested | Needs server restart + real browser + 2 windows |
| **Fish Audio TTS** | Endpoint untested (Z: drive full) | `/tts?kind=boss&cat=boss&n=0` should return mp3 |
| **Performance on real GPU** | Software GL only (560 fall platforms = slow) | Profile frame time, draw calls, memory |
| **Horror/Dread visual balance** | Headless only | Vignette, heartbeat, screen-tear, WATCHERS silhouettes — need human eyes |
| **Schizo hallucination daemon** | ~25–55s cadence, untested | Phantom toasts, heartbeat-sting, shock rings — tune frequency/intensity |

---

## AGENT ASSIGNMENTS

### 🤖 CLAUDE — "The Visual Polish & Atmosphere Lead"
**Mission:** Make every zone, enemy, and moment look *alive* and *intentional* in a real browser.

**Deliverables:**
1. **Zone Visual Pass** — Load each zone (City, Jungle, Inferno, Frozen, Psychedelic, Horror) in real browser. Verify:
   - Palette reads at distance (fog density, sun intensity, mid-tone richness)
   - Weather particles (leaves/embers/snow/spores) feel right
   - Skyline buildings **emit light / have emissive windows** (fix pitch-black)
   - Jungle trunkify + canopy sway, Inferno flames, Frozen aurora, Psy pulse, Horror breath/grain
   - Reactive sky breathing (Jungle hue shift, Horror pulse)
2. **Enemy Visual Pass** — Spawn every variant (walker/gunner/charger/shield/bomber/drone/boss/guardian/frog/stego) at varied distances:
   - Cyberpunk/EVA accents read in fog (pylons, vents, crests, optic rings, neon bands)
   - Aggro arrows visible across map (additive, fog-free)
   - Eyeball drones/bombers — silhouette clarity, rotor halo, optic nerve
   - Hitbox vs visual mismatch check (r=0.65, h=1.1)
3. **Horror/Dread/Schizo Tuning** — Play 10+ min with each system on:
   - Dread: heartbeat rate, vignette close speed, screen-tear frequency, WATCHER spawn distance/vanish logic
   - Schizo: vignette pulse (2.6s), grain animation (.42s), HUD jitter (5.3s), hallucination cadence (25–55s), toast/subtitle blood-red + grain
   - **Adjust numbers until it feels oppressive but playable, not annoying**
4. **Lighting/Post Pass** — Add/verify:
   - Bloom on weapon beacons, ore cubes, enemy emissives
   - SSAO or cheap ambient occlusion on platforms
   - Tone mapping (ACES/Reinhard) for neon pop without blowout
   - Vignette already exists — ensure it serves gameplay (edge fade, not center)

**Tools:** `server/start-server.bat` → `http://localhost:8080` — use dev hooks: `__ng.setZone('jungle')`, `__ng.setDread(1)`, `__ng.schizo=true`, `__ng.spawn('boss', 20, 1.5)`, `__ng.grow()`

**Success Criteria:** Every zone feels distinct and alive; enemies read at 100m in fog; horror systems create tension without fatigue; skyline glows.

---

### 🎮 BUFFY — "The Gameplay Feel & Systems Integrity Lead"
**Mission:** Ensure every system *plays* as good as it looks — responsiveness, clarity, fairness, juice.

**Deliverables:**
1. **Weapon/Combat Feel** — Play each weapon (blade, pistol, SMG, shotgun, railgun, plasma, rocket, BFG, sword):
   - Recoil, spread, muzzle flash, screen shake, hit confirmation (killFx rings, gold flash, streak toasts)
   - Ammo economy — checkpoint dispensers, weapon beacons, pickup distribution
   - Enemy HP vs weapon DPS — time-to-kill feels right per variant
2. **Movement & Platforming** — Test:
   - Double jump → hoverboard (Space hold) — physics, drift, cancel
   - Bouncy platforms (boost 24–38) — consistency, no phantom launches
   - Morphing specials (orbit/piston/breath/trampoline) — predictable timing
   - Fall corridor — 230 platforms, void loop transition smooth
   - Platform labels — HUD current/deepest/highest updates correctly
3. **Minecraft/Building Loop** — Verify:
   - Hotbar selection (1=blade, 2=builder, wheel/digits)
   - Mine charges (RESLOAD) — walk-over radius 2.2, shake feedback, +N toast
   - placeBlock (E + slot 2) — 4 resource cost, 2.8×1×2.8 platform, refund on block
   - Biome resource drops (city=STONE, jungle=WOOD, inferno=EMBER, frozen=LEAF, psy/storm=CYBERITE)
4. **Multiplayer Sync** — Two real browser windows (not tabs):
   - Host/guest join, names, hearts visible
   - Enemy simulation host migration (lowest ID)
   - Platform determinism (same seed = same platforms)
   - Voice chat not required — but position/state sync must be solid
5. **Progression & Rewards** — Check:
   - Level clear rewards (moon=3000, spontaneous arena=+300+heart+ammo+coin)
   - Kill streak escalation (DOUBLE→UNSPEAKABLE, ×25, 4s window)
   - Lore terminals (20) — accessible, readable, not intrusive
   - Easter eggs (ROCK BOTTOM, more welcome)

**Tools:** Same dev hooks + `__ng.giveWeapon('railgun')`, `__ng.killStreak=5`, `__ng.level=3`

**Success Criteria:** Movement crisp, combat juicy, building intuitive, multiplayer deterministic, progression rewarding.

---

### 🚀 ANTIGRAVITY — "The Technical Performance & Infrastructure Lead"
**Mission:** Ship a stable, performant, deployable build — no crashes, no leaks, no "works on my machine."

**Deliverables:**
1. **Performance Profiling (Real GPU)** — Capture metrics:
   - Frame time (ms) at 1080p/60 target — city, jungle, inferno, moon, fall corridor
   - Draw calls, triangles, texture memory, JS heap over 10 min play
   - Software GL vs hardware delta — identify bottlenecks (560 fall platforms = known heavy)
   - **Optimize:** instancing for repeated meshes (ore cubes, canopy, platforms), texture atlasing, frustum culling tune
2. **Memory/Leak Audit** — 30-min soak test:
   - Level transitions (1→7) — three.js object disposal, geometry/material deref
   - Enemy spawn/despawn — pooled or leaking?
   - Gore/blood FX caps (420) — pool recycling verified
   - TTS cache growth — `tts-cache/` pruning strategy
3. **Server Hardening** —
   - `/tts` endpoint: test 300/hr cap, cache hit/miss, 429/502 handling, key rotation doc
   - `/net-info` — Tailscale detection accuracy, CORS headers
   - WebSocket: maxPayload 64k, ping/30s, room cleanup, host migration race
   - Windows Firewall rule doc for TCP 8080 (admin PowerShell one-liner)
4. **Build/Deploy Pipeline** —
   - `node --check` on index.html (inline script) — zero errors
   - Headless smoke (`run.mjs`) — 0 errors, builds L1–7
   - Electron/Tauri package candidate? (single-file = easy)
   - GitHub Pages / Cloudflare Pages static host for client (server separate)
5. **Bug Fixes from TODO** —
   - `props = []` dedupe (streetReset crash guard)
   - Z: drive space — test scripts cleanup `shot/profile_*`
   - Favicon 404 (pre-existing)
   - Voice lines sync: `LINES` in index.html ≡ `server/voice-lines.json` ≡ `CAST` cues

**Tools:** Chrome DevTools Performance/Memory, `node --check`, `run.mjs`, `probe.mjs`, `server/start-server.bat`

**Success Criteria:** 60fps on mid GPU (GTX 1060 class), 0 leaks over 30 min, server runs 24h no restart, deployable in <5 min.

---

## COORDINATION PROTOCOL

| Channel | Purpose |
|---------|---------|
| **Shared repo** | All edits to `index.html`, `server/server.js`, `server/voice-lines.json` |
| **TODO.md** | Each agent appends `[CLAUDE]`, `[BUFFY]`, `[ANTIGRAVITY]` entries with date + status |
| **Dev hooks** | Use `__ng.*` globals — document new ones in TODO |
| **Conflicts** | Claude owns visuals/CSS, Buffy owns gameplay numbers, Antigravity owns perf/infra — overlap = discuss in TODO |

---

## FIRST HOUR CHECKLIST (All Agents)

- [ ] `cd server && npm install && npm start` — server logs "Neon Genocide server on port 8080"
- [ ] Open `http://localhost:8080` — game loads, no console errors
- [ ] Press **H** — controls hint appears, fades at 14s
- [ ] Press **B** — Crazy Mode toggles (chroma-split + CRT wobble)
- [ ] Press **N** — Music toggles
- [ ] Press **G** — Gore toggles
- [ ] Press **KeyH** — Schizo toggles (body class)
- [ ] Dev console: `__ng.setZone('jungle')` — zone shifts, trunkify runs
- [ ] Dev console: `__ng.setDread(1)` — vignette, heartbeat, WATCHERS
- [ ] Dev console: `__ng.spawn('boss', 15, 1.2)` — boss spawns, aggro arrow visible
- [ ] Two browser **windows** (not tabs) — `?room=test` — see each other

---

## PRIORITY ORDER (User's "IMPRESS" Directive)

1. **Claude:** Zone visuals + skyline glow + enemy accents + horror/schizo tuning → **biggest visual ROI**
2. **Buffy:** Combat feel + movement + multiplayer sync → **biggest playability ROI**
3. **Antigravity:** Perf profile + leaks + server hardening → **enables everything else to ship**

---

**Ship Target:** A build that drops into a browser, runs 60fps, looks *distinctly* Neon Genocide, and makes a friend say "holy shit" within 30 seconds.