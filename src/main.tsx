// Adapted from math-tank src/main.tsx.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import './app/styles.css';
import { swUpdate } from './app/swUpdate';
import { requestPersistentStorage } from './core/storage/storage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root is missing from index.html');
}

// The service worker precaches the game for offline play; a new version waits for the start screen (FR-046).
swUpdate.install(registerSW);

// Ask once on start that the browser keeps the stored data when space runs low (FR-036).
void requestPersistentStorage(navigator.storage);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
