// Party Room server: serves the built app, runs private rooms over WebSocket, and stores profiles.
// The server owns the question deck: it picks rounds, keeps answers secret until the reveal,
// runs the timers and does the scoring. The host screen only sends commands.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { unseal } from '../scripts/obfuscate.mjs';

const PORT = Number(process.env.PORT || 8787);
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const DECK_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/generated/deck.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

/** Tiny JSON store for profiles, leaderboards and answer statistics (self-hosted mode). */
function createStore(file) {
  let data = { profile: {}, players: {}, crowd: {}, editor: {} };
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
// Saving shared editor changes needs the editor password: the app sends sha256('gag-server:' + password),
// which can't be derived from the app's own code. Change it together with EDITOR_HASH in src/lib/hash.ts.
const EDITOR_HASH = process.env.EDITOR_KEY_HASH || '40e1a2abb4a8cface526a313bbfb9c67fffbbf1f7cd280547fb449716fb52e0b';

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
  store.data.editor ??= {};
  const deck = JSON.parse(fs.readFileSync(DECK_FILE, 'utf8'));
  const gameOf = (id) => deck.games.find((g) => g.id === id);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const sm = url.pathname.match(/^\/api\/store\/(profile|players|crowd|editor)(?:\/([^/]+))?$/);
    if (sm) {
      const [, kind, id] = sm;
      const json = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(body));
      };
      if (kind === 'editor' && req.method === 'PUT' && (!EDITOR_HASH || req.headers['x-editor-key'] !== EDITOR_HASH)) return json(403, { error: 'editor_key' });
      if (req.method === 'GET' && !id && kind !== 'profile' && kind !== 'editor') {
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

  // What everyone may see. Votes stay hidden (only "has voted") and the answer never leaves the server before the reveal.
  const view = (room) => ({
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    round: room.round,
    deadline: room.deadline,
    remaining: eligible(room).filter((r) => !room.used.has(r.id)).length,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, char: p.char, skin: p.skin, score: p.score, online: p.sockets.size > 0, voted: p.id in room.votes })),
    votes: room.phase === 'reveal' ? room.votes : null,
    reveal: room.phase === 'reveal' ? room.reveal : null,
    index: room.index
  });

  const broadcast = (room) => {
    const msg = JSON.stringify({ t: 'state', state: view(room) });
    for (const p of room.players.values()) for (const ws of p.sockets) ws.readyState === 1 && ws.send(msg);
    for (const ws of room.hostSockets) ws.readyState === 1 && ws.send(msg);
  };

  function eligible(room) {
    const games = new Set(room.settings.gameIds);
    return deck.rounds.filter((r) => r.u && games.has(r.g) && (room.settings.mature || !r.m) && ['realfake', 'dilemma'].includes(gameOf(r.g)?.engine) && (!r.o || r.o.length === 2));
  }

  function publishNext(room) {
    const pool = eligible(room).filter((r) => !room.used.has(r.id));
    if (!pool.length) {
      room.phase = 'ended';
      return broadcast(room);
    }
    const r = pool[Math.floor(Math.random() * pool.length)];
    const g = gameOf(r.g);
    const secret = unseal(r.id, r.x);
    room.used.add(r.id);
    room.current = { id: r.id, engine: g.engine, answer: g.engine === 'realfake' ? secret.a : null, note: g.engine === 'realfake' ? secret.rv : (secret.pn || []).join(' · ') || null };
    room.round = {
      id: r.id,
      prompt: secret.fee ? `${r.p}\n💰 ${secret.fee}` : r.p,
      options: r.o ? { a: r.o[0], b: r.o[1] } : g.options,
      game: g.title,
      emoji: g.emoji,
      engine: g.engine
    };
    room.phase = 'vote';
    room.votes = {};
    room.reveal = null;
    room.index += 1;
    clearTimeout(room.timer);
    room.deadline = room.settings.timer ? Date.now() + room.settings.timer * 1000 : null;
    if (room.deadline) room.timer = setTimeout(() => reveal(room), room.settings.timer * 1000);
    broadcast(room);
  }

  /** Scoring happens here, from the server's own copy of the answer. */
  function reveal(room) {
    if (room.phase !== 'vote') return;
    clearTimeout(room.timer);
    room.deadline = null;
    room.phase = 'reveal';
    const { answer, note, engine } = room.current;
    room.reveal = { answer, note };
    if (engine === 'realfake') {
      for (const [pid, v] of Object.entries(room.votes)) if (v === answer) room.players.get(pid).score += 1;
    } else if (room.settings.decisionMode === 'majority') {
      const t = {};
      for (const v of Object.values(room.votes)) t[v] = (t[v] ?? 0) + 1;
      const ranked = Object.entries(t).sort((a, b) => b[1] - a[1]);
      const top = ranked[0] && (!ranked[1] || ranked[1][1] < ranked[0][1]) ? ranked[0][0] : null;
      if (top) for (const [pid, v] of Object.entries(room.votes)) if (v === top) room.players.get(pid).score += 1;
      room.reveal.majority = top;
    }
    broadcast(room);
  }

  const cleanSettings = (s = {}) => {
    const known = new Set(deck.games.map((g) => g.id));
    const gameIds = Array.isArray(s.gameIds) ? s.gameIds.filter((id) => known.has(id)) : deck.games.filter((g) => g.engine === 'realfake' && g.count > 0).map((g) => g.id);
    return { gameIds, mature: !!s.mature, timer: [0, 15, 20, 30].includes(s.timer) ? s.timer : 20, decisionMode: s.decisionMode === 'majority' ? 'majority' : 'free' };
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
        room = { code: c, hostId: clientId, hostSockets: new Set([ws]), players: new Map(), phase: 'lobby', settings: cleanSettings(m.settings), round: null, current: null, votes: {}, reveal: null, index: 0, used: new Set(), deadline: null, timer: null, touched: Date.now() };
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
          p = { id: clientId, name, score: 0, sockets: new Set(), char: null, skin: null };
          r.players.set(clientId, p);
        }
        // Cosmetic only: shown in the waiting room and on the scoreboard.
        if (typeof m.char === 'string') p.char = m.char.slice(0, 20);
        if (typeof m.skin === 'string') p.skin = m.skin.slice(0, 30);
        p.sockets.add(ws);
        send({ t: 'joined', role: 'player', code: r.code });
        return broadcast(r);
      }
      if (!room) return fail('not_in_room');
      room.touched = Date.now();
      const isHost = clientId === room.hostId;

      if (m.t === 'vote') {
        if (room.phase !== 'vote' || !room.players.has(clientId)) return;
        if (!Object.keys(room.round?.options || {}).includes(m.choice)) return;
        room.votes[clientId] = m.choice;
        const online = [...room.players.values()].filter((p) => p.sockets.size > 0);
        if (online.length && online.every((p) => p.id in room.votes)) return reveal(room);
        return broadcast(room);
      }
      if (!isHost) return fail('host_only');
      if (m.t === 'settings') {
        room.settings = cleanSettings(m.settings);
        return broadcast(room);
      }
      if (m.t === 'next') {
        if (room.phase === 'vote') return;
        return publishNext(room);
      }
      if (m.t === 'reveal') return reveal(room);
      if (m.t === 'kick') {
        room.players.delete(m.playerId);
        return broadcast(room);
      }
      if (m.t === 'end') {
        clearTimeout(room.timer);
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
    for (const [c, r] of rooms)
      if (now - r.touched > ROOM_TTL_MS) {
        clearTimeout(r.timer);
        rooms.delete(c);
      }
  }, 60_000);
  server.on('close', () => clearInterval(sweep));

  return { server, rooms, store };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createPartyServer({ storeFile: process.env.STORE_FILE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data/store.json') });
  server.listen(PORT, () => console.log(`המשחקייה על הגג — http://localhost:${PORT}`));
}
