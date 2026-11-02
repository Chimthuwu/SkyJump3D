// _wildwood_fix20b.cjs — E20b inserted the six wildwood monument kinds AFTER farMonument's final `else` (the
// fairytale-mushroom fallback). Move the chain in front of that else:  `} else if (groveheart) ...` attaches to the
// bubble branch, the mushroom else stays the last branch. Run: node archive/levels/_wildwood_fix20b.cjs
const fs = require('fs');
let src = fs.readFileSync('index.html', 'utf8');
const s0 = src.indexOf("} else if (kind === 'groveheart') {");
const p = src.indexOf("M(sp2, glow(0x6aff4a)", s0);
const q = src.indexOf("\r\n    }\r\n}", p);
if (s0 < 0 || p < 0 || q < 0) { console.error('FIX ANCHOR FAIL', s0, p, q); process.exit(1); }
const block = src.slice(s0, q + 8);          // "} else if (groveheart) {...} ... else if (vinemaze) {...}\r\n    }"
const head = src.slice(0, s0);               // ends "...g.add(band);\r\n      }\r\n    "  (shroom else still open)
const tail = src.slice(q + 8);               // starts "\r\n}"  (farMonument close) + rest of file
if (!head.endsWith('\r\n    ')) { console.error('HEAD SHAPE UNEXPECTED'); process.exit(1); }
let out = head + '}' + tail;                 // restore: shroom else closed, farMonument closed
const rest = block.slice(1);                 // " else if (kind === 'groveheart') {...}\r\n    }"  (leading close-brace dropped)
const mush = "} else {                                           // fairytale mushroom: ivory gills, a russet cap, and cream spots";
const mushIdx = out.indexOf(mush);
if (mushIdx < 0) { console.error('MUSHROOM ANCHOR FAIL'); process.exit(1); }
// the mushroom anchor's leading "} else {" — the "} " closes the bubble branch; insert our chain right after it,
// before the mushroom else, keeping the mushroom else as the final branch:
out = out.slice(0, mushIdx + 1) + rest + '\r\n' + out.slice(mushIdx + 1);
fs.writeFileSync('index.html', out, 'utf8');
console.log('FIX20b OK — six kinds now before the mushroom else');
