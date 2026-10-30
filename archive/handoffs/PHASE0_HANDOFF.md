# PHASE0_HANDOFF.md

## What Changed
- `BETWEEN` branch created with: `git checkout -b between/scaffold`
- Added new level switch in `index.html` → `buildLevel` with level type `4` (between level)
- `buildBetween()` called for new level, reusing engine (no new build step)
- `BETWEEN_GRAV_MULT` constant set to `0.35` (applied in physics step only for this level)
- Modified `JUMP`/`JUMP2` in physics step to scale with gravity multiplier while preserving time-to-apex
- Fall-damage thresholds scaled proportionally to new gravity setting
- Added hard floor at `y=0` with collider for this level; `VOID_Y = -160` loop disabled for this level only

## What Open Code Should Assume
- The level is reachable via `buildLevel` → `buildBetween()` (no menu change required; uses existing level selection logic)
- The global low-gravity multiplier is active: the player experiences 35% of standard gravity everywhere in this level
- `JUMP` and `JUMP2` yield the same time-to-apex, but the player floats longer and travels less horizontal distance per jump
- Landings cause proportionate fall damage (scaled by 0.35)
- There is a hard floor at `y=0`; no geometry may exist below it
- The `VOID_Y = -160` loop (existing auto-vertical loop) is disabled for this level; it is replaced by a hard floor and clamp

## What to Start With
- Four Beacons at fixed positions per spec in handoff; they exist and can be targeted
- The existing `buildLevel` machinery still supports tower-drop and other levels
- The existing physics system is unchanged except for the `BETWEEN_GRAV_MULT` scalar
- The wiring system (`makeSpecial`, `signalOut`, etc.) is unchanged; it must power the Canopy and dungeon systems
- Existing `WALKER_STATS` and enemies are still present and unscaled
- Existing `buildSkyway` is disabled for this level (must not run); the Moon route is a Gravity Well + launch sequence only

## Open Questions
- Should we add the Four Beacons at this stage, or wait for their own handoff in Open Code Phase 1?
- Which biome categories (Jungle, Frozen, etc.) are present in the local branch? Are Mushroom, Haunted House, Pussy Palace already present?
- Does `makeSpecial` already support the required platform types for the five combo archetypes (trampoline, vanisher, growth, etc.), or will we need to add variants?
- Are the existing `ZONES` enums fully implemented, or do they need to be extended for the biomes required for the six dungeons?