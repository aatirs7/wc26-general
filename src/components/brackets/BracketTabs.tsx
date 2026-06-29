'use client';

import { useState } from 'react';

// Toggles the Bracket tab between the viewer's own picks and the live, actual
// bracket. Both views are rendered on the server and handed in as nodes, so the
// switch is instant and keeps each view's own layout. Mirrors the Matches >
// Groups live/picks toggle.
export default function BracketTabs({ picks, live }: { picks: React.ReactNode; live: React.ReactNode }) {
  const [view, setView] = useState<'picks' | 'live'>('picks');
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="flex rounded-full border border-edge bg-white/[0.03] p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setView('picks')}
            className={`rounded-full px-4 py-1.5 transition-colors ${view === 'picks' ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
          >
            My picks
          </button>
          <button
            type="button"
            onClick={() => setView('live')}
            className={`rounded-full px-4 py-1.5 transition-colors ${view === 'live' ? 'bg-live text-white' : 'text-muted'}`}
          >
            Live bracket
          </button>
        </div>
      </div>
      <div className={view === 'picks' ? '' : 'hidden'}>{picks}</div>
      <div className={view === 'live' ? '' : 'hidden'}>{live}</div>
    </div>
  );
}
