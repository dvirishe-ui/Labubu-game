import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { NameSheet } from './components/Profile';
import { Toasts } from './components/Toasts';
import { Modal } from './components/ui';
import { parseDuelHash } from './lib/challenges';
import { loadOverrides, resolveDeck, type AdminOverrides } from './lib/deck';
import { bumpStats, finishGame, finishPartyNight, type RewardEvent } from './lib/economy';
import { partyAvailable } from './lib/party';
import { buildRecap } from './lib/recap';
import { createSession, loadSession, rematch, saveSession, type Session } from './lib/session';
import { load, save } from './lib/storage';
import { profileStore, useProfile } from './lib/store';
import Home, { type Nav } from './screens/Home';
import Setup, { type SetupPreset } from './screens/Setup';
import Play from './screens/Play';
import Results from './screens/Results';

const Notes = lazy(() => import('./screens/Notes'));
const Party = lazy(() => import('./screens/Party'));
const Admin = lazy(() => import('./screens/Admin'));
const Solo = lazy(() => import('./screens/Solo'));
const Daily = lazy(() => import('./screens/Daily'));
const Duel = lazy(() => import('./screens/Duel'));
const Shop = lazy(() => import('./screens/Shop'));
const Collection = lazy(() => import('./screens/Collection'));
const Friends = lazy(() => import('./screens/Friends'));
const TimeMachine = lazy(() => import('./screens/TimeMachine'));

type View =
  | { name: 'home' }
  | { name: 'setup'; preset: SetupPreset; back: 'home' | 'friends' }
  | { name: 'play' }
  | { name: 'results'; rewards: RewardEvent[] }
  | { name: 'duel'; initial: { code: string; score: number | null } | null }
  | { name: Exclude<Nav, 'night'> };

function initialView(): View {
  try {
    if (new URLSearchParams(location.search).get('room')) return { name: 'party' };
    const duel = parseDuelHash(location.hash);
    if (duel) return { name: 'duel', initial: duel };
  } catch {
    /* sandboxed */
  }
  return { name: 'home' };
}

/** Coins and stats for a finished one-phone game, credited to this device's profile (first participant). */
function settleSession(s: Session): RewardEvent[] {
  const owner = s.participants[0]?.id;
  const recap = buildRecap(s);
  const played = s.log.filter((l) => !l.skipped).length;
  const factual = s.log.filter((l) => l.meta.answeredBy?.includes(owner));
  const perfect = factual.length >= 5 && factual.every((l) => l.meta.correct?.includes(owner));
  const events: RewardEvent[] = [];
  const r = profileStore.apply((p) => finishGame(p, { sessionId: s.id, answered: played, durationMs: Date.now() - s.startedAt, won: recap.winners.includes(owner) && s.participants.length > 1, perfect }));
  events.push(...r.events);
  const fooled = s.log.reduce((n, l) => n + (l.meta.fooled?.[owner] ?? 0), 0);
  if (fooled) events.push(...profileStore.apply((p) => bumpStats(p, { bluffWins: fooled })).events);
  if (s.config.minutes && played >= 5) events.push(...profileStore.apply((p) => finishPartyNight(p, s.id)).events);
  return events;
}

export default function App() {
  const profile = useProfile();
  const [overrides, setOverrides] = useState<AdminOverrides>(loadOverrides);
  const { games, rounds } = useMemo(() => resolveDeck(overrides), [overrides]);
  const [view, setView] = useState<View>(initialView);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [mature, setMature] = useState(() => load<boolean>('mature', false));
  const [gate, setGate] = useState(false);
  const [party, setParty] = useState(false);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    partyAvailable().then(setParty);
    profileStore.init().then(() => setWelcome(!profileStore.get().profile.name));
  }, []);
  useEffect(() => {
    save('mature', mature);
  }, [mature]);
  useEffect(() => {
    if (view.name === 'play' || view.name === 'home') saveSession(session && session.index < session.steps.length ? session : null);
  }, [session, view.name]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.name]);

  const toggleMature = () => (mature ? setMature(false) : setGate(true));
  const go = (v: View) => setView(v);
  const home = () => go({ name: 'home' });
  const nav = (n: Nav) => (n === 'night' ? go({ name: 'setup', preset: { minutes: 20 }, back: 'home' }) : go({ name: n } as View));
  const clearHash = () => {
    try {
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* sandboxed viewer */
    }
  };

  let screen: JSX.Element;
  switch (view.name) {
    case 'setup':
      screen = (
        <Setup
          key={JSON.stringify(view.preset)}
          games={games}
          rounds={rounds}
          preset={view.preset}
          mature={mature}
          onNeedMature={toggleMature}
          onBack={() => go({ name: view.back } as View)}
          onStart={(c) => {
            setSession(createSession(c, games, rounds));
            go({ name: 'play' });
          }}
        />
      );
      break;
    case 'play':
      screen = session ? (
        <Play
          session={session}
          games={games}
          rounds={rounds}
          onUpdate={setSession}
          onFinish={(s) => {
            setSession(s);
            saveSession(null);
            go({ name: 'results', rewards: settleSession(s) });
          }}
          onExit={home}
        />
      ) : (
        <></>
      );
      break;
    case 'results':
      screen = session ? (
        <Results
          session={session}
          rewards={view.rewards}
          onAgain={() => {
            setSession(rematch(session, games, rounds));
            go({ name: 'play' });
          }}
          onHome={() => {
            setSession(null);
            home();
          }}
        />
      ) : (
        <></>
      );
      break;
    case 'notes':
      screen = <Notes onBack={home} />;
      break;
    case 'party':
      screen = (
        <Party
          games={games}
          rounds={rounds}
          mature={mature}
          onBack={() => {
            try {
              history.replaceState(null, '', location.pathname);
            } catch {
              /* sandboxed viewer */
            }
            home();
          }}
        />
      );
      break;
    case 'admin':
      screen = <Admin overrides={overrides} onChange={setOverrides} onBack={home} />;
      break;
    case 'solo':
      screen = <Solo games={games} rounds={rounds} mature={mature} onBack={home} />;
      break;
    case 'daily':
      screen = <Daily games={games} rounds={rounds} onBack={home} onDuel={() => go({ name: 'duel', initial: null })} />;
      break;
    case 'duel':
      screen = (
        <Duel
          games={games}
          rounds={rounds}
          initial={view.initial}
          onBack={() => {
            clearHash();
            home();
          }}
        />
      );
      break;
    case 'shop':
      screen = <Shop onBack={home} />;
      break;
    case 'collection':
      screen = <Collection onBack={home} onShop={() => go({ name: 'shop' })} />;
      break;
    case 'timemachine':
      screen = <TimeMachine onBack={home} />;
      break;
    case 'friends':
      screen = <Friends partyAvailable={party} onBack={home} onNav={nav} onDuel={() => go({ name: 'duel', initial: null })} onPlay={(preset) => go({ name: 'setup', preset, back: 'friends' })} />;
      break;
    default:
      screen = (
        <Home
          games={games}
          mature={mature}
          resume={session && session.index < session.steps.length ? session : null}
          partyAvailable={party}
          onPlay={(preset) => go({ name: 'setup', preset, back: 'home' })}
          onResume={() => go({ name: 'play' })}
          onNav={nav}
          onMature={toggleMature}
        />
      );
  }

  return (
    <>
      <Suspense fallback={<div className="min-h-fill" />}>{screen}</Suspense>
      <Toasts />
      <NameSheet open={welcome && view.name === 'home' && !profile.name} onClose={() => setWelcome(false)} />
      <Modal open={gate} onClose={() => setGate(false)} title="תוכן למבוגרים">
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">חלק מהפינות כוללות שפה בוטה, הומור מיני ותוכן למבוגרים בלבד. מצב 18+ חושף אותן.</p>
          <p className="text-ink-400">יש להפעיל רק אם כל מי שמשחק בן/בת 18 ומעלה.</p>
          <button
            className="btn-cherry w-full"
            onClick={() => {
              setMature(true);
              setGate(false);
            }}
          >
            כולם פה 18+ — להפעיל
          </button>
          <button className="btn-ghost w-full" onClick={() => setGate(false)}>
            לא עכשיו
          </button>
        </div>
      </Modal>
    </>
  );
}
