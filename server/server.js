// SkyJump3D co-op relay: serves ../index.html and relays JSON messages between players in a room.
// Run:  cd server && npm install && npm start      (then open http://<this-pc-ip>:8080/?room=myroom)
// No accounts, no persistence. Meant for LAN / friends — do not expose it to the open internet as-is.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { WebSocketServer } = require('ws');

// ---- tiny .env loader (the Fish Audio key lives in server/.env, which is git-ignored and never sent to the browser) ----
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch (_) {}

const PORT = Number(process.env.PORT) || 8080;
const MAX_ROOM = 8;
const INDEX = path.join(__dirname, '..', 'index.html');

// ---- enemy voices via Fish Audio (free model). Only the phrases in voice-lines.json can be requested, and every clip is cached on disk,
// ---- so each line is generated at most once per voice and nobody can use this server as a general text-to-speech proxy.
const FISH_KEY = process.env.FISH_AUDIO_API_KEY || '', FISH_MODEL = process.env.FISH_AUDIO_MODEL || 's2.1-pro-free';
const LINES = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice-lines.json'), 'utf8'));
const CACHE_DIR = path.join(__dirname, 'tts-cache'); fs.mkdirSync(CACHE_DIR, { recursive: true });
const VOICE_IDS = {       // generic public voices from the Fish library (no named-character clones)
  creeper: 'cd227e7ad9194b31abf09593525e562b',   // "Male creepy whisper"
  horrorGirl: '8b8749a864dc418fb41c4b21b8a66ac0', // "horror": young, high, slow, intimate
  demon: '42da7b41896e47b2b4346710296382d9',     // "Demon"
  goblin: '9b4be1f9957f488aa666d7e0842b41c4',    // "goblin": raspy, grating
  ghost: '1421de1bdd984e34a61c934f27aff576',     // "horror": scary ghost
  doom: 'af58b0ab319e4de283b398a5b0f7528c',      // "doom": intense villain
};
const CAST = {            // enemy kind -> voice, delivery cue and speed (the game adds echo / ring-mod / reverb on top)
  walker:  { id: VOICE_IDS.creeper,    cue: '[whispering]', speed: 0.95 },
  gunner:  { id: VOICE_IDS.horrorGirl, cue: '[nervous]', speed: 1.1 },
  charger: { id: VOICE_IDS.doom,       cue: '[angry]', speed: 0.85 },
  shield:  { id: VOICE_IDS.ghost,      cue: '[soft tone]', speed: 0.9 },
  bomber:  { id: VOICE_IDS.goblin,     cue: '[hysterical]', speed: 1.25 },
  drone:   { id: VOICE_IDS.horrorGirl, cue: '[whispering]', speed: 1.15 },
  boss:    { id: VOICE_IDS.demon,      cue: '[angry]', speed: 0.8 },
  inner:   { id: VOICE_IDS.horrorGirl, cue: '[whispering]', speed: 0.9 },   // the voices "inside your head"
};
let synthQueue = Promise.resolve(), synthsThisHour = [], inflight = new Map();
// keep the disk cache bounded (default 500 clips ≈ 25–50 MB): drop the oldest files when over the cap
const TTS_CACHE_MAX = Number(process.env.TTS_CACHE_MAX) || 500;
function pruneTtsCache() {
  fs.readdir(CACHE_DIR, (err, names) => {
    if (err || names.length <= TTS_CACHE_MAX) return;
    const files = names.filter(n => n.endsWith('.mp3'));
    if (files.length <= TTS_CACHE_MAX) return;
    let done = 0, oldest = [];
    for (const n of files) fs.stat(path.join(CACHE_DIR, n), (e, st) => {
      if (!e) oldest.push({ n, t: st.mtimeMs });
      if (++done === files.length) {
        oldest.sort((a, b) => a.t - b.t).slice(0, files.length - TTS_CACHE_MAX)
          .forEach(f => fs.unlink(path.join(CACHE_DIR, f.n), () => {}));
      }
    });
  });
}
function fishSynth(text, cast) {
  const body = JSON.stringify({ text: `${cast.cue} ${text}`, reference_id: cast.id, format: 'mp3', latency: 'normal', prosody: { speed: cast.speed, volume: 0, normalize_loudness: true } });
  const once = () => new Promise((resolve, reject) => {
    const req = https.request('https://api.fish.audio/v1/tts', { method: 'POST', timeout: 60000, headers: {
      Authorization: `Bearer ${FISH_KEY}`, 'Content-Type': 'application/json', model: FISH_MODEL, 'Content-Length': Buffer.byteLength(body) } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { const buf = Buffer.concat(chunks); if (res.statusCode === 200) resolve(buf); else reject(Object.assign(new Error(buf.toString().slice(0, 160)), { status: res.statusCode })); });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout'))); req.end(body);
  });
  return (async () => {                      // retry only 429 / 5xx, with exponential backoff (per the Fish docs)
    for (let attempt = 0; ; attempt++) {
      try { return await once(); }
      catch (e) { if (attempt >= 3 || !(e.status === 429 || e.status >= 500 || !e.status)) throw e; await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); }
    }
  })();
}
async function serveTts(url, res) {
  const q = new URL(url, 'http://x').searchParams, kind = q.get('kind'), cat = q.get('cat'), n = Number(q.get('n'));
  const cast = CAST[kind], list = LINES[cat];
  const fail = (code, msg) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: msg })); };
  if (!FISH_KEY) return fail(503, 'voices not configured');
  if (!cast || !list || !Number.isInteger(n) || n < 0 || n >= list.length) return fail(400, 'bad request');
  const text = list[n];
  const key = crypto.createHash('sha1').update([kind, cat, text, cast.id, cast.cue, cast.speed, FISH_MODEL].join('|')).digest('hex').slice(0, 20);
  const file = path.join(CACHE_DIR, key + '.mp3');
  const send = buf => { res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400', 'Content-Length': buf.length }); res.end(buf); };
  if (fs.existsSync(file)) return send(fs.readFileSync(file));
  const now = Date.now(); synthsThisHour = synthsThisHour.filter(t => now - t < 3600e3);
  if (synthsThisHour.length >= 300) return fail(429, 'voice quota reached for this hour');
  let job = inflight.get(key);
  if (!job) {                                   // one at a time (the free tier allows 5 concurrent; we stay well under)
    synthsThisHour.push(now);
    // catch BEFORE chaining so one failed synth can't poison the queue for every later request
    job = (synthQueue = synthQueue.catch(() => {}).then(() => fishSynth(text, cast)))
      .then(buf => { fs.writeFileSync(file, buf); pruneTtsCache(); return buf; });
    inflight.set(key, job); job.catch(() => {}).finally(() => inflight.delete(key));
  }
  try { send(await job); } catch (e) { console.log(`[tts] ${kind}/${cat}/${n} failed: ${e.status || ''} ${String(e.message).slice(0, 100)}`); fail(502, 'voice generation failed'); }
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(INDEX).pipe(res);
  } else if (url === '/LOGO2.png') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=3600' });
    fs.createReadStream(path.join(__dirname, '..', 'LOGO2.png')).pipe(res);
  } else if (url === '/voice-lines.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(LINES));
  } else if (url === '/net-info') {          // lets the in-game multiplayer wizard detect Tailscale and show the invite link
    const addresses = [];
    for (const [name, addrs] of Object.entries(os.networkInterfaces()))
      for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal) {
        const o = a.address.split('.').map(Number), ts = (o[0] === 100 && o[1] >= 64 && o[1] <= 127) || /tailscale/i.test(name);
        addresses.push({ name, address: a.address, kind: ts ? 'tailscale' : 'lan' });
      }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ port: PORT, addresses }));
  } else if (url === '/tts-status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ enabled: !!FISH_KEY }));
  } else if (url === '/tts') {
    serveTts(req.url, res);
  } else {
    res.writeHead(404); res.end('not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const rooms = new Map();   // name -> { members: Map<id, ws>, host: id }
let nextId = 1;

function send(ws, m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }
function broadcast(room, m, exceptId) {
  const data = JSON.stringify(m);
  for (const [id, ws] of room.members) if (id !== exceptId && ws.readyState === 1) ws.send(data);
}

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const name = (q.get('room') || 'lobby').replace(/[^\w-]/g, '').slice(0, 24) || 'lobby';
  let room = rooms.get(name);
  if (!room) { room = { members: new Map(), host: 0 }; rooms.set(name, room); }
  if (room.members.size >= MAX_ROOM) { send(ws, { t: 'full' }); ws.close(); return; }

  const id = nextId++;
  room.members.set(id, ws);
  if (!room.host) room.host = id;                      // first in the room hosts the enemy simulation
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  send(ws, { t: 'hi', id, host: room.host, peers: [...room.members.keys()].filter(i => i !== id) });
  broadcast(room, { t: 'join', id }, id);
  console.log(`[${name}] player ${id} joined (${room.members.size} in room, host ${room.host})`);

  ws.on('message', data => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    m.from = id;                                       // server stamps the sender; clients can't spoof it
    if (m.to) { const target = room.members.get(m.to | 0); if (target) send(target, m); }
    else broadcast(room, m, id);
  });

  ws.on('close', () => {
    room.members.delete(id);
    console.log(`[${name}] player ${id} left (${room.members.size} in room)`);
    if (!room.members.size) { rooms.delete(name); return; }
    if (room.host === id) {                            // host migration: lowest remaining id takes over
      room.host = Math.min(...room.members.keys());
      broadcast(room, { t: 'host', id: room.host });
    }
    broadcast(room, { t: 'leave', id });
  });
});

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SkyJump3D server on port ${PORT}  (enemy voices: ${FISH_KEY ? 'Fish Audio ' + FISH_MODEL : 'browser fallback - no key'})`);
  for (const addrs of Object.values(os.networkInterfaces()))
    for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal) console.log(`  friends on your network: http://${a.address}:${PORT}/?room=myroom`);
  console.log(`  this PC:                 http://localhost:${PORT}/?room=myroom`);
});

module.exports = { server, wss };
