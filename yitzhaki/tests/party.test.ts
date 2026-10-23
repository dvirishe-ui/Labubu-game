import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
// @ts-expect-error plain .mjs server module
import { createPartyServer } from '../server/party-server.mjs';

let port = 0;
let srv: { server: import('node:http').Server; rooms: Map<string, any> };

beforeAll(async () => {
  srv = createPartyServer();
  (globalThis as any).__srv = srv;
  await new Promise<void>((r) => srv.server.listen(0, () => r()));
  port = (srv.server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((r) => srv.server.close(() => r())));

function client(id: string) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const inbox: Record<string, unknown>[] = [];
  const waiters: [(m: Record<string, unknown>) => boolean, (m: Record<string, unknown>) => void][] = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    inbox.push(m);
    for (const w of waiters.slice()) if (w[0](m)) (waiters.splice(waiters.indexOf(w), 1), w[1](m));
  });
  const open = new Promise((r) => ws.on('open', r));
  return {
    ws,
    open,
    send: (o: Record<string, unknown>) => ws.send(JSON.stringify({ ...o, clientId: id })),
    next: (pred: (m: Record<string, any>) => boolean) =>
      new Promise<Record<string, any>>((resolve) => {
        const hit = inbox.find(pred);
        if (hit) return resolve(hit);
        waiters.push([pred, resolve]);
      })
  };
}

describe('party room server', () => {
  it('health endpoint', async () => {
    const r = await fetch(`http://localhost:${port}/api/health`);
    expect(await r.json()).toEqual({ ok: true, party: true });
  });

  it('server picks rounds, hides answers and votes, scores on its own and survives reconnects', async () => {
    const host = client('host');
    await host.open;
    host.send({ t: 'create', settings: { gameIds: ['israel-bidur'], timer: 0 } });
    const code = (await host.next((m) => m.t === 'joined')).code as string;

    const a = client('pa');
    const b = client('pb');
    await Promise.all([a.open, b.open]);
    a.send({ t: 'join', code, name: 'אלף', char: 'tzach', skin: 'tzach:special' });
    b.send({ t: 'join', code, name: 'אלף' });
    expect((await b.next((m) => m.t === 'error')).error).toBe('name_taken');
    b.send({ t: 'join', code, name: 'בית' });
    await b.next((m) => m.t === 'joined');
    const lobby = await host.next((m) => m.t === 'state' && m.state.players.length === 2);
    expect(lobby.state.players.find((p: any) => p.id === 'pa')).toMatchObject({ char: 'tzach', skin: 'tzach:special' });

    a.send({ t: 'next' });
    expect((await a.next((m) => m.t === 'error' && m.error === 'host_only')).error).toBe('host_only');
    host.send({ t: 'next' });
    const q = await a.next((m) => m.t === 'state' && m.state.phase === 'vote');
    const raw = JSON.stringify(q);
    expect(q.state.round.prompt.length).toBeGreaterThan(0);
    expect(raw).not.toMatch(/"answer"|"a":|"rv"/);
    expect(q.state.reveal).toBeNull();

    a.send({ t: 'vote', choice: 'real' });
    a.send({ t: 'vote', choice: 'nonsense' });
    const mid = await host.next((m) => m.t === 'state' && m.state.players.find((p: any) => p.id === 'pa')?.voted);
    expect(mid.state.votes).toBeNull();
    b.send({ t: 'vote', choice: 'fake' });
    // everyone online voted → the server reveals by itself
    const rev = await b.next((m) => m.t === 'state' && m.state.phase === 'reveal');
    const ans = rev.state.reveal.answer;
    expect(['real', 'fake']).toContain(ans);
    expect(rev.state.votes).toEqual({ pa: 'real', pb: 'fake' });
    const winner = ans === 'real' ? 'pa' : 'pb';
    expect(rev.state.players.find((p: any) => p.id === winner).score).toBe(1);

    a.ws.close();
    const a2 = client('pa');
    await a2.open;
    a2.send({ t: 'join', code });
    const back = await a2.next((m) => m.t === 'state');
    expect(back.state.players.find((p: any) => p.id === 'pa')).toMatchObject({ score: winner === 'pa' ? 1 : 0, online: true });
    for (const c of [host, a2, b]) c.ws.close();
  });

  it('a timed round carries a deadline that clears on reveal', async () => {
    const host = client('host2');
    await host.open;
    host.send({ t: 'create', settings: { gameIds: ['israel-bidur'], timer: 15 } });
    const code = (await host.next((m) => m.t === 'joined')).code as string;
    const a = client('pc');
    await a.open;
    a.send({ t: 'join', code, name: 'גימל' });
    await a.next((m) => m.t === 'joined');
    const srv = (globalThis as any).__srv;
    host.send({ t: 'next' });
    const q = await host.next((m) => m.t === 'state' && m.state.phase === 'vote');
    expect(q.state.deadline).toBeGreaterThan(Date.now());
    // fast-forward: fire the room's timer early
    const room = srv.rooms.get(code);
    clearTimeout(room.timer);
    room.timer = setTimeout(() => {}, 0);
    host.send({ t: 'reveal' });
    const rev = await host.next((m) => m.t === 'state' && m.state.phase === 'reveal');
    expect(rev.state.deadline).toBeNull();
    for (const c of [host, a]) c.ws.close();
  });
});

describe('self-hosted store', () => {
  it('stores profiles, players and answers', async () => {
    const base = `http://localhost:${port}/api/store`;
    const put = (p: string, body: unknown) => fetch(`${base}/${p}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await put('profile/cabc12345', { coins: 5 })).status).toBe(200);
    expect(await (await fetch(`${base}/profile/cabc12345`)).json()).toEqual({ coins: 5 });
    await put('players/cabc12345', { name: 'א', days: {} });
    await put('crowd/cabc12345', { a: { q1: 'real' } });
    expect(await (await fetch(`${base}/players`)).json()).toEqual([{ name: 'א', days: {}, id: 'cabc12345' }]);
    expect(await (await fetch(`${base}/crowd`)).json()).toEqual([{ a: { q1: 'real' }, id: 'cabc12345' }]);
    expect((await put('players/a%2Fb', {})).status).toBe(400);
    expect((await put('players/ok-id-1', [1, 2])).status).toBe(400);
    expect((await fetch(`${base}/profile`)).status).toBe(400);
  });
});
