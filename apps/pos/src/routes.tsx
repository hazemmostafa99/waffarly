import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteLoading } from './app/route-loading.js';
import { Login } from './Login.js';
import { POSLayout } from './POSLayout.js';
import { POSScreen } from './POSScreen.js';
import { POSCatalogScreen } from './features/catalog/pos-catalog-screen.js';
import { PosShiftScreen } from './features/shifts/pos-shift-screen.js';
import { PosDiningScreen } from './features/dining/pos-dining-screen.js';
import { PosReceiptsScreen } from './features/receipts/pos-receipts-screen.js';
import { EmployeeAccess, EmployeeAccessNotice } from './features/auth/employee-access.js';
import { EmployeeInventoryScreen } from './features/inventory/employee-inventory-screen.js';

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
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <POSLayout />,
    children: [
      {
        index: true,
        element: (
          <EmployeeAccess permission="view_orders">
            <POSScreen />
          </EmployeeAccess>
        ),
      },
      {
        path: 'catalog',
        element: (
          <EmployeeAccess permission="sell">
            <POSCatalogScreen />
          </EmployeeAccess>
        ),
      },
      {
        path: 'dining',
        element: (
          <EmployeeAccess permission="sell">
            <PosDiningScreen />
          </EmployeeAccess>
        ),
      },
      {
        path: 'receipts',
        element: (
          <EmployeeAccess permission="view_receipts">
            <PosReceiptsScreen />
          </EmployeeAccess>
        ),
      },
      {
        path: 'shift',
        element: (
          <EmployeeAccess permission="open_register_shift">
            <PosShiftScreen />
          </EmployeeAccess>
        ),
      },
      {
        path: 'inventory',
        element: (
          <EmployeeAccess permission="view_inventory">
            <EmployeeInventoryScreen />
          </EmployeeAccess>
        ),
      },
      { path: 'access', element: <EmployeeAccessNotice /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
