import React from 'react';
import { createRoot } from 'react-dom/client';
import { MobilePartyController } from './multiplayer/MobilePartyController';
import { parsePartyUrlQuery } from './multiplayer/party-client';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element in index.html');
}

const partyQuery = parsePartyUrlQuery(window.location.search);
const root = createRoot(rootEl);

const loading = (
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
);

if (partyQuery.isPartyController) {
  // Phone path: this entry, the React vendor chunk, and one CSS file.
  // The stage bundle (WebGPU, QR, Google fonts) stays out of this request.
  root.render(
    <React.StrictMode>
      <MobilePartyController roomCode={partyQuery.roomCode} />
    </React.StrictMode>,
  );
} else {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://fonts.googleapis.com';
  const preconnectStatic = document.createElement('link');
  preconnectStatic.rel = 'preconnect';
  preconnectStatic.href = 'https://fonts.gstatic.com';
  preconnectStatic.crossOrigin = 'anonymous';
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href =
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Orbitron:wght@600;800;900&family=Space+Grotesk:wght@500;600;700&display=swap';
  document.head.append(preconnect, preconnectStatic, fonts);

  root.render(<React.StrictMode>{loading}</React.StrictMode>);
  void import('./App').then(({ App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
}
