import '@waffarly/ui/theme.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { LocaleProvider } from '@waffarly/ui';
import { queryClient } from './app/query-client.js';
import { router } from './routes.js';
import './style.css';
import '@waffarly/ui/storefront-design.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <RouterProvider router={router} />
      </LocaleProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
