import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { WorkspaceChrome } from '@waffarly/ui';
import { RouteLoading } from './app/route-loading.js';
import { Login } from './Login.js';
import { POSLayout } from './POSLayout.js';
import { POSScreen } from './POSScreen.js';

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
        children: [{ index: true, element: <POSScreen /> }],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
