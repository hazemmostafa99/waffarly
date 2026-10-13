import '@waffarly/ui/theme.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './style.css';
import '@waffarly/ui/storefront-design.css';
import { LocaleProvider, WorkspaceChrome } from '@waffarly/ui';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <LocaleProvider>
      <WorkspaceChrome>
        <App />
      </WorkspaceChrome>
    </LocaleProvider>
  </React.StrictMode>,
);
