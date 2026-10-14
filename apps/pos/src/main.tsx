import '@waffarly/ui/theme.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { LocaleProvider, WorkspaceChrome } from '@waffarly/ui';
import { router } from './routes.js';
import './style.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <LocaleProvider>
      <WorkspaceChrome>
        <RouterProvider router={router} />
      </WorkspaceChrome>
    </LocaleProvider>
  </React.StrictMode>,
);