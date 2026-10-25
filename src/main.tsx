import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { MobilePartyController, parsePartyUrlQuery } from './multiplayer';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element in index.html');
}

const partyQuery = parsePartyUrlQuery(window.location.search);

createRoot(rootEl).render(
  <React.StrictMode>
    {partyQuery.isPartyController ? (
      <MobilePartyController roomCode={partyQuery.roomCode} />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
