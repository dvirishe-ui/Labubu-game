import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Modal } from './components/ui';
import { loadOverrides, resolveDeck, type AdminOverrides } from './lib/deck';
import { partyAvailable } from './lib/party';
import { createSession, loadSession, rematch, saveSession, type Session } from './lib/session';
import { load, save } from './lib/storage';
import Home from './screens/Home';
import Setup, { type SetupPreset } from './screens/Setup';
import Play from './screens/Play';
import Results from './screens/Results';

const Notes = lazy(() => import('./screens/Notes'));
const Party = lazy(() => import('./screens/Party'));
const Admin = lazy(() => import('./screens/Admin'));

type View = { name: 'home' } | { name: 'setup'; preset: SetupPreset } | { name: 'play' } | { name: 'results' } | { name: 'notes' } | { name: 'party' } | { name: 'admin' };

export default function App() {
  const [overrides, setOverrides] = useState<AdminOverrides>(loadOverrides);
  const { games, rounds } = useMemo(() => resolveDeck(overrides), [overrides]);
  const [view, setView] = useState<View>(() => (new URLSearchParams(location.search).get('room') ? { name: 'party' } : { name: 'home' }));
  const [session, setSession] = useState<Session | null>(loadSession);
  const [mature, setMature] = useState(() => load<boolean>('mature', false));
  const [gate, setGate] = useState(false);
  const [party, setParty] = useState(false);

  useEffect(() => {
    partyAvailable().then(setParty);
  }, []);
  useEffect(() => {
    save('mature', mature);
  }, [mature]);
  useEffect(() => {
    if (view.name === 'play' || view.name === 'home') saveSession(session && session.index < session.roundIds.length ? session : null);
  }, [session, view.name]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.name]);

  const toggleMature = () => (mature ? setMature(false) : setGate(true));
  const go = (v: View) => setView(v);

  let screen: JSX.Element;
  switch (view.name) {
    case 'setup':
      screen = (
        <Setup
          games={games}
          rounds={rounds}
          preset={view.preset}
          mature={mature}
          onNeedMature={toggleMature}
          onBack={() => go({ name: 'home' })}
          onStart={(c) => {
            setSession(createSession(c, rounds));
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
            go({ name: 'results' });
          }}
          onExit={() => go({ name: 'home' })}
        />
      ) : (
        <></>
      );
      break;
    case 'results':
      screen = session ? (
        <Results
          session={session}
          onAgain={() => {
            setSession(rematch(session, rounds));
            go({ name: 'play' });
          }}
          onHome={() => {
            setSession(null);
            go({ name: 'home' });
          }}
        />
      ) : (
        <></>
      );
      break;
    case 'notes':
      screen = <Notes onBack={() => go({ name: 'home' })} />;
      break;
    case 'party':
      screen = <Party games={games} rounds={rounds} mature={mature} onBack={() => {
            try {
              history.replaceState(null, '', location.pathname);
            } catch {
              /* sandboxed viewer */
            }
            go({ name: 'home' });
          }} />;
      break;
    case 'admin':
      screen = <Admin overrides={overrides} onChange={setOverrides} onBack={() => go({ name: 'home' })} />;
      break;
    default:
      screen = (
        <Home
          games={games}
          mature={mature}
          resume={session && session.index < session.roundIds.length ? session : null}
          partyAvailable={party}
          onPlay={(preset) => go({ name: 'setup', preset })}
          onResume={() => go({ name: 'play' })}
          onNotes={() => go({ name: 'notes' })}
          onParty={() => go({ name: 'party' })}
          onAdmin={() => go({ name: 'admin' })}
          onMature={toggleMature}
        />
      );
  }

  return (
    <>
      <Suspense fallback={<div className="min-h-[100dvh]" />}>{screen}</Suspense>
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
