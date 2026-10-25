import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { parsePartyUrlQuery } from './multiplayer/party-client';
import './styles.css';

const LazyApp = lazy(() =>
  import('./App').then((mod) => ({ default: mod.App })),
);

const LazyMobilePartyController = lazy(() =>
  import('./multiplayer/MobilePartyController').then((mod) => ({
    default: mod.MobilePartyController,
  })),
);

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element in index.html');
}

const partyQuery = parsePartyUrlQuery(window.location.search);

createRoot(rootEl).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100vh',
            background: '#050914',
            color: '#3ce8ff',
            fontFamily: 'monospace',
            fontSize: '13px',
            letterSpacing: '0.12em',
          }}
        >
          LOADING MARBLE ARENA...
        </div>
      }
    >
      {partyQuery.isPartyController ? (
        <LazyMobilePartyController roomCode={partyQuery.roomCode} />
      ) : (
        <LazyApp />
      )}
    </Suspense>
  </React.StrictMode>,
);

