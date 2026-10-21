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
- **Vehicles:** DeLorean-style car and a hover-bike. Hold **X** to boost, **E** to get on/off. Drops are cushioned, and
  highways have ramps, kickers and loop-the-loops (cars on wide roads, bikes on narrow trails).
- **Weapons (1–7):** Blade, Laser, Scatter, Plasma, Railgun, Beam, Arc. Empty weapons auto-switch to one with ammo.
- **Beyond the sky:** a skyway to the Moon, then the **Alien Void** — ~900 mixed platforms (moving, orbiting, crumbling, thin beams),
  drifting space cities underneath, alien troops and UFOs — leading to Mars.
- **Warp gates:** hidden until you discover them by landing on their platform.
- **Co-op:** up to 8 players through the small Node relay in `server/` (LAN / Tailscale).

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
| X (held, on a vehicle) | boost |
| V / Caps Lock | first / third person |
| R | respawn at last checkpoint |
| M / N / G / H | sound / music / gore / hint bar |

## Run it

**Quickest (single player):** open `index.html` through any static file server, for example

```
python -m http.server 8080
```

then visit http://localhost:8080.

**With multiplayer + voice lines:** `cd server && npm install`, run `start-server.bat` (needs Node), open http://localhost:8080.
Put an optional Fish Audio key in `server/.env` (git-ignored) to enable voice lines.

## Deploy (Cloudflare Pages)

The game is static, so the deploy is just `index.html`:

```
mkdir dist && copy index.html dist
npx wrangler pages deploy dist --project-name sky-jump --branch main
```

## Project docs

- [OVERVIEW.md](OVERVIEW.md) — architecture, systems, constants and known issues.
- [TODO.md](TODO.md) — current status and the handoff channel between agents.
- [PLAN.md](PLAN.md), [PLAN-HOMEBASE.md](PLAN-HOMEBASE.md), [PLAN-INTERIORS-MP.md](PLAN-INTERIORS-MP.md) — multi-agent work plans (vehicles, home base + Guide + missions, tower interiors + 6-player spawns).
- [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md) — what to measure and fix for performance.
