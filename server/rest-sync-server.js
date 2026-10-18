/**
 * rest-sync-server.js
 * Reference implementation of the custom REST sync contract used by
 * src/systems/sync/RestAdapter.js. Zero dependencies, JSON-file storage.
 *
 *   node server/rest-sync-server.js            # listens on :8787
 *   VITE_SYNC_REST_URL=http://localhost:8787 npm run dev
 *
 * This is a development server: it has no authentication. Put real auth
 * (device tokens / JWT) in front of it before shipping.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const DB_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rest-sync-db.json');

/** Loads the JSON "database" ({ saves: {}, leaderboard: {} }). */
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { saves: {}, leaderboard: {} };
  }
}
let db = loadDb();
const persist = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // ---- saves
    if (parts[0] === 'saves' && parts[1]) {
      const id = decodeURIComponent(parts[1]);
      if (req.method === 'GET') {
        const row = db.saves[id];
        return row ? send(res, 200, { save: row.save, updatedAt: row.updatedAt }) : send(res, 404, { error: 'not_found' });
      }
      if (req.method === 'PUT') {
        const { save, updatedAt } = await readBody(req);
        if (!save || typeof updatedAt !== 'number') return send(res, 400, { error: 'bad_request' });
        // Server-side guard of the latest-timestamp rule: never overwrite newer data.
        const existing = db.saves[id];
        if (existing && existing.updatedAt > updatedAt) return send(res, 409, { error: 'stale', updatedAt: existing.updatedAt });
        db.saves[id] = { save, updatedAt };
        persist();
        return send(res, 200, { ok: true });
      }
    }

    // ---- leaderboard
    if (parts[0] === 'leaderboard') {
      if (req.method === 'GET') {
        const limit = Math.min(100, Number(url.searchParams.get('limit')) || 50);
        const rows = Object.values(db.leaderboard)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        return send(res, 200, rows);
      }
      if (req.method === 'POST') {
        const { playerId, displayName, score, dollId } = await readBody(req);
        if (!playerId || !Number.isFinite(score)) return send(res, 400, { error: 'bad_request' });
        const prev = db.leaderboard[playerId];
        db.leaderboard[playerId] = {
          playerId,
          displayName: String(displayName || 'Labubu').slice(0, 24),
          score: Math.max(prev?.score || 0, Math.floor(score)),
          dollId
        };
        persist();
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    return send(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, () => console.log(`[rest-sync] listening on http://localhost:${PORT}`));
