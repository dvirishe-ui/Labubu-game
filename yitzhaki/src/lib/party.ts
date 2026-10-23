import { useCallback, useEffect, useRef, useState } from 'react';
import { load, save } from './storage';

export interface PartyPlayer {
  id: string;
  name: string;
  score: number;
  online: boolean;
  voted: boolean;
}

export interface PartyState {
  code: string;
  hostId: string;
  phase: 'lobby' | 'vote' | 'reveal' | 'ended';
  round: { id: string; prompt: string; options: Record<string, string>; game: string; engine: string } | null;
  players: PartyPlayer[];
  votes: Record<string, string> | null;
  reveal: { answer: string | null; note: string | null } | null;
  index: number;
}

export const ERRORS: Record<string, string> = {
  no_room: 'לא מצאנו חדר עם הקוד הזה.',
  no_name: 'צריך שם.',
  name_taken: 'השם הזה כבר תפוס בחדר.',
  room_full: 'החדר מלא.',
  host_only: 'רק המנחה יכול לעשות את זה.'
};

export function clientId(): string {
  let id = load<string | null>('clientId', null);
  if (!id) {
    id = 'c' + Math.random().toString(36).slice(2, 12);
    save('clientId', id);
  }
  return id;
}

export async function partyAvailable(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch('./api/health', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    return r.ok && (await r.json()).party === true;
  } catch {
    return false;
  }
}

/** WebSocket connection with automatic reconnect + re-join. */
export function useParty() {
  const [state, setState] = useState<PartyState | null>(null);
  const [role, setRole] = useState<'host' | 'player' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const joinMsg = useRef<Record<string, unknown> | null>(load('party.join', null));
  const id = clientId();

  const send = useCallback((o: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ ...o, clientId: id }));
  }, [id]);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${location.pathname.replace(/[^/]*$/, '')}ws`;
      const sock = new WebSocket(url);
      ws.current = sock;
      sock.onopen = () => {
        retry = 0;
        setConnected(true);
        if (joinMsg.current) sock.send(JSON.stringify({ ...joinMsg.current, clientId: id }));
      };
      sock.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === 'state') {
          setState(m.state);
          if (m.state.phase === 'ended') {
            joinMsg.current = null;
            save('party.join', null);
          }
        } else if (m.t === 'joined') {
          setRole(m.role);
          setError(null);
          joinMsg.current = { t: 'join', code: m.code, name: joinMsg.current?.name };
          save('party.join', joinMsg.current);
        } else if (m.t === 'error') {
          setError(ERRORS[m.error] ?? m.error);
          if (m.error === 'no_room') {
            joinMsg.current = null;
            save('party.join', null);
          }
        }
      };
      sock.onclose = () => {
        setConnected(false);
        if (!closed) timer = setTimeout(connect, Math.min(8000, 500 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws.current?.close();
    };
  }, [id]);

  const create = () => {
    joinMsg.current = null;
    send({ t: 'create' });
  };
  const join = (code: string, name: string) => {
    joinMsg.current = { t: 'join', code: code.trim().toUpperCase(), name: name.trim() };
    send(joinMsg.current);
  };
  const leave = () => {
    joinMsg.current = null;
    save('party.join', null);
    setState(null);
    setRole(null);
  };
  return { state, role, error, connected, send, create, join, leave, id };
}
