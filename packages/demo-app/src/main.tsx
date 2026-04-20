import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './index.css';

if (import.meta.env.DEV) {
  // The preview agent is only for dev — it auto-inits on import.
  void import('@product/preview-agent/auto');
}

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
