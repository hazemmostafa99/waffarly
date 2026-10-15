import '@waffarly/ui/theme.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { LocaleProvider } from '@waffarly/ui';
import { router } from './routes.js';
import './style.css';
import './dashboard.css';
import '@waffarly/ui/dashboard-components.css';
import './products.css';
import './features/catalog/product-builder/product-builder.css';
import './categories.css';
import './features/inventory/inventory.css';
import './media.css';
import './discounts.css';
import './orders.css';
import './branches.css';
import '@waffarly/ui/storefront-design.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  </React.StrictMode>,
);
