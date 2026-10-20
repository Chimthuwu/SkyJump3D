# SkyJump3D — Project Overview (for a reviewing agent)

> Snapshot of everything currently in the game, written so an outside agent can give professional advice
> (aesthetics, performance, architecture, game design, multiplayer). Line numbers are approximate —
> **two agents edit `index.html` concurrently**, so anchors drift. Search by function name.
> The Fish Audio API key is NOT in this document or the client; it lives only in `server/.env`.

## 1. What it is

A first-person, neon/retro, **endless co-op platformer-shooter** set on a huge sky-city. You start on the roof of a
tower, drop through a network of floating platforms, buildings and arenas, fight enemies and Guardian mini-bosses,
land on a street target to clear the level, and the next (taller, harder) level starts. Optionally ascend past the
sky into space and land on the Moon. Tone: "psychosis simulator" — enemies whisper paranoid, urging hallucination
lines in processed voices. Heavy persistent gore. Up to 8-player co-op over LAN/Tailscale.

Origin: "a 3D game where you jump off a tall building" → grew by user requests. Name history: Tower Drop → Neon Genocide → **SkyJump3D**
(`localStorage` keys still use the `towerdrop.` prefix).

## 2. Tech & file map

- **Single file** `index.html` (~4,050 lines): inline ES module, **Three.js r160** via importmap (jsdelivr). No build step, no bundler, no assets — every texture/model/sound is procedural.
- `server/server.js` (Node, dep: `ws`): static file host + WebSocket relay (`/ws`) + Fish Audio TTS proxy (`/tts`) + `/net-info`, `/tts-status`, `/voice-lines.json`. Rooms of up to 8, host migration. Start with `server/start-server.bat` (port 8080).
- `server/voice-lines.json` — voice lines (must mirror `LINES` in `index.html`). `server/.env` (git-ignored) holds the key + `FISH_AUDIO_MODEL=s2.1-pro-free`. `server/tts-cache/` caches clips.
- `TODO.md` — shared task list / agent handoff channel (read first). 
- Test tooling lives outside the repo in `C:\Users\Serge\skytest\` (puppeteer-core driving Edge with SwiftShader; stub harness scripts).

Section order in `index.html`: tuning → helpers → renderer + retro pipeline → textures/materials → world → enemies (`WALKER_STATS`, `makeWalker`, `makeDrone`) → evolving backdrop → sky network (`pickEnemy`, `spawnBiomeEnemy`, `buildArena`, `buildBuildingHub`, portals/routes, `connect`, `buildNetwork`, `walkBranch`, `buildBranches`) → Skyway/Moon → `buildLevel` → player model/weapon meshes/`makeBoard` → effects → audio → saved best → gore → game state → input → combat → weapons → continuous weapons → first-person camera → reactive environment (zones) → Jungle morph → space → wall climbing → physics → enemy AI → items → visuals/HUD → multiplayer → weird platforms/portals → zone worlds → enemy voices → main menu/wizard → dev tools → boot.

## 3. Controls

| Input | Action |
|---|---|
| WASD | move |
| Shift | sprint (×1.6) |
| Space | jump; **double-jump summons the hoverboard**; hold Space in air to ride; at a wall: wall-jump |
| C / Ctrl | ground pound |
| Click / F / J | fire (hold for continuous weapons) |
| Right-click | aim down sights (FOV −18, steadier) |
| 1–7 / wheel / Tab | select weapon (locked ones show "LOCKED") |
| Caps Lock / V | toggle first/third person (**starts first-person**) |
| Q / E | camera orbit (third person) |
| R | respawn at checkpoint |
| M mute · L voice lines · G gore · P retro preset · B "crazy" shader mode |
| Esc | pause menu with debug report + Copy button |
| F3 | live debug overlay · F4 noclip (Space up, C down) |

## 4. Core mechanics & constants

- `GRAV 30`, `JUMP 11.5`, `JUMP2 10`, `RUN 9`, `MAXHP 5` (hearts), terminal velocity 50.
- Physics: AABB solids, per-axis resolution in 1/120 s substeps; 3 cm standing-contact tolerance (fixed an `onGround` flicker bug); `stepUp` for lips ≤ 0.55 m; coyote time; double jump; mantle.
- **Fall damage by impact speed**: ≥32 → 1 dmg, ≥40 → 2, ≥47 → SPLAT (instant death + huge gore). Hurt gives 1.3 s invulnerability + knockback.
- **Hoverboard** (double-jump): `makeBoard()` neon deck with cyan/magenta rails + glow strip + 2 additive thrusters. Speed `RUN*1.4`, accel 46, fall `GLIDE_FALL 3.0`, meter `GLIDE_TIME 8 s` (HUD "Glide"). Surf stance (body rotated 1.25·glideK), lean `leanK` into turns, board banks, camera roll in FPV, FOV kick, glowing particle trail, `sfx.board`. First-person has a separate `boardV` under your feet; other players' avatars also ride boards.
- **Climbing**: jump into a wall to grab; stamina "Grip" bar; wall-jump; mantle.
- **Bounce pads**, **checkpoints**, **portals** (flat neon hatches you fall into; route clusters, landmarks and a hub portal loop connect regions).
- Score: coins +10, enemy points by kind, **Bullseye combo** on the street target. Best score/level saved in `localStorage`.
- Level clear: land on the street-level bullseye/target (ground pad) → next level. Levels are seeded (`seed = 11 + level*97`), so identical for every co-op client. `TOP = min(480 + level*100, 1200)`; `WORLD_R = 640`.

**The Void Loop ("psychosis loop")**: there is no floor. The ground plane is hidden and the y=0 clamp removed; the street target sits on a floating island (`streetPad`) and the boss arena is another floating slab. Falling below `VOID_Y = -160` calls `voidLoop()`: you reappear ~140 m above the moon, beside it on the tower side, still falling (no damage), with a flash + toast ("THERE IS NO FLOOR." → "FALLING. FALLING. FALLING."). Landing on the Moon arena still clears the level.

## 5. Level generation

Everything level-specific goes in the `lvl` group (scene.add is overridden during `buildLevel`).
- Central tower (TH=16), roof spawn pad, 1–2 roof guards, boss waiting on the ground on one side (hp `14 + 5·level`, scale 2.6), street target on the other with a tall cyan beam.
- `buildNetwork`: hub buildings + **6 arena types** (colosseum, cross, tiers, pillars, gauntlet, pit); `connect()` chains floating platforms (step-up ≤3 m, drop ≤8 m, ascending chains); `walkBranch/buildBranches` add random climb/flat/drop branches and extra ladders near spawn; `exit` hub at y=12. Each arena has a **Guardian mini-boss** (`e.mini`, crowned); beating it unlocks the next chain (ghost outlines → platforms rise in: `unlockArena`/`spawnGate`).
- **Special platforms** (`makeSpecial`): movers, **crumblers** (any cracked platform, any colour), **psychedelic** (trip camera wobble, warp, or inverted controls).
- Armory buildings hold weapon pickups (`weaponPickup`).
- Surroundings (`buildSurroundings`), evolving backdrop, Night-City skyline.

## 6. Zones / reactive worlds

Landing on a coloured platform sets the zone (`setZone`); `updateEnv` lerps sky, fog, lights, clouds, weather. First 3 level indices have none; then cycles `ZONES` in blocks of 4 via `zoneFor`.

| Zone | Look | Weather | Gameplay effect | Enemy roster (`BIOME_ENEMIES`) |
|---|---|---|---|---|
| Psychedelic | purple/magenta/cyan | none | low gravity | gunner, shield, walker, drone |
| Jungle | green; trees, vines, monkeys; "trunkify" tower morph | leaves | weaker jumps | dinosaur, gorilla, charger |
| Frozen | ice blue | snow | slippery | frozenStalker, shield, walker, drone |
| Inferno | red/orange | embers | slower glide fall | infernal, charger, gunner, bomber |
| Storm | dark grey-blue | rain + lightning + sky bolts | wind gusts | stormWraith, gunner, shield, drone |
| Horror | near-black crimson | ash | extra blood on hit | stalker, charger, walker, shield |

Each has world dressing (`dressSite`, `animDress`), giant scenery (`buildBackdrop`), `zoneGround`, and a CSS screen filter. Night-City sky presets: Night City, Neon Rain, Violet Smog, Chrome Night, Blackout.

## 7. Space & Moon

`spaceK` fades gravity to 35%, sky/fog to black, shows star Points. The **Skyway** is bounce-pad stairs up to y = TOP+800, then a bridge to a self-lit cratered Moon sphere (`MeshBasicMaterial`, `fog:false`) with an arena. Landing on the Moon triggers `levelClear('moon', 3000)`.

## 8. Weapons (keys 1–7)

Blade (melee, 2 dmg) · Laser (rapid red bolts, infinite) · Scatter (6 magenta beams; shells) · Plasma (slow orb, explosion, rocket-jump; rockets) · Railgun (piercing; rails) · **Beam** (continuous stream, energy meter + overheat lock) · **Arc** (continuous short-range lightning, up to 3 targets). Hitscan via `castRay`; beams are additive meshes. Unlock system (added by the other agent): `weaponOwned`, pickups, ammo caps/reserve, "LOCKED" in HUD; ammo caches and hearts also drop.

## 9. Enemies

Walker, gunner (aimed bolts), charger (hog, ×1.25), shield (blocks frontal hits), bomber (kamikaze), drone (flying), dinosaur, gorilla, frozenStalker, infernal, stormWraith, stalker; Guardian mini-boss per arena; ground boss. Stats in `WALKER_STATS` (hp 2–7, speed 1.8–3.0, 50–180 pts). Far enemies sleep. Cyberpunk/EVA visual palette (cyan/magenta/violet neon accents, visors). Damage kinds: hit, stomp, pound, blast, self.

## 10. Gore

Instanced decal mesh (≤5000) painting floors and walls with blood; gibs, blood-on-screen, splatter on hurt (bigger in Horror). **Persists per level** in `localStorage` (`towerdrop.gore.L<level>`) — player blood and guts stay on the map. `G` toggles.

## 11. Audio & voices

- WebAudio-synthesized sfx (no files). M mutes.
- **Alien voices**: per-kind noise/tone recipes, plus spoken hallucination lines (paranoid, urging: "jump the gap", "kill them all", "they're watching you"). Lines in `LINES` (grunt/boss/death; 12/6/6). Deliberately **no self-harm lines**.
- **Fish Audio TTS** via server proxy only: model `s2.1-pro-free` (sent as `model` header), voice cast per kind (`CAST` in `server.js`: walker creeper-whisper, gunner/drone horror girl, charger doom, shield ghost, bomber goblin, boss demon, inner horror-girl whisper). Server serves **allowlisted lines only**, caches to disk, retries only 429/5xx, caps 300 new clips/hour, free tier 5 concurrent. Client processes clips through an FX chain per kind (`VFX`/`voiceChain`: octave-down twin, echo, ring-mod, distortion, low-pass, reverb). Random "inner voices" occur during play. Falls back to browser SpeechSynthesis. Subtitles in `#subs`. `L` toggles.
- Pickup voice "Eshay!" (`sfx.eshay`).

## 12. Rendering / aesthetics

- Retro pipeline (added by "Buffy"): 320×240 render target upscaled, Bayer dither, colour quantize; presets `PS1`, `N64`, `MODERN` (default); `retroMaterial()` patches Lambert/Basic materials (vertex snap, affine UVs, flat shading) and `Object3D.add` is monkey-patched to retrofit meshes. Fixed 4:3 camera aspect. Settings in `localStorage` `towerdrop.settings`. "Crazy" mode (B).
- Procedural everything: canvas textures, box/cylinder/sphere primitives, additive glow meshes, Points for stars/weather.
- HUD: hearts, Glide/Grip/Energy bars, level/altitude, score/best/combo, weapon line, boss bar for nearest Guardian/boss, toast, subtitles, players list.
- **Known aesthetic problems (user: "ok ok ok but the aesthetics....")**: overall very dark and muddy; large HUD box; chunky first-person gun; black platform undersides; low contrast between neon and background; flat-shaded primitives lack material richness.

## 13. Multiplayer

- Node relay, rooms ≤8, host migration. **Host simulates enemies**, sends snapshots at 10 Hz (+ full snapshot every 5 s); guests send damage (`dmg`) to host. Shared: player pose (15 Hz), rays, rockets, booms, slams, enemy shots, deaths, level clears. Local-only: pickups, blood, score. Deterministic seeded levels, so geometry isn't sent.
- Avatars with name tags and hoverboards; players HUD (HTML-escaped).
- **Menu wizard**: HOST (checklist: Tailscale detected via `/net-info`, server running, invite link, room code, copy, START HOSTING) and JOIN (steps, paste invite, TEST CONNECTION, JOIN navigates to host page which auto-connects via `?room=`). `serverOrigin()` finds `localhost:8080` even from a `file://` page.
- This PC: Tailscale 100.95.67.84, LAN 192.168.0.226.
- **Security**: server is unauthenticated, intended for LAN/Tailscale only — do not expose to the open internet. **Open issue**: Windows Firewall has no inbound rule for Node, so friends over Tailscale can't connect until the user runs (admin PowerShell): `New-NetFirewallRule -DisplayName "SkyJump3D (Tailscale)" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -InterfaceAlias "Tailscale"`.

## 14. Menus & dev tools

Main menu START / MULTIPLAYER / EXIT (+ settings). ESC pause with debug report; F3 overlay (last blocker/clamp, position); F4 noclip; `window.__ng` hook: `info()`, `tp(x,y,z)`, `look(yaw,pitch)`, `zone(name)`, `voice(kind)`, `pos`.

## 15. Verified vs. unverified

Verified in real Edge (software GL): loads with no console errors; menu + wizard flow (including from `file://`); TTS for all 8 voice kinds incl. cache and allowlist rejection; Inferno world; Skyway + Moon landing; first-person start; hoverboard trail + glide drain; two-window multiplayer visibility.
**Not verified**: Jungle / Psychedelic / Frozen / Storm / Horror visuals by eye; hoverboard deck appearance (not clearly visible in screenshots); frame rate on a real GPU (software GL gave ~8–13 fps); firewall path for remote friends.

## 16. Known issues / risks

1. Dark, muddy look (see §12).
2. Performance unmeasured on real hardware; many dynamic lights/particles/instanced decals/320×240 post pass.
3. Single 4,000-line file edited by two agents simultaneously — merge-drift and hidden syntax breaks have already caused three blank-screen/startup crashes (duplicate `const`, bad GLSL, undefined `hide`). Recommend a syntax check before every handoff.
4. Firewall blocks remote joiners (§13).
5. Fish API key was pasted into chat multiple times — user should rotate it.
6. `localStorage` keys still named `towerdrop.*`.
7. No server-side validation of damage; host-authoritative only for enemies.

## 17. Questions for the reviewing agent

1. How do we fix the dark/muddy look while keeping the retro-neon identity (palette, lighting, emissive use, bloom-style glow, HUD sizing)?
2. Performance plan: what to profile/cut first (lights, draw calls, particles, decals, post pass)? Is single-file still viable or should we split into modules with a build step?
3. Architecture: separating simulation from rendering for multiplayer; making the relay safe for wider use (auth, rate limits).
4. Game feel: hoverboard handling, fall-damage thresholds, difficulty curve across levels and zones.
5. Content: variety of arenas/enemies per zone, pacing of unlocks.
