import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
// @ts-expect-error plain .mjs server module
import { createPartyServer } from '../server/party-server.mjs';

let port = 0;
let srv: { server: import('node:http').Server };

beforeAll(async () => {
  srv = createPartyServer();
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

  it('host publishes, players vote secretly, reveal scores, reconnect keeps score', async () => {
    const host = client('host');
    await host.open;
    host.send({ t: 'create' });
    const joined = await host.next((m) => m.t === 'joined');
    const code = joined.code as string;

    const a = client('pa');
    const b = client('pb');
    await Promise.all([a.open, b.open]);
    a.send({ t: 'join', code, name: 'אלף' });
    b.send({ t: 'join', code, name: 'אלף' });
    expect((await b.next((m) => m.t === 'error')).error).toBe('name_taken');
    b.send({ t: 'join', code, name: 'בית' });
    await b.next((m) => m.t === 'joined');

    host.send({ t: 'publish', round: { id: 'r1', prompt: 'שאלה ניטרלית', options: { real: 'אמיתי', fake: 'המצאה' }, game: 'בדיקה', engine: 'realfake' } });
    await a.next((m) => m.t === 'state' && m.state.phase === 'vote');
    a.send({ t: 'vote', choice: 'real' });
    b.send({ t: 'vote', choice: 'fake' });
    b.send({ t: 'vote', choice: 'nonsense' });
    const mid = await host.next((m) => m.t === 'state' && m.state.players.every((p: any) => p.voted));
    expect(mid.state.votes).toBeNull();

    a.send({ t: 'reveal', answer: 'real' });
    expect((await a.next((m) => m.t === 'error')).error).toBe('host_only');

    host.send({ t: 'reveal', answer: 'real', note: null });
    const rev = await b.next((m) => m.t === 'state' && m.state.phase === 'reveal');
    expect(rev.state.votes).toEqual({ pa: 'real', pb: 'fake' });
    expect(rev.state.players.find((p: any) => p.id === 'pa').score).toBe(1);

    a.ws.close();
    const a2 = client('pa');
    await a2.open;
    a2.send({ t: 'join', code });
    const back = await a2.next((m) => m.t === 'state');
    expect(back.state.players.find((p: any) => p.id === 'pa')).toMatchObject({ score: 1, online: true });
    for (const c of [host, a2, b]) c.ws.close();
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
