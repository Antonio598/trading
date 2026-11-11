import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { listenForInstall } from './lib/install';
import './index.css';

listenForInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
