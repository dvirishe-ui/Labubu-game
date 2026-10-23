// Dev-only sheet of every character × skin (open /gallery.html with `npm run dev`).
import { createRoot } from 'react-dom/client';
import { Avatar } from './components/Avatar';
import { CHARACTERS, skinsFor } from './lib/characters';
import './styles.css';

createRoot(document.getElementById('g')!).render(
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 170px)', gap: 8, padding: 8 }}>
    {CHARACTERS.flatMap((c) =>
      skinsFor(c.id).map((s) => (
        <div key={s.id} style={{ color: '#ddd', fontSize: 12, textAlign: 'center' }}>
          <Avatar charId={c.id} skinId={s.id} size={170} animated={false} />
          {c.name} · {s.name}
        </div>
      ))
    )}
  </div>
);
