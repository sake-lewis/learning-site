import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
import { App } from './app/App.tsx';
import { purgeExpiredTakes } from './app/retention.ts';
import { loadSettings } from './app/settings.ts';
import './ui/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Expired generations are removed before the first render, so the history never lists them.
void Promise.all([loadSettings(), purgeExpiredTakes().catch(() => 0)]).finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
