// Party Room server: serves the built app and relays room state over WebSocket.
// The host's device keeps the deck; answers reach the server only when the host reveals.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

/** Tiny JSON store for profiles, leaderboards and answer statistics (self-hosted mode). */
function createStore(file) {
  let data = { profile: {}, players: {}, crowd: {} };
  if (file && fs.existsSync(file)) {
    try {
      data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch {
      /* start fresh on a corrupt file */
    }
  }
  let timer = null;
  const flush = () => {
    if (!file) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data));
    }, 300);
  };
  return { data, flush };
}

const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

function readBody(req, limit = 300_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function createPartyServer({ storeFile = process.env.STORE_FILE ?? null } = {}) {
  const rooms = new Map();
  const store = createStore(storeFile);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const sm = url.pathname.match(/^\/api\/store\/(profile|players|crowd)(?:\/([^/]+))?$/);
    if (sm) {
      const [, kind, id] = sm;
      const json = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(body));
      };
      if (req.method === 'GET' && !id && kind !== 'profile') {
        const rows = Object.entries(store.data[kind]).map(([rid, v]) => ({ ...v, id: rid }));
        return json(200, rows);
      }
      if (!id || !ID_RE.test(id)) return json(400, { error: 'bad_id' });
      if (req.method === 'GET') return json(200, store.data[kind][id] ?? null);
      if (req.method === 'PUT') {
        readBody(req)
          .then((body) => {
            if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'bad_body' });
            store.data[kind][id] = body;
            store.flush();
            json(200, { ok: true });
          })
          .catch(() => json(400, { error: 'bad_body' }));
        return;
      }
      return json(405, { error: 'method' });
    }
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, party: true }));
    }
    let file;
    try {
      file = path.join(DIST, decodeURIComponent(url.pathname));
    } catch {
      return res.writeHead(400).end();
    }
    if (file !== DIST && !file.startsWith(DIST + path.sep)) return res.writeHead(403).end();
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end('Build the app first: npm run build');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  const code = () => {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let c;
    do c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
    while (rooms.has(c));
    return c;
  };

  // What everyone may see. Votes stay hidden (only "has voted") until the reveal.
  const view = (room) => ({
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    round: room.round,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score, online: p.sockets.size > 0, voted: p.id in room.votes })),
    votes: room.phase === 'reveal' ? room.votes : null,
    reveal: room.phase === 'reveal' ? room.reveal : null,
    index: room.index
  });

  const broadcast = (room) => {
    const msg = JSON.stringify({ t: 'state', state: view(room) });
    for (const p of room.players.values()) for (const ws of p.sockets) ws.readyState === 1 && ws.send(msg);
    for (const ws of room.hostSockets) ws.readyState === 1 && ws.send(msg);
  };

  wss.on('connection', (ws) => {
    let room = null;
    let clientId = null;
    const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
    const fail = (error) => send({ t: 'error', error });

    ws.on('message', (data) => {
      let m;
      try {
        m = JSON.parse(String(data));
      } catch {
        return fail('bad_json');
      }
      if (typeof m.clientId === 'string') clientId = m.clientId.slice(0, 40);
      if (!clientId) return fail('no_client_id');

      if (m.t === 'create') {
        const c = code();
        room = { code: c, hostId: clientId, hostSockets: new Set([ws]), players: new Map(), phase: 'lobby', round: null, votes: {}, reveal: null, index: 0, touched: Date.now() };
        rooms.set(c, room);
        send({ t: 'joined', role: 'host', code: c });
        return broadcast(room);
      }
      if (m.t === 'join') {
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return fail('no_room');
        room = r;
        if (clientId === r.hostId) {
          r.hostSockets.add(ws);
          send({ t: 'joined', role: 'host', code: r.code });
          return broadcast(r);
        }
        const name = String(m.name || '').trim().slice(0, 18);
        let p = r.players.get(clientId);
        if (!p) {
          if (!name) return fail('no_name');
          if (r.players.size >= 12) return fail('room_full');
          if ([...r.players.values()].some((x) => x.name === name)) return fail('name_taken');
          p = { id: clientId, name, score: 0, sockets: new Set() };
          r.players.set(clientId, p);
        }
        p.sockets.add(ws);
        send({ t: 'joined', role: 'player', code: r.code });
        return broadcast(r);
      }
      if (!room) return fail('not_in_room');
      room.touched = Date.now();
      const isHost = clientId === room.hostId;

      if (m.t === 'vote') {
        if (room.phase !== 'vote' || !room.players.has(clientId)) return;
        const allowed = Object.keys(room.round?.options || {});
        if (!allowed.includes(m.choice)) return;
        room.votes[clientId] = m.choice;
        return broadcast(room);
      }
      if (!isHost) return fail('host_only');
      if (m.t === 'publish') {
        const r = m.round || {};
        room.round = { id: String(r.id), prompt: String(r.prompt).slice(0, 600), options: r.options, game: r.game, engine: r.engine };
        room.phase = 'vote';
        room.votes = {};
        room.reveal = null;
        room.index += 1;
        return broadcast(room);
      }
      if (m.t === 'reveal') {
        if (room.phase !== 'vote') return;
        const answer = typeof m.answer === 'string' ? m.answer : null;
        room.phase = 'reveal';
        room.reveal = { answer, note: m.note ? String(m.note).slice(0, 400) : null };
        if (answer) for (const [pid, v] of Object.entries(room.votes)) if (v === answer) room.players.get(pid).score += 1;
        return broadcast(room);
      }
      if (m.t === 'kick') {
        room.players.delete(m.playerId);
        return broadcast(room);
      }
      if (m.t === 'end') {
        room.phase = 'ended';
        broadcast(room);
        rooms.delete(room.code);
      }
    });

    ws.on('close', () => {
      if (!room) return;
      room.hostSockets.delete(ws);
      room.players.get(clientId)?.sockets.delete(ws);
      broadcast(room);
    });
  });

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [c, r] of rooms) if (now - r.touched > ROOM_TTL_MS) rooms.delete(c);
  }, 60_000);
  server.on('close', () => clearInterval(sweep));

  return { server, rooms, store };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createPartyServer({ storeFile: process.env.STORE_FILE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data/store.json') });
  server.listen(PORT, () => console.log(`המשחקייה על הגג — http://localhost:${PORT}`));
}
