# SkyJump3D

A first-person, neon/retro **sky-city platformer-shooter** with co-op. You start on a tower roof high above the
city and work your way down (or up) through floating platforms, rooftops, arenas and highways — all in a single
`index.html` built on Three.js. Every model, texture and sound is procedural, so there are no assets to download.

**Play:** https://sky-jump.pages.dev

## What's in the game

- **Movement:** run, sprint, double-jump (which summons your hoverboard), long glide, wall climbing/jumping, ground pound, rail grinding.
- **A huge sky-city:** buildings, themed arenas with Guardian bosses, spiral and weaving platform chains, trampolines,
  mega-rails, loops, highways and a Ride Park. Levels get taller and harder each time.
- **Biomes:** Jungle, Frozen, Inferno, Storm, Horror and Psychedelic zones, each with its own enemies, weather and resources.
- **Vehicles:** DeLorean-style car and a hover-bike. Hold **Shift** to boost, **E** to get on/off. Drops are cushioned, and
  highways have ramps, kickers and loop-the-loops (cars on wide roads, bikes on narrow trails).
- **Weapons (1–7):** Blade, Laser, Scatter, Plasma, Railgun, Beam, Arc. Empty weapons auto-switch to one with ammo.
- **Beyond the sky:** a skyway to the Moon, then the **Alien Void** — ~900 mixed platforms (moving, orbiting, crumbling, thin beams),
  drifting space cities underneath, alien troops and UFOs — leading to Mars.
- **Warp gates:** hidden until you discover them by landing on their platform.- **Co-op:** up to 6 players. On the public site, MULTIPLAYER -> HOST A GAME works out of the box through the online Cloudflare relay (just share the invite link). For LAN / Tailscale, run the small Node relay in `server/`.
- **Room modes (host picks):** on the host screen toggle **COOP** (teammates can never hurt each other, even with bullets/beams) or **PVP** (classic free-for-all friendly fire). The choice is room-wide: it syncs to everyone already connected and applies to late joiners. Toggle with the button, **C**, or **RB**.

## Controls

| Key | Action |
|---|---|
| WASD | move |
| Shift | sprint |
| Space | jump · double-jump = hoverboard · hold to glide · wall-jump |
| C / Ctrl | ground pound |
| Click / F | fire · Right-click aim |
| 1–7 / wheel | choose weapon |
| E | get on/off a vehicle (near one) |
| Shift (held, on a vehicle) | boost |
| V / Caps Lock | first / third person |
| R | respawn at last checkpoint |
| M / N / G / H | sound / music / gore / hint bar |

### Gamepad / handheld (Steam Deck, ROG Ally, Legion Go, controllers)

Works in any browser with a controller connected — no mapping app needed.

| Input | Action |
|---|---|
| Left stick | move |
| Right stick | look (same sensitivity clamps as mouse) |
| A | jump · double-jump hoverboard · hold to glide · wall-jump |
| B | ground pound |
| X | interact / use prop / place block (same as E) |
| Y | first / third person |
| RT | fire · LT aim down sights |
| RB | next weapon · LB grapple (hold to reel; also picks warp destinations) |
| L3 (stick click) | sprint, or boost on a vehicle |
| D-pad or left stick | browse the menus (also arrow keys) on all title screens: main, level select, multiplayer, host, join |
| A | confirm / start (also ENTER) — starts the selected level from level select |
| B / Back | back (main ← level select/multiplayer, multiplayer ← host/join) — also un-pause during play |
| X / Y (multiplayer screen) | open host / join directly (same as the buttons) — room codes still need the keyboard |
| C / RB (host screen) | toggle the room mode PVP <-> COOP |
| Start | pause (ENTER on the title screen) |
| `[` / `]` on the keyboard | look-sensitivity down / up (30%–300%) |
| `I` on the keyboard | invert right-stick Y on/off |

Sensitivity and invert-Y are saved in localStorage, so a handheld remembers its settings between plays.

## Run it

**Quickest (single player):** open `index.html` through any static file server, for example

```
python -m http.server 8080
```

then visit http://localhost:8080.

**With multiplayer + voice lines:** `cd server && npm install`, run `start-server.bat` (needs Node), open http://localhost:8080.
Put an optional Fish Audio key in `server/.env` (git-ignored) to enable voice lines.

## Deploy (Cloudflare Pages)

**`git push` does not deploy this project.** The live `sky-jump` Pages project is direct-upload
(`Git Provider: No`), so pushes only update GitHub. Deploy from the repo root with:

```
npm run deploy:pages
```

That builds `cf-public/` from `index.html` + `server/voice-lines.json` and uploads it to the
`sky-jump` Pages project on the `main` branch. To make pushes deploy automatically instead, connect
the GitHub repo in Cloudflare Dashboard → Workers & Pages → `sky-jump` → Settings → Builds &
deployments, with build command `npm run cf:prep` and output directory `cf-public`.

## Project docs

- [OVERVIEW.md](OVERVIEW.md) — architecture, systems, constants and known issues.
- [TODO.md](TODO.md) — current status and the handoff channel between agents.
- [PLAN.md](PLAN.md), [PLAN-HOMEBASE.md](PLAN-HOMEBASE.md), [PLAN-INTERIORS-MP.md](PLAN-INTERIORS-MP.md) — multi-agent work plans (vehicles, home base + Guide + missions, tower interiors + 6-player spawns).
- [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md) — what to measure and fix for performance.
