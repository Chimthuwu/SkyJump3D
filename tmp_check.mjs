import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const count = (re, s = src) => (s.match(re) || []).length;
let bad = 0;

// declared exactly once
for (const [name, re] of [
  ['RIDE_ZONE', /(?:^|\n)const RIDE_ZONE = /],
  ['props', /const props = \[\]/],
  ['streetReset', /function streetReset\(\)/],
  ['buildRidePark', /function buildRidePark\(\)/],
  ['spawnStreetRiders', /function spawnStreetRiders\(/],
  ['addRail', /function addRail\(/],
  ['addRamp', /function addRamp\(/],
  ['addProp', /function addProp\(/],
  ['useProp', /function useProp\(\)/],
  ['tryLatchRail', /function tryLatchRail\(\)/],
  ['handleGrind', /function handleGrind\(/],
  ['makeRiderVisual', /function makeRiderVisual\(\)/],
  ['spawnRiderGroup', /function spawnRiderGroup\(/],
]) {
  const n = count(re);
  if (n !== 1) { console.log('BAD count for', name, '=', n); bad++; }
}

// wired call sites
const wires = [
  ['park in hub network', /hubs\.push\(buildRidePark\(\)\)/],
  ['roof riders', /spawnStreetRiders\(hubs\)/],
  ['street terminal rider pack', /spawnRiderGroup\(groundPad\.x \+ 2/],
  ['park rider pack', /spawnRiderGroup\(cx, parkY, cz, slab/],
  ['start roof gear', /addProp\('board', start\.x \+ 4/],
  ['ridepark slab carrier', /const slab = addSlab\(cx, parkY, cz, 26, 26, 3, RIDE_ZONE, false\)/],
  ['main loop calls updateStreet', /updateItems\(dt\); updateStreet\(dt\);/],
  ['buildLevel resets street', /streetReset\(\);/],
  ['keydown ENTER mounts', /if \(e\.code === 'Enter' && state === 'play'\) useProp\(\);/],
  ['playerUpdate grind branch', /if \(grinding\) \{ atkPress = false; mouseHeld = false; handleGrind\(dt\); return; \}/],
  ['gear speed multipliers', /const gearMul = gear === 'board'/],
  ['enemy pathway lightens grind?', /gear === 'board' \|\| gear === 'skates' \? it\.mesh\.rotation\.y/],
  ['rider AI case', /e\.variant === 'rider'\) \{ e\.chCd \-= dt;/],
  ['rider active gate', /e\.variant === 'rider' \? \(d < 46/],
  ['updateVisuals mirrors board', /gearBoard\.visible = \(gear === 'board'/],
  ['skates visuals', /gearSkateL\.visible/g],
].filter(Boolean);

for (const [name, re] of wires) {
  const n = count(re);
  if (n < 1) { console.log('MISSING WIRE:', name); bad++; }
}

// leftover mistakes check
const nope = [
  ['stray keepOut=arguments', /const keepOut = arguments/],
  ['street module duplicated', /const RIDE_ZONE = \{ name: 'Ride Park'[\s\S]*const RIDE_ZONE/],
  ['double slab', /let slab = null/],
];
for (const [name, re] of nope) {
  if (count(re) > 0) { console.log('LEFTOVER:', name); bad++; }
}

// ensure rails are excluded from collision paths (4 places)
const excl = count(/!s\.rail/g);
console.log('rail collision exclusions:', excl, '(want 4)');
if (excl < 4) bad++;
console.log(bad ? 'CHECKS FAILED' : 'ALL STRUCTURE CHECKS PASS');
