// Dev-only sheet of every character × skin (open /gallery.html with `npm run dev`).
import { createRoot } from 'react-dom/client';
import { Avatar } from './components/Avatar';
import { CHARACTERS, SECRET_CHARACTER, skinsFor } from './lib/characters';
import './styles.css';

// `?big` shows one large classic portrait per character.
const big = location.search.includes('big');

createRoot(document.getElementById('g')!).render(
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${big ? 3 : 5}, ${big ? 300 : 170}px)`, gap: 8, padding: 8 }}>
    {[...CHARACTERS, SECRET_CHARACTER].flatMap((c) =>
      skinsFor(c.id).slice(0, big ? 1 : undefined).map((s) => (
        <div key={s.id} style={{ color: '#ddd', fontSize: 12, textAlign: 'center' }}>
          <Avatar charId={c.id} skinId={s.id} size={big ? 300 : 170} animated={false} />
          {c.name} · {s.name}
        </div>
      ))
    )}
  </div>
);
