import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { WorkspaceChrome } from '@waffarly/ui';
import { RouteLoading } from './app/route-loading.js';
import { Login } from './Login.js';
import { POSLayout } from './POSLayout.js';
import { POSScreen } from './POSScreen.js';
import { POSCatalogScreen } from './features/catalog/pos-catalog-screen.js';
import { PosShiftScreen } from './features/shifts/pos-shift-screen.js';
import { PosDiningScreen } from './features/dining/pos-dining-screen.js';
import { PosReceiptsScreen } from './features/receipts/pos-receipts-screen.js';

export const router = createBrowserRouter([
  ...(import.meta.env.DEV
    ? [
        {
          path: '/prototype',
          hydrateFallbackElement: <RouteLoading />,
          lazy: () => import('./features/prototype/prototype-route.js'),
        },
      ]
    : []),
  {
    element: (
      <WorkspaceChrome>
        <Outlet />
      </WorkspaceChrome>
    ),
    children: [
      { path: '/login', element: <Login /> },
      {
        path: '/',
        element: <POSLayout />,
        children: [
          { index: true, element: <POSScreen /> },
          { path: 'catalog', element: <POSCatalogScreen /> },
          { path: 'dining', element: <PosDiningScreen /> },
          { path: 'receipts', element: <PosReceiptsScreen /> },
          { path: 'shift', element: <PosShiftScreen /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
