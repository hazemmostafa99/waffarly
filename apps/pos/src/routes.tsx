import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteLoading } from './app/route-loading.js';
import { Login } from './Login.js';
import { POSLayout } from './POSLayout.js';
import { POSScreen } from './POSScreen.js';
import { POSCatalogScreen } from './features/catalog/pos-catalog-screen.js';
import { PosShiftScreen } from './features/shifts/pos-shift-screen.js';
import { PosDeliveryScreen } from './features/delivery/pos-delivery-screen.js';
import { PosDiningScreen } from './features/dining/pos-dining-screen.js';
import {
  ActivityAccess,
  EmployeeAccess,
  EmployeeAccessNotice,
  PosHomeRoute,
} from './features/auth/employee-access.js';
import { EmployeeInventoryScreen } from './features/inventory/employee-inventory-screen.js';
import { PosOrdersScreen } from './features/receipts/pos-receipts-screen.js';

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
        path: 'deliveries',
        element: (
          <ActivityAccess feature="delivery">
            <EmployeeAccess permission="sell">
              <PosDeliveryScreen />
            </EmployeeAccess>
          </ActivityAccess>
        ),
      },
      {
        index: true,
        element: <PosHomeRoute />,
      },
      {
        path: 'kitchen',
        element: (
          <ActivityAccess feature="kitchen">
            <EmployeeAccess permission="view_orders">
              <POSScreen />
            </EmployeeAccess>
          </ActivityAccess>
        ),
      },
      {
        path: 'orders',
        element: (
          <EmployeeAccess permission="view_receipts">
            <PosOrdersScreen />
          </EmployeeAccess>
        ),
      },
      { path: 'receipts', element: <Navigate to="/orders" replace /> },
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
          <ActivityAccess feature="diningTables">
            <EmployeeAccess permission="sell">
              <PosDiningScreen />
            </EmployeeAccess>
          </ActivityAccess>
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
